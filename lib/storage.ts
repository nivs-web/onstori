import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export async function put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<{ key: string }> {
  const env = r2Env();
  if (env) {
    await client(env).send(
      new PutObjectCommand({ Bucket: r2Bucket(env, bucket), Key: key, Body: body, ContentType: contentType })
    );
    return { key };
  }
  const { bucket: sbBucket, path } = split(key);
  const { error } = await sbAdmin().storage.from(sbBucket).upload(path, body, { contentType });
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
