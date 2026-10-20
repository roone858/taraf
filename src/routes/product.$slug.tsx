import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  Minus,
  Plus,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productQuery, settingsQuery } from "@/lib/data";
import { availabilityLabel, effectivePrice, formatPrice, LOW_STOCK } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { priceRange, productSizes, unitPrice } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { QuickOrderDialog } from "@/components/QuickOrderDialog";
import { WhatsappIcon } from "@/components/BrandIcons";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({
    meta: [
      { title: "تفاصيل القطعة — TARAF FURNITURE" },
      {
        name: "description",
        content: "تفاصيل قطعة أثاث فاخرة من طرف: المقاسات، الخامات والتشطيبات.",
      },
      { property: "og:title", content: "قطعة من TARAF FURNITURE" },
      { property: "og:description", content: "أثاث فاخر بتفاصيل منحوتة." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p, isLoading } = useQuery(productQuery(slug));
  const { data: s } = useQuery(settingsQuery);
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [finish, setFinish] = useState<string>();
  const [color, setColor] = useState<string>();
  const [size, setSize] = useState<string>();
  // Set after a blocked add, so the unanswered option groups get flagged
  const [tried, setTried] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const { data: related } = useQuery({
    queryKey: ["related", p?.id],
    enabled: !!p?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_published", true)
        .eq("category_id", p!.category_id!)
        .neq("id", p!.id)
        .limit(4);
      return data ?? [];
    },
  });

  if (isLoading) return <ProductSkeleton />;
  if (!p)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 pt-20 text-center">
        <h1 className="font-display text-3xl text-navy">هذه القطعة غير متاحة</h1>
        <p className="max-w-sm text-muted-foreground">ربما أُزيلت من المجموعة أو تغيّر رابطها.</p>
        <Button asChild className="h-11 gap-2 px-6">
          <Link to="/shop">
            العودة للمتجر <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </main>
    );

  const currency = s?.currency;
  const sizes = productSizes(p);
  const needSize = sizes.length > 0;
  const range = priceRange(p);
  const price = unitPrice(p, size);
  const selectedSize = sizes.find((x) => x.label === size);
  // The struck-through original price only makes sense while the product's own (sale) price applies
  const onSale =
    p.sale_price != null && Number(p.sale_price) < Number(p.price) && !selectedSize?.price;
  const discount = onSale ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0;
  const showFrom = needSize && !size && range.min !== range.max;
  const unavailable =
    p.availability === "unavailable" || (p.availability === "in_stock" && p.stock <= 0);
  const lowStock = !unavailable && p.availability === "in_stock" && p.stock <= LOW_STOCK;
  const max = p.availability === "in_stock" ? p.stock : 99;
  const dims = [
    p.width_cm && `العرض ${p.width_cm} سم`,
    p.height_cm && `الارتفاع ${p.height_cm} سم`,
    p.depth_cm && `العمق ${p.depth_cm} سم`,
  ].filter(Boolean) as string[];
  const needFinish = p.finishes.length > 0;
  const needColor = p.colors.length > 0;

  const missing = [
    needSize && !size && "المقاس",
    needFinish && !finish && "التشطيب",
    needColor && !color && "اللون",
  ].filter(Boolean) as string[];

  const add = () => {
    if (missing.length) {
      setTried(true);
      toast.error(`يرجى اختيار ${missing.join(" و")} أولاً`);
      return;
    }
    const options = [finish, color].filter(Boolean).join(" / ") || undefined;
    const variant = [size, options].filter(Boolean).join(" / ") || undefined;
    cart.add({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images[0],
      variant,
      size,
      options,
      unitPrice: price,
      quantity: qty,
      maxQty: p.availability === "in_stock" ? p.stock : undefined,
    });
    cart.setOpen(true);
  };

  const status = unavailable ? "unavailable" : p.availability;

  return (
    <main className="pt-20">
      <div className="mx-auto max-w-7xl px-5 pt-6 lg:px-10 lg:pt-10">
        <nav aria-label="مسار التصفح" className="text-sm text-muted-foreground">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li className="shrink-0">
              <Link to="/shop" className="transition-colors hover:text-navy">
                المتجر
              </Link>
            </li>
            {p.categories && (
              <>
                <ChevronLeft aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <li className="shrink-0">
                  <Link
                    to="/shop"
                    search={{ cat: p.categories.slug }}
                    className="transition-colors hover:text-navy"
                  >
                    {p.categories.name}
                  </Link>
                </li>
              </>
            )}
            <ChevronLeft aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <li aria-current="page" className="min-w-0 truncate text-navy">
              {p.name}
            </li>
          </ol>
        </nav>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 pb-16 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-8">
        <Gallery
          images={p.images}
          name={p.name}
          badges={
            <>
              {onSale && (
                <span className="bg-gold px-2.5 py-1 text-xs text-ink">خصم {discount}٪</span>
              )}
              {p.is_bestseller && (
                <span className="flex items-center gap-1 bg-ivory/95 px-2.5 py-1 text-xs text-navy">
                  <Flame className="h-3 w-3 text-gold" /> الأكثر مبيعاً
                </span>
              )}
            </>
          }
        />

        <div className="min-w-0 lg:pt-2">
          <h1 className="font-display text-3xl leading-tight text-navy [text-wrap:balance] sm:text-4xl lg:text-5xl">
            {p.name}
          </h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
            {showFrom && <span className="text-sm text-muted-foreground">يبدأ من</span>}
            <span className="text-2xl text-navy tabular-nums sm:text-3xl">
              {formatPrice(showFrom ? range.min : price, currency)}
            </span>
            {onSale && !showFrom && (
              <span className="text-muted-foreground line-through tabular-nums">
                {formatPrice(Number(p.price), currency)}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full",
                  status === "in_stock" && "bg-emerald-600",
                  status === "made_to_order" && "bg-gold",
                  status === "unavailable" && "bg-destructive",
                )}
              />
              <span
                className={status === "unavailable" ? "text-destructive" : "text-foreground/80"}
              >
                {unavailable ? "غير متوفر حالياً" : availabilityLabel[p.availability]}
              </span>
            </span>
            {lowStock && <span className="text-destructive">متبقٍ {p.stock} فقط</span>}
            {p.sku && (
              <span className="text-muted-foreground">
                رمز القطعة{" "}
                <span dir="ltr" className="tabular-nums">
                  {p.sku}
                </span>
              </span>
            )}
          </div>

          {p.description && (
            <p className="mt-6 max-w-[65ch] whitespace-pre-line leading-loose text-foreground/80">
              {p.description}
            </p>
          )}

          {(needSize || needFinish || needColor) && !unavailable && (
            <div className="mt-8 space-y-7 border-t hairline pt-8">
              {needSize && (
                <OptionGroup label="المقاس" value={selectedSize?.label} invalid={tried && !size}>
                  {sizes.map((o) => (
                    <Choice
                      key={o.label}
                      active={size === o.label}
                      onClick={() => setSize(o.label)}
                    >
                      <span>{o.label}</span>
                      {range.min !== range.max && (
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            size === o.label ? "text-gold" : "text-muted-foreground",
                          )}
                        >
                          {formatPrice(o.price ?? effectivePrice(p), currency)}
                        </span>
                      )}
                    </Choice>
                  ))}
                </OptionGroup>
              )}
              {needFinish && (
                <OptionGroup label="التشطيب" value={finish} invalid={tried && !finish}>
                  {p.finishes.map((x) => (
                    <Choice key={x} active={finish === x} onClick={() => setFinish(x)}>
                      {x}
                    </Choice>
                  ))}
                </OptionGroup>
              )}
              {needColor && (
                <OptionGroup label="اللون / القماش" value={color} invalid={tried && !color}>
                  {p.colors.map((x) => (
                    <Choice key={x} active={color === x} onClick={() => setColor(x)}>
                      {x}
                    </Choice>
                  ))}
                </OptionGroup>
              )}
            </div>
          )}

          {!unavailable && (
            <div className="mt-8 space-y-3">
              <div className="flex gap-3">
                <div
                  className="flex h-12 shrink-0 items-center border border-navy/20"
                  role="group"
                  aria-label="الكمية"
                >
                  <button
                    type="button"
                    aria-label="زيادة الكمية"
                    disabled={qty >= max}
                    className="flex h-full w-11 items-center justify-center text-navy transition-colors hover:bg-navy/5 disabled:opacity-30"
                    onClick={() => setQty((q) => Math.min(max, q + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center tabular-nums" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="إنقاص الكمية"
                    disabled={qty <= 1}
                    className="flex h-full w-11 items-center justify-center text-navy transition-colors hover:bg-navy/5 disabled:opacity-30"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={add}
                  className="h-12 flex-1 text-base"
                  aria-disabled={missing.length > 0}
                >
                  {missing.length ? `اختر ${missing[0]}` : "أضف إلى السلة"}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="flex h-12 w-full items-center justify-center gap-2 border border-gold/60 text-navy transition-colors hover:border-gold hover:bg-gold hover:text-ink"
              >
                <WhatsappIcon className="h-4 w-4" /> اطلب الآن عبر واتساب
              </button>
              <QuickOrderDialog
                p={p}
                open={quickOpen}
                onOpenChange={setQuickOpen}
                initialSize={size}
              />
            </div>
          )}

          {(dims.length > 0 || p.materials) && (
            <section className="mt-10 border-t hairline pt-8" aria-labelledby="specs">
              <h2 id="specs" className="font-sans text-base text-navy">
                المواصفات
              </h2>
              <dl className="mt-4 divide-y divide-border text-sm">
                {dims.length > 0 && (
                  <Spec icon={<Ruler className="h-4 w-4" />} label="الأبعاد">
                    <span className="tabular-nums">{dims.join(" · ")}</span>
                  </Spec>
                )}
                {p.materials && (
                  <Spec icon={<Layers className="h-4 w-4" />} label="الخامات">
                    {p.materials}
                  </Spec>
                )}
              </dl>
            </section>
          )}

          {s?.policies && (
            <details className="group mt-8 border-y hairline">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-sm text-navy [&::-webkit-details-marker]:hidden">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <span className="flex-1">سياسة التوصيل والاسترجاع</span>
                <Plus className="h-4 w-4 transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="max-w-[65ch] whitespace-pre-line pb-5 text-sm leading-loose text-muted-foreground">
                {s.policies}
              </p>
            </details>
          )}
        </div>
      </div>

      {related && related.length > 0 && (
        <section className="border-t hairline bg-ivory/60">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24">
            <div className="mb-8 flex items-end justify-between gap-4 lg:mb-10">
              <h2 className="font-display text-2xl text-navy sm:text-3xl">قطع ذات صلة</h2>
              {p.categories && (
                <Link
                  to="/shop"
                  search={{ cat: p.categories.slug }}
                  className="flex shrink-0 items-center gap-1.5 text-sm text-navy underline-offset-4 hover:underline"
                >
                  عرض الكل <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} currency={currency} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

/** Main photo with arrows, swipe and arrow-key navigation, plus a thumbnail strip. */
function Gallery({
  images,
  name,
  badges,
}: {
  images: string[];
  name: string;
  badges: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const go = (to: number) => setI(((to % n) + n) % n);

  return (
    <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div
        role="region"
        aria-roledescription="معرض صور"
        aria-label={`صور ${name}`}
        tabIndex={n > 1 ? 0 : undefined}
        // RTL: the next photo sits to the left
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(i + 1);
          if (e.key === "ArrowRight") go(i - 1);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || Math.abs(end - start) < 40) return;
          go(end > start ? i + 1 : i - 1);
        }}
        className="group/gallery relative aspect-[4/5] overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {images[i] && (
          <img
            key={images[i]}
            src={images[i]}
            alt={n > 1 ? `${name} — صورة ${i + 1} من ${n}` : name}
            className="h-full w-full animate-in object-cover fade-in duration-500"
          />
        )}
        <div className="absolute top-3 start-3 flex flex-col items-start gap-1.5">{badges}</div>
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="الصورة السابقة"
              onClick={() => go(i - 1)}
              className="absolute top-1/2 start-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-ivory/90 text-navy shadow-[0_2px_10px_rgb(13_21_34/0.12)] transition-opacity hover:bg-ivory lg:opacity-0 lg:group-hover/gallery:opacity-100 lg:focus-visible:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="الصورة التالية"
              onClick={() => go(i + 1)}
              className="absolute top-1/2 end-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-ivory/90 text-navy shadow-[0_2px_10px_rgb(13_21_34/0.12)] transition-opacity hover:bg-ivory lg:opacity-0 lg:group-hover/gallery:opacity-100 lg:focus-visible:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 end-3 bg-ink/70 px-2.5 py-1 text-xs text-cream tabular-nums">
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:gap-3">
          {images.map((src, idx) => (
            <button
              key={src}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`عرض الصورة ${idx + 1}`}
              aria-current={idx === i || undefined}
              className={cn(
                "aspect-square w-16 shrink-0 overflow-hidden border-2 transition-[border-color,opacity] sm:w-20",
                idx === i ? "border-gold" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionGroup({
  label,
  value,
  invalid,
  children,
}: {
  label: string;
  value?: string | undefined;
  invalid: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 flex w-full items-baseline gap-2 text-sm">
        <span className={invalid ? "text-destructive" : "text-navy"}>
          {label} <span className="text-destructive">*</span>
        </span>
        {value ? (
          <span className="min-w-0 truncate text-muted-foreground">— {value}</span>
        ) : (
          invalid && <span className="text-xs text-destructive">مطلوب</span>
        )}
      </legend>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={label}
        aria-invalid={invalid || undefined}
      >
        {children}
      </div>
    </fieldset>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-20 flex-col items-start justify-center gap-0.5 border px-4 py-2 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        active
          ? "border-navy bg-navy text-cream"
          : "border-navy/15 bg-ivory text-ink hover:border-gold",
      )}
    >
      {children}
    </button>
  );
}

function Spec({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="flex w-24 shrink-0 items-center gap-2 text-muted-foreground">
        <span className="text-gold">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 text-foreground/85">{children}</dd>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <main className="pt-20" aria-busy="true" aria-label="جارٍ تحميل القطعة">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:px-10">
        <div className="aspect-[4/5] animate-pulse bg-muted" />
        <div className="space-y-4 lg:pt-2">
          <div className="h-10 w-3/4 animate-pulse bg-muted" />
          <div className="h-8 w-32 animate-pulse bg-muted" />
          <div className="h-4 w-24 animate-pulse bg-muted" />
          <div className="mt-8 h-24 animate-pulse bg-muted" />
          <div className="h-12 animate-pulse bg-muted" />
        </div>
      </div>
    </main>
  );
}
