import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/data";
import { useCart } from "@/lib/cart";
import { availabilityLabel, effectivePrice, formatPrice } from "@/lib/format";

export function ProductCard({ p, currency }: { p: Product; currency?: string | undefined }) {
  const cart = useCart();
  const price = effectivePrice(p);
  const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price);
  const unavailable = p.availability === "unavailable" || (p.availability === "in_stock" && p.stock <= 0);
  const needsVariant = p.finishes.length > 0 || p.colors.length > 0;

  return (
    <article className="group">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          {p.images[0] && (
            <img
              src={p.images[0]}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105"
            />
          )}
          {onSale && <span className="absolute top-4 right-4 bg-gold px-3 py-1 text-xs text-ink">عرض خاص</span>}
          {unavailable && (
            <span className="absolute top-4 left-4 bg-ink/80 px-3 py-1 text-xs text-cream">غير متوفر</span>
          )}
        </div>
      </Link>
      <div className="mt-5 flex items-start justify-between gap-3">
        <div>
          <Link to="/product/$slug" params={{ slug: p.slug }}>
            <h3 className="text-lg font-sans text-ink transition-colors group-hover:text-navy">{p.name}</h3>
          </Link>
          <div className="mt-1 flex items-baseline gap-3 text-sm">
            <span className="text-navy">{formatPrice(price, currency)}</span>
            {onSale && <span className="text-muted-foreground line-through">{formatPrice(Number(p.price), currency)}</span>}
          </div>
          {!unavailable && p.availability === "made_to_order" && (
            <p className="mt-1 text-xs text-muted-foreground">{availabilityLabel["made_to_order"]}</p>
          )}
        </div>
        {!unavailable && !needsVariant && (
          <button
            aria-label={`أضف ${p.name} إلى السلة`}
            onClick={() => {
              cart.add({
                productId: p.id,
                slug: p.slug,
                name: p.name,
                image: p.images[0],
                unitPrice: price,
                quantity: 1,
                maxQty: p.availability === "in_stock" ? p.stock : undefined,
              });
              toast.success("أُضيف إلى السلة");
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center border hairline text-navy transition-colors hover:bg-navy hover:text-gold"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}
