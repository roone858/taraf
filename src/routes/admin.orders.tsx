import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, FileText, Loader2, MapPin, Phone, Search, StickyNote, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUSES,
  STOCK_HOLDING,
  orderErrorMessage,
  orderStatusLabel,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WhatsappIcon } from "@/components/BrandIcons";
import { SendInvoiceWhatsapp } from "@/components/SendInvoiceWhatsapp";
import { inp } from "./admin.categories";

export const Route = createFileRoute("/admin/orders")({ component: Orders });

type OrderRow = Order & { order_items: OrderItem[] };
const ORDERS_KEY = ["admin", "orders"] as const;

const dateTimeFmt = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const statusTone: Record<OrderStatus, string> = {
  new: "bg-gold/20 text-navy",
  confirmed: "bg-navy/10 text-navy",
  in_production: "bg-navy/10 text-navy",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

function Orders() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: settings } = useQuery(settingsQuery);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .order("id");
      if (error) throw error;
      return data as OrderRow[];
    },
    refetchInterval: 60_000,
  });

  const all = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => {
    const m = new Map<OrderStatus, number>();
    for (const o of all) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, [all]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return all.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (!term ||
          o.order_number.toLowerCase().includes(term) ||
          o.customer_name.toLowerCase().includes(term) ||
          (digits.length >= 3 && o.phone.replace(/\D/g, "").includes(digits))),
    );
  }, [all, q, status]);
  const open = all.find((o) => o.id === openId) ?? null;

  const refresh = () =>
    Promise.all(
      [["admin"], ["products"], ["product"], ["shop"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">الطلبات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {all.length} طلب · {counts.get("new") ?? 0} جديد بانتظار التأكيد · يُخصم المخزون عند
            تأكيد الطلب
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 bg-ivory p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="رقم الطلب أو اسم العميل أو الهاتف"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(inp, "mt-0 ps-9")}
          />
        </div>
        <div className="flex flex-wrap border bg-cream text-sm" role="group" aria-label="الحالة">
          {(["all", ...ORDER_STATUSES] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatus(v)}
              className={cn(
                "flex h-10 items-center gap-1.5 px-3 transition-colors",
                status === v ? "bg-navy text-cream" : "text-navy hover:bg-gold/15",
              )}
            >
              {v === "all" ? "الكل" : orderStatusLabel[v]}
              <span
                className={cn("text-xs", status === v ? "text-cream/70" : "text-muted-foreground")}
              >
                {v === "all" ? all.length : (counts.get(v) ?? 0)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto bg-ivory">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-normal">الطلب</th>
              <th className="p-3 text-start font-normal">العميل</th>
              <th className="p-3 text-start font-normal">القطع</th>
              <th className="p-3 text-start font-normal">الإجمالي</th>
              <th className="p-3 text-start font-normal">الحالة</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading &&
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-3">
                    <div className="h-12 animate-pulse bg-cream" />
                  </td>
                </tr>
              ))}
            {isError && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  تعذر تحميل الطلبات.{" "}
                  <button onClick={() => refetch()} className="text-navy underline hover:text-gold">
                    إعادة المحاولة
                  </button>
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {all.length === 0
                    ? "لا توجد طلبات بعد. ستظهر هنا الطلبات القادمة من صفحة إتمام الطلب."
                    : "لا توجد طلبات مطابقة."}
                </td>
              </tr>
            )}
            {rows.map((o) => {
              const pieces = o.order_items.reduce((s, i) => s + i.quantity, 0);
              return (
                <tr
                  key={o.id}
                  className="cursor-pointer transition-colors hover:bg-cream/60"
                  onClick={() => setOpenId(o.id)}
                >
                  <td className="p-3">
                    <p className="text-navy" dir="ltr">
                      {o.order_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateTimeFmt.format(new Date(o.created_at))}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="text-navy">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span dir="ltr">{o.phone}</span> · {o.city}
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {pieces} {pieces === 1 ? "قطعة" : "قطع"}
                  </td>
                  <td className="whitespace-nowrap p-3 text-navy">
                    {formatPrice(Number(o.total), o.currency)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        to="/admin/orders/$id/invoice"
                        params={{ id: o.id }}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`فاتورة ${o.order_number}`}
                        title="الفاتورة (PDF)"
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-gold/15 hover:text-navy"
                      >
                        <FileText className="h-4 w-4" />
                      </Link>
                      <span
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground"
                        aria-hidden
                      >
                        <Eye className="h-4 w-4" />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OrderDialog
        key={open?.id}
        order={open}
        storeCurrency={settings?.currency}
        storeName={settings?.store_name}
        onClose={() => setOpenId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("whitespace-nowrap px-2 py-0.5 text-xs", statusTone[status])}>
      {orderStatusLabel[status]}
    </span>
  );
}

function OrderDialog({
  order,
  storeCurrency,
  storeName,
  onClose,
  onChanged,
}: {
  order: OrderRow | null;
  storeCurrency: string | undefined;
  storeName: string | undefined;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState(order?.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!order) return null;

  const currency = order.currency || storeCurrency;
  const customerWa = normalizeWhatsappNumber(order.phone);
  const canDelete =
    (order.status === "new" || order.status === "cancelled") && !order.stock_deducted;

  const changeStatus = async (s: OrderStatus) => {
    if (s === order.status || pending) return;
    setPending(s);
    const { error } = await supabase.rpc("set_order_status", { _order_id: order.id, _status: s });
    setPending(null);
    if (error) return void toast.error(orderErrorMessage(error.message));
    const deducted = STOCK_HOLDING.includes(s) && !order.stock_deducted;
    const restored = !STOCK_HOLDING.includes(s) && order.stock_deducted;
    toast.success(
      `تم تغيير الحالة إلى «${orderStatusLabel[s]}»${deducted ? " وخصم المخزون" : restored ? " وإرجاع المخزون" : ""}`,
    );
    await onChanged();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase
      .from("orders")
      .update({ admin_notes: notes.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    setSavingNotes(false);
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ الملاحظات");
    await onChanged();
  };

  const remove = async () => {
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    setConfirmDelete(false);
    if (error) return void toast.error(error.message);
    toast.success("تم حذف الطلب");
    onClose();
    await onChanged();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-2xl"
        >
          <DialogHeader className="border-b px-6 py-4 text-start">
            <DialogTitle className="flex flex-wrap items-center gap-3 font-display text-2xl text-navy">
              <span dir="ltr">{order.order_number}</span>
              <StatusBadge status={order.status} />
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {dateTimeFmt.format(new Date(order.created_at))}
            </p>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm">
            {/* Status */}
            <section>
              <h3 className="eyebrow mb-3 font-sans">الحالة</h3>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={!!pending}
                    className={cn(
                      "flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors disabled:opacity-60",
                      s === order.status
                        ? "border-navy bg-navy text-cream"
                        : s === "cancelled"
                          ? "text-destructive hover:border-destructive"
                          : "text-navy hover:border-gold",
                    )}
                  >
                    {pending === s && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {orderStatusLabel[s]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {order.stock_deducted
                  ? "تم خصم المخزون لهذا الطلب. الرجوع إلى «جديد» أو الإلغاء يعيد الكميات للمخزون."
                  : "لم يُخصم المخزون بعد. سيُخصم عند نقل الطلب إلى «مؤكد» أو ما بعدها."}
              </p>
            </section>

            {/* Customer */}
            <section>
              <h3 className="eyebrow mb-3 font-sans">العميل</h3>
              <div className="space-y-2 bg-cream/60 p-4">
                <p className="text-base text-navy">{order.customer_name}</p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gold" />
                  <a href={`tel:${order.phone}`} dir="ltr" className="hover:text-gold">
                    {order.phone}
                  </a>
                  {customerWa && (
                    <a
                      href={`https://wa.me/${customerWa}?text=${encodeURIComponent(`مرحباً ${order.customer_name}، بخصوص طلبك رقم ${order.order_number} من TARAF FURNITURE`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-2 flex items-center gap-1 text-xs text-gold hover:text-navy"
                    >
                      <WhatsappIcon className="h-3.5 w-3.5" /> مراسلة
                    </a>
                  )}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-gold" />
                  <span>
                    {order.city} — {order.address}
                  </span>
                </p>
                {order.notes && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <StickyNote className="mt-1 h-4 w-4 shrink-0 text-gold" />
                    <span>{order.notes}</span>
                  </p>
                )}
              </div>
            </section>

            {/* Items */}
            <section>
              <h3 className="eyebrow mb-3 font-sans">القطع</h3>
              <ul className="divide-y border-y">
                {order.order_items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-navy">{i.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.variant && <>{i.variant} · </>}
                        {i.quantity} × {formatPrice(Number(i.unit_price), currency)}
                        {!i.product_id && " · (المنتج محذوف)"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-navy">
                      {formatPrice(Number(i.line_total), currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <dt>المجموع الفرعي</dt>
                  <dd>{formatPrice(Number(order.subtotal), currency)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>رسوم التوصيل</dt>
                  <dd>{formatPrice(Number(order.delivery_fee), currency)}</dd>
                </div>
                <div className="flex justify-between text-base text-navy">
                  <dt>الإجمالي</dt>
                  <dd>{formatPrice(Number(order.total), currency)}</dd>
                </div>
              </dl>
            </section>

            {/* Internal notes */}
            <section>
              <h3 className="eyebrow mb-3 font-sans">ملاحظات داخلية</h3>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="لا تظهر للعميل — مثل موعد التوصيل أو تفاصيل الدفع"
                className={cn(inp, "mt-0 h-auto py-2")}
              />
              {notes.trim() !== (order.admin_notes ?? "") && (
                <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="mt-2 gap-2">
                  {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />} حفظ الملاحظات
                </Button>
              )}
            </section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
            {canDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-sm text-destructive hover:underline"
              >
                <Trash2 className="h-4 w-4" /> حذف الطلب
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <SendInvoiceWhatsapp order={order} storeName={storeName} currency={storeCurrency} />
              <Button asChild variant="outline" className="gap-2">
                <Link to="/admin/orders/$id/invoice" params={{ id: order.id }} target="_blank">
                  <FileText className="h-4 w-4" /> الفاتورة PDF
                </Link>
              </Button>
              <Button variant="outline" onClick={onClose} disabled={!!pending}>
                إغلاق
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent dir="rtl" className="bg-ivory">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف الطلب {order.order_number}؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الطلب وقطعه نهائياً. يُفضّل تغيير الحالة إلى «ملغي» للاحتفاظ بالسجل.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
