import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode } from "react";
import { ArrowLeft, BadgePercent, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { Emblem } from "@/components/Logo";
import {
  bestsellersQuery,
  categoriesQuery,
  faqsQuery,
  featuredQuery,
  onSaleQuery,
  settingsQuery,
  testimonialsQuery,
  type Product,
} from "@/lib/data";
import { parseHomeConfig, type SectionConfig, type SectionId } from "@/lib/home-config";
import { cn } from "@/lib/utils";
import { pageHead, storeJsonLd } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { TestimonialsSlider } from "@/components/TestimonialsSlider";
import { FaqSection } from "@/components/FaqSection";

export const Route = createFileRoute("/")({
  // Everything above the fold and the product rails render on the server
  loader: async ({ context: { queryClient } }) => {
    const warm = (p: Promise<unknown>) => p.catch(() => null);
    const [{ s, seo, store }] = await Promise.all([
      loadSeo(queryClient),
      warm(queryClient.ensureQueryData(categoriesQuery)),
      warm(queryClient.ensureQueryData(featuredQuery)),
      warm(queryClient.ensureQueryData(bestsellersQuery)),
      warm(queryClient.ensureQueryData(onSaleQuery)),
      warm(queryClient.ensureQueryData(testimonialsQuery)),
      warm(queryClient.ensureQueryData(faqsQuery)),
    ]);
    return { s, seo, store };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { s, seo, store } = loaderData;
    const tagline = s?.hero_title || "أناقة خالدة تُصاغ بالحرفة";
    return pageHead({
      seo,
      store,
      rawTitle: seo.homeTitle || `${store} — ${tagline}`,
      description:
        seo.homeDescription ||
        s?.hero_subtitle ||
        `اكتشف أثاث ${store} الفاخر: قطع منحوتة، كنب راقٍ، سفرة وغرف نوم بتفاصيل حرفية.`,
      image: seo.shareImage || s?.hero_image_url,
      path: "/",
      jsonLd: storeJsonLd(s, seo),
    });
  },
  component: Home,
});

/** Section order, visibility and titles come from Admin → الصفحة الرئيسية (store_settings.home_config). */
function Home() {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats } = useQuery(categoriesQuery);
  const { data: featured } = useQuery(featuredQuery);
  const { data: testimonials } = useQuery(testimonialsQuery);
  const { data: bestsellers } = useQuery(bestsellersQuery);
  const { data: onSale } = useQuery(onSaleQuery);
  const cfg = parseHomeConfig(s?.home_config);
  const collectionsShown = cfg.sections.some((x) => x.id === "collections" && x.visible);
  const maxDiscount = Math.max(
    0,
    ...(onSale ?? []).map((p) => Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100)),
  );
  const currency = s?.currency;

  const sections: Record<SectionId, (c: SectionConfig) => ReactNode> = {
    collections: (c) => (
      <section
        id="collections"
        className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 md:py-24 lg:px-10"
        aria-labelledby={c.title ? "collections-title" : undefined}
      >
        <Heading c={c} aside={<MoreLink to="/shop">كل القطع</MoreLink>} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6">
          {/* Placeholder tiles hold the layout while categories load */}
          {!cats &&
            Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className={cn(
                  "aspect-[4/5] animate-pulse bg-muted",
                  i === 0 ? "md:row-span-2 md:aspect-auto" : "md:aspect-square",
                )}
              />
            ))}
          {cats?.map((cat, i) => (
            <Link
              key={cat.id}
              to="/shop"
              search={{ cat: cat.slug }}
              className={cn(
                "group relative aspect-[4/5] overflow-hidden bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
                // The lead collection gets the tall slot from md up
                i === 0 && "md:row-span-2 md:aspect-auto",
                i > 0 && "md:aspect-square",
              )}
            >
              {cat.image_url && (
                <img
                  src={cat.image_url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-[1.6s] ease-out group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-veil" />
              <div className="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5">
                <h3 className="font-sans text-lg text-cream text-balance sm:text-xl md:text-2xl">
                  {cat.name}
                </h3>
                <span className="mt-1.5 flex items-center gap-2 text-xs text-gold sm:text-sm">
                  اكتشف
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    ),

    bestsellers: (c) =>
      bestsellers && bestsellers.length > 0 ? (
        <ProductRail
          c={c}
          className="bg-ivory"
          icon={<Flame className="h-4 w-4 text-gold" />}
          aside={<MoreLink to="/shop">تصفح المتجر</MoreLink>}
          products={bestsellers}
          currency={currency}
        />
      ) : null,

    offers: (c) =>
      onSale && onSale.length > 0 ? (
        <ProductRail
          c={c}
          className="border-y hairline"
          icon={<BadgePercent className="h-4 w-4 text-gold" />}
          aside={
            maxDiscount > 0 && (
              <span className="inline-flex items-center gap-2 bg-gold px-4 py-2 text-sm text-ink">
                خصم حتى {maxDiscount}٪
              </span>
            )
          }
          products={onSale}
          currency={currency}
        />
      ) : null,

    featured: (c) =>
      featured && featured.length > 0 ? (
        <ProductRail
          c={c}
          className="bg-ivory"
          aside={<MoreLink to="/shop">عرض الكل</MoreLink>}
          products={featured}
          currency={currency}
        />
      ) : null,

    story: (c) => {
      const [main, inset] = cfg.storyImages;
      return (
        <section className="overflow-hidden bg-silk py-20 text-cream md:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:grid-cols-2 md:gap-16 lg:px-10">
            {main && (
              <div className="relative md:pb-8">
                <img
                  src={main}
                  alt={s?.story_title ?? ""}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover md:w-4/5"
                />
                {inset && (
                  <div className="absolute bottom-0 end-0 hidden w-2/5 border hairline bg-ink p-2 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.5)] md:block">
                    <img
                      src={inset}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}
            <div className={main ? "" : "md:col-span-2 md:mx-auto md:max-w-2xl md:text-center"}>
              <Emblem className={cn("h-12 w-12", !main && "md:mx-auto")} />
              <h2 className="mt-6 font-display text-3xl text-balance md:text-5xl">
                {s?.story_title}
              </h2>
              {c.eyebrow && <p className="mt-3 text-gold">{c.eyebrow}</p>}
              <div className={cn("my-7 h-px w-20 bg-gold/60", !main && "md:mx-auto")} />
              <p className="max-w-[60ch] text-base leading-loose whitespace-pre-line text-cream/80 md:text-lg">
                {s?.story_body}
              </p>
            </div>
          </div>
        </section>
      );
    },

    testimonials: (c) =>
      testimonials && testimonials.length > 0 ? (
        <TestimonialsSlider items={testimonials.slice(0, 12)} eyebrow={c.eyebrow} title={c.title} />
      ) : null,

    faq: (c) => <FaqSection eyebrow={c.eyebrow} title={c.title} />,

    gallery: () =>
      cfg.gallery.length > 0 ? (
        <section
          className={cn(
            "grid grid-cols-2 gap-px bg-ink",
            cfg.gallery.length % 3 === 0 ? "md:grid-cols-3" : "md:grid-cols-4",
          )}
          aria-label="معرض الصور"
        >
          {cfg.gallery.map((src, i) => (
            <div key={`${src}-${i}`} className="group overflow-hidden">
              <img
                src={src}
                alt=""
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
              />
            </div>
          ))}
        </section>
      ) : null,
  };

  return (
    <main>
      <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink">
        <img
          src={s?.hero_image_url || "/images/hero.jpg"}
          alt={s?.hero_title ?? "TARAF FURNITURE"}
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1088}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-veil" />
        <div className="absolute inset-x-10 top-28 hidden h-px bg-gold/30 lg:block" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-24 lg:px-10">
          <h1 className="fade-up max-w-3xl font-display text-4xl leading-[1.15] text-cream text-balance sm:text-5xl md:text-7xl">
            {s?.hero_title ?? "أناقة خالدة تُصاغ بالحرفة"}
          </h1>
          {cfg.hero.eyebrow && (
            <p
              className="fade-up mt-4 flex items-center gap-3 text-gold"
              style={{ animationDelay: ".1s" }}
            >
              <span aria-hidden className="h-px w-8 bg-gold/70" />
              {cfg.hero.eyebrow}
            </p>
          )}
          {s?.hero_subtitle && (
            <p
              className="fade-up mt-5 max-w-xl text-base leading-relaxed text-cream/85 md:text-lg"
              style={{ animationDelay: ".2s" }}
            >
              {s.hero_subtitle}
            </p>
          )}
          {(cfg.hero.primaryLabel || cfg.hero.secondaryLabel) && (
            <div
              className="fade-up mt-8 flex flex-wrap gap-3 md:mt-10 md:gap-4"
              style={{ animationDelay: ".3s" }}
            >
              {cfg.hero.primaryLabel && (
                <Button asChild variant="gold" className="h-12 flex-1 px-8 sm:flex-none">
                  <Link to="/shop">{cfg.hero.primaryLabel}</Link>
                </Button>
              )}
              {cfg.hero.secondaryLabel && (
                <Button asChild variant="ghostGold" className="h-12 flex-1 px-8 sm:flex-none">
                  {collectionsShown ? (
                    <a href="#collections">{cfg.hero.secondaryLabel}</a>
                  ) : (
                    <Link to="/shop">{cfg.hero.secondaryLabel}</Link>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {s?.promo_banner && (
        <div className="bg-gold px-5 py-3 text-center text-sm text-ink text-balance">
          {s.promo_banner}
        </div>
      )}

      {cfg.sections
        .filter((c) => c.visible)
        .map((c) => (
          <Fragment key={c.id}>{sections[c.id](c)}</Fragment>
        ))}
    </main>
  );
}

/**
 * Section heading. The admin-managed "eyebrow" text renders as a short lead under the title
 * rather than as a label above it.
 */
function Heading({ c, icon, aside }: { c: SectionConfig; icon?: ReactNode; aside?: ReactNode }) {
  if (!c.title && !c.eyebrow && !aside) return null;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-12">
      <div className="min-w-0">
        {c.title && (
          <h2
            id={`${c.id}-title`}
            className="flex items-center gap-3 font-display text-3xl text-navy text-balance md:text-5xl"
          >
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-navy md:h-11 md:w-11">
                {icon}
              </span>
            )}
            {c.title}
          </h2>
        )}
        {c.eyebrow && <p className="mt-3 max-w-xl text-muted-foreground">{c.eyebrow}</p>}
      </div>
      {aside}
    </div>
  );
}

function MoreLink({ to, children }: { to: "/shop"; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex shrink-0 items-center gap-1.5 text-sm text-navy underline decoration-gold underline-offset-[6px] transition-colors hover:decoration-navy"
    >
      {children}
      <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
    </Link>
  );
}

function ProductRail({
  c,
  className,
  icon,
  aside,
  products,
  currency,
}: {
  c: SectionConfig;
  className: string;
  icon?: ReactNode;
  aside?: ReactNode;
  products: Product[];
  currency: string | undefined;
}) {
  return (
    <section
      className={cn("py-16 md:py-24", className)}
      aria-labelledby={c.title ? `${c.id}-title` : undefined}
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Heading c={c} icon={icon} aside={aside} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-14">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} currency={currency} />
          ))}
        </div>
      </div>
    </section>
  );
}
