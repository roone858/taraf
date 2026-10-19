import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { useCart, type CartItem } from "@/lib/cart";
import { effectivePrice, formatPrice } from "@/lib/format";
import { orderErrorMessage } from "@/lib/orders";
import { buildOrderMessage, buildWhatsappUrl, computeTotals, normalizeWhatsappNumber } from "@/lib/whatsapp";
import { CartLines } from "@/components/CartDrawer";
import { WhatsappIcon } from "@/components/BrandIcons";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().trim().min(3, "يرجى إدخال الاسم بالكامل").max(100),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{8,20}$/, "رقم الهاتف غير صحيح"),
  city: z.string().trim().min(2, "يرجى إدخال المدينة أو المحافظة").max(60),
  address: z.string().trim().min(8, "يرجى إدخال عنوان تفصيلي").max(300),
  notes: z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب — TARAF FURNITURE" },
      { name: "description", content: "راجع سلتك وأرسل طلبك مباشرة عبر واتساب." },
      { property: "og:title", content: "إتمام الطلب — TARAF FURNITURE" },
      { property: "og:description", content: "أرسل طلبك عبر واتساب." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const cart = useCart();
  const { data: s } = useQuery(settingsQuery);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{ number: string; total: number; whatsappUrl: string | null } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const phone = normalizeWhatsappNumber(s?.whatsapp_number);
  const fee = Number(s?.delivery_fee ?? 0);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (f: Form) => {
    if (busy) return;
    // Bots fill hidden fields; humans can't see it. Silently ignore.
    if (honeypot.current?.value) return;
    setBusy(true);
    try {
      const ids = [...new Set(cart.items.map((i) => i.productId))];
      const { data, error } = await supabase.from("products").select("id,name,price,sale_price,stock,availability,is_published").in("id", ids);
      if (error) throw error;
      const fresh: CartItem[] = [];
      const problems: string[] = [];
      for (const i of cart.items) {
        const p = data.find((d) => d.id === i.productId);
        if (!p || p.availability === "unavailable") { problems.push(`${i.name} لم يعد متاحاً`); continue; }
        const unit = effectivePrice({ price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) });
        if (p.availability === "in_stock" && i.quantity > p.stock) {
          if (p.stock <= 0) { problems.push(`${i.name} نفد من المخزون`); continue; }
          problems.push(`تم تعديل كمية ${i.name} إلى ${p.stock}`);
          fresh.push({ ...i, quantity: p.stock, unitPrice: unit, maxQty: p.stock });
          continue;
        }
        if (unit !== i.unitPrice) problems.push(`تم تحديث سعر ${i.name}`);
        fresh.push({ ...i, unitPrice: unit, name: p.name });
      }
      if (problems.length) {
        cart.replace(fresh);
        toast.warning(problems.join(" — ") + ". يرجى المراجعة ثم الإرسال مرة أخرى.");
        return;
      }
      // Record the order; prices and totals are recomputed server-side in place_order()
      const { data: number, error: orderError } = await supabase.rpc("place_order", {
        _customer: { name: f.name, phone: f.phone, city: f.city, address: f.address, notes: f.notes ?? "" },
        _items: fresh.map((i) => ({ product_id: i.productId, quantity: i.quantity, variant: i.variant ?? null })),
      });
      if (orderError || !number) {
        toast.error(orderErrorMessage(orderError?.message));
        return;
      }
      const lines = fresh.map((i) => ({ name: i.name, variant: i.variant, quantity: i.quantity, unitPrice: i.unitPrice }));
      const whatsappUrl = phone ? buildWhatsappUrl(phone, buildOrderMessage(f, lines, fee, s?.currency, number)) : null;
      setPlaced({ number, total: computeTotals(lines, fee).total, whatsappUrl });
      cart.clear();
      window.scrollTo({ top: 0 });
      // May be blocked as a popup after the awaits above; the confirmation screen has a button as fallback
      if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener");
    } catch {
      toast.error("تعذر إرسال الطلب. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  const input = "mt-2 h-12 w-full border bg-ivory px-4 focus:outline-none focus:border-gold";
  const Err = ({ m }: { m?: string | undefined }) => (m ? <p className="mt-1 text-xs text-destructive">{m}</p> : null);

  if (placed)
    return (
      <main className="flex min-h-[80vh] items-center justify-center px-5 pt-28 pb-16">
        <div className="w-full max-w-lg bg-ivory p-8 text-center sm:p-10">
          <CheckCircle2 className="mx-auto h-12 w-12 text-gold" />
          <h1 className="mt-5 font-display text-3xl text-navy">تم تسجيل طلبك</h1>
          <p className="mt-3 text-sm text-muted-foreground">رقم الطلب</p>
          <p className="mt-1 font-display text-3xl tracking-wider text-navy" dir="ltr">{placed.number}</p>
          <p className="mt-2 text-sm text-muted-foreground">الإجمالي التقديري: {formatPrice(placed.total, s?.currency)}</p>
          <div className="my-6 h-px bg-gold/40" />
          {placed.whatsappUrl ? (
            <>
              <p className="text-sm leading-relaxed text-navy">
                لتسريع التأكيد، أرسل تفاصيل الطلب إلينا عبر واتساب. إن لم تُفتح المحادثة تلقائياً اضغط الزر.
              </p>
              <Button asChild className="mt-5 h-12 w-full gap-2 text-base">
                <a href={placed.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon className="h-5 w-5" /> أرسل الطلب عبر واتساب
                </a>
              </Button>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-navy">سيتواصل معك فريقنا قريباً على رقم هاتفك لتأكيد الطلب.</p>
          )}
          <Link to="/shop" className="mt-5 inline-block text-sm text-gold hover:text-navy">متابعة التسوق</Link>
        </div>
      </main>
    );

  if (cart.items.length === 0)
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 pt-20">
        <p className="font-display text-3xl text-navy">سلتك فارغة</p>
        <Link to="/shop" className="text-gold">تصفح المجموعة</Link>
      </main>
    );

  return (
    <main className="pt-20">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-14 lg:grid-cols-[1.2fr_1fr] lg:px-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <h1 className="font-display text-4xl text-navy">بيانات التوصيل</h1>
          <label className="block text-sm">الاسم بالكامل<input {...register("name")} className={input} /><Err m={errors.name?.message} /></label>
          <label className="block text-sm">رقم الهاتف<input {...register("phone")} dir="ltr" inputMode="tel" className={`${input} text-right`} /><Err m={errors.phone?.message} /></label>
          <label className="block text-sm">المدينة / المحافظة<input {...register("city")} className={input} /><Err m={errors.city?.message} /></label>
          <label className="block text-sm">العنوان التفصيلي<textarea {...register("address")} rows={3} className={`${input} h-auto py-3`} /><Err m={errors.address?.message} /></label>
          <label className="block text-sm">ملاحظات (اختياري)<textarea {...register("notes")} rows={2} className={`${input} h-auto py-3`} /></label>

          {/* Honeypot: hidden from people and assistive tech; bots tend to fill it */}
          <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <Button type="submit" disabled={busy} className="h-14 w-full gap-2 text-base">
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {busy ? "جارٍ إرسال الطلب..." : "تأكيد الطلب"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            يُسجَّل طلبك فور التأكيد ويظهر لك رقم الطلب{phone ? "، ثم يُفتح واتساب برسالة جاهزة بالتفاصيل لتسريع التواصل" : ""}. سيتواصل معك فريقنا لتأكيد الطلب وموعد التوصيل.
          </p>
        </form>
        <aside className="h-fit bg-ivory p-6">
          <h2 className="font-display text-2xl text-navy">ملخص الطلب</h2>
          <CartLines />
          <div className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span>المجموع الفرعي</span><span>{formatPrice(cart.subtotal, s?.currency)}</span></div>
            <div className="flex justify-between"><span>رسوم التوصيل</span><span>{formatPrice(fee, s?.currency)}</span></div>
            <div className="flex justify-between pt-2 text-base text-navy"><span>الإجمالي التقديري</span><span>{formatPrice(cart.subtotal + fee, s?.currency)}</span></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
