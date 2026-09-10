/**
 * 녹화 화면(`/rec/{slug}`) 대비 검사 (2026-09-11, 회장님 폰 실측 후).
 *
 * ★ 왜 따로 필요한가: `design-contrast.ts` 는 **브랜드 색 조합**을, `shell-contrast.ts` 는
 *   **어드민·편집화면 면**을 잰다. 녹화 화면은 **어느 쪽도 아니다** — `--forest` 위에
 *   흰 글자를 얹는 독자 화면이고, 그래서 아무도 안 재고 있었다.
 *
 * ★ 이 검사의 핵심은 **`opacity-*` 를 섞어서 잰다**는 것이다. 화면의 글자 대부분이
 *   `opacity-60`~`opacity-80` 을 달고 있는데, 그걸 안 섞으면 「흰 글자니까 11:1」이라는
 *   **틀린 안심**을 얻는다. 실제로 보이는 색을 재야 한다.
 *
 * 실행: `npx tsx scripts/rec-contrast.ts`
 */

/* ── globals.css :root 실측값 (줄번호는 2026-09-11 기준) ── */
const T = {
  forest: "#2E4038",      // 226행 --forest = --n-800
  cream: "#FFFFFF",       // 230행 --cream = --n-0
  n900: "#1A2722",        // 45행  — .t-h1/h2/h3/display 가 «클래스에 박아 둔» 색
  n700: "#50665E",        // 43행  — --text-soft 가 가리키는 색 = .t-caption/.t-micro 색
  n300: "#C9D4D0",        // 39행
  n200: "#E5EBE9",        // 38행
  green700: "#005B2A",    // btn-lime 배경
  green200: "#A8DCC6",    // --lime
  dangerSoft: "#FDECEE",  // 오류 문구
  black: "#000000",
};

