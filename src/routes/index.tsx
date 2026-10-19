import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { Emblem } from "@/components/Logo";
import { categoriesQuery, featuredQuery, newestQuery, settingsQuery } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TARAF FURNITURE — أناقة خالدة تُصاغ بالحرفة" },
      { name: "description", content: "اكتشف أثاث طرف الفاخر: قطع منحوتة، كنب راقٍ، سفرة وغرف نوم بتفاصيل حرفية." },
      { property: "og:title", content: "TARAF FURNITURE — أثاث فاخر" },
      { property: "og:description", content: "قطع أثاث فاخرة منحوتة بعناية لمنزلك." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats } = useQuery(categoriesQuery);
  const { data: featured } = useQuery(featuredQuery);
  const { data: newest } = useQuery(newestQuery);

  return (
    <main>
      <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink">
        <img
          src={s?.hero_image_url || "/images/hero.jpg"}
          alt="أريكة منحوتة فاخرة"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1088}
        />
        <div className="absolute inset-0 bg-veil" />
        <div className="absolute inset-x-10 top-28 hidden h-px bg-gold/30 lg:block" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-24 lg:px-10">
          <p className="eyebrow fade-up">TARAF FURNITURE</p>
          <h1 className="fade-up mt-6 max-w-3xl font-display text-5xl text-cream md:text-7xl" style={{ animationDelay: ".15s" }}>
            {s?.hero_title ?? "أناقة خالدة تُصاغ بالحرفة"}
          </h1>
          <p className="fade-up mt-6 max-w-xl text-lg text-cream/80" style={{ animationDelay: ".3s" }}>
            {s?.hero_subtitle}
          </p>
          <div className="fade-up mt-10 flex flex-wrap gap-4" style={{ animationDelay: ".45s" }}>
            <Button asChild variant="gold" className="h-12 px-8">
              <Link to="/shop">تسوّق الآن</Link>
            </Button>
            <Button asChild variant="ghostGold" className="h-12 px-8">
              <a href="#collections">استكشف المجموعات</a>
            </Button>
          </div>
        </div>
      </section>

      {s?.promo_banner && (
        <div className="bg-gold py-3 text-center text-sm text-ink">{s.promo_banner}</div>
      )}

      <section id="collections" className="mx-auto max-w-7xl px-5 py-28 lg:px-10">
        <div className="mb-14 flex items-end justify-between">
          <div>
            <p className="eyebrow">المجموعات</p>
            <h2 className="mt-3 font-display text-4xl text-navy md:text-5xl">مساحات تُروى بالتفاصيل</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {cats?.map((c, i) => (
            <Link
              key={c.id}
              to="/shop"
              search={{ cat: c.slug }}
              className={`group relative overflow-hidden bg-ink ${i === 0 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" : "aspect-[4/5] md:aspect-square"}`}
            >
              {c.image_url && (
                <img src={c.image_url} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85 transition-transform duration-[1.6s] group-hover:scale-105" />
              )}
              <div className="absolute inset-0 bg-veil" />
              <div className="absolute inset-x-5 bottom-5">
                <h3 className="font-sans text-xl text-cream md:text-2xl">{c.name}</h3>
                <span className="mt-2 flex items-center gap-2 text-xs text-gold">
                  اكتشف <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {featured && featured.length > 0 && (
        <section className="bg-ivory py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-10">
            <div className="mb-14 flex items-end justify-between">
              <div>
                <p className="eyebrow">مختارات</p>
                <h2 className="mt-3 font-display text-4xl text-navy md:text-5xl">قطع مميزة</h2>
              </div>
              <Link to="/shop" className="text-sm text-navy hover:text-gold">عرض الكل</Link>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
              {featured.map((p) => <ProductCard key={p.id} p={p} currency={s?.currency} />)}
            </div>
          </div>
        </section>
      )}

      <section className="bg-silk py-32 text-cream">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 md:grid-cols-2 lg:px-10">
          <div className="relative">
            <img src="/images/p-chair.jpg" alt="تفاصيل النحت" loading="lazy" className="aspect-[4/5] w-full object-cover md:w-4/5" />
            <div className="absolute -bottom-8 left-0 hidden w-2/5 border hairline p-2 md:block">
              <img src="/images/p-decor.jpg" alt="" loading="lazy" className="aspect-square w-full object-cover" />
            </div>
          </div>
          <div>
            <Emblem className="h-12 w-12" />
            <p className="eyebrow mt-6">قصتنا</p>
            <h2 className="mt-4 font-display text-4xl md:text-5xl">{s?.story_title}</h2>
            <div className="my-8 h-px w-24 bg-gold/60" />
            <p className="max-w-lg text-lg leading-loose text-cream/75">{s?.story_body}</p>
          </div>
        </div>
      </section>

      {newest && newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-28 lg:px-10">
          <p className="eyebrow">وصل حديثاً</p>
          <h2 className="mb-14 mt-3 font-display text-4xl text-navy md:text-5xl">أحدث الإضافات</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
            {newest.map((p) => <ProductCard key={p.id} p={p} currency={s?.currency} />)}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4">
        {["/images/cat-dining.jpg", "/images/p-table.jpg", "/images/cat-bedroom.jpg", "/images/cat-living.jpg"].map((src) => (
          <img key={src} src={src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
        ))}
      </section>
    </main>
  );
}
