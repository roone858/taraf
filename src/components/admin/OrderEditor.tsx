import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Minus, PackagePlus, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { effectivePrice, formatPrice } from "@/lib/format";
import { productSizes } from "@/lib/sizes";
import {
  ORDER_STATUSES,
  orderErrorMessage,
  orderStatusLabel,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders";
import { customerSchema } from "@/lib/customer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, SectionTitle, adminNum, inp } from "@/components/admin/kit";

type Line = {
  key: string;
  product_id: string | null;
  name: string;
  variant: string;
  quantity: number;
  unit_price: string;
};

type Customer = { name: string; phone: string; city: string; address: string; notes: string };

const pickerQuery = {
  queryKey: ["admin", "order-editor-products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, sale_price, sizes, images, availability, stock, is_published")
      .order("name");
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60_000,
};

const blankCustomer: Customer = { name: "", phone: "", city: "", address: "", notes: "" };
const price = (v: string) => {
  const n = Number(v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Create or edit an invoice (= an order) from the admin, through admin_save_order(). Any price can be
 * set and lines need not be catalogue products. Stock is reconciled by the database function.
 */
export function OrderEditor({
  order,
  open,
  currency,
  defaultFee,
  onClose,
  onSaved,
}: {
  /** The order to edit, or null for a new invoice. */
  order: (Order & { order_items: OrderItem[] }) | null;
  open: boolean;
  currency: string | undefined;
  defaultFee: number;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [customer, setCustomer] = useState<Customer>(blankCustomer);
  const [lines, setLines] = useState<Line[]>([]);
  const [fee, setFee] = useState("0");
  const [paid, setPaid] = useState("0");
  const [status, setStatus] = useState<OrderStatus>("confirmed");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Customer, string>>>({});
  const { data: products, isLoading: loadingProducts } = useQuery({
    ...pickerQuery,
    enabled: open,
  });

  // Fresh state each time it opens
  useEffect(() => {
    if (!open) return;
    setQ("");
    setErrors({});
    if (order) {
      setCustomer({
        name: order.customer_name,
        phone: order.phone,
        city: order.city,
        address: order.address,
        notes: order.notes ?? "",
      });
      setLines(
        order.order_items.map((i) => ({
          key: i.id,
          product_id: i.product_id,
          name: i.product_name,
          variant: i.variant ?? "",
          quantity: i.quantity,
          unit_price: String(Number(i.unit_price)),
        })),
      );
      setFee(String(Number(order.delivery_fee)));
      setPaid(String(Number(order.amount_paid ?? 0)));
    } else {
      setCustomer(blankCustomer);
      setLines([]);
      setFee(String(defaultFee));
      setPaid("0");
      setStatus("confirmed");
    }
  }, [open, order, defaultFee]);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !products) return [];
    return products.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 8);
  }, [q, products]);

  const subtotal = lines.reduce((t, l) => t + (price(l.unit_price) || 0) * l.quantity, 0);
  const feeValue = price(fee);
  const total = subtotal + (Number.isFinite(feeValue) ? feeValue : 0);
  const paidValue = paid.trim() === "" ? 0 : price(paid);
  const paidOk = Number.isFinite(paidValue) && paidValue <= total;
  const remaining = Math.max(0, total - (Number.isFinite(paidValue) ? paidValue : 0));
  const f = (n: number) => formatPrice(n, currency);

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addProduct = (p: NonNullable<typeof products>[number]) => {
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        product_id: p.id,
        name: p.name,
        variant: "",
        quantity: 1,
        unit_price: String(effectivePrice(p)),
      },
    ]);
    setQ("");
  };
  const addCustom = () =>
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        product_id: null,
        name: q.trim(),
        variant: "",
        quantity: 1,
        unit_price: "",
      },
    ]);

  const save = async () => {
    if (busy) return;
    const parsed = customerSchema.safeParse(customer);
    if (!parsed.success) {
      const e: Partial<Record<keyof Customer, string>> = {};
      for (const issue of parsed.error.issues) e[issue.path[0] as keyof Customer] ??= issue.message;
      setErrors(e);
      return void toast.error("راجع بيانات العميل");
    }
    setErrors({});
    if (!lines.length) return void toast.error("أضف قطعة واحدة على الأقل");
    const bad = lines.find((l) => !l.name.trim() || !Number.isFinite(price(l.unit_price)));
    if (bad) return void toast.error("كل سطر يحتاج اسماً وسعراً صحيحاً");
    if (!Number.isFinite(feeValue)) return void toast.error("رسوم التوصيل غير صحيحة");
    if (!paidOk) return void toast.error("المبلغ المدفوع غير صحيح أو أكبر من الإجمالي");

    setBusy(true);
    const { data: id, error } = await supabase.rpc("admin_save_order", {
      _order_id: order?.id ?? null,
      _order: {
        ...parsed.data,
        delivery_fee: feeValue,
        amount_paid: paidValue,
        ...(order ? {} : { status }),
        items: lines.map((l) => ({
          product_id: l.product_id,
          name: l.name.trim(),
          variant: l.variant.trim(),
          quantity: l.quantity,
          unit_price: price(l.unit_price),
        })),
      },
    });
    setBusy(false);
    if (error || !id) return void toast.error(orderErrorMessage(error?.message));
    toast.success(order ? "تم حفظ الفاتورة" : "تم إنشاء الفاتورة");
    onSaved(id);
  };

  const text = (k: keyof Customer, extra?: React.InputHTMLAttributes<HTMLInputElement>) => ({
    value: customer[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setCustomer((c) => ({ ...c, [k]: e.target.value })),
    "aria-invalid": !!errors[k],
    className: cn(inp, errors[k] && "border-destructive"),
    ...extra,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        dir="rtl"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none bg-ivory p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-xl"
      >
        <DialogHeader className="border-b border-navy/10 px-5 py-4 text-start sm:px-6">
          <DialogTitle className="font-display text-2xl text-navy">
            {order ? (
              <>
                تعديل الفاتورة{" "}
                <span dir="ltr" className="tabular-nums">
                  {order.order_number}
                </span>
              </>
            ) : (
              "فاتورة جديدة"
            )}
          </DialogTitle>
          {order?.stock_deducted && (
            <p className="text-xs text-muted-foreground">
              خُصم المخزون لهذا الطلب؛ سيُعدَّل تلقائياً حسب القطع الجديدة عند الحفظ.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 text-sm sm:px-6">
          {/* Customer */}
          <section>
            <SectionTitle>العميل</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الاسم بالكامل *">
                <input {...text("name")} />
                <Err m={errors.name} />
              </Field>
              <Field label="رقم الهاتف *">
                <input {...text("phone", { type: "tel", dir: "ltr" })} />
                <Err m={errors.phone} />
              </Field>
              <Field label="المدينة *">
                <input {...text("city")} />
                <Err m={errors.city} />
              </Field>
              <Field label="العنوان *">
                <input {...text("address", { placeholder: "أو: استلام من المعرض" })} />
                <Err m={errors.address} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="ملاحظات تظهر في الفاتورة">
                  <input {...text("notes")} maxLength={500} />
                </Field>
              </div>
            </div>
          </section>

          {/* Items */}
          <section>
            <SectionTitle>القطع</SectionTitle>
            <div className="relative">
              <label className="relative block">
                <span className="sr-only">ابحث عن منتج لإضافته</span>
                <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث عن منتج لإضافته…"
                  className={cn(inp, "mt-0 h-11 ps-9")}
                  autoComplete="off"
                />
              </label>
              {q.trim() && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-navy/15 bg-ivory shadow-lg">
                  {loadingProducts ? (
                    <p className="flex items-center gap-2 px-3 py-3 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
                    </p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {matches.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => addProduct(p)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-cream focus-visible:bg-cream focus-visible:outline-none"
                          >
                            {p.images[0] ? (
                              <img
                                src={p.images[0]}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <span className="h-10 w-10 shrink-0 rounded bg-muted" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-navy">{p.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {f(effectivePrice(p))}
                                {p.availability === "in_stock" &&
                                  ` · المخزون ${adminNum.format(p.stock)}`}
                                {!p.is_published && " · غير منشور"}
                              </span>
                            </span>
                            <Plus className="h-4 w-4 shrink-0 text-gold" />
                          </button>
                        </li>
                      ))}
                      <li className="border-t border-navy/10">
                        <button
                          type="button"
                          onClick={addCustom}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-navy transition-colors hover:bg-cream"
                        >
                          <PackagePlus className="h-4 w-4 text-gold" />
                          إضافة «{q.trim()}» كسطر حر (ليس من المنتجات)
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-navy/20 px-4 py-6 text-center text-muted-foreground">
                ابحث عن منتج أعلاه، أو{" "}
                <button
                  type="button"
                  onClick={addCustom}
                  className="text-navy underline decoration-gold underline-offset-4"
                >
                  أضف سطراً حراً
                </button>
                .
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {lines.map((l) => {
                  const product = l.product_id
                    ? products?.find((p) => p.id === l.product_id)
                    : undefined;
                  const sizes = product ? productSizes(product) : [];
                  const lineTotal = (price(l.unit_price) || 0) * l.quantity;
                  return (
                    <li key={l.key} className="rounded-lg border border-navy/10 bg-cream/60 p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                          <label className="block">
                            <span className="sr-only">اسم القطعة</span>
                            <input
                              value={l.name}
                              onChange={(e) => update(l.key, { name: e.target.value })}
                              placeholder="اسم القطعة"
                              className={cn(inp, "mt-0")}
                              maxLength={200}
                            />
                          </label>
                          {sizes.length > 0 ? (
                            <label className="block">
                              <span className="sr-only">المقاس</span>
                              <select
                                value={sizes.some((s) => s.label === l.variant) ? l.variant : ""}
                                onChange={(e) => {
                                  const s = sizes.find((x) => x.label === e.target.value);
                                  update(l.key, {
                                    variant: e.target.value,
                                    ...(s && product
                                      ? { unit_price: String(s.price ?? effectivePrice(product)) }
                                      : {}),
                                  });
                                }}
                                className={cn(inp, "mt-0")}
                              >
                                <option value="">اختر المقاس</option>
                                {sizes.map((s) => (
                                  <option key={s.label} value={s.label}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <label className="block">
                              <span className="sr-only">الخيار (لون، مقاس…)</span>
                              <input
                                value={l.variant}
                                onChange={(e) => update(l.key, { variant: e.target.value })}
                                placeholder="الخيار (اختياري)"
                                className={cn(inp, "mt-0")}
                                maxLength={100}
                              />
                            </label>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                          aria-label={`حذف ${l.name || "السطر"}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center rounded-lg border border-navy/15 bg-ivory">
                          <button
                            type="button"
                            aria-label="زيادة"
                            disabled={l.quantity >= 99}
                            onClick={() => update(l.key, { quantity: l.quantity + 1 })}
                            className="p-2.5 disabled:opacity-30"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center tabular-nums" aria-label="الكمية">
                            {l.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="إنقاص"
                            disabled={l.quantity <= 1}
                            onClick={() => update(l.key, { quantity: l.quantity - 1 })}
                            className="p-2.5 disabled:opacity-30"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <label className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">سعر الوحدة</span>
                          <input
                            value={l.unit_price}
                            onChange={(e) => update(l.key, { unit_price: e.target.value })}
                            inputMode="decimal"
                            dir="ltr"
                            className={cn(
                              inp,
                              "mt-0 h-9 w-28 text-right tabular-nums",
                              !Number.isFinite(price(l.unit_price)) &&
                                l.unit_price !== "" &&
                                "border-destructive",
                            )}
                          />
                        </label>
                        <span className="ms-auto text-navy tabular-nums">{f(lineTotal)}</span>
                      </div>
                      {!l.product_id && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          سطر حر — لا يؤثر على المخزون.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Totals */}
          <section className="rounded-lg bg-cream/70 p-4">
            <dl className="space-y-2 tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <dt>المجموع الفرعي</dt>
                <dd>{f(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <dt>
                  <label htmlFor="invoice-fee">رسوم التوصيل</label>
                </dt>
                <dd>
                  <input
                    id="invoice-fee"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    inputMode="decimal"
                    dir="ltr"
                    className={cn(
                      inp,
                      "mt-0 h-9 w-28 text-right tabular-nums",
                      !Number.isFinite(feeValue) && "border-destructive",
                    )}
                  />
                </dd>
              </div>
              <div className="flex justify-between border-t border-navy/10 pt-2 text-base text-navy">
                <dt>الإجمالي</dt>
                <dd className="font-medium">{f(total)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <dt>
                  <label htmlFor="invoice-paid">المبلغ المدفوع</label>
                </dt>
                <dd className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaid(String(total))}
                    className="h-9 rounded-lg px-2 text-xs text-navy underline decoration-gold underline-offset-4 hover:decoration-navy"
                  >
                    تحصيل الكل
                  </button>
                  <input
                    id="invoice-paid"
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)}
                    inputMode="decimal"
                    dir="ltr"
                    aria-invalid={!paidOk}
                    aria-describedby={!paidOk ? "invoice-paid-err" : undefined}
                    className={cn(
                      inp,
                      "mt-0 h-9 w-28 text-right tabular-nums",
                      !paidOk && "border-destructive",
                    )}
                  />
                </dd>
              </div>
              <div
                className={cn(
                  "flex justify-between rounded-md px-3 py-2 text-base",
                  remaining > 0 ? "bg-navy text-cream" : "bg-gold/20 text-navy",
                )}
              >
                <dt>{remaining > 0 ? "المتبقي" : "مدفوعة بالكامل"}</dt>
                <dd className="font-medium">{f(remaining)}</dd>
              </div>
            </dl>
            {!paidOk && (
              <p id="invoice-paid-err" className="mt-2 text-xs text-destructive">
                المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي.
              </p>
            )}
          </section>

          {!order && (
            <section>
              <SectionTitle>الحالة</SectionTitle>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="حالة الفاتورة">
                {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={status === s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "h-10 rounded-lg border px-3.5 text-sm transition-colors",
                      status === s
                        ? "border-navy bg-navy text-cream"
                        : "border-navy/15 text-navy hover:border-gold hover:bg-gold/10",
                    )}
                  >
                    {orderStatusLabel[s]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                «مؤكد» وما بعدها تخصم القطع المتوفرة من المخزون فوراً.
              </p>
            </section>
          )}
        </div>

        <div className="flex gap-2 border-t border-navy/10 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:justify-end sm:px-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="h-11 flex-1 sm:h-10 sm:flex-none"
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={busy}
            className="h-11 flex-[2] gap-2 sm:h-10 sm:min-w-36 sm:flex-none"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {order ? "حفظ التعديلات" : `إنشاء الفاتورة · ${f(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Err({ m }: { m?: string | undefined }) {
  return m ? <span className="mt-1 block text-xs text-destructive">{m}</span> : null;
}
