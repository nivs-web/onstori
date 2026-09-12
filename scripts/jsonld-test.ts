/**
 * **구조화 데이터(JSON-LD)가 무엇을 싣고 무엇을 빼는지** 검사한다. (2026-09-13 지시 11)
 *
 * ★★ 왜 검사로 증명하나: 지금 운영에는 **정회원이 한 곳뿐**이고 그마저 예시 사이트라
 *   화면에서 눈으로 확인할 자리가 없다. 「됐습니다」라고 말만 할 수는 없다.
 *
 * ⚠ DB 도 네트워크도 안 쓴다 — 순수 함수만 잰다.
 */
import { localBusinessJsonLd } from "../lib/jsonld";
import type { SiteData } from "../lib/sites";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`  ❌ ${name}\n       기대 ${JSON.stringify(want)}\n       실제 ${JSON.stringify(got)}`); bad++;
  } else console.log(`  ✅ ${name}`);
};

const site = (over: Partial<SiteData> = {}): SiteData => ({
  slug: "dasan",
  status: "active",
  stories: [],
  doc: {
    schemaVersion: 1,
    template: "quote",
    businessName: "다산 리모델링",
    theme: { palette: "clean", font: "pretendard" },
    sections: [
      { type: "hero", headline: "환영합니다", sub: "욕실만 12년", image: "https://img.onstori.com/a.webp", cta: { label: "견적 문의", action: "quote" } },
      { type: "quoteForm", title: "견적 문의", phone: "010-1234-5678", allowPhotos: true },
      { type: "map", title: "오시는 길", address: "경기 남양주시 다산동 1", phone: "010-1234-5678" },
    ],
  } as SiteData["doc"],
  ...over,
});

const parse = (s: string | null) => (s ? JSON.parse(s.replace(/\\u003c/g, "<")) : null);

console.log("── 번호는 «공개»로 켜 두신 분만 ──");
{
  const d = parse(localBusinessJsonLd(site(), { phone: "010-1234-5678" }));
  t("★ 비공개가 기본 — 번호를 안 싣는다", d?.telephone, undefined);
  t("주소는 싣는다", d?.address?.streetAddress, "경기 남양주시 다산동 1");
  t("상호는 싣는다", d?.name, "다산 리모델링");
}
{
  const d = parse(localBusinessJsonLd(site(), { phone: "010-1234-5678", phonePublic: true }));
  t("★ 공개로 켜면 싣는다", d?.telephone, "010-1234-5678");
}

console.log("\n── 넣지 않기로 한 것 ──");
{
  const d = parse(localBusinessJsonLd(site(), { phone: "010-1234-5678", phonePublic: true, notify: { email: "boss@gmail.com" } }));
  /* ⚠ 알림용 메일은 사장님 개인 주소다. 실으면 검색에 노출된다(김팀장 경고) */
  t("★ 알림용 이메일은 안 싣는다", d?.email, undefined);
  t("영업시간은 안 싣는다", d?.openingHours, undefined);
  t("별점은 안 싣는다 (불변 규칙 7)", d?.aggregateRating, undefined);
}

console.log("\n── 아예 안 싣는 경우 ──");
t("체험(trial) 중이면 없다", localBusinessJsonLd(site({ status: "trial" }), {}), null);
t("★ 예시 사이트면 없다", localBusinessJsonLd(site({ sample: true }), {}), null);

console.log("\n── ★ </script> 막는 줄이 살아 있나 ──");
{
  /* ★★ 상호는 사장님이 직접 치는 글자다. 여기가 뚫리면 그 페이지에서 남의 코드가 돈다 */
  const evil = site();
  evil.doc = { ...evil.doc, businessName: '가게</script><script>alert(1)</script>' } as SiteData["doc"];
  const raw = localBusinessJsonLd(evil, {}) ?? "";
  t("★ 원문에 '<' 가 한 글자도 없다", raw.includes("<"), false);
  t("유니코드로 바뀌어 있다", raw.includes("\\u003c"), true);
  t("되돌리면 상호는 그대로다", parse(raw)?.name, '가게</script><script>alert(1)</script>');
}

console.log("\n── 모르는 값은 키 자체를 안 넣는다 ──");
{
  const bare = site();
  bare.doc = { ...bare.doc, sections: [] } as SiteData["doc"];
  const d = parse(localBusinessJsonLd(bare, {}));
  t("주소가 없으면 address 키가 없다", "address" in (d ?? {}), false);
  t("그래도 이름·주소(url)는 있다", [d?.name, d?.url], ["다산 리모델링", "https://onstori.com/dasan"]);
}

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
