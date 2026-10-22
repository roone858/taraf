import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  FileText,
  Inbox,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
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
import { OrderEditor } from "@/components/admin/OrderEditor";
import {
  Badge,
  EmptyState,
  ErrorState,
  FilterTabs,
  ListSkeleton,
  ResultBar,
  SearchInput,
  SectionTitle,
  inp,
  type Tone,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/orders")({ component: Orders });

type OrderRow = Order & { order_items: OrderItem[] };
type Period = "all" | "today" | "7" | "30";
type Sort = "newest" | "oldest" | "total";

const ORDERS_KEY = ["admin", "orders"] as const;
const num = new Intl.NumberFormat("ar-EG");
const dateTimeFmt = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const PERIODS: [Period, string][] = [
  ["all", "كل الفترات"],
  ["today", "اليوم"],
  ["7", "آخر ٧ أيام"],
  ["30", "آخر ٣٠ يوماً"],
];
const SORTS: [Sort, string][] = [
  ["newest", "الأحدث أولاً"],
  ["oldest", "الأقدم أولاً"],
  ["total", "الأعلى قيمة"],
];

/** Badge surface + dot colour per status. `new` is the only one that asks for action, so it alone is gold. */
const STATUS_TONE: Record<OrderStatus, Tone> = {
  new: "gold",
  confirmed: "navy",
  in_production: "soft",
  delivered: "muted",
  cancelled: "danger",
};

function periodStart(p: Period) {
  if (p === "all") return 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p !== "today") d.setDate(d.getDate() - (Number(p) - 1));
  return d.getTime();
}

const pieceCount = (o: OrderRow) => o.order_items.reduce((s, i) => s + i.quantity, 0);
const piecesLabel = (n: number) => `${num.format(n)} ${n === 1 ? "قطعة" : "قطع"}`;

