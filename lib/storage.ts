import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sbAdmin } from "./db-admin";

/**
 * 파일 저장소 단일 창구 — 앱 코드는 "어느 저장소인지" 모른다.
 * docs/specs/storage-r2.md · DECISIONS 2026-09-03 참조.
 *
 * 이미지·사진은 Cloudflare R2, DB·Auth·RLS 는 Supabase 유지. 이유: Supabase 는 전송량 과금
 * (Free 5GB/월, Pro 도 250GB 후 $0.09/GB)인데 R2 는 저장만 과금하고 전송이 무료다.
 *
 * 키 규칙 = `{버킷}/{경로}` — Supabase 시절 경로를 그대로 이어받는다.
 *   uploads/{slug}/{uuid}.webp · bank/{industry}/{mood}/{role}/{uuid}.webp · (비공개) inquiries/{siteId}/{uuid}.webp
 * 첫 segment 가 곧 Supabase 버킷명이라 폴백이 1:1 이고, R2-2 백필도 1:1 복사 +
 * URL prefix 교체로 끝난다(스펙 4장). 그래서 키에 버킷명을 포함시킨다.
 *
 * R2 env 6개가 전부 있으면 R2, 하나라도 없으면 **Supabase Storage 폴백**(기존 동작) —
 * 로컬·CI 에서 R2 자격증명 없이도 그대로 돈다.
 */

export type Bucket = "media" | "private";

type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  media: string;
  private: string;
  publicBase: string;
};

function r2Env(): R2Env | null {
  const e = {
    accountId: process.env.R2_ACCOUNT_ID?.trim(),
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim(),
    media: process.env.R2_BUCKET_MEDIA?.trim(),
    private: process.env.R2_BUCKET_PRIVATE?.trim(),
    // 뒤 슬래시가 붙어 오면 URL 이 `//` 로 조립된다
    publicBase: process.env.R2_PUBLIC_BASE?.trim().replace(/\/+$/, ""),
  };
  if (!e.accountId || !e.accessKeyId || !e.secretAccessKey || !e.media || !e.private || !e.publicBase) return null;
  return e as R2Env;
}

/** 진단·로그용 — 지금 어느 저장소로 도는지 */
export function storageMode(): "r2" | "supabase" {
  return r2Env() ? "r2" : "supabase";
}

let clientCache: S3Client | null = null;
function client(env: R2Env): S3Client {
  if (clientCache) return clientCache;
  clientCache = new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
  });
  return clientCache;
}

function r2Bucket(env: R2Env, bucket: Bucket): string {
  return bucket === "media" ? env.media : env.private;
}

/** 키 첫 segment = Supabase 버킷명. 폴백에서 그대로 쪼개 쓴다. */
function split(key: string): { bucket: string; path: string } {
  const i = key.indexOf("/");
  if (i <= 0 || i === key.length - 1) throw new Error(`storage: 키는 "{버킷}/{경로}" 형식이어야 한다 — ${key}`);
  return { bucket: key.slice(0, i), path: key.slice(i + 1) };
}

