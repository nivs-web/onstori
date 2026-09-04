# 전략기획실 대시보드 — onstori.com/plandept (운영자 전용)

위치: 저장소 `content/plandept/` (public 이 아님 — 정적 공개 금지).
서빙: `app/plandept/[[...path]]/route.ts` 가 운영자 쿠키(`onstori_admin` = ADMIN_KEY)를 확인한 뒤 이 폴더의 파일을 내준다.
로그인 안 된 요청은 `/admin?next=/plandept` 로 보낸다. 운영자 콘솔(/admin) 메뉴의 "전략기획실" 버튼이 여기로 온다.

- index.html — 화면. 손대지 않아도 됨.
- data.js — **아이디어 목록(단일 출처).** 단계(stage)·결정(decision)·요약·다음 행동·문서 링크·이력. 이 파일만 고치면 화면이 바뀐다.
- docs/ — 기획서(md)·리포트(html)·샘플 페이지(html). data.js 의 docs[].href 는 `/plandept/docs/…` 절대경로(라우트 핸들러가 같이 내준다).

## 운영
- 아이디어 추가·단계 변경 = data.js 수정(기술참모가 갱신본 배치) → commit/push.
- 아이디어별 주소: `onstori.com/plandept/#/idea/story-nudge` 처럼 공유 가능(운영자 로그인 필요).
- md 는 화면 안에서 렌더(cdnjs marked, 막히면 내장 변환기). 검색엔진 noindex(meta + X-Robots-Tag).
- 단계: 아이디어 → 준비중 → 기획중 → 기획완료(회장님 검토 대기) → 적용중(온팀장 작업) → 적용완료 / 폐기·보류
- 예약 슬러그 'plandept' 는 마이그레이션 `20260904130000_reserve_plandept_slug.sql`(다음 db push 때 적용).
