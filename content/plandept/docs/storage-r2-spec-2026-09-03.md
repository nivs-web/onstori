# 이미지 저장소 — Cloudflare R2 이전 스펙 (2026-09-03)

## 0. 결정

- DB · Auth · RLS · Realtime → **Supabase 유지**
- 이미지뱅크 · 사이트 사진 · 스토리 사진 · 견적 첨부 사진 · (추후) 히어로 영상 → **Cloudflare R2**
- 이유: Supabase Free는 파일 1GB · 전송량(egress) 5GB/월, Pro($25)도 100GB · 250GB/월 뒤 $0.09/GB. R2는 저장 10GB 무료·이후 $0.015/GB-월, **전송량 무료**. 사진·영상이 늘고 방문이 몰릴수록 차이가 커진다.
- 원칙: 앱 코드는 "어느 저장소인지"를 모른다. `lib/storage.ts` 한 곳만 안다.

## 1. 단계 (두 번으로 나눈다)

| 단계 | 내용 | 시점 |
|---|---|---|
| **R2-1** | 저장 계층 추상화 + **신규 업로드 전부 R2** + 공개 도메인 | 견적 접수(G1) **전** |
| **R2-2** | 기존 이미지뱅크 638장·업로드 사진 R2로 복사 + DB URL 일괄 치환 + Supabase Storage 정리 | 견적 접수 라이브 후 |

R2-1을 먼저 하는 이유: G1의 견적 첨부 사진이 저장소를 쓴다. 추상화가 먼저 있으면 G1은 `storage.put()` 한 줄이고, 나중에 다시 고칠 일이 없다.

## 2. 사전 준비 (사람)

1. Cloudflare 계정 → **onstori.com 을 Cloudflare 존(zone)으로 추가** → 등록기관(도메인 산 곳)에서 네임서버를 Cloudflare 것으로 변경. Vercel 용 레코드(A/CNAME)는 그대로 옮기되 **DNS only(회색 구름)** 로 둔다 — Vercel 앞에 Cloudflare 프록시를 두지 않는다.
2. R2 버킷 2개: `onstori-media`(공개 — 뱅크·사이트·스토리 사진), `onstori-private`(비공개 — 견적 첨부).
3. `onstori-media` 에 커스텀 도메인 **`img.onstori.com`** 연결(R2 → Settings → Custom Domains). r2.dev 주소는 개발용이라 프로덕션에 쓰지 않는다.
4. R2 API 토큰(Object Read & Write, 두 버킷 한정) 발급 → Vercel Production env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_MEDIA=onstori-media`, `R2_BUCKET_PRIVATE=onstori-private`, `R2_PUBLIC_BASE=https://img.onstori.com`. 로컬 `.env.local` 동일.
5. (선택) Cloudflare 캐시 규칙: `img.onstori.com/*` Cache Everything, Edge TTL 1년 — 파일명이 uuid 라 캐시 무효화 불필요.

### 2-1. 이전 전 확인 (2026-09-03 추가)
- 등록기관은 Spaceship. 현재 네임서버가 (a) Spaceship 기본 + DNS 레코드로 Vercel 연결인지 (b) Vercel 네임서버(`ns1.vercel-dns.com`)인지 먼저 확인. (b)면 Cloudflare 가 자동으로 가져올 레코드가 없으므로 Vercel 프로젝트 → Domains 화면의 권장 레코드(A `@` → `76.76.21.21`, CNAME `www`·`*` → `cname.vercel-dns.com`)와 Resend·기타 TXT 레코드를 손으로 옮긴다.
- 와일드카드 `*.onstori.com`(P0 때 서브도메인 방식용으로 Vercel 에 연결)은 그대로 둔다. DNS 는 **구체 이름(`img`)이 와일드카드(`*`)보다 우선**하므로 `img.onstori.com` 만 R2 로 가고 나머지 서브도메인은 계속 Vercel(→ 경로로 301). Vercel 쪽 `*.onstori.com` 도메인 등록도 지우지 않는다(추후 본사 내부용 보류 결정 유지).
- Cloudflare 존의 Vercel 레코드는 전부 **DNS only(회색)**. `img` 만 프록시(주황) — R2 커스텀 도메인이 자동 생성.

