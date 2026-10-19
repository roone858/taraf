import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight, Printer } from "lucide-react";
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

  if (isLoading) return <Centered>جارٍ تحميل الفاتورة...</Centered>;
  if (error || !order)
    return (
      <Centered>
        <p>تعذر العثور على الطلب، أو ليست لديك صلاحية لعرضه.</p>
        <Link to="/admin/orders" className="mt-4 inline-block text-gold">
          العودة إلى الطلبات
        </Link>
      </Centered>
    );

  const currency = order.currency || s?.currency;
  const f = (n: number) => formatPrice(Number(n), currency);

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { html, body { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="mx-auto mb-6 flex max-w-[210mm] items-center justify-between gap-3 px-4 print:hidden">
        <Link
          to="/admin/orders"
          className="flex items-center gap-2 text-sm text-navy hover:text-gold"
        >
          <ArrowRight className="h-4 w-4" /> الطلبات
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            اختر «حفظ بصيغة PDF» من نافذة الطباعة
          </span>
          <SendInvoiceWhatsapp order={order} storeName={s?.store_name} currency={s?.currency} />
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة / حفظ PDF
          </Button>
        </div>
      </div>

      {/* A4 sheet */}
      <article className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[14mm] text-sm text-ink shadow-lg print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-gold pb-6">
          <div>
            <img
              src={BRAND.horizontal.dark}
              alt={s?.store_name ?? "TARAF FURNITURE"}
              className="h-14 w-auto"
            />
            <div className="mt-4 space-y-0.5 text-xs text-muted-foreground">
              {s?.address && <p>{s.address}</p>}
              {s?.contact_phone && (
                <p dir="ltr" className="text-end">
                  {s.contact_phone}
                </p>
              )}
              {s?.contact_email && (
                <p dir="ltr" className="text-end">
                  {s.contact_email}
                </p>
              )}
            </div>
          </div>
          <div className="text-end">
            <h1 className="font-display text-4xl text-navy">فاتورة</h1>
            <dl className="mt-3 space-y-1 text-xs">
              <Meta label="رقم الفاتورة" value={<span dir="ltr">{order.order_number}</span>} />
              <Meta label="التاريخ" value={dateFmt.format(new Date(order.created_at))} />
              <Meta label="حالة الطلب" value={orderStatusLabel[order.status]} />
            </dl>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <h2 className="mb-2 text-xs tracking-wider text-gold">فاتورة إلى</h2>
            <p className="text-base text-navy">{order.customer_name}</p>
            <p className="mt-1 text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>
              {order.phone}
            </p>
            <p className="mt-1 text-muted-foreground">
              {order.city} — {order.address}
            </p>
          </div>
          {order.notes && (
            <div>
              <h2 className="mb-2 text-xs tracking-wider text-gold">ملاحظات العميل</h2>
              <p className="text-muted-foreground">{order.notes}</p>
            </div>
          )}
        </section>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy text-cream">
              <th className="w-10 px-3 py-2.5 text-center font-normal">#</th>
              <th className="px-3 py-2.5 text-start font-normal">الصنف</th>
              <th className="w-16 px-3 py-2.5 text-center font-normal">الكمية</th>
              <th className="w-32 px-3 py-2.5 text-end font-normal">سعر الوحدة</th>
              <th className="w-32 px-3 py-2.5 text-end font-normal">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((i, idx) => (
              <tr key={i.id} className="break-inside-avoid border-b border-navy/10">
                <td className="px-3 py-3 text-center text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-navy">{i.product_name}</p>
                  {i.variant && <p className="text-xs text-muted-foreground">{i.variant}</p>}
                </td>
                <td className="px-3 py-3 text-center">{i.quantity}</td>
                <td className="px-3 py-3 text-end whitespace-nowrap">{f(i.unit_price)}</td>
                <td className="px-3 py-3 text-end whitespace-nowrap text-navy">
                  {f(i.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <dl className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>المجموع الفرعي</dt>
              <dd>{f(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>رسوم التوصيل</dt>
              <dd>{f(order.delivery_fee)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-gold pt-2 text-base text-navy">
              <dt>الإجمالي</dt>
              <dd className="font-display text-xl">{f(order.total)}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-16 border-t border-navy/10 pt-6 text-center text-xs text-muted-foreground">
          <p className="text-navy">شكراً لثقتكم في {s?.store_name ?? "TARAF FURNITURE"}</p>
          <p className="mt-1">حينما تكتمل التفاصيل… يبدأ الترف</p>
        </footer>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-24 text-navy">{value}</dd>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-sm text-navy">
      {children}
    </div>
  );
}
