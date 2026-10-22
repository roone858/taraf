import type { Json } from "@/integrations/supabase/types";

/** Home-page sections that can be reordered, hidden and retitled from the admin. */
export const SECTION_IDS = [
  "collections",
  "bestsellers",
  "offers",
  "featured",
  "custom",
  "story",
  "testimonials",
  "faq",
  "gallery",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type SectionConfig = { id: SectionId; visible: boolean; eyebrow: string; title: string };

export type HomeConfig = {
  hero: { eyebrow: string; primaryLabel: string; secondaryLabel: string };
  /** Display order = array order. */
  sections: SectionConfig[];
  /** [main, inset] images of the «قصتنا» section. */
  storyImages: string[];
  gallery: string[];
};

/** Admin-facing names, and what each section shows. */
export const SECTION_META: Record<SectionId, { name: string; source: string }> = {
  collections: { name: "المجموعات", source: "الفئات الظاهرة في المتجر" },
  bestsellers: { name: "الأكثر مبيعاً", source: "المنتجات المعلّمة 🔥 في صفحة المنتجات" },
  offers: { name: "عروض وتخفيضات", source: "تلقائياً: المنتجات التي لها سعر عرض" },
  featured: { name: "مختارات", source: "المنتجات المعلّمة ⭐ مميز" },
  custom: { name: "التفصيل حسب الطلب", source: "رابط إلى صفحة التفصيل" },
  story: { name: "قصتنا", source: "نص وصور تكتبها هنا" },
  testimonials: { name: "آراء العملاء", source: "صفحة آراء العملاء" },
  faq: { name: "الأسئلة الشائعة", source: "صفحة الأسئلة الشائعة" },
  gallery: { name: "شريط الصور", source: "صور تختارها هنا" },
};

/** Current site copy — used whenever the stored config lacks a value. */
export const DEFAULT_HOME: HomeConfig = {
  hero: {
    eyebrow: "TARAF FURNITURE",
    primaryLabel: "تسوّق الآن",
    secondaryLabel: "استكشف المجموعات",
  },
  // Order alternates product rails with brand/trust content, and backgrounds never repeat back-to-back:
  // cream → ivory → dark → cream/gold → ivory → dark → ivory → images → (dark footer)
  sections: [
    { id: "collections", visible: true, eyebrow: "المجموعات", title: "مساحات تُروى بالتفاصيل" },
    { id: "bestsellers", visible: true, eyebrow: "الأكثر مبيعاً", title: "اختيارات عملائنا" },
    { id: "story", visible: true, eyebrow: "قصتنا", title: "" },
    { id: "offers", visible: true, eyebrow: "عروض وتخفيضات", title: "خصومات على قطع مختارة" },
    { id: "featured", visible: true, eyebrow: "مختارات", title: "قطع مميزة" },
    {
      id: "custom",
      visible: true,
      eyebrow: "سرير أو دولاب ملابس أو مرتبة بمقاسات مساحتك، بالخامة والقماش واللون الذي تختاره.",
      title: "أنت تختار الفكرة، ونحن نهتم بالتفاصيل.",
    },
    { id: "faq", visible: true, eyebrow: "مساعدة", title: "الأسئلة الشائعة" },
    { id: "testimonials", visible: true, eyebrow: "آراء عملائنا", title: "ثقة تُبنى بالتفاصيل" },
    { id: "gallery", visible: true, eyebrow: "", title: "" },
  ],
  storyImages: ["/images/p-chair.jpg", "/images/p-decor.jpg"],
  gallery: [
    "/images/cat-dining.jpg",
    "/images/p-table.jpg",
    "/images/cat-bedroom.jpg",
    "/images/cat-living.jpg",
  ],
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const urls = (v: unknown, fallback: string[], max: number) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, max)
    : fallback;

/**
 * Reads `store_settings.home_config` defensively: unknown sections are dropped, sections missing from
 * the stored order are appended in their default position, and absent values use the defaults.
 */
export function parseHomeConfig(raw: Json | undefined | null): HomeConfig {
  const c = obj(raw);
  const hero = obj(c["hero"]);
  const defaults = new Map(DEFAULT_HOME.sections.map((s) => [s.id, s]));

  const stored = Array.isArray(c["sections"]) ? c["sections"] : [];
  const seen = new Set<SectionId>();
  const sections: SectionConfig[] = [];
  for (const item of stored) {
    const s = obj(item);
    const id = s["id"] as SectionId;
    const d = defaults.get(id);
    if (!d || seen.has(id)) continue;
    seen.add(id);
    sections.push({
      id,
      visible: typeof s["visible"] === "boolean" ? s["visible"] : d.visible,
      eyebrow: str(s["eyebrow"], d.eyebrow),
      title: str(s["title"], d.title),
    });
  }
  // Sections the stored config doesn't know yet go in after their nearest default predecessor
  DEFAULT_HOME.sections.forEach((d, i) => {
    if (seen.has(d.id)) return;
    const prev = DEFAULT_HOME.sections
      .slice(0, i)
      .reverse()
      .find((p) => seen.has(p.id));
    sections.splice(prev ? sections.findIndex((x) => x.id === prev.id) + 1 : 0, 0, { ...d });
    seen.add(d.id);
  });

  return {
    hero: {
      eyebrow: str(hero["eyebrow"], DEFAULT_HOME.hero.eyebrow),
      primaryLabel: str(hero["primaryLabel"], DEFAULT_HOME.hero.primaryLabel),
      secondaryLabel: str(hero["secondaryLabel"], DEFAULT_HOME.hero.secondaryLabel),
    },
    sections,
    storyImages: urls(c["storyImages"], DEFAULT_HOME.storyImages, 2),
    gallery: urls(c["gallery"], DEFAULT_HOME.gallery, 8),
  };
}
