import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Product } from "@/lib/data";
import { effectivePrice, formatPrice } from "@/lib/format";
import { productSizes, unitPrice } from "@/lib/sizes";
import { fetchInvoiceUrl, orderErrorMessage } from "@/lib/orders";
import { customerSchema, loadCustomer, saveCustomer, type CustomerForm } from "@/lib/customer";
import { buildOrderMessage, buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsappIcon } from "./BrandIcons";

const field =
  "mt-1.5 h-11 w-full border bg-cream px-3 text-sm focus:border-gold focus:outline-none";

/**
 * One-product order without the cart: pick options + quantity, enter delivery details,
 * record the order via place_order(), then hand off to WhatsApp with the order number.
 */
export function QuickOrderDialog({
  p,
  open,
  onOpenChange,
  initialSize,
}: {
  p: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSize?: string | undefined;
}) {
  const { data: s } = useQuery(settingsQuery);
  const currency = s?.currency;
  const fee = Number(s?.delivery_fee ?? 0);
  const storePhone = normalizeWhatsappNumber(s?.whatsapp_number);

  const sizes = productSizes(p);
  const [size, setSize] = useState<string | undefined>(initialSize);
  const [finish, setFinish] = useState<string>();
  const [color, setColor] = useState<string>();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{
    number: string;
    total: number;
    url: string | null;
  } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerForm>({ resolver: zodResolver(customerSchema) });

  // Fresh state each time it opens; prefill delivery details saved on this device
  useEffect(() => {
    if (!open) return;
    setSize(initialSize);
    setFinish(undefined);
    setColor(undefined);
    setQty(1);
    setPlaced(null);
    reset({ notes: "", ...loadCustomer() });
  }, [open, initialSize, reset]);

  const max = p.availability === "in_stock" ? Math.max(1, p.stock) : 99;
  const price = unitPrice(p, size);
  const subtotal = price * qty;
  const missing = [
    sizes.length > 0 && !size && "المقاس",
    p.finishes.length > 0 && !finish && "التشطيب",
    p.colors.length > 0 && !color && "اللون",
  ].filter(Boolean) as string[];

  const submit = async (f: CustomerForm) => {
    if (busy || honeypot.current?.value) return;
    if (missing.length) return void toast.error(`يرجى اختيار ${missing.join(" و")}`);
    setBusy(true);
    const options = [finish, color].filter(Boolean).join(" / ") || null;
    const { data: number, error } = await supabase.rpc("place_order", {
      _customer: {
        name: f.name,
        phone: f.phone,
        city: f.city,
        address: f.address,
        notes: f.notes ?? "",
      },
      _items: [{ product_id: p.id, quantity: qty, size: size ?? null, variant: options }],
    });
    setBusy(false);
    if (error || !number) return void toast.error(orderErrorMessage(error?.message));

    saveCustomer(f);
    const variant = [size, options].filter(Boolean).join(" / ") || undefined;
    const invoice = await fetchInvoiceUrl(number, f.phone).catch(() => undefined);
    const message = buildOrderMessage(
      f,
      [{ name: p.name, variant, quantity: qty, unitPrice: price }],
      fee,
      currency,
      number,
      invoice,
    );
    const url = storePhone ? buildWhatsappUrl(storePhone, message) : null;
    setPlaced({ number, total: subtotal + fee, url });
    // May be blocked as a popup after the await; the success view has a button as fallback
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent dir="rtl" className="flex flex-col gap-0 bg-ivory p-0 sm:max-w-lg">
        {placed ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-gold" />
            <DialogTitle className="mt-4 font-display text-3xl text-navy">
              تم تسجيل طلبك
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              رقم الطلب
            </DialogDescription>
            <p className="mt-1 font-display text-3xl tracking-wider text-navy" dir="ltr">
              {placed.number}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              الإجمالي التقديري: {formatPrice(placed.total, currency)}
            </p>
            {placed.url ? (
              <>
                <p className="mt-6 text-sm text-navy">
                  أرسل التفاصيل إلينا عبر واتساب لتسريع التأكيد. إن لم تُفتح المحادثة اضغط الزر.
                </p>
                <Button asChild className="mt-4 h-12 w-full gap-2 text-base">
                  <a href={placed.url} target="_blank" rel="noopener noreferrer">
                    <WhatsappIcon className="h-5 w-5" /> أرسل الطلب عبر واتساب
                  </a>
                </Button>
              </>
            ) : (
              <p className="mt-6 text-sm text-navy">سيتواصل معك فريقنا قريباً لتأكيد الطلب.</p>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-4 text-sm text-gold hover:text-navy"
            >
              متابعة التسوق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="border-b px-5 py-4 text-start">
              <div className="flex items-center gap-3">
                {p.images[0] && (
                  <img src={p.images[0]} alt="" className="h-16 w-13 shrink-0 object-cover" />
                )}
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-normal text-navy">
                    {p.name}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-navy">
                    {formatPrice(price, currency)}
                    {sizes.length > 0 && !size && (
                      <span className="ms-2 text-xs text-muted-foreground">حسب المقاس</span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
              {sizes.length > 0 && (
                <Choice
                  label="المقاس"
                  items={sizes.map((x) => ({
                    value: x.label,
                    hint: formatPrice(x.price ?? effectivePrice(p), currency),
                  }))}
                  value={size}
                  onChange={setSize}
                />
              )}
              {p.finishes.length > 0 && (
                <Choice
                  label="التشطيب"
                  items={p.finishes.map((v) => ({ value: v }))}
                  value={finish}
                  onChange={setFinish}
                />
              )}
              {p.colors.length > 0 && (
                <Choice
                  label="اللون / القماش"
                  items={p.colors.map((v) => ({ value: v }))}
                  value={color}
                  onChange={setColor}
                />
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">الكمية</span>
                <div className="flex items-center border bg-cream">
                  <button
                    type="button"
                    aria-label="زيادة"
                    className="p-2.5 disabled:opacity-30"
                    disabled={qty >= max}
                    onClick={() => setQty((q) => Math.min(max, q + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="w-9 text-center tabular-nums">{qty}</span>
                  <button
                    type="button"
                    aria-label="إنقاص"
                    className="p-2.5 disabled:opacity-30"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 border-t pt-5">
                <p className="text-navy">بيانات التوصيل</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-muted-foreground">الاسم بالكامل</span>
                    <input {...register("name")} autoComplete="name" className={field} />
                    <Err m={errors.name?.message} />
                  </label>
                  <label className="block">
                    <span className="text-muted-foreground">رقم الهاتف</span>
                    <input
                      {...register("phone")}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      className={cn(field, "text-right")}
                    />
                    <Err m={errors.phone?.message} />
                  </label>
                </div>
                <label className="block">
                  <span className="text-muted-foreground">المدينة / المحافظة</span>
                  <input {...register("city")} autoComplete="address-level2" className={field} />
                  <Err m={errors.city?.message} />
                </label>
                <label className="block">
                  <span className="text-muted-foreground">العنوان التفصيلي</span>
                  <textarea
                    {...register("address")}
                    rows={2}
                    autoComplete="street-address"
                    className={cn(field, "h-auto py-2.5")}
                  />
                  <Err m={errors.address?.message} />
                </label>
                <label className="block">
                  <span className="text-muted-foreground">ملاحظات (اختياري)</span>
                  <input {...register("notes")} className={field} />
                </label>
                {/* Honeypot: hidden from people and assistive tech */}
                <input
                  ref={honeypot}
                  type="text"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  className="hidden"
                />
              </div>
            </div>

            <div className="border-t bg-ivory px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <dl className="mb-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>المنتج × {qty}</dt>
                  <dd>{formatPrice(subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>رسوم التوصيل</dt>
                  <dd>{formatPrice(fee, currency)}</dd>
                </div>
                <div className="flex justify-between text-base text-navy">
                  <dt>الإجمالي التقديري</dt>
                  <dd>{formatPrice(subtotal + fee, currency)}</dd>
                </div>
              </dl>
              <Button type="submit" disabled={busy} className="h-12 w-full gap-2 text-base">
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <WhatsappIcon className="h-5 w-5" />
                )}
                {busy
                  ? "جارٍ تسجيل الطلب..."
                  : missing.length
                    ? `اختر ${missing[0]}`
                    : "تأكيد الطلب عبر واتساب"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; hint?: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-muted-foreground">
        {label} <span className="text-destructive">*</span>
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {items.map((it) => {
          const active = value === it.value;
          return (
            <button
              key={it.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(it.value)}
              className={cn(
                "flex flex-col items-start border px-3 py-2 text-start transition-colors",
                active
                  ? "border-navy bg-navy text-cream"
                  : "border-navy/15 bg-cream text-navy hover:border-gold",
              )}
            >
              <span>{it.value}</span>
              {it.hint && (
                <span className={cn("text-xs", active ? "text-gold" : "text-muted-foreground")}>
                  {it.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Err({ m }: { m?: string | undefined }) {
  return m ? <p className="mt-1 text-xs text-destructive">{m}</p> : null;
}
