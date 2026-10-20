import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight, FileWarning, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, type Order, type OrderItem } from "@/lib/orders";
import { BRAND } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SendInvoiceWhatsapp } from "@/components/SendInvoiceWhatsapp";

// Outside the /admin layout (no sidebar) so the page prints cleanly; data is still admin-only via RLS.
export const Route = createFileRoute("/admin_/orders/$id/invoice")({
  ssr: false,
  head: () => ({
    meta: [{ title: "فاتورة — TARAF FURNITURE" }, { name: "robots", content: "noindex" }],
  }),
  component: Invoice,
});

const dateFmt = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const num = new Intl.NumberFormat("ar-EG");

function Invoice() {
  const { id } = Route.useParams();
  const { data: s } = useQuery(settingsQuery);
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as (Order & { order_items: OrderItem[] }) | null;
    },
  });

  // The PDF saved from the print dialog takes its file name from the document title
  useEffect(() => {
    if (order) document.title = `فاتورة ${order.order_number}`;
  }, [order]);

  if (isLoading) return <SheetSkeleton />;
  if (error || !order)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
          <FileWarning className="h-5 w-5" />
        </span>
        <p className="mt-4 text-base text-navy">لم نجد هذه الفاتورة</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          قد يكون الطلب محذوفاً، أو أن الحساب الحالي لا يملك صلاحية عرضه.
        </p>
        <Button asChild variant="outline" className="mt-5 h-10 gap-2">
          <Link to="/admin/orders">
            <ArrowRight className="h-4 w-4" /> العودة إلى الطلبات
          </Link>
        </Button>
      </div>
    );

  const currency = order.currency || s?.currency;
  const f = (n: number) => formatPrice(Number(n), currency);
  const storeName = s?.store_name ?? "TARAF FURNITURE";
  const pieces = order.order_items.reduce((t, i) => t + i.quantity, 0);

  return (
    <div className="min-h-screen bg-cream print:bg-white">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="sticky top-0 z-10 border-b border-navy/10 bg-cream/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/admin/orders"
            className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-navy transition-colors hover:bg-navy/5"
          >
            <ArrowRight className="h-4 w-4" /> الطلبات
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <SendInvoiceWhatsapp order={order} storeName={s?.store_name} currency={s?.currency} />
            <Button
              onClick={() => window.print()}
              className="h-10 gap-2"
              title="اختر «حفظ بصيغة PDF» من نافذة الطباعة"
            >
              <Printer className="h-4 w-4" /> طباعة / حفظ PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Sheet: A4 on large screens and paper, fluid on phones */}
      <main className="px-3 py-6 sm:px-6 sm:py-10 print:p-0">
        <article className="mx-auto max-w-[210mm] rounded-xl bg-white px-5 py-8 text-sm text-ink shadow-[0_1px_2px_oklch(0.19_0.03_260/0.06),0_12px_32px_-12px_oklch(0.19_0.03_260/0.18)] sm:px-[14mm] sm:py-[14mm] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          {/* Masthead */}
          <header className="flex flex-row gap-6  items-start justify-between">
            <div className="sm:text-start">
              <h1 className="font-display text-4xl leading-none text-navy sm:text-5xl">فاتورة</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                رقم{" "}
                <span dir="ltr" className="text-navy tabular-nums">
                  {order.order_number}
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
            <Fact label="تاريخ الإصدار" value={dateFmt.format(new Date(order.created_at))} />
            <Fact label="حالة الطلب" value={orderStatusLabel[order.status]} />
            <Fact label="عدد القطع" value={num.format(pieces)} />
            <Fact label="العملة" value={currency ?? "—"} ltr />
          </dl>

          {/* Parties */}
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Party title="من">
              <p className="text-base text-navy">{storeName}</p>
              {s?.address && <p>{s.address}</p>}
              {s?.contact_phone && (
                <p>
                  <bdi className="tabular-nums">{s.contact_phone}</bdi>
                </p>
              )}
              {s?.contact_email && (
                <p>
                  <bdi>{s.contact_email}</bdi>
                </p>
              )}
            </Party>
            <Party title="إلى">
              <p className="text-base text-navy">{order.customer_name}</p>
              <p>
                <bdi className="tabular-nums">{order.phone}</bdi>
              </p>
              <p>
                {order.city} — {order.address}
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
              {order.order_items.map((i, idx) => (
                <tr key={i.id} className="break-inside-avoid border-b border-navy/[0.07]">
                  <td className="py-3.5 align-top text-muted-foreground tabular-nums">
                    {num.format(idx + 1)}
                  </td>
                  <td className="py-3.5 align-top">
                    <p className="text-navy">{i.product_name}</p>
                    {i.variant && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{i.variant}</p>
                    )}
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
            {order.order_items.map((i) => (
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
                <dd>{f(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>رسوم التوصيل</dt>
                <dd>{f(order.delivery_fee)}</dd>
              </div>
              <div className="flex items-baseline justify-between rounded-lg bg-navy px-4 py-3 text-cream">
                <dt className="text-sm">الإجمالي المستحق</dt>
                <dd className="text-xl font-medium text-gold">{f(order.total)}</dd>
              </div>
            </dl>
          </section>

          {order.notes && (
            <section className="mt-8 rounded-lg bg-cream/70 px-4 py-3 break-inside-avoid">
              <h2 className="text-xs text-muted-foreground">ملاحظات العميل</h2>
              <p className="mt-1 text-navy">{order.notes}</p>
            </section>
          )}

          <footer className="mt-12 border-t border-navy/10 pt-6 text-center break-inside-avoid">
            <p className="text-navy">شكراً لثقتكم في {storeName}</p>
            <p className="mt-1 text-xs text-muted-foreground">حينما تكتمل التفاصيل… يبدأ الترف</p>
          </footer>
        </article>

        <p className="mx-auto mt-4 max-w-[210mm] px-2 text-center text-xs text-muted-foreground print:hidden">
          لحفظ الفاتورة كملف PDF اختر «حفظ بصيغة PDF» في نافذة الطباعة.
        </p>
      </main>
    </div>
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

function Party({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-navy/10 px-4 py-3.5 break-inside-avoid">
      <h2 className="text-xs text-muted-foreground">{title}</h2>
      <div className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div
      className="min-h-screen bg-cream px-3 py-16 sm:px-6"
      aria-busy="true"
      aria-label="جارٍ تحميل الفاتورة"
    >
      <div className="mx-auto max-w-[210mm] space-y-6 rounded-xl bg-white px-5 py-8 sm:px-[14mm] sm:py-[14mm]">
        <div className="flex justify-between">
          <div className="h-12 w-40 animate-pulse rounded bg-navy/[0.06]" />
          <div className="h-10 w-28 animate-pulse rounded bg-navy/[0.06]" />
        </div>
        <div className="h-px bg-navy/10" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-navy/[0.06]" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-navy/[0.06]" />
          <div className="h-24 animate-pulse rounded-lg bg-navy/[0.06]" />
        </div>
        <div className="h-40 animate-pulse rounded bg-navy/[0.06]" />
      </div>
    </div>
  );
}
