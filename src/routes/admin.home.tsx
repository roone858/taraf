import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgePercent,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  FolderTree,
  HelpCircle,
  Images,
  Loader2,
  MessageSquareQuote,
  RotateCcw,
  Star,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  bestsellersQuery,
  categoriesQuery,
  faqsQuery,
  featuredQuery,
  onSaleQuery,
  settingsQuery,
  testimonialsQuery,
} from "@/lib/data";
import {
  DEFAULT_HOME,
  SECTION_META,
  parseHomeConfig,
  type HomeConfig,
  type SectionConfig,
  type SectionId,
} from "@/lib/home-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SingleImageUpload } from "@/components/SingleImageUpload";
import { ImageUploader } from "@/components/ImageUploader";
import { Field, inp } from "./admin.categories";

export const Route = createFileRoute("/admin/home")({ component: HomeEditor });

type Draft = {
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string | null;
  promo_banner: string;
  story_title: string;
  story_body: string;
  config: HomeConfig;
};

const ICONS: Record<SectionId, LucideIcon> = {
  collections: FolderTree,
  bestsellers: Flame,
  offers: BadgePercent,
  featured: Star,
  story: BookOpen,
  testimonials: MessageSquareQuote,
  faq: HelpCircle,
  gallery: Images,
};
const MANAGE: Partial<Record<SectionId, { to: string; label: string }>> = {
  collections: { to: "/admin/categories", label: "إدارة الفئات" },
  bestsellers: { to: "/admin/products", label: "اختيار المنتجات 🔥" },
  offers: { to: "/admin/products", label: "أسعار العروض" },
  featured: { to: "/admin/products", label: "اختيار المنتجات ⭐" },
  testimonials: { to: "/admin/testimonials", label: "إدارة الآراء" },
  faq: { to: "/admin/faqs", label: "إدارة الأسئلة" },
};
const num = new Intl.NumberFormat("ar-EG");