function Orders() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ order: OrderRow | null } | null>(null);
  const { data: settings } = useQuery(settingsQuery);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
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
  // Search + period narrow the set first, so the status counts always describe what you're looking at
  const scoped = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const from = periodStart(period);
    return all.filter(
      (o) =>
        new Date(o.created_at).getTime() >= from &&
        (!term ||
          o.order_number.toLowerCase().includes(term) ||
          o.customer_name.toLowerCase().includes(term) ||
          (digits.length >= 3 && o.phone.replace(/\D/g, "").includes(digits))),
    );
  }, [all, q, period]);
  const counts = useMemo(() => {
    const m = new Map<OrderStatus, number>();
    for (const o of scoped) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, [scoped]);
  const rows = useMemo(() => {
    const list = scoped.filter((o) => status === "all" || o.status === status);
    if (sort === "oldest") return [...list].reverse();
    if (sort === "total") return [...list].sort((a, b) => Number(b.total) - Number(a.total));
    return list;
  }, [scoped, status, sort]);

  const shownValue = rows
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);
  const newCount = all.filter((o) => o.status === "new").length;
  const filtered = status !== "all" || q.trim() !== "" || period !== "all";
  const clearFilters = () => {
    setStatus("all");
    setQ("");
    setPeriod("all");
  };
  const open = all.find((o) => o.id === openId) ?? null;

  const refresh = () =>
    Promise.all(
      [["admin"], ["products"], ["product"], ["shop"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight text-navy">الطلبات</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLoading ? (
              "جارٍ تحميل الطلبات…"
            ) : (
              <>
                <span className="text-navy tabular-nums">{num.format(all.length)}</span> طلب
                {newCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-navy tabular-nums">{num.format(newCount)}</span> بانتظار
                    التأكيد
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-10 gap-2"
            aria-label="تحديث الطلبات"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button onClick={() => setEditor({ order: null })} className="h-10 gap-2">
            <Plus className="h-4 w-4" /> فاتورة جديدة
          </Button>
        </div>
      </header>

      <div className="mt-8 overflow-hidden rounded-xl border border-navy/10 bg-ivory shadow-[0_1px_2px_oklch(0.19_0.03_260/0.06)]">
        <FilterTabs
          label="تصفية حسب الحالة"
          value={status}
          onChange={setStatus}
          items={(["all", ...ORDER_STATUSES] as const).map((v) => ({
            value: v,
            label: v === "all" ? "الكل" : orderStatusLabel[v],
            count: v === "all" ? scoped.length : (counts.get(v) ?? 0),
            attention: v === "new",
          }))}
        />

        {/* Search, period, sort */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput
            className="flex-1"
            label="بحث في الطلبات"
            placeholder="رقم الطلب، اسم العميل، أو الهاتف"
            value={q}
            onChange={setQ}
          />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <SelectField
              icon={CalendarDays}
              label="الفترة"
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={PERIODS}
            />
            <SelectField
              icon={ArrowUpDown}
              label="الترتيب"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={SORTS}
            />
          </div>
        </div>

        {/* Result summary */}
        {!isLoading && !isError && all.length > 0 && (
          <ResultBar onClear={filtered ? clearFilters : undefined}>
            <span className="text-navy tabular-nums">{num.format(rows.length)}</span> طلب
            {shownValue > 0 && (
              <>
                {" · "}
                قيمتها{" "}
                <span className="text-navy tabular-nums">
                  {formatPrice(shownValue, settings?.currency)}
                </span>
                <span className="text-xs"> (دون الملغي)</span>
              </>
            )}
          </ResultBar>
        )}

        {/* Results */}
        <div className="border-t border-navy/10">
          {isLoading ? (
            <ListSkeleton thumb="round" />
          ) : isError ? (
            <ErrorState what="الطلبات" onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            all.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="لا توجد طلبات بعد"
                text="تظهر الطلبات هنا فور إرسالها من صفحة إتمام الطلب أو زر «اطلب الآن» في المتجر."
              />
            ) : (
              <EmptyState
                icon={Search}
                title="لا توجد طلبات مطابقة"
                text="جرّب كلمة بحث أخرى أو فترة أطول."
                action={
                  <Button variant="outline" onClick={clearFilters} className="h-10">
                    مسح الفلاتر
                  </Button>
                }
              />
            )
          ) : (
            <>
              {/* Phones: one divided list */}
              <ul className="divide-y divide-navy/[0.07] md:hidden">
                {rows.map((o) => (
                  // Row button and invoice link are siblings in a flex row, so they can never overlap
                  <li key={o.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setOpenId(o.id)}
                      className="min-w-0 flex-1 py-4 ps-4 pe-2 text-start transition-colors duration-150 hover:bg-cream/70 focus-visible:bg-cream focus-visible:outline-none active:bg-cream"
                      aria-label={`الطلب ${o.order_number} — ${o.customer_name}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-navy tabular-nums" dir="ltr">
                          {o.order_number}
                        </span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-1.5 truncate text-sm text-navy">{o.customer_name}</p>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">
                          {o.city} · {dateTimeFmt.format(new Date(o.created_at))}
                        </span>
                        <span className="shrink-0 text-sm text-navy tabular-nums">
                          {formatPrice(Number(o.total), o.currency)}
                        </span>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center border-s border-navy/[0.07] px-1.5">
                      <InvoiceLink order={o} />
                    </div>
                  </li>
                ))}
              </ul>

              {/* md and up: table */}
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-navy/[0.03] text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      الطلب
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      العميل
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      القطع
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-normal">
                      الإجمالي
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      الحالة
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">إجراءات</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/[0.07]">
                  {rows.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setOpenId(o.id)}
                      className="group cursor-pointer transition-colors duration-150 hover:bg-cream/70"
                    >
                      <td className="px-4 py-3.5">
                        {/* Real button so keyboard users can open the order too */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(o.id);
                          }}
                          className="rounded-sm text-navy tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                          dir="ltr"
                        >
                          {o.order_number}
                        </button>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {dateTimeFmt.format(new Date(o.created_at))}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-navy">{o.customer_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span dir="ltr" className="tabular-nums">
                            {o.phone}
                          </span>{" "}
                          · {o.city}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {piecesLabel(pieceCount(o))}
                      </td>
                      <td className="px-4 py-3.5 text-end whitespace-nowrap text-navy tabular-nums">
                        {formatPrice(Number(o.total), o.currency)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <InvoiceLink order={o} />
                          <ChevronLeft
                            aria-hidden
                            className="h-4 w-4 text-muted-foreground/50 transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:text-navy"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <OrderDialog
        key={open?.id}
        order={open}
        storeCurrency={settings?.currency}
        storeName={settings?.store_name}
        onClose={() => setOpenId(null)}
        onChanged={refresh}
        onEdit={() => {
          if (!open) return;
          // One dialog at a time: the editor replaces the order view and reopens it after saving
          setEditor({ order: open });
          setOpenId(null);
        }}
      />

      <OrderEditor
        open={!!editor}
        order={editor?.order ?? null}
        currency={settings?.currency}
        defaultFee={Number(settings?.delivery_fee ?? 0)}
        onClose={() => setEditor(null)}
        onSaved={async (id) => {
          setEditor(null);
          await refresh();
          setOpenId(id);
        }}
      />
    </div>
  );
}

function SelectField({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inp, "mt-0 h-11 rounded-lg ps-9 sm:w-44")}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function InvoiceLink({ order, className }: { order: OrderRow; className?: string }) {
  return (
    <Link
      to="/admin/orders/$id/invoice"
      params={{ id: order.id }}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      aria-label={`فاتورة الطلب ${order.order_number} (تفتح في نافذة جديدة)`}
      title="الفاتورة"
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-gold/15 hover:text-navy focus-visible:outline-2 focus-visible:outline-gold",
        className,
      )}
    >
      <FileText className="h-4 w-4" />
    </Link>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{orderStatusLabel[status]}</Badge>;
}

function OrderDialog({
  order,
  storeCurrency,
  storeName,
  onClose,
  onChanged,
  onEdit,
}: {
  order: OrderRow | null;
  storeCurrency: string | undefined;
  storeName: string | undefined;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
  onEdit: () => void;
}) {
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState(order?.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!order) return null;

  const currency = order.currency || storeCurrency;
  const customerWa = normalizeWhatsappNumber(order.phone);

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
    const { error } = await supabase.rpc("admin_delete_order", { _order_id: order.id });
    setConfirmDelete(false);
    if (error) return void toast.error(orderErrorMessage(error.message));
    toast.success(order.stock_deducted ? "تم حذف الفاتورة وإرجاع المخزون" : "تم حذف الفاتورة");
    onClose();
    await onChanged();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-2xl sm:rounded-xl"
        >
          <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
            <DialogTitle className="flex flex-wrap items-center gap-3 font-display text-2xl text-navy">
              <span dir="ltr" className="tabular-nums">
                {order.order_number}
              </span>
              <StatusBadge status={order.status} />
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {dateTimeFmt.format(new Date(order.created_at))} · {piecesLabel(pieceCount(order))}
            </p>
          </DialogHeader>

          <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6 text-sm">
            {/* Status */}
            <section>
              <SectionTitle>تغيير الحالة</SectionTitle>
              <div className="flex flex-wrap gap-2" role="group" aria-label="حالة الطلب">
                {ORDER_STATUSES.map((s) => {
                  const current = s === order.status;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeStatus(s)}
                      disabled={!!pending}
                      aria-pressed={current}
                      className={cn(
                        "flex h-10 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors duration-150 disabled:cursor-wait disabled:opacity-60",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                        current
                          ? "border-navy bg-navy text-cream"
                          : s === "cancelled"
                            ? "border-destructive/30 text-destructive hover:bg-destructive/5"
                            : "border-navy/15 text-navy hover:border-gold hover:bg-gold/10",
                      )}
                    >
                      {pending === s && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {orderStatusLabel[s]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                {order.stock_deducted
                  ? "خُصم المخزون لهذا الطلب. الرجوع إلى «جديد» أو الإلغاء يعيد الكميات للمخزون."
                  : "لم يُخصم المخزون بعد. يُخصم عند نقل الطلب إلى «مؤكد» أو ما بعدها."}
              </p>
            </section>

            {/* Customer */}
            <section>
              <SectionTitle>العميل</SectionTitle>
              <div className="space-y-2.5 rounded-lg bg-cream/70 p-4">
                <p className="text-base text-navy">{order.customer_name}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gold" />
                    <a
                      href={`tel:${order.phone}`}
                      dir="ltr"
                      className="tabular-nums underline-offset-4 hover:text-navy hover:underline"
                    >
                      {order.phone}
                    </a>
                  </span>
                  {customerWa && (
                    <a
                      href={`https://wa.me/${customerWa}?text=${encodeURIComponent(`مرحباً ${order.customer_name}، بخصوص طلبك رقم ${order.order_number} من TARAF FURNITURE`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-navy transition-colors hover:bg-gold/15"
                    >
                      <WhatsappIcon className="h-3.5 w-3.5 text-gold" /> مراسلة على واتساب
                    </a>
                  )}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span>
                    {order.city} — {order.address}
                  </span>
                </p>
                {order.notes && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <span>{order.notes}</span>
                  </p>
                )}
              </div>
            </section>

            {/* Items */}
            <section>
              <SectionTitle>القطع</SectionTitle>
              <ul className="divide-y divide-navy/[0.07] border-y border-navy/10">
                {order.order_items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-navy">{i.product_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {i.variant && <>{i.variant} · </>}
                        {i.quantity} × {formatPrice(Number(i.unit_price), currency)}
                        {!i.product_id && " · (المنتج محذوف)"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-navy tabular-nums">
                      {formatPrice(Number(i.line_total), currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5 tabular-nums">
                <div className="flex justify-between text-muted-foreground">
                  <dt>المجموع الفرعي</dt>
                  <dd>{formatPrice(Number(order.subtotal), currency)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>رسوم التوصيل</dt>
                  <dd>{formatPrice(Number(order.delivery_fee), currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-navy/10 pt-2 text-base text-navy">
                  <dt>الإجمالي</dt>
                  <dd className="font-medium">{formatPrice(Number(order.total), currency)}</dd>
                </div>
              </dl>
            </section>

            {/* Internal notes */}
            <section>
              <SectionTitle>ملاحظات داخلية</SectionTitle>
              <label className="block">
                <span className="sr-only">ملاحظات داخلية</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="لا تظهر للعميل — مثل موعد التوصيل أو تفاصيل الدفع"
                  className={cn(inp, "mt-0 h-auto rounded-lg py-2.5")}
                />
              </label>
              {notes.trim() !== (order.admin_notes ?? "") && (
                <Button
                  size="sm"
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="mt-2 h-9 gap-2"
                >
                  {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />} حفظ الملاحظات
                </Button>
              )}
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy/10 px-6 py-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> حذف
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onEdit} disabled={!!pending} className="gap-2">
                <Pencil className="h-4 w-4" /> تعديل
              </Button>
              <SendInvoiceWhatsapp order={order} storeName={storeName} currency={storeCurrency} />
              <Button asChild variant="outline" className="gap-2">
                <Link to="/admin/orders/$id/invoice" params={{ id: order.id }} target="_blank">
                  <FileText className="h-4 w-4" /> الفاتورة
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
        <AlertDialogContent dir="rtl" className="bg-ivory sm:rounded-xl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف الفاتورة {order.order_number}؟</AlertDialogTitle>
            <AlertDialogDescription>
              تُحذف الفاتورة وقطعها نهائياً ولا يمكن استرجاعها.
              {order.stock_deducted && " الكميات المخصومة من المخزون ستُعاد إليه."} للاحتفاظ بالسجل
              غيّر الحالة إلى «ملغي» بدلاً من الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف الفاتورة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
