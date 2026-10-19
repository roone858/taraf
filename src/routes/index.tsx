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
  featuredQuery,
  onSaleQuery,
  settingsQuery,
  testimonialsQuery,
  type Product,
} from "@/lib/data";
import { parseHomeConfig, type SectionConfig, type SectionId } from "@/lib/home-config";
import { TestimonialsSlider } from "@/components/TestimonialsSlider";
import { FaqSection } from "@/components/FaqSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TARAF FURNITURE — أناقة خالدة تُصاغ بالحرفة" },
      {
        name: "description",
        content: "اكتشف أثاث طرف الفاخر: قطع منحوتة، كنب راقٍ، سفرة وغرف نوم بتفاصيل حرفية.",
      },
      { property: "og:title", content: "TARAF FURNITURE — أثاث فاخر" },
      { property: "og:description", content: "قطع أثاث فاخرة منحوتة بعناية لمنزلك." },
    ],
  }),
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
      <section id="collections" className="mx-auto max-w-7xl px-5 py-28 lg:px-10">
        <Heading c={c} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {cats?.map((cat, i) => (
            <Link
              key={cat.id}
              to="/shop"
              search={{ cat: cat.slug }}
              className={`group relative overflow-hidden bg-ink ${i === 0 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" : "aspect-[4/5] md:aspect-square"}`}
            >
              {cat.image_url && (
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-85 transition-transform duration-[1.6s] group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-veil" />
              <div className="absolute inset-x-5 bottom-5">
                <h3 className="font-sans text-xl text-cream md:text-2xl">{cat.name}</h3>
                <span className="mt-2 flex items-center gap-2 text-xs text-gold">
                  اكتشف{" "}
                  <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
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
          icon={<Flame className="h-3.5 w-3.5" />}
          aside={
            <Link to="/shop" className="text-sm text-navy hover:text-gold">
              تصفح المتجر
            </Link>
          }
          products={bestsellers}
          currency={currency}
        />
      ) : null,

    offers: (c) =>
      onSale && onSale.length > 0 ? (
        <ProductRail
          c={c}
          className="border-y border-gold/30"
          icon={<BadgePercent className="h-3.5 w-3.5" />}
          aside={
            <span className="inline-flex items-center gap-2 bg-gold px-4 py-2 text-sm text-ink">
              خصم حتى {maxDiscount}٪
            </span>
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
          aside={
            <Link to="/shop" className="text-sm text-navy hover:text-gold">
              عرض الكل
            </Link>
          }
          products={featured}
          currency={currency}
        />
      ) : null,

    story: (c) => {
      const [main, inset] = cfg.storyImages;
      return (
        <section className="bg-silk py-32 text-cream">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 md:grid-cols-2 lg:px-10">
            {main && (
              <div className="relative">
                <img
                  src={main}
                  alt={s?.story_title ?? ""}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover md:w-4/5"
                />
                {inset && (
                  <div className="absolute -bottom-8 left-0 hidden w-2/5 border hairline p-2 md:block">
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
              <Emblem className={`h-12 w-12 ${main ? "" : "md:mx-auto"}`} />
              {c.eyebrow && <p className="eyebrow mt-6">{c.eyebrow}</p>}
              <h2 className="mt-4 font-display text-4xl md:text-5xl">{s?.story_title}</h2>
              <div className={`my-8 h-px w-24 bg-gold/60 ${main ? "" : "md:mx-auto"}`} />
              <p className="max-w-lg text-lg leading-loose whitespace-pre-line text-cream/75 md:max-w-none">
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
          className={`grid grid-cols-2 ${cfg.gallery.length % 3 === 0 ? "md:grid-cols-3" : "md:grid-cols-4"}`}
          aria-label="معرض الصور"
        >
          {cfg.gallery.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={src}
              alt=""
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
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
        />
        <div className="absolute inset-0 bg-veil" />
        <div className="absolute inset-x-10 top-28 hidden h-px bg-gold/30 lg:block" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-24 lg:px-10">
          {cfg.hero.eyebrow && <p className="eyebrow fade-up">{cfg.hero.eyebrow}</p>}
          <h1
            className="fade-up mt-6 max-w-3xl font-display text-5xl text-cream md:text-7xl"
            style={{ animationDelay: ".15s" }}
          >
            {s?.hero_title ?? "أناقة خالدة تُصاغ بالحرفة"}
          </h1>
          {s?.hero_subtitle && (
            <p
              className="fade-up mt-6 max-w-xl text-lg text-cream/80"
              style={{ animationDelay: ".3s" }}
            >
              {s.hero_subtitle}
            </p>
          )}
          {(cfg.hero.primaryLabel || cfg.hero.secondaryLabel) && (
            <div className="fade-up mt-10 flex flex-wrap gap-4" style={{ animationDelay: ".45s" }}>
              {cfg.hero.primaryLabel && (
                <Button asChild variant="gold" className="h-12 px-8">
                  <Link to="/shop">{cfg.hero.primaryLabel}</Link>
                </Button>
              )}
              {cfg.hero.secondaryLabel && (
                <Button asChild variant="ghostGold" className="h-12 px-8">
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
        <div className="bg-gold py-3 text-center text-sm text-ink">{s.promo_banner}</div>
      )}

      {cfg.sections
        .filter((c) => c.visible)
        .map((c) => (
          <Fragment key={c.id}>{sections[c.id](c)}</Fragment>
        ))}
    </main>
  );
}

function Heading({ c, icon, aside }: { c: SectionConfig; icon?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
      <div>
        {c.eyebrow && (
          <p className="eyebrow flex items-center gap-2">
            {icon} {c.eyebrow}
          </p>
        )}
        {c.title && (
          <h2 id={`${c.id}-title`} className="mt-3 font-display text-4xl text-navy md:text-5xl">
            {c.title}
          </h2>
        )}
      </div>
      {aside}
    </div>
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
      className={`py-28 ${className}`}
      aria-labelledby={c.title ? `${c.id}-title` : undefined}
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Heading c={c} icon={icon} aside={aside} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} currency={currency} />
          ))}
        </div>
      </div>
    </section>
  );
}
