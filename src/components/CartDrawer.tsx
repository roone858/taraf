import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/data";
import { formatPrice } from "@/lib/format";

export function CartLines() {
  const cart = useCart();
  const { data: s } = useQuery(settingsQuery);
  return (
    <ul className="divide-y">
      {cart.items.map((i) => (
        <li key={i.productId + (i.variant ?? "")} className="flex gap-4 py-5">
          {i.image && <img src={i.image} alt={i.name} className="h-24 w-20 object-cover" />}
          <div className="flex flex-1 flex-col">
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-ink">{i.name}</p>
                {i.variant && <p className="text-xs text-muted-foreground">{i.variant}</p>}
              </div>
              <button aria-label="حذف" onClick={() => cart.remove(i.productId, i.variant)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <div className="flex items-center border">
                <button aria-label="زيادة" className="p-2" onClick={() => cart.setQty(i.productId, i.variant, i.quantity + 1)}>
                  <Plus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center text-sm">{i.quantity}</span>
                <button aria-label="إنقاص" className="p-2" onClick={() => cart.setQty(i.productId, i.variant, i.quantity - 1)}>
                  <Minus className="h-3 w-3" />
                </button>
              </div>
              <span className="text-sm text-navy">{formatPrice(i.unitPrice * i.quantity, s?.currency)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const { data: s } = useQuery(settingsQuery);
  return (
    <Sheet open={cart.open} onOpenChange={cart.setOpen}>
      <SheetContent side="left" className="flex w-full flex-col bg-ivory sm:max-w-md" dir="rtl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-navy">سلة التسوق</SheetTitle>
        </SheetHeader>
        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground">سلتك فارغة حالياً</p>
            <Button asChild variant="outline" onClick={() => cart.setOpen(false)}>
              <Link to="/shop">تصفح المجموعة</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4">
              <CartLines />
            </div>
            <div className="space-y-3 border-t p-4">
              <div className="flex justify-between text-sm">
                <span>المجموع الفرعي</span>
                <span>{formatPrice(cart.subtotal, s?.currency)}</span>
              </div>
              <Button asChild className="h-12 w-full" onClick={() => cart.setOpen(false)}>
                <Link to="/checkout">إتمام الطلب عبر واتساب</Link>
              </Button>
              <button onClick={cart.clear} className="w-full text-xs text-muted-foreground hover:text-destructive">
                إفراغ السلة
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
