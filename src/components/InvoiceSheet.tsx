import type { ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders";
import type { Settings } from "@/lib/data";
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

/** The printable A4 invoice, shared by the admin page and the customer link (/invoice/<token>). */
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

  return (
    <article className="mx-auto max-w-[210mm] rounded-xl bg-white px-5 py-8 text-sm text-ink shadow-[0_1px_2px_oklch(0.19_0.03_260/0.06),0_12px_32px_-12px_oklch(0.19_0.03_260/0.18)] sm:px-[14mm] sm:py-[14mm] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      {/* Masthead */}
      <header className="flex flex-row gap-6  items-start justify-between">
        <div className="sm:text-start">
          <h1 className="font-display text-4xl leading-none text-navy sm:text-5xl">فاتورة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            رقم{" "}
            <span dir="ltr" className="text-navy tabular-nums">
              {invoice.order_number}
            </span>
          </p>
        </div>
        <img
          src={BRAND.horizontal.dark}
          alt={storeName}
          className="h-12 w-auto self-start sm:h-14"
        />
      </header>
      <div className="mt-6 h-px bg-gold/70" />

      {/* Key facts */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Fact label="تاريخ الإصدار" value={dateFmt.format(new Date(invoice.created_at))} />
        <Fact label="حالة الطلب" value={orderStatusLabel[invoice.status]} />
        <Fact label="عدد القطع" value={num.format(pieces)} />
        <Fact label="العملة" value={currency ?? "—"} ltr />
      </dl>

      {/* Parties */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Party title="من">
          <p className="text-base text-navy">{storeName}</p>
          {settings?.address && <p>{settings.address}</p>}
          {settings?.contact_phone && (
            <p>
              <bdi className="tabular-nums">{settings.contact_phone}</bdi>
            </p>
          )}
          {settings?.contact_email && (
            <p>
              <bdi>{settings.contact_email}</bdi>
            </p>
          )}
        </Party>
        <Party title="إلى">
          <p className="text-base text-navy">{invoice.customer_name}</p>
          <p>
            <bdi className="tabular-nums">{invoice.phone}</bdi>
          </p>
          <p>
            {invoice.city} — {invoice.address}
          </p>
        </Party>
      </section>

      {/* Items — table on sm+ and paper */}
      <table className="mt-8 hidden w-full border-collapse text-sm sm:table print:table">
        <thead>
          <tr className="border-b border-navy/15 text-xs text-muted-foreground">
            <th scope="col" className="w-10 py-3 text-start font-normal">
              #
            </th>
            <th scope="col" className="py-3 text-start font-normal">
              الصنف
            </th>
            <th scope="col" className="w-16 py-3 text-center font-normal">
              الكمية
            </th>
            <th scope="col" className="w-32 py-3 text-end font-normal">
              سعر الوحدة
            </th>
            <th scope="col" className="w-32 py-3 text-end font-normal">
              الإجمالي
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((i, idx) => (
            <tr key={i.id} className="break-inside-avoid border-b border-navy/[0.07]">
              <td className="py-3.5 align-top text-muted-foreground tabular-nums">
                {num.format(idx + 1)}
              </td>
              <td className="py-3.5 align-top">
                <p className="text-navy">{i.product_name}</p>
                {i.variant && <p className="mt-0.5 text-xs text-muted-foreground">{i.variant}</p>}
              </td>
              <td className="py-3.5 text-center align-top tabular-nums">
                {num.format(i.quantity)}
              </td>
              <td className="py-3.5 text-end align-top whitespace-nowrap tabular-nums">
                {f(i.unit_price)}
              </td>
              <td className="py-3.5 text-end align-top whitespace-nowrap text-navy tabular-nums">
                {f(i.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Items — list on phones */}
      <ul className="mt-8 divide-y divide-navy/[0.07] border-y border-navy/15 sm:hidden print:hidden">
        {invoice.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-4 py-3.5">
            <div className="min-w-0">
              <p className="text-navy">{i.product_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {i.variant && <>{i.variant} · </>}
                {num.format(i.quantity)} × {f(i.unit_price)}
              </p>
            </div>
            <span className="shrink-0 text-navy tabular-nums">{f(i.line_total)}</span>
          </li>
        ))}
      </ul>

      {/* Totals */}
      <section className="mt-6 flex sm:justify-end">
        <dl className="w-full space-y-2.5 tabular-nums sm:w-80">
          <div className="flex justify-between text-muted-foreground">
            <dt>المجموع الفرعي</dt>
            <dd>{f(invoice.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>رسوم التوصيل</dt>
            <dd>{f(invoice.delivery_fee)}</dd>
          </div>
          <div className="flex items-baseline justify-between rounded-lg bg-navy px-4 py-3 text-cream">
            <dt className="text-sm">الإجمالي المستحق</dt>
            <dd className="text-xl font-medium text-gold">{f(invoice.total)}</dd>
          </div>
        </dl>
      </section>

      {invoice.notes && (
        <section className="mt-8 rounded-lg bg-cream/70 px-4 py-3 break-inside-avoid">
          <h2 className="text-xs text-muted-foreground">ملاحظات العميل</h2>
          <p className="mt-1 text-navy">{invoice.notes}</p>
        </section>
      )}

      <footer className="mt-12 border-t border-navy/10 pt-6 text-center break-inside-avoid">
        <p className="text-navy">شكراً لثقتكم في {storeName}</p>
        <p className="mt-1 text-xs text-muted-foreground">حينما تكتمل التفاصيل… يبدأ الترف</p>
      </footer>
    </article>
  );
}

function Fact({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className="mt-1 text-navy"
        dir={ltr ? "ltr" : undefined}
        style={ltr ? { textAlign: "right" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function Party({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-navy/10 px-4 py-3.5 break-inside-avoid">
      <h2 className="text-xs text-muted-foreground">{title}</h2>
      <div className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