### 2-2. 고객 커스텀 도메인 (P5 이후 · `docs/specs/custom-domain.md` 로 분리 예정)
- 원리: 고객의 `companyname.com` → Vercel 프로젝트에 도메인 추가(Vercel Domains API) → 고객 등록기관에 CNAME/A 안내 → 검증 폴링 → 앱이 `Host` 헤더로 `sites.custom_domain` 조회 → 같은 렌더러. SSL 은 Vercel 자동. Cloudflare 는 관여하지 않는다(이미지 도메인만 담당).
- 수동/반자동(먼저): 에디터 "내 도메인 연결" 입력 → 레코드 안내 → 연결 확인. 어느 등록기관에서 샀든 동작.
- 자동(나중): 가비아·후이즈 리셀러 API 로 온스토리가 대신 구매·DNS 설정 → 사업자·리셀러 계약 필요. 수동 경로가 먼저 돌아간 뒤 검토.

## 3. 코드 — R2-1

### `lib/storage.ts` (신설, 서버 전용)
```ts
type Bucket = "media" | "private";
put(bucket, key, body: Buffer, contentType): Promise<{ key }>      // S3 PutObject
publicUrl(key): string                                              // `${R2_PUBLIC_BASE}/${key}` (media 전용)
signedGetUrl(key, expiresSec = 600): Promise<string>                // private 전용, S3 presign
remove(bucket, key): Promise<void>
```
- 구현: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, endpoint `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`.
- env 가 없으면 **Supabase Storage 로 폴백**(기존 동작). 로컬에서 R2 없이도 돈다.
- 키 규칙: `bank/{industry}/{mood}/{role}/{uuid}.webp` · `sites/{siteId}/{uuid}.webp` · `stories/{siteId}/{uuid}.webp` · (private) `inquiries/{siteId}/{uuid}.webp`. 기존 Supabase 경로 규칙과 같게 해 R2-2 복사가 1:1 이 되게 한다.

### 호출부 교체 (기존 파일 수정 3곳)
- `app/api/site/upload/route.ts` — Supabase `uploads` 버킷 업로드 → `storage.put("media", "sites/…")` + `publicUrl`.
- `app/api/site/story/route.ts` — 스토리 사진 동일(`stories/…`).
- `scripts/bank-generate.ts`(및 `lib/bank.ts` 의 URL 조립) — 생성 이미지를 R2 `bank/…` 에 저장하고 `image_bank.storage_path` 에는 **키만** 저장, URL 은 `publicUrl(key)` 로 조립. 기존 행(Supabase 전체 URL)은 `http` 로 시작하면 그대로 쓰는 분기 유지 — R2-2 전까지 두 형식 공존.

### `next.config.ts`
- `images.remotePatterns` 에 `img.onstori.com` 추가(추후 next/image 도입 대비).

## 4. 코드 — R2-2 (백필)

- `scripts/storage-migrate.ts`: Supabase `bank`·`uploads` 버킷을 목록 → 같은 키로 R2 복사 → 검증(HEAD 200·크기 일치) → `image_bank.storage_path` 를 키로 치환.
- `scripts/storage-rewrite-urls.ts`: `sites.draft`/`published`/`site_versions.snapshot`/`story_entries.photos` 안의 `https://wpsrfjqfbhmeriscdacu.supabase.co/storage/v1/object/public/{bank|uploads}/…` 를 `https://img.onstori.com/…` 로 치환. 실행 전 `site_versions` 스냅샷, dry-run 옵션 필수.
- 2주 관찰 후 Supabase 버킷의 원본 삭제(그 전엔 두 곳 모두 200).

## 5. 트래픽 폭증은 저장소만으로 안 끝난다

방문 1회 = HTML(Vercel) + DB 조회(Supabase) + 이미지(R2). R2 는 이미지를 해결하지만 **HTML 을 만들 때마다 Supabase 를 읽는 구조**가 남는다. 함께 할 것(작음):
- `app/[slug]/page.tsx` 에 `export const revalidate = 60` (ISR — 60초 캐시), 발행 API 에서 `revalidatePath("/{slug}")` 호출 → 발행 즉시 반영·평시엔 캐시. 방문이 1,000배 늘어도 DB 조회는 분당 1회.
- Vercel Hobby 는 월 100GB 전송·비상업 약관. 첫 유료 고객 시점에 Pro(1TB) 전환은 이미 계획됨.

## 6. 완료 조건

- R2-1: `npm run build` 통과 · env 없을 때 기존 Supabase 경로로 동작(폴백) · env 있을 때 에디터 사진 업로드 → `img.onstori.com/sites/…` URL 로 화면 표시 · 스토리 사진 동일 · `bank-generate` 1장 테스트 → R2 `bank/…` 저장·행 등록 · `git diff --stat` 에 lib/schema.ts 없음.
- R2-2: dry-run 리포트(치환 건수) → 실행 → 발행 사이트 전부 이미지 200 · Supabase 원본은 2주 보존.
