import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Coins,
  FileText,
  Globe,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders";
import type { Settings } from "@/lib/data";
import { parseSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { BRAND } from "./Logo";

/** What an invoice shows; an admin order row and get_invoice() both provide it. */
export type InvoiceData = {
  order_number: string;
  created_at: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  city: string;
  address: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  /** Missing on data from before payments were recorded; treated as 0. */
  amount_paid?: number | undefined;
  currency: string | null;
  items: {
    id: string;
    product_name: string;
    variant: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
};

const dateFmt = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const num = new Intl.NumberFormat("ar-EG");

/** Static QR of the public website (public/assets/brand/qr-website.svg → https://www.tarafhome.com). */
const WEBSITE_QR = "/assets/brand/qr-website.svg";
const FALLBACK_SITE = "www.tarafhome.com";

/** Deep gold for the amount-due band: dark enough for cream text, unlike the light brand gold. */
const dueBand = "bg-[oklch(0.6_0.075_72)] text-cream";

/**
 * The printable A4 invoice, shared by the admin page and the customer link (/invoice/<token>).
 * Dark masthead and table head, cream sheet, gold accents. Colours print (the pages set
 * print-color-adjust: exact).
 */
export function InvoiceSheet({
  invoice,
  settings,
}: {
  invoice: InvoiceData;
  settings: Settings | null | undefined;
}) {
  const currency = invoice.currency || settings?.currency;
  const f = (n: number) => formatPrice(Number(n), currency);
  const storeName = settings?.store_name ?? "TARAF FURNITURE";
  const pieces = invoice.items.reduce((t, i) => t + i.quantity, 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const remaining = Math.max(0, Number(invoice.total) - paid);
  const site =
    parseSeo(settings?.seo)
      .siteUrl.replace(/^https?:\/\//, "")
      .replace(/\/$/, "") || FALLBACK_SITE;

  return (
    <article className="mx-auto max-w-[210mm] overflow-hidden rounded-xl bg-[oklch(0.975_0.01_85)] text-sm text-ink shadow-[0_1px_2px_oklch(0.19_0.03_260/0.06),0_12px_32px_-12px_oklch(0.19_0.03_260/0.18)] print:max-w-none print:rounded-none print:shadow-none">
      {/* Masthead */}
      <header className="relative bg-ink text-cream">
        <div className="flex items-center justify-between gap-4 px-5 py-6 sm:px-10 sm:py-8">
          <div className="min-w-0">
            <h1 className="font-display text-4xl leading-none text-gold sm:text-5xl">فاتورة</h1>
            <p className="mt-3 text-xs text-cream/70 sm:text-sm">رقم الفاتورة</p>
            <p
              dir="ltr"
              className="mt-1 text-end text-lg font-medium tracking-wide text-gold sm:text-2xl"
            >
              {invoice.order_number}
            </p>
          </div>
          <span aria-hidden className="hidden h-24 w-px bg-gold/50 sm:block" />
          <img
            src={BRAND.horizontal.light}
            alt={storeName}
            className="h-14 w-auto shrink-0 sm:h-28"
          />
        </div>
        <div aria-hidden className="h-1 bg-gradient-to-l from-gold/30 via-gold to-gold/30" />
      </header>

      <div className="px-5 py-6 sm:px-10 sm:py-8">
        {/* Key facts */}
        <dl className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-navy/10">
          <Fact icon={LayoutGrid} label="عدد القطع" value={num.format(pieces)} />
          <Fact icon={Coins} label="العملة" value={currency ?? "—"} />
          <Fact
            icon={BadgeCheck}
            label="حالة الطلب"
            value={<StatusPill status={invoice.status} />}
          />
          <Fact
            icon={CalendarDays}
            label="تاريخ الإصدار"
            value={dateFmt.format(new Date(invoice.created_at))}
          />
        </dl>

        {/* Parties */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Party title="إلى" icon={User} name={invoice.customer_name}>
            <Line icon={Phone}>
              <bdi className="tabular-nums">{invoice.phone}</bdi>
            </Line>
            <Line icon={MapPin}>
              {invoice.city} — {invoice.address}
            </Line>
          </Party>
          <Party title="من" icon={Store} name={storeName}>
            {settings?.address && <Line icon={MapPin}>{settings.address}</Line>}
            {settings?.contact_phone && (
              <Line icon={Phone}>
                <bdi className="tabular-nums">{settings.contact_phone}</bdi>
              </Line>
            )}
            {settings?.contact_email && (
              <Line icon={Mail}>
                <bdi>{settings.contact_email}</bdi>
              </Line>
            )}
            {settings?.vat_number && (
              <Line icon={FileText}>
                <span className="text-xs">الرقم الضريبي:</span>{" "}
                <bdi className="text-navy tabular-nums">{settings.vat_number}</bdi>
              </Line>
            )}
            {settings?.cr_number && (
              <Line icon={FileText}>
                <span className="text-xs">السجل التجاري:</span>{" "}
                <bdi className="text-navy tabular-nums">{settings.cr_number}</bdi>
              </Line>
            )}
          </Party>
        </section>

        {/* Items — table on sm+ and paper */}
        <div className="mt-8 hidden overflow-hidden rounded-lg border border-navy/10 sm:block print:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-ink text-cream">
              <tr>
                <th scope="col" className="w-12 px-3 py-3.5 text-center font-normal">
                  #
                </th>
                <th
                  scope="col"
                  className="border-s border-cream/15 px-4 py-3.5 text-center font-normal"
                >
                  الصنف
                </th>
                <th
                  scope="col"
                  className="w-20 border-s border-cream/15 px-3 py-3.5 text-center font-normal"
                >
                  الكمية
                </th>
                <th
                  scope="col"
                  className="w-32 border-s border-cream/15 px-3 py-3.5 text-center font-normal"
                >
                  سعر الوحدة
                </th>
                <th
                  scope="col"
                  className="w-32 border-s border-cream/15 px-3 py-3.5 text-center font-normal"
                >
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60">
              {invoice.items.map((i, idx) => (
                <tr key={i.id} className="break-inside-avoid border-t border-navy/10">
                  <td className="px-3 py-4 text-center text-muted-foreground tabular-nums">
                    {num.format(idx + 1)}
                  </td>
                  <td className="border-s border-navy/10 px-4 py-4">
                    <p className="font-medium text-navy">{i.product_name}</p>
                    {i.variant && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{i.variant}</p>
                    )}
                  </td>
                  <td className="border-s border-navy/10 px-3 py-4 text-center tabular-nums">
                    {num.format(i.quantity)}
                  </td>
                  <td className="border-s border-navy/10 px-3 py-4 text-center whitespace-nowrap tabular-nums">
                    {f(i.unit_price)}
                  </td>
                  <td className="border-s border-navy/10 px-3 py-4 text-center font-medium whitespace-nowrap text-navy tabular-nums">
                    {f(i.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Items — cards on phones */}
        <div className="mt-8 overflow-hidden rounded-lg border border-navy/10 sm:hidden print:hidden">
          <p className="bg-ink px-4 py-3 text-cream">الأصناف</p>
          <ul className="divide-y divide-navy/10 bg-white/60">
            {invoice.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium text-navy">{i.product_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {i.variant && <>{i.variant} · </>}
                    {num.format(i.quantity)} × {f(i.unit_price)}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-navy tabular-nums">
                  {f(i.line_total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Totals (end side) */}
        <section className="mt-6 flex sm:justify-end">
          <div className="w-full overflow-hidden rounded-lg border border-navy/10 bg-white/60 sm:w-[22rem]">
            <dl className="divide-y divide-navy/10 px-5 tabular-nums">
              <Row label="المجموع الفرعي" value={f(invoice.subtotal)} />
              <Row label="رسوم التوصيل" value={f(invoice.delivery_fee)} />
              {paid > 0 && (
                <>
                  <Row label="الإجمالي" value={f(invoice.total)} strong />
                  <Row label="المبلغ المدفوع" value={f(paid)} />
                </>
              )}
            </dl>
            <div className={cn("flex items-baseline justify-between px-5 py-4", dueBand)}>
              <span className="text-base">
                {paid > 0 ? (remaining > 0 ? "المتبقي" : "مدفوعة بالكامل") : "الإجمالي المستحق"}
              </span>
              <span className="text-2xl font-medium tabular-nums">
                {f(paid > 0 ? remaining : invoice.total)}
              </span>
            </div>
          </div>
        </section>

        {invoice.notes && (
          <section className="mt-6 rounded-lg border border-navy/10 bg-white/60 px-4 py-3 break-inside-avoid">
            <h2 className="text-xs text-muted-foreground">ملاحظات</h2>
            <p className="mt-1 text-navy">{invoice.notes}</p>
          </section>
        )}

        {/* Thanks + website QR */}
        <section className="mt-10 flex flex-col-reverse gap-6 break-inside-avoid sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-2xl text-[oklch(0.55_0.075_72)] sm:text-3xl">
              شكراً لثقتكم في ترف
            </p>
            <p className="mt-1 text-muted-foreground">حينما تكتمل التفاصيل، يبدأ الترف.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground sm:text-end">
              <p>امسح الرمز لزيارة موقعنا</p>
              <p dir="ltr" className="mt-1 text-sm text-navy">
                {site}
              </p>
            </div>
            <span aria-hidden className="h-14 w-px bg-gold/60" />
            <img
              src={WEBSITE_QR}
              alt={`رمز QR لموقع ${storeName}`}
              width={88}
              height={88}
              className="h-22 w-22 shrink-0"
            />
          </div>
        </section>
      </div>

      {/* Contact strip */}
      <footer className="grid grid-cols-1 gap-3 border-t border-gold/30 bg-[oklch(0.94_0.018_85)] px-5 py-5 text-sm sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-navy/10 sm:px-10 print:grid-cols-3">
        <div className="sm:pe-6">
          <p className="tracking-[0.2em] text-navy">{storeName}</p>
          {settings?.address && (
            <p className="mt-0.5 text-xs text-muted-foreground">{settings.address}</p>
          )}
        </div>
        {settings?.contact_phone ? (
          <p className="flex items-center gap-2 text-navy sm:justify-center sm:px-6">
            <Phone className="h-4 w-4 text-gold" aria-hidden />
            <bdi className="tabular-nums">{settings.contact_phone}</bdi>
          </p>
        ) : (
          <span className="hidden sm:block" />
        )}
        <p className="flex items-center gap-2 text-navy sm:justify-end sm:ps-6">
          <Globe className="h-4 w-4 text-gold" aria-hidden />
          <bdi>{site}</bdi>
        </p>
      </footer>
    </article>
  );
}

/** Each status in its own colour; backgrounds print too (print-color-adjust: exact on the page). */
const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  confirmed: "bg-sky-100 text-sky-900 ring-sky-300",
  in_production: "bg-violet-100 text-violet-900 ring-violet-300",
  delivered: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  cancelled: "bg-red-100 text-red-900 ring-red-300",
};

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1 ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {orderStatusLabel[status]}
    </span>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 sm:justify-center sm:px-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/50 text-[oklch(0.55_0.075_72)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium text-navy">{value}</dd>
      </div>
    </div>
  );
}

function Party({
  title,
  icon: Icon,
  name,
  children,
}: {
  title: string;
  icon: LucideIcon;
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white/60 px-5 py-4 break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs text-muted-foreground">{title}</h2>
          <p className="mt-1 text-base font-medium text-navy">{name}</p>
        </div>
        <Icon className="h-6 w-6 shrink-0 text-[oklch(0.55_0.075_72)]" aria-hidden />
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function Line({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn("flex justify-between py-3", strong ? "text-navy" : "text-muted-foreground")}
    >
      <dt>{label}</dt>
      <dd className={cn(strong ? "font-medium" : "text-navy")}>{value}</dd>
    </div>
  );
}