function HomeEditor() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const [d, setD] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<SectionId | null>(null);

  // Content counts so each section shows whether it will actually appear
  const { data: cats } = useQuery(categoriesQuery);
  const { data: bestsellers } = useQuery(bestsellersQuery);
  const { data: onSale } = useQuery(onSaleQuery);
  const { data: featured } = useQuery(featuredQuery);
  const { data: testimonials } = useQuery(testimonialsQuery);
  const { data: faqs } = useQuery(faqsQuery);

  const initial = useMemo<Draft | null>(
    () =>
      s
        ? {
            hero_title: s.hero_title,
            hero_subtitle: s.hero_subtitle,
            hero_image_url: s.hero_image_url,
            promo_banner: s.promo_banner ?? "",
            story_title: s.story_title,
            story_body: s.story_body,
            config: parseHomeConfig(s.home_config),
          }
        : null,
    [s],
  );
  useEffect(() => setD(initial), [initial]);

  if (!d || !initial) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="h-10 w-56 animate-pulse bg-ivory" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-ivory" />
        ))}
      </div>
    );
  }

  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const set = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x));
  const setCfg = (patch: Partial<HomeConfig>) =>
    setD((x) => (x ? { ...x, config: { ...x.config, ...patch } } : x));
  const setSection = (id: SectionId, patch: Partial<SectionConfig>) =>
    setCfg({ sections: d.config.sections.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    const list = [...d.config.sections];
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setCfg({ sections: list });
  };

  const counts: Record<SectionId, number> = {
    collections: cats?.length ?? 0,
    bestsellers: bestsellers?.length ?? 0,
    offers: onSale?.length ?? 0,
    featured: featured?.length ?? 0,
    story: d.story_title.trim() || d.story_body.trim() ? 1 : 0,
    testimonials: testimonials?.length ?? 0,
    faq: faqs?.length ?? 0,
    gallery: d.config.gallery.length,
  };
  const countLabel: Record<SectionId, (n: number) => string> = {
    collections: (n) => `${num.format(n)} فئة`,
    bestsellers: (n) => `${num.format(n)} منتج`,
    offers: (n) => `${num.format(n)} منتج عليه عرض`,
    featured: (n) => `${num.format(n)} منتج`,
    story: () => "نص مكتوب",
    testimonials: (n) => `${num.format(n)} رأي منشور`,
    faq: (n) => `${num.format(n)} سؤال منشور`,
    gallery: (n) => `${num.format(n)} صورة`,
  };

  const save = async () => {
    if (saving) return;
    if (!d.hero_title.trim()) return void toast.error("عنوان الواجهة مطلوب");
    setSaving(true);
    const { error } = await supabase
      .from("store_settings")
      .update({
        hero_title: d.hero_title.trim(),
        hero_subtitle: d.hero_subtitle.trim(),
        hero_image_url: d.hero_image_url,
        promo_banner: d.promo_banner.trim() || null,
        story_title: d.story_title.trim(),
        story_body: d.story_body.trim(),
        home_config: d.config,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ الصفحة الرئيسية");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="max-w-4xl pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">الصفحة الرئيسية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            الواجهة، ترتيب الأقسام وإظهارها، وعناوينها. تظهر التغييرات للزوار بعد الحفظ.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2 rounded-full">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> عرض الصفحة
          </a>
        </Button>
      </div>

      {/* Hero */}
      <Card title="الواجهة" description="أول ما يراه الزائر عند فتح المتجر.">
        <SingleImageUpload
          label="صورة الواجهة"
          folder="hero"
          url={d.hero_image_url}
          onChange={(hero_image_url) => set({ hero_image_url })}
          emptyTitle="اختر صورة للواجهة"
          emptyHint="صورة أفقية بعرض ١٩٢٠ بكسل على الأقل · بدونها تُستخدم الصورة الافتراضية"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="العنوان الصغير فوق العنوان">
            <input
              className={inp}
              value={d.config.hero.eyebrow}
              onChange={(e) => setCfg({ hero: { ...d.config.hero, eyebrow: e.target.value } })}
              placeholder="اتركه فارغاً لإخفائه"
            />
          </Field>
          <Field label="العنوان الرئيسي *">
            <input
              className={inp}
              value={d.hero_title}
              onChange={(e) => set({ hero_title: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="النص التعريفي">
              <textarea
                rows={2}
                className={cn(inp, "h-auto py-2")}
                value={d.hero_subtitle}
                onChange={(e) => set({ hero_subtitle: e.target.value })}
              />
            </Field>
          </div>
          <Field label="نص الزر الأساسي (إلى المتجر)">
            <input
              className={inp}
              value={d.config.hero.primaryLabel}
              onChange={(e) => setCfg({ hero: { ...d.config.hero, primaryLabel: e.target.value } })}
              placeholder="اتركه فارغاً لإخفاء الزر"
            />
          </Field>
          <Field label="نص الزر الثاني (إلى المجموعات)">
            <input
              className={inp}
              value={d.config.hero.secondaryLabel}
              onChange={(e) =>
                setCfg({ hero: { ...d.config.hero, secondaryLabel: e.target.value } })
              }
              placeholder="اتركه فارغاً لإخفاء الزر"
            />
          </Field>
        </div>
      </Card>

      {/* Promo strip */}
      <Card title="شريط العروض" description="شريط ذهبي أسفل الواجهة مباشرة. اتركه فارغاً لإخفائه.">
        <input
          className={cn(inp, "mt-0")}
          value={d.promo_banner}
          onChange={(e) => set({ promo_banner: e.target.value })}
          placeholder="مثال: توصيل مجاني للطلبات داخل الرياض"
        />
      </Card>

      {/* Sections */}
      <Card
        title="الأقسام"
        description="رتّب الأقسام بالأسهم، وأظهر أو أخفِ أي قسم، واضغط على القسم لتعديل عناوينه."
      >
        <ul className="space-y-2">
          {d.config.sections.map((sec, i) => {
            const Icon = ICONS[sec.id];
            const meta = SECTION_META[sec.id];
            const count = counts[sec.id];
            const empty = count === 0;
            const expanded = open === sec.id;
            const manage = MANAGE[sec.id];
            return (
              <li
                key={sec.id}
                className={cn(
                  "rounded-xl border transition-colors",
                  expanded ? "border-gold/60 bg-cream/60" : "border-navy/10 bg-cream/30",
                  !sec.visible && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`تحريك ${meta.name} لأعلى`}
                      className="text-muted-foreground hover:text-navy disabled:opacity-25"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === d.config.sections.length - 1}
                      aria-label={`تحريك ${meta.name} لأسفل`}
                      className="text-muted-foreground hover:text-navy disabled:opacity-25"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : sec.id)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-start"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-navy">{meta.name}</span>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          empty && sec.visible ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {empty ? "لا يوجد محتوى — لن يظهر للزوار" : countLabel[sec.id](count)}
                      </span>
                    </span>
                  </button>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {sec.visible ? (
                      <Eye className="inline h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="inline h-3.5 w-3.5" />
                    )}
                  </span>
                  <Switch
                    checked={sec.visible}
                    onCheckedChange={(v) => setSection(sec.id, { visible: v })}
                    aria-label={`إظهار ${meta.name}`}
                  />
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-navy/10 p-4 text-sm">
                    <p className="text-xs text-muted-foreground">المحتوى: {meta.source}</p>

                    {sec.id !== "gallery" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="العنوان الصغير">
                          <input
                            className={inp}
                            value={sec.eyebrow}
                            onChange={(e) => setSection(sec.id, { eyebrow: e.target.value })}
                            placeholder="اتركه فارغاً لإخفائه"
                          />
                        </Field>
                        {sec.id === "story" ? (
                          <Field label="العنوان">
                            <input
                              className={inp}
                              value={d.story_title}
                              onChange={(e) => set({ story_title: e.target.value })}
                            />
                          </Field>
                        ) : (
                          <Field label="العنوان">
                            <input
                              className={inp}
                              value={sec.title}
                              onChange={(e) => setSection(sec.id, { title: e.target.value })}
                            />
                          </Field>
                        )}
                      </div>
                    )}

                    {sec.id === "story" && (
                      <>
                        <Field label="النص">
                          <textarea
                            rows={4}
                            className={cn(inp, "h-auto py-2")}
                            value={d.story_body}
                            onChange={(e) => set({ story_body: e.target.value })}
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {[0, 1].map((k) => (
                            <SingleImageUpload
                              key={k}
                              label={k === 0 ? "الصورة الرئيسية" : "الصورة الصغيرة"}
                              folder="home"
                              url={d.config.storyImages[k] ?? null}
                              className="aspect-[4/5]"
                              emptyTitle="اختر صورة"
                              onChange={(url) => {
                                const next = [...d.config.storyImages];
                                next[k] = url ?? "";
                                setCfg({ storyImages: next.filter(Boolean) });
                              }}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {sec.id === "gallery" && (
                      <>
                        <ImageUploader
                          folder="home"
                          images={d.config.gallery}
                          onChange={(update) =>
                            setD((x) =>
                              x
                                ? {
                                    ...x,
                                    config: {
                                      ...x.config,
                                      gallery: update(x.config.gallery).slice(0, 8),
                                    },
                                  }
                                : x,
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          حتى ٨ صور مربعة تظهر متجاورة. ٣ أو ٦ صور تظهر بثلاثة أعمدة، وغيرها بأربعة.
                        </p>
                      </>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      {manage ? (
                        <Link to={manage.to} className="text-xs text-gold hover:text-navy">
                          {manage.label} ←
                        </Link>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const def = DEFAULT_HOME.sections.find((x) => x.id === sec.id)!;
                          setSection(sec.id, { eyebrow: def.eyebrow, title: def.title });
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-navy"
                      >
                        <RotateCcw className="h-3 w-3" /> العناوين الافتراضية
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Save bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 border-t hairline bg-navy/95 backdrop-blur transition-transform duration-300 md:start-64",
          dirty || saving ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:px-10">
          <span className="text-sm text-cream/80">لديك تغييرات غير محفوظة</span>
          <div className="flex gap-2">
            <Button
              variant="ghostGold"
              onClick={() => setD(initial)}
              disabled={saving}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" /> تراجع
            </Button>
            <Button variant="gold" onClick={save} disabled={saving} className="min-w-28 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-navy/[0.08] bg-ivory p-5 shadow-sm md:p-6">
      <h2 className="text-lg text-navy">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
