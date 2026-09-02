import { z } from "zod";

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
  photos: z.array(z.string()).min(1).max(30),
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
  allowPhotos: z.boolean().default(true), // 실제 폼 접수는 P8 — P1은 연락 CTA 카드로 렌더
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

/* ── 통합 ── */

export const Section = z.discriminatedUnion("type", [
  Hero, About, StoryFeed, Gallery, Reviews, MapSec, Banner,
  PortfolioGallery, ProcessSteps, QuoteForm,
  HoursCard, MenuPrice,
]);

export const SiteDoc = z.object({
  schemaVersion: z.literal(1),
  template: z.enum(["visit", "book", "quote", "consult", "browse"]),
  businessName: z.string().min(1).max(40),
  theme: Theme,
  sections: z.array(Section).min(1).max(20),
});

export const StoryEntry = z.object({
  id: z.string(),
  entryType: z.enum(["work", "news", "milestone", "guest"]),
  title: z.string().max(60),
  body: z.string().max(1000),
  photos: z.array(z.string()).max(10).default([]),
  entryDate: z.string(), // YYYY-MM-DD
});

export type ThemeT = z.infer<typeof Theme>;
export type SectionT = z.infer<typeof Section>;
export type SiteDocT = z.infer<typeof SiteDoc>;
export type StoryEntryT = z.infer<typeof StoryEntry>;