const hex = (h: string) => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] as const;
};
/** 반투명 색을 바탕에 얹었을 때 «눈에 실제로 보이는» 색 */
const blend = (fg: string, alpha: number, bg: string) => {
  const [fr, fg2, fb] = hex(fg); const [br, bg2, bb] = hex(bg);
  const m = (a: number, b: number) => Math.round(alpha * a + (1 - alpha) * b);
  return `#${[m(fr, br), m(fg2, bg2), m(fb, bb)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};
const lum = (h: string) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

type Row = { 화면: string; "보이는 글자": string; 글자색: string; 바탕: string; 대비: string; 기준: number; 통과: string };
const rows: Row[] = [];
/** @param fg 글자색 @param a 불투명도(opacity-*) @param bg 바탕 @param min 기준(본문 4.5 · 큰제목 3) */
function check(screen: string, label: string, fg: string, a: number, bg: string, min = 4.5) {
  const seen = a >= 1 ? fg : blend(fg, a, bg);
  const c = ratio(seen, bg);
  rows.push({
    화면: screen, "보이는 글자": label,
    글자색: a >= 1 ? fg : `${fg}@${Math.round(a * 100)}%→${seen}`,
    바탕: bg, 대비: c.toFixed(2) + ":1", 기준: min, 통과: c >= min ? "✅" : "❌",
  });
}

/** ① 지금 코드 그대로 — `.t-caption`/`.t-h*` 는 클래스에 박힌 색이 이긴다 */
const FIXED = process.argv.includes("--fixed");
/* 고친 뒤에는 `.rec-shell` 이 이 둘을 흰색 계열로 뒤집는다 */
const caption = FIXED ? T.cream : T.n700;  // .t-caption / .t-micro — 고친 뒤엔 흰색(마크업이 opacity 로 흐린다)
const heading = FIXED ? T.cream : T.n900;  // .t-h1 / .t-h2 / .t-h3 / .t-display

const white10 = blend(T.cream, 0.10, T.forest); // bg-white/10 패널
const white15 = blend(T.cream, 0.15, T.forest); // 진행 막대 홈
const white95 = blend(T.cream, 0.95, T.forest); // 영상 위 질문 카드

/* ── 상단 바 (모든 화면) ── */
check("상단바", "onstori.com/rec · 다산 리모델링", caption, 0.7, T.forest);
check("상단바", "60초 녹화 / REC 0:42 / 60", caption, 0.7, T.forest);

/* ── 1 인사 ── */
check("인사", "온스토리", caption, 0.6, T.forest);
check("인사", "안녕하세요, ○○ 사장님 (t-h1)", heading, 1, T.forest, 3);
check("인사", "오늘 질문 하나에 60초만…", T.cream, 0.8, T.forest);
check("인사", "✎ 글쓰기 금지 (테두리 알약)", T.cream, 1, T.forest);
check("인사", "[60초 영상 촬영하기] 글자", T.cream, 1, T.green700);

/* ── 안내 접이식 (bg-white/10) ── */
check("촬영안내", "어떻게 찍나요? · 30초면 읽어요", T.cream, 1, white10);
check("촬영안내", "설명 줄 (opacity-75)", T.cream, 0.75, white10);

/* ── 3 영상/음성 ── */
check("질문", "오늘의 질문", caption, 0.6, T.forest);
check("질문", "질문 본문 (t-h2)", heading, 1, T.forest, 3);
check("질문", "질문 바꾸기", T.cream, 0.7, T.forest);
check("질문", "영상으로 / 음성만 설명", T.cream, 0.75, T.forest);
check("질문", "브라우저가 권한을 물으면…", caption, 0.6, T.forest);

/* ── 4 카메라 확인 ── */
check("카메라확인", "카메라 확인", caption, 0.6, T.forest);
check("카메라확인", "영상 위 질문 카드", T.forest, 1, white95);
check("카메라확인", "카메라를 매장 쪽으로 돌려도 됩니다", caption, 0.7, T.forest);
check("카메라확인", "준비되셨으면 시작을 누르세요…", T.cream, 0.8, T.forest);

/* ── 6·7 카운트다운·녹화 ──
   ⚠ 영상 위 글자는 **가장 밝은 경우(흰 매장)** 를 기준으로 잰다. 어두운 경우는 저절로 통과한다. */
const onVideo = (a: number) => blend(T.black, a, "#FFFFFF"); // 검정 스크림을 «흰 화면» 위에 얹은 최악
check("녹화", "건너뛰기 (검정 70% 알약)", T.cream, 1, onVideo(0.7));       // 전: 흰70%/스크림40% = 2.16:1
check("녹화", "REC 0:42 / 1:00 (검정 70% 알약)", T.cream, 1, onVideo(0.7)); // 전: 검정 50% = 3.95:1
check("녹화", "카운트다운 숫자 3·2·1 (큰 글자)", T.cream, 1, onVideo(0.5), 3);
check("녹화", "카메라 전환 버튼 (검정 70% 알약)", T.cream, 1, onVideo(0.7));
check("녹화", "얼굴이 안 나와도 됩니다…", caption, 0.6, T.forest);
check("녹화", "꼭 60초를 다 쓰지 않으셔도 됩니다", caption, 0.6, T.forest);
check("녹화", "잠깐 / 재개 버튼 글자", T.cream, 1, T.forest);

/* ── 8 확인 ── */
check("확인", "확인 · 0:42", caption, 0.6, T.forest);
check("확인", "오류 문구 (--danger-soft)", T.dangerSoft, 1, T.forest);
check("확인", "다시 찍기 (테두리 버튼)", T.cream, 1, T.forest);
check("확인", "보내면 홈페이지에 걸 수 있어요", caption, 0.6, T.forest);
check("확인", "못 쓰는 형식 안내 (bg-white/10)", T.cream, 1, white10);

/* ── 보내는 중 · 완료 ── */
check("보내는중", "43% (t-h1)", heading, 1, T.forest, 3);
check("보내는중", "보내는 중이에요…", T.cream, 0.8, T.forest);
check("완료", "보냈어요 (t-h1)", heading, 1, T.forest, 3);
check("완료", "영상이 저장됐어요…", T.cream, 0.8, T.forest);
check("완료", "하나 더 녹화하기", T.cream, 0.7, T.forest);

/* ── 오류 화면 ── */
check("오류", "카메라를 열지 못했어요 (t-h2)", heading, 1, T.forest, 3);
check("오류", "오류 설명 본문", T.cream, 0.8, T.forest);
check("오류", "사파리로 열어 주세요 (bg-white/10)", T.cream, 1, white10);
check("오류", "크롬으로 열기", T.cream, 0.8, T.forest);

/* ── 만료 화면 (page.tsx) ── */
check("만료", "이 링크는 만료됐어요 (t-h1)", heading, 1, T.forest, 3);
check("만료", "녹화 링크는 그 주에만…", T.cream, 0.8, T.forest);

/* ── UI 부품 대비(3:1) — 글자가 아니라 «모양이 보이는가» ──
   ⚠ 빨간 REC 점은 여기서 뺐다. 점 옆에 「REC」라는 **글자가 같은 뜻을 말하고 있어서**
     그 글자가 기준을 넘으면 점은 대비 요건 대상이 아니다(WCAG 1.4.11 «글자로도 전달» 예외).
     대신 그 글자를 위에서 8.46:1 로 재고 있다. */
check("부품", "진행 막대 (라임) / 홈 (흰15%)", T.green200, 1, white15, 3);      // 전: 빨강 --terra = 1.55:1
check("부품", "주 버튼 면 (라임) / 바탕", T.green200, 1, T.forest, 3);          // 전: --green-700 = 1.33:1
check("부품", "주 버튼 글자 (--forest) / 라임 면", T.forest, 1, T.green200);
check("부품", "정지 버튼 빨간 네모 / 흰 원", "#E42939", 1, T.cream, 3);         // 전: 초록 바탕 직접 = 2.45:1
check("부품", "카메라 확인 미리보기 테두리 없음 — 검정 면", T.cream, 1, T.black);

console.table(rows);
const bad = rows.filter((r) => r.통과 === "❌");
console.log(`\n검사 ${rows.length}건 · 미달 ${bad.length}건 ${FIXED ? "(고친 뒤)" : "(고치기 전)"}`);
if (bad.length) {
  console.log("\n미달 목록:");
  for (const b of bad) console.log(`  ❌ [${b.화면}] ${b["보이는 글자"]} — ${b.대비} (기준 ${b.기준}:1)`);
}
process.exit(FIXED && bad.length ? 1 : 0);