/**
 * 이미지·영상 캐시 정책 — 1년 · immutable.
 * 키가 UUID 라서 **같은 주소의 내용이 바뀌는 일이 없다.** 파일을 바꾸면 새 UUID 가 나온다.
 * 그래서 브라우저·CDN 이 다시 물어볼 필요가 전혀 없다 (docs/PERFORMANCE.md).
 * 이게 없으면 R2 기본값으로 나가 손님이 올 때마다 사진을 재검증한다.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";

export async function put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<{ key: string }> {
  const env = r2Env();
  if (env) {
    await client(env).send(
      new PutObjectCommand({
        Bucket: r2Bucket(env, bucket), Key: key, Body: body, ContentType: contentType,
        CacheControl: IMMUTABLE,
      })
    );
    return { key };
  }
  const { bucket: sbBucket, path } = split(key);
  // Supabase 는 초 단위 문자열만 받는다 — immutable 지시어는 지원하지 않는다
  const { error } = await sbAdmin().storage.from(sbBucket).upload(path, body, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return { key };
}

/** 공개 URL — media 전용. 비공개 파일은 signedGetUrl 을 쓴다. */
export function publicUrl(key: string): string {
  const env = r2Env();
  if (env) return `${env.publicBase}/${key}`;
  const { bucket, path } = split(key);
  return sbAdmin().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** 비공개 파일 열람용 서명 URL(기본 10분) */
export async function signedGetUrl(key: string, expiresSec = 600): Promise<string> {
  const env = r2Env();
  if (env) {
    return getSignedUrl(client(env), new GetObjectCommand({ Bucket: env.private, Key: key }), { expiresIn: expiresSec });
  }
  const { bucket, path } = split(key);
  const { data, error } = await sbAdmin().storage.from(bucket).createSignedUrl(path, expiresSec);
  if (error || !data) throw new Error(error?.message ?? "서명 URL 발급 실패");
  return data.signedUrl;
}

/**
 * 브라우저 직접 업로드용 서명 PUT URL (R2 전용, 기본 10분) — 60초 녹화 영상은 Vercel 함수 본문 한도(4.5MB)를 넘으므로
 * 브라우저 → R2 로 바로 올린다 (기획1 /mainplan #rec). R2 env 가 없으면 null → 호출측이 서버 경유 폴백을 쓴다.
 */
export async function signedPutUrl(bucket: Bucket, key: string, contentType: string, expiresSec = 600): Promise<string | null> {
  const env = r2Env();
  if (!env) return null;
  // ⚠ 여기에는 CacheControl 을 넣지 않는다. 서명 URL 에 넣으면 그 헤더가 **서명에 포함**돼
  //   브라우저가 똑같은 Cache-Control 헤더를 같이 보내야만 업로드가 성공한다(안 보내면 403).
  //   녹화 영상은 한 번 보고 마는 파일이라 1년 캐시의 이득도 작다.
  return getSignedUrl(client(env), new PutObjectCommand({ Bucket: r2Bucket(env, bucket), Key: key, ContentType: contentType }), { expiresIn: expiresSec });
}

export async function remove(bucket: Bucket, key: string): Promise<void> {
  const env = r2Env();
  if (env) {
    await client(env).send(new DeleteObjectCommand({ Bucket: r2Bucket(env, bucket), Key: key }));
    return;
  }
  const { bucket: sbBucket, path } = split(key);
  const { error } = await sbAdmin().storage.from(sbBucket).remove([path]);
  if (error) throw new Error(error.message);
}

/**
 * prefix 로 시작하는 키를 전부 나열한다. (예: "uploads/my-shop/")
 * 사이트 자동 삭제에서 쓴다 — DB 에 URL 이 남아 있지 않은 파일까지 확실히 지우기 위해서다.
 * 페이지네이션을 끝까지 따라간다. 안전장치로 최대 5,000개에서 멈춘다(그 이상이면 호출부가 다시 부른다).
 */
export async function listPrefix(bucket: Bucket, prefix: string): Promise<string[]> {
  const env = r2Env();
  const keys: string[] = [];
  if (env) {
    let token: string | undefined;
    do {
      const r = await client(env).send(
        new ListObjectsV2Command({ Bucket: r2Bucket(env, bucket), Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 })
      );
      for (const o of r.Contents ?? []) if (o.Key) keys.push(o.Key);
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token && keys.length < 5000);
    return keys;
  }
  // Supabase 폴백 — prefix 는 "{버킷}/{경로}" 형식이라 첫 segment 를 버킷으로 쪼갠다
  const { bucket: sbBucket, path } = split(prefix.replace(/\/+$/, "") + "/x");
  const dir = path.replace(/\/x$/, "");
  const { data, error } = await sbAdmin().storage.from(sbBucket).list(dir, { limit: 1000 });
  if (error) throw new Error(error.message);
  for (const f of data ?? []) keys.push(`${sbBucket}/${dir}/${f.name}`);
  return keys;
}

/**
 * prefix 아래 파일을 전부 지우고 지운 개수를 준다.
 * ⚠ 되돌릴 수 없다. 호출부가 삭제 대상을 정확히 좁혔는지 먼저 확인할 것.
 * 개별 실패는 삼키고 계속한다 — 하나 때문에 멈추면 파일이 반만 남는다.
 */
export async function removePrefix(bucket: Bucket, prefix: string): Promise<number> {
  const keys = await listPrefix(bucket, prefix);
  let n = 0;
  for (const key of keys) {
    try {
      await remove(bucket, key);
      n++;
    } catch (e) {
      console.error(JSON.stringify({ evt: "storage_remove_failed", key, err: String(e).slice(0, 200) }));
    }
  }
  return n;
}
