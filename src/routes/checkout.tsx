import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { useCart, type CartItem } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { productSizes, unitPrice } from "@/lib/sizes";
import { orderErrorMessage } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { customerSchema, type CustomerForm } from "@/lib/customer";
import {
  buildOrderMessage,
  buildWhatsappUrl,
  computeTotals,
  normalizeWhatsappNumber,
} from "@/lib/whatsapp";
import { CartLines } from "@/components/CartDrawer";
import { WhatsappIcon } from "@/components/BrandIcons";
import { Button } from "@/components/ui/button";

const schema = customerSchema;
type Form = CustomerForm;

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
  const [placed, setPlaced] = useState<{
    number: string;
    total: number;
    whatsappUrl: string | null;
  } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const phone = normalizeWhatsappNumber(s?.whatsapp_number);
  const fee = Number(s?.delivery_fee ?? 0);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (f: Form) => {
    if (busy) return;
    // Bots fill hidden fields; humans can't see it. Silently ignore.
    if (honeypot.current?.value) return;
    setBusy(true);
    try {
      const ids = [...new Set(cart.items.map((i) => i.productId))];
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,sale_price,stock,availability,is_published,sizes")
        .in("id", ids);
      if (error) throw error;
      const fresh: CartItem[] = [];
      const problems: string[] = [];
      for (const i of cart.items) {
        const p = data.find((d) => d.id === i.productId);
        if (!p || p.availability === "unavailable") {
          problems.push(`${i.name} لم يعد متاحاً`);
          continue;
        }
        // Sized products need a size that still exists (e.g. carts saved before sizes were added)
        const sizes = productSizes(p);
        if (sizes.length > 0 && !sizes.some((x) => x.label === i.size)) {
          problems.push(`اختر مقاس ${i.name} من صفحة المنتج`);
          continue;
        }
        const unit = unitPrice(
          {
            price: Number(p.price),
            sale_price: p.sale_price == null ? null : Number(p.sale_price),
            sizes: p.sizes,
          },
          i.size,
        );
        if (p.availability === "in_stock" && i.quantity > p.stock) {
          if (p.stock <= 0) {
            problems.push(`${i.name} نفد من المخزون`);
            continue;
          }
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
        _customer: {
          name: f.name,
          phone: f.phone,
          city: f.city,
          address: f.address,
          notes: f.notes ?? "",
        },
        // The server prepends the size to the stored variant, so send finish/colour separately
        _items: fresh.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
          size: i.size ?? null,
          variant: (i.size ? i.options : (i.options ?? i.variant)) ?? null,
        })),
      });
      if (orderError || !number) {
        toast.error(orderErrorMessage(orderError?.message));
        return;
      }
      const lines = fresh.map((i) => ({
        name: i.name,
        variant: i.variant,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
      const whatsappUrl = phone
        ? buildWhatsappUrl(phone, buildOrderMessage(f, lines, fee, s?.currency, number))
        : null;
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

  const cur = s?.currency;
  const total = cart.subtotal + fee;

  if (placed)
    return (
      <main className="flex min-h-[80vh] items-center justify-center px-5 pt-28 pb-16">
        <div className="w-full max-w-lg border hairline bg-ivory p-8 text-center shadow-[0_12px_40px_-12px_rgb(13_21_34/0.18)] sm:p-10">
          <CheckCircle2 className="mx-auto h-12 w-12 text-gold" strokeWidth={1.5} />
          <h1 className="mt-5 font-display text-3xl text-navy">تم تسجيل طلبك</h1>
          <div className="mt-6 bg-cream px-4 py-4">
            <p className="text-sm text-muted-foreground">رقم الطلب</p>
            <p className="mt-1 font-display text-3xl tracking-wider text-navy" dir="ltr">
              {placed.number}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              الإجمالي التقديري:{" "}
              <span className="text-navy tabular-nums">{formatPrice(placed.total, cur)}</span>
            </p>
          </div>
          {placed.whatsappUrl ? (
            <>
              <p className="mt-6 text-sm leading-relaxed text-navy">
                لتسريع التأكيد، أرسل تفاصيل الطلب إلينا عبر واتساب. إن لم تُفتح المحادثة تلقائياً
                اضغط الزر.
              </p>
              <Button asChild className="mt-5 h-12 w-full gap-2 text-base">
                <a href={placed.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon className="h-5 w-5" /> أرسل الطلب عبر واتساب
                </a>
              </Button>
            </>
          ) : (
            <p className="mt-6 text-sm leading-relaxed text-navy">
              سيتواصل معك فريقنا قريباً على رقم هاتفك لتأكيد الطلب.
            </p>
          )}
          <Link
            to="/shop"
            className="mt-5 inline-block text-sm text-navy underline decoration-gold underline-offset-4 hover:decoration-navy"
          >
            متابعة التسوق
          </Link>
        </div>
      </main>
    );

  if (cart.items.length === 0)
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-5 pt-20 text-center">
        <ShoppingBag className="h-12 w-12 text-gold" strokeWidth={1.25} />
        <h1 className="mt-2 font-display text-3xl text-navy">سلتك فارغة</h1>
        <p className="text-sm text-muted-foreground">أضف قطعاً إلى السلة لإتمام الطلب.</p>
        <Button asChild className="mt-4 h-11 gap-2 px-6">
          <Link to="/shop">
            تصفح المجموعة <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </main>
    );

  return (
    <main className="pt-20">
      <div className="mx-auto max-w-6xl px-5 pt-8 pb-16 lg:px-10 lg:pt-12 lg:pb-24">
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-navy"
        >
          <ChevronRight className="h-4 w-4" /> متابعة التسوق
        </Link>
        <h1 className="mt-3 font-display text-3xl text-navy sm:text-4xl">إتمام الطلب</h1>

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
          {/* Summary comes first on mobile so the total is seen before the form */}
          <aside
            aria-labelledby="summary-title"
            className="h-fit border hairline bg-ivory p-5 sm:p-6 lg:sticky lg:top-28 lg:order-last"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="summary-title" className="font-display text-2xl text-navy">
                ملخص الطلب
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {n.format(cart.count)} {cart.count === 1 ? "قطعة" : "قطع"}
              </span>
            </div>
            <CartLines compact />
            <dl className="space-y-2.5 border-t hairline pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">المجموع الفرعي</dt>
                <dd className="tabular-nums">{formatPrice(cart.subtotal, cur)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">رسوم التوصيل</dt>
                <dd className="tabular-nums">{fee > 0 ? formatPrice(fee, cur) : "مجاناً"}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-border/80 pt-3 text-navy">
                <dt>الإجمالي التقديري</dt>
                <dd className="text-xl tabular-nums">{formatPrice(total, cur)}</dd>
              </div>
            </dl>
          </aside>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            <section
              aria-labelledby="delivery-title"
              className="border hairline bg-ivory p-5 sm:p-6"
            >
              <h2 id="delivery-title" className="font-display text-2xl text-navy">
                بيانات التوصيل
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                نستخدمها للتواصل معك وتوصيل الطلب فقط.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField id="name" label="الاسم بالكامل" error={errors.name?.message}>
                    <input
                      id="name"
                      autoComplete="name"
                      {...register("name")}
                      {...fieldProps(errors.name)}
                    />
                  </FormField>
                </div>
                <FormField id="phone" label="رقم الهاتف" error={errors.phone?.message}>
                  <input
                    id="phone"
                    type="tel"
                    dir="ltr"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="05xxxxxxxx"
                    {...register("phone")}
                    {...fieldProps(errors.phone, "text-right")}
                  />
                </FormField>
                <FormField id="city" label="المدينة / المحافظة" error={errors.city?.message}>
                  <input
                    id="city"
                    autoComplete="address-level2"
                    {...register("city")}
                    {...fieldProps(errors.city)}
                  />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField
                    id="address"
                    label="العنوان التفصيلي"
                    hint="الحي، الشارع، رقم المبنى"
                    error={errors.address?.message}
                  >
                    <textarea
                      id="address"
                      rows={3}
                      autoComplete="street-address"
                      {...register("address")}
                      {...fieldProps(errors.address, "h-auto py-3")}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField id="notes" label="ملاحظات" optional>
                    <textarea
                      id="notes"
                      rows={2}
                      placeholder="موعد مناسب للتوصيل، تفاصيل إضافية…"
                      {...register("notes")}
                      {...fieldProps(undefined, "h-auto py-3")}
                    />
                  </FormField>
                </div>
              </div>
            </section>

            {/* Honeypot: hidden from people and assistive tech; bots tend to fill it */}
            <input
              ref={honeypot}
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />
            <div className="space-y-3">
              <Button type="submit" disabled={busy} className="h-14 w-full gap-2 text-base">
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> جارٍ إرسال الطلب...
                  </>
                ) : (
                  <>
                    تأكيد الطلب
                    <span className="text-cream/50" aria-hidden>
                      ·
                    </span>
                    <span className="tabular-nums">{formatPrice(total, cur)}</span>
                  </>
                )}
              </Button>
              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  يُسجَّل طلبك فور التأكيد ويظهر لك رقم الطلب
                  {phone ? "، ثم يُفتح واتساب برسالة جاهزة بالتفاصيل لتسريع التواصل" : ""}. سيتواصل
                  معك فريقنا لتأكيد الطلب وموعد التوصيل.
                </span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

const n = new Intl.NumberFormat("ar-EG");

/** Shared input styling, with the error state and its aria wiring. */
function fieldProps(error: { message?: string | undefined } | undefined, extra?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    className: cn(
      "mt-2 h-12 w-full border bg-cream/40 px-4 transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:bg-ivory focus:outline-none focus:ring-2",
      error
        ? "border-destructive focus:border-destructive focus:ring-destructive/20"
        : "border-navy/15 focus:border-gold focus:ring-gold/25",
      extra,
    ),
  };
}

function FormField({
  id,
  label,
  hint,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm text-navy">
        {label}
        {optional && <span className="text-xs text-muted-foreground">(اختياري)</span>}
        {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
