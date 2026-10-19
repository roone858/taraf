import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { useCart, type CartItem } from "@/lib/cart";
import { effectivePrice, formatPrice } from "@/lib/format";
import { buildOrderMessage, buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/whatsapp";
import { CartLines } from "@/components/CartDrawer";
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
  const [opened, setOpened] = useState(false);
  const phone = normalizeWhatsappNumber(s?.whatsapp_number);
  const fee = Number(s?.delivery_fee ?? 0);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (f: Form) => {
    if (!phone) return;
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
      const msg = buildOrderMessage(f, fresh.map((i) => ({ name: i.name, variant: i.variant, quantity: i.quantity, unitPrice: i.unitPrice })), fee, s?.currency);
      window.open(buildWhatsappUrl(phone, msg), "_blank", "noopener");
      setOpened(true);
    } catch {
      toast.error("تعذر التحقق من السلة. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  const input = "mt-2 h-12 w-full border bg-ivory px-4 focus:outline-none focus:border-gold";
  const Err = ({ m }: { m?: string | undefined }) => (m ? <p className="mt-1 text-xs text-destructive">{m}</p> : null);

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

          {!phone ? (
            <p className="border border-destructive/40 p-4 text-sm text-destructive">
              الطلب عبر واتساب غير متاح حالياً — لم يتم إعداد رقم واتساب المتجر بعد من لوحة التحكم.
            </p>
          ) : (
            <Button type="submit" disabled={busy} className="h-14 w-full text-base">
              {busy ? "جارٍ التحقق..." : "إرسال الطلب عبر واتساب"}
            </Button>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            سيتم فتح واتساب برسالة جاهزة تحتوي على تفاصيل طلبك. لا يتم تأكيد الطلب أو استلامه تلقائياً — يجب إرسال الرسالة، وسيتواصل معك فريقنا للتأكيد.
          </p>
          {opened && (
            <div className="border hairline bg-ivory p-4 text-sm">
              <p>هل أرسلت الرسالة عبر واتساب؟</p>
              <button type="button" onClick={() => { cart.clear(); toast.success("تم إفراغ السلة"); }} className="mt-2 text-gold underline">
                نعم، أفرغ السلة
              </button>
            </div>
          )}
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
