import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight, FileWarning, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { type Order, type OrderItem } from "@/lib/orders";
import { InvoiceSheet } from "@/components/InvoiceSheet";
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
        <InvoiceSheet invoice={{ ...order, items: order.order_items }} settings={s} />

        <p className="mx-auto mt-4 max-w-[210mm] px-2 text-center text-xs text-muted-foreground print:hidden">
          لحفظ الفاتورة كملف PDF اختر «حفظ بصيغة PDF» في نافذة الطباعة.
        </p>
      </main>
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
