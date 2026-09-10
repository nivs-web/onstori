import { z } from "zod";
import { PHOTO_LIMITS } from "@/config/limits";

/**
 * 섹션 JSON 스키마 v1 — 사이트의 "약속".
 * ⚠ 변경 시 4곳 동시 수정: 이 파일 + components/sections/* + (P3) 에디터 폼 + docs/SCHEMA.md
 *   (CLAUDE.md 불변 규칙 2)
 */

export const Theme = z.object({
  palette: z.enum(["clean", "warm", "premium", "lively"]).default("clean"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), // 미지정 시 palette 기본색
  font: z.enum(["pretendard"]).default("pretendard"),
});

const Cta = z.object({
  label: z.string().min(1).max(20),
  action: z.enum(["call", "quote", "reserve", "consult"]),
});

/* ── 공통 섹션 ── */

export const Hero = z.object({
  type: z.literal("hero"),
  eyebrow: z.string().max(40).optional(),
  headline: z.string().min(1).max(60),
  sub: z.string().max(160).optional(),
  image: z.string().optional(),
  cta: Cta,
});

export const About = z.object({
  type: z.literal("about"),
  title: z.string().max(40).default("소개"),
  body: z.string().min(1).max(600),
  // 소개 사진 1장. optional — 이 필드가 생기기 전에 만들어진 발행본이 그대로 통과해야 한다
  image: z.string().optional(),
  stats: z.array(z.object({ label: z.string().max(20), value: z.string().max(20) })).max(4).optional(),
});

export const StoryFeed = z.object({
  type: z.literal("storyFeed"),
  title: z.string().max(40).default("우리 가게 이야기"),
  showCount: z.number().int().min(3).max(10).default(5),
});

export const Gallery = z.object({
  type: z.literal("gallery"),
  title: z.string().max(40).default("갤러리"),
  photos: z.array(z.string()).min(1).max(PHOTO_LIMITS.gallery),
});

export const Reviews = z.object({
  type: z.literal("reviews"),
  title: z.string().max(40).default("고객 이야기"),
  // 별점 필드는 의도적으로 없음 — 표시광고법 방침 (CLAUDE.md 불변 규칙 7)
  items: z.array(z.object({
    title: z.string().max(60),
    body: z.string().max(300),
    source: z.string().max(30).optional(),
  })).min(1).max(20),
});

export const MapSec = z.object({
  type: z.literal("map"),
  title: z.string().max(40).default("오시는 길"),
  address: z.string().min(1).max(120),
  phone: z.string().max(20).optional(),
  naverMapUrl: z.string().url().optional(),
  note: z.string().max(120).optional(),
});

export const Banner = z.object({
  type: z.literal("banner"),
  text: z.string().min(1).max(80),
  link: z.string().url().optional(),
});

/* ── QUOTE 템플릿 전용 ── */

export const PortfolioGallery = z.object({
  type: z.literal("portfolioGallery"),
  title: z.string().max(40).default("시공 사례"),
  items: z.array(z.object({
    title: z.string().max(60),
    image: z.string(),
    date: z.string().max(20).optional(),
    tag: z.string().max(20).optional(),
  })).min(1).max(30),
});

export const ProcessSteps = z.object({
  type: z.literal("processSteps"),
  title: z.string().max(40).default("진행 과정"),
  steps: z.array(z.object({
    name: z.string().max(20),
    desc: z.string().max(80).optional(),
    // 단계별 소형 사진. optional — 이 필드가 생기기 전 발행본 호환
    image: z.string().optional(),
  })).min(2).max(6),
});

export const QuoteForm = z.object({
  type: z.literal("quoteForm"),
  title: z.string().max(40).default("견적 문의"),
  sub: z.string().max(120).optional(),
  phone: z.string().min(1).max(20),
  kakaoUrl: z.string().url().optional(),
  allowPhotos: z.boolean().default(true), // 접수 폼은 components/sections/quote-form.tsx
});

/* ── VISIT 템플릿 전용 ── */

export const HoursCard = z.object({
  type: z.literal("hoursCard"),
  title: z.string().max(40).default("영업시간"),
  hours: z.string().min(1).max(200), // 줄바꿈 허용
  holidayNote: z.string().max(60).optional(),
});

export const MenuPrice = z.object({
  type: z.literal("menuPrice"),
  title: z.string().max(40).default("메뉴"),
  items: z.array(z.object({
    name: z.string().max(40),
    price: z.string().max(20),
    desc: z.string().max(80).optional(),
  })).min(1).max(40),
});

