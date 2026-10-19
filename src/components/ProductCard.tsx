import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { availabilityLabel, effectivePrice, formatPrice, LOW_STOCK } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductCard({ p, currency }: { p: Product; currency?: string | undefined }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const price = effectivePrice(p);
  const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price);
  const discount = onSale ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0;
  const unavailable =
    p.availability === "unavailable" || (p.availability === "in_stock" && p.stock <= 0);
  const lowStock = !unavailable && p.availability === "in_stock" && p.stock <= LOW_STOCK;
  const needsVariant = p.finishes.length > 0 || p.colors.length > 0;
  const [img1, img2] = p.images;

  const add = () => {
    cart.add({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: img1,
      unitPrice: price,
      quantity: 1,
      maxQty: p.availability === "in_stock" ? p.stock : undefined,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
    toast.success(`أُضيف «${p.name}» إلى السلة`, {
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
            {p.is_featured && !onSale && (
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
            <span className="text-navy">{formatPrice(price, currency)}</span>
            {onSale && (
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
          (needsVariant ? (
            // Products with finishes/colours need a choice on the product page
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
              aria-label={`أضف ${p.name} إلى السلة`}
              title="أضف إلى السلة"
              onClick={add}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center border transition-colors",
                added
                  ? "border-gold bg-gold text-ink"
                  : "hairline text-navy hover:bg-navy hover:text-gold",
              )}
            >
              {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          ))}
      </div>
    </article>
  );
}
