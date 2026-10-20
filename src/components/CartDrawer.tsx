import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "@/components/BrandIcons";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const n = new Intl.NumberFormat("ar-EG");

/** Cart rows. `compact` is the read-mostly variant used in the checkout summary. */
export function CartLines({ compact = false }: { compact?: boolean }) {
  const cart = useCart();
  const { data: s } = useQuery(settingsQuery);
  return (
    <ul className="divide-y divide-border/80">
      {cart.items.map((i) => {
        const atMax = i.maxQty != null && i.quantity >= i.maxQty;
        return (
          <li
            key={i.productId + (i.variant ?? "")}
            className={cn("flex gap-4", compact ? "py-4" : "py-5")}
          >
            <Link
              to="/product/$slug"
              params={{ slug: i.slug }}
              onClick={() => cart.setOpen(false)}
              className={cn(
                "shrink-0 overflow-hidden bg-muted",
                compact ? "h-20 w-16" : "h-28 w-22",
              )}
              tabIndex={-1}
              aria-hidden
            >
              {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/product/$slug"
                    params={{ slug: i.slug }}
                    onClick={() => cart.setOpen(false)}
                    className="line-clamp-2 text-ink transition-colors hover:text-navy"
                  >
                    {i.name}
                  </Link>
                  {i.variant && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{i.variant}</p>
                  )}
                  {!compact && (
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {formatPrice(i.unitPrice, s?.currency)} للقطعة
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`حذف ${i.name}`}
                  onClick={() => cart.remove(i.productId, i.variant)}
                  className="-me-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                <div
                  className="flex h-9 items-center border border-navy/15 bg-ivory"
                  role="group"
                  aria-label={`كمية ${i.name}`}
                >
                  <button
                    type="button"
                    aria-label="زيادة الكمية"
                    disabled={atMax}
                    className="flex h-full w-9 items-center justify-center text-navy transition-colors hover:bg-navy/5 disabled:opacity-30"
                    onClick={() => cart.setQty(i.productId, i.variant, i.quantity + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">
                    {n.format(i.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label="إنقاص الكمية"
                    disabled={i.quantity <= 1}
                    className="flex h-full w-9 items-center justify-center text-navy transition-colors hover:bg-navy/5 disabled:opacity-30"
                    onClick={() => cart.setQty(i.productId, i.variant, i.quantity - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-navy tabular-nums">
                  {formatPrice(i.unitPrice * i.quantity, s?.currency)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const { data: s } = useQuery(settingsQuery);
  // Emptying the cart takes a second tap, so a stray tap can't wipe it
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!confirmClear) return;
    const t = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmClear]);

  return (
    <Sheet open={cart.open} onOpenChange={cart.setOpen}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 bg-cream p-0 sm:max-w-md"
        dir="rtl"
      >
        <SheetHeader className="border-b hairline px-5 py-5 text-start">
          <SheetTitle className="flex items-baseline gap-2 font-display text-2xl text-navy">
            سلة التسوق
            {cart.count > 0 && (
              <span className="font-sans text-sm text-muted-foreground tabular-nums">
                ({n.format(cart.count)})
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">القطع المضافة إلى سلتك</SheetDescription>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <ShoppingBag className="h-12 w-12 text-gold" strokeWidth={1.25} />
            <p className="mt-2 font-display text-2xl text-navy">سلتك فارغة حالياً</p>
            <p className="text-sm text-muted-foreground">اكتشف قطعاً تليق بمساحتك.</p>
            <Button asChild className="mt-4 h-11 gap-2 px-6" onClick={() => cart.setOpen(false)}>
              <Link to="/shop">
                تصفح المجموعة <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <CartLines />
            </div>
            <div className="space-y-4 border-t hairline bg-ivory px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
              <div className="flex items-baseline justify-between">
                <span className="text-navy">المجموع الفرعي</span>
                <span className="text-lg text-navy tabular-nums">
                  {formatPrice(cart.subtotal, s?.currency)}
                </span>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                تُضاف رسوم التوصيل في صفحة إتمام الطلب.
              </p>
              <Button
                asChild
                className="h-12 w-full gap-2 text-base"
                onClick={() => cart.setOpen(false)}
              >
                <Link to="/checkout">
                  <WhatsappIcon className="h-4 w-4" /> إتمام الطلب عبر واتساب
                </Link>
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => cart.setOpen(false)}
                  className="text-navy underline decoration-gold underline-offset-4 hover:decoration-navy"
                >
                  متابعة التسوق
                </button>
                <button
                  type="button"
                  onClick={() =>
                    confirmClear ? (cart.clear(), setConfirmClear(false)) : setConfirmClear(true)
                  }
                  className={cn(
                    "text-xs transition-colors",
                    confirmClear
                      ? "text-destructive"
                      : "text-muted-foreground hover:text-destructive",
                  )}
                >
                  {confirmClear ? "اضغط مرة أخرى للتأكيد" : "إفراغ السلة"}
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