/* ── 60초 영상 ── */

/**
 * 사장님이 찍은 60초 영상 한 편 (2026-09-10, V-1).
 *
 * ★ **사장님이 이 값을 타이핑하지 않는다.** 편집화면의 [홈페이지에 걸기] 가 넣는다.
 *   그래서 「섹션 추가」 목록(`lib/section-defaults.ts` 의 ADDABLE_SECTIONS)에는 **넣지 않는다** —
 *   빈 영상 칸을 만들 수 있게 하면 사장님이 주소를 칠 수 없어 막다른 길이 된다(2026-09-10 회장님).
 *
 * ⚠ `url` 을 `.url()` 로 막지 않는다. 우리 R2 주소만 들어오는 자리이고, 저장소가
 *   R2 없이 Supabase 폴백으로 돌 때 주소 형태가 달라진다. 대신 **최대 길이**로만 막는다.
 * ⚠ `poster` 는 **선택**이다. 표지 뽑기가 실패해도 영상은 정상으로 보여야 한다(회장님 지시).
 * ⚠ 필드를 늘릴 때는 전부 `.optional()` 로 — **이미 발행된 사이트의 문서가 그대로 통과해야 한다**
 *   (`About.image` 주석이 같은 이유로 붙어 있다).
 */
export const VideoSec = z.object({
  type: z.literal("video"),
  title: z.string().max(40).default("사장님 이야기"),
  url: z.string().min(1).max(500),
  /** 표지 사진. 없으면 브라우저 기본 첫 프레임으로 보인다 */
  poster: z.string().max(500).optional(),
  /** 영상 아래 한 줄. 녹화할 때의 «오늘의 질문»이 들어온다 */
  caption: z.string().max(120).optional(),
});

/* ── 플로팅 연결 위젯 ── */

/**
 * 화면 어디서나 눌리는 연결 버튼 (2026-09-05).
 * ⚠ 위젯은 값을 갖지 않는다 — 전화번호·카톡 주소는 quoteForm 섹션에서 파생한다
 *   (components/sections/index.tsx 의 contactOf). 같은 값의 사본을 늘리지 않기 위해서다.
 * ⚠ Section union 에 넣지 않는다 — sections 의 순서·max(20)·RenderSection switch 와 얽힌다.
 */
export const Widget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("call"),  label: z.string().max(8).default("전화") }),
  z.object({ kind: z.literal("kakao"), label: z.string().max(8).default("카카오톡") }),
]);

/* ── 통합 ── */

export const Section = z.discriminatedUnion("type", [
  Hero, About, StoryFeed, Gallery, Reviews, MapSec, Banner,
  PortfolioGallery, ProcessSteps, QuoteForm,
  HoursCard, MenuPrice,
  // 2026-09-10 V-1 — 맨 뒤에 더한다. 순서는 union 판정에 영향이 없고, 이미 발행된 문서도 그대로 통과한다
  VideoSec,
]);

export const SiteDoc = z.object({
  schemaVersion: z.literal(1),
  template: z.enum(["visit", "book", "quote", "consult", "browse"]),
  businessName: z.string().min(1).max(40),
  theme: Theme,
  sections: z.array(Section).min(1).max(20),
  // 플로팅 연결 위젯. optional — 이 필드가 생기기 전 발행본 호환
  // ⚠ 필수로 만들면 lib/sites.ts 의 SiteDoc.parse(safeParse 아님)에서 기존 발행 사이트가 전부 죽는다.
  // ⚠ .default([]) 도 쓰지 않는다 — update 라우트가 parsed.data 를 저장해 손 안 댄 사이트에도 "widgets":[] 가 덧씌워진다.
  widgets: z.array(Widget).max(2).optional(),
});

export const StoryEntry = z.object({
  id: z.string(),
  entryType: z.enum(["work", "news", "milestone", "guest"]),
  title: z.string().max(60),
  body: z.string().max(1000),
  photos: z.array(z.string()).max(PHOTO_LIMITS.story).default([]),
  entryDate: z.string(), // YYYY-MM-DD
});

export type ThemeT = z.infer<typeof Theme>;
export type SectionT = z.infer<typeof Section>;
export type WidgetT = z.infer<typeof Widget>;
export type SiteDocT = z.infer<typeof SiteDoc>;
export type StoryEntryT = z.infer<typeof StoryEntry>;
