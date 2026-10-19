import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Flame, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { availabilityLabel, effectivePrice, formatPrice, LOW_STOCK } from "@/lib/format";
import { priceRange, productSizes, unitPrice } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "./BrandIcons";
import { QuickOrderDialog } from "./QuickOrderDialog";

export function ProductCard({ p, currency }: { p: Product; currency?: string | undefined }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const [size, setSize] = useState<string>();
  const [nudge, setNudge] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const sizes = productSizes(p);
  const hasSizes = sizes.length > 0;
  const hasOptions = p.finishes.length > 0 || p.colors.length > 0;
  // Sizes alone can be picked right on the card; finishes/colours still need the product page
  const quickSizes = hasSizes && !hasOptions;
  const selected = sizes.find((s) => s.label === size);
  const price = unitPrice(p, size);
  const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price) && !selected?.price;
  const discount = onSale ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0;
  const unavailable =
    p.availability === "unavailable" || (p.availability === "in_stock" && p.stock <= 0);
  const lowStock = !unavailable && p.availability === "in_stock" && p.stock <= LOW_STOCK;
  const range = priceRange(p);
  const fromPrice = hasSizes && !size && range.min !== range.max;
  const [img1, img2] = p.images;
  const MAX_CHIPS = 4;

  const add = () => {
    if (quickSizes && !size) {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 1400);
      toast.message("اختر المقاس أولاً");
      return;
    }
    cart.add({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: img1,
      variant: size,
      size,
      unitPrice: price,
      quantity: 1,
      maxQty: p.availability === "in_stock" ? p.stock : undefined,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
    toast.success(`أُضيف «${p.name}»${size ? ` (${size})` : ""} إلى السلة`, {
      action: { label: "عرض السلة", onClick: () => cart.setOpen(true) },
    });
  };

  return (
    <article className="group">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="block" aria-label={p.name}>
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          {img1 && (
            <img
              src={img1}
              alt={p.name}
              loading="lazy"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-all duration-[1.2s] ease-out group-hover:scale-105",
                img2 && "group-hover:opacity-0",
                unavailable && "grayscale-[60%]",
              )}
            />
          )}
          {/* Second photo fades in on hover */}
          {img2 && (
            <img
              src={img2}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          )}
          <div className="absolute top-3 start-3 flex flex-col items-start gap-1.5">
            {onSale && (
              <span className="bg-gold px-2.5 py-1 text-xs text-ink">خصم {discount}٪</span>
            )}
            {p.is_bestseller && (
              <span className="flex items-center gap-1 bg-ivory/95 px-2.5 py-1 text-xs text-navy">
                <Flame className="h-3 w-3 text-gold" /> الأكثر مبيعاً
              </span>
            )}
            {p.is_featured && !onSale && !p.is_bestseller && (
              <span className="bg-navy/85 px-2.5 py-1 text-xs text-cream">مميز</span>
            )}
          </div>
          {unavailable && (
            <span className="absolute top-3 end-3 bg-ink/80 px-2.5 py-1 text-xs text-cream">
              غير متوفر
            </span>
          )}
        </div>
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/product/$slug" params={{ slug: p.slug }}>
            <h3 className="line-clamp-2 font-sans text-base text-ink transition-colors group-hover:text-navy sm:text-lg">
              {p.name}
            </h3>
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-sm">
            {fromPrice && <span className="text-xs text-muted-foreground">يبدأ من</span>}
            <span className="text-navy">
              {formatPrice(fromPrice ? range.min : price, currency)}
            </span>
            {onSale && !fromPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(Number(p.price), currency)}
              </span>
            )}
          </div>
          {!unavailable && p.availability === "made_to_order" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {availabilityLabel["made_to_order"]}
            </p>
          )}
          {lowStock && <p className="mt-1 text-xs text-destructive">متبقٍ {p.stock} فقط</p>}
        </div>

        {!unavailable &&
          (hasOptions ? (
            // Finishes/colours need a choice on the product page
            <Link
              to="/product/$slug"
              params={{ slug: p.slug }}
              aria-label={`اختر خيارات ${p.name}`}
              title="اختر الخيارات"
              className="flex h-10 w-10 shrink-0 items-center justify-center border hairline text-navy transition-colors hover:bg-navy hover:text-gold"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              aria-label={
                quickSizes && !size ? `اختر مقاس ${p.name} أولاً` : `أضف ${p.name} إلى السلة`
              }
              title={quickSizes && !size ? "اختر المقاس أولاً" : "أضف إلى السلة"}
              onClick={add}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center border transition-colors",
                added
                  ? "border-gold bg-gold text-ink"
                  : quickSizes && !size
                    ? "hairline text-navy/40 hover:text-navy"
                    : "hairline text-navy hover:bg-navy hover:text-gold",
              )}
            >
              {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          ))}
      </div>

      {/* Sizes: selectable on the card when they're the only choice; listed otherwise */}
      {hasSizes && !unavailable && (
        <div className="mt-3">
          {quickSizes ? (
            <div
              className={cn(
                "flex flex-wrap gap-1.5 rounded-sm transition-shadow",
                nudge && "ring-2 ring-gold ring-offset-2 ring-offset-background",
              )}
              role="radiogroup"
              aria-label={`مقاس ${p.name}`}
            >
              {sizes.slice(0, MAX_CHIPS).map((s) => {
                const active = size === s.label;
                return (
                  <button
                    key={s.label}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSize(active ? undefined : s.label)}
                    title={formatPrice(s.price ?? effectivePrice(p), currency)}
                    className={cn(
                      "border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-navy bg-navy text-cream"
                        : "border-navy/15 text-navy hover:border-gold",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
              {sizes.length > MAX_CHIPS && (
                <Link
                  to="/product/$slug"
                  params={{ slug: p.slug }}
                  className="border border-dashed border-navy/20 px-2.5 py-1 text-xs text-muted-foreground hover:border-gold hover:text-navy"
                  aria-label={`كل مقاسات ${p.name}`}
                >
                  +{sizes.length - MAX_CHIPS}
                </Link>
              )}
            </div>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              المقاسات: {sizes.map((s) => s.label).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Direct single-product order: records the order, then opens WhatsApp */}
      {!unavailable && (
        <>
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 border border-gold/60 text-sm text-navy transition-colors hover:border-gold hover:bg-gold hover:text-ink"
          >
            <WhatsappIcon className="h-4 w-4" /> اطلب الآن عبر واتساب
          </button>
          <QuickOrderDialog p={p} open={quickOpen} onOpenChange={setQuickOpen} initialSize={size} />
        </>
      )}
    </article>
  );
}
