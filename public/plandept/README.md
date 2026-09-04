# 전략기획실 대시보드 — onstori.com/plandept

위치: 저장소 `public/plandept/` (Next.js 는 public 아래 파일을 도메인 루트에서 그대로 서빙).
- index.html — 화면. 손대지 않아도 됨.
- data.js — **아이디어 목록(단일 출처).** 단계(stage)·결정(decision)·요약·다음 행동·문서 링크·이력. 이 파일만 고치면 화면이 바뀐다.
- docs/ — 기획서(md)·리포트(html)·샘플 페이지(html). data.js 의 docs[].href 는 `/plandept/docs/…` 절대경로.

## /plandept 경로가 열리려면 (온팀장, 한 번만)
`onstoriplandept` 와 같은 방식이다.
1. `next.config.ts` rewrites.beforeFiles 에 두 줄 추가:
   `{ source: "/plandept", destination: "/plandept/index.html" }`,
   `{ source: "/plandept/", destination: "/plandept/index.html" }`
   (없으면 app/[slug] 동적 라우트가 'plandept' 를 고객 슬러그로 가로채 404)
2. 예약 슬러그: `insert into reserved_slugs (slug) values ('plandept') on conflict do nothing;` 마이그레이션 1개(다음 db push 때 함께).
3. commit · push → Vercel 자동 배포 → `https://onstori.com/plandept` 확인.

## 운영
- 아이디어 추가·단계 변경 = data.js 수정(기술참모가 갱신본 배치) → commit/push.
- 아이디어별 주소: `onstori.com/plandept/#/idea/story-nudge` 처럼 공유 가능.
- md 는 화면 안에서 렌더(cdnjs marked, 막히면 내장 변환기). 검색엔진 noindex.
- 단계: 아이디어 → 준비중 → 기획중 → 기획완료(회장님 검토 대기) → 적용중(온팀장 작업) → 적용완료 / 폐기·보류
