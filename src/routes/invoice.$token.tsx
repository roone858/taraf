import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { FileWarning, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { WhatsappIcon } from "@/components/BrandIcons";
import { InvoiceSheet, type InvoiceData } from "@/components/InvoiceSheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Customer-facing invoice: /invoice/<invoice_token>, sent over WhatsApp. The token alone grants
 * read access (get_invoice), so the page is kept out of search engines.
 */
export const Route = createFileRoute("/invoice/$token")({
  ssr: false,
  head: () => ({
    meta: [{ title: "فاتورة — TARAF FURNITURE" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PublicInvoice,
});

function PublicInvoice() {
  const { token } = Route.useParams();
  const { data: s } = useQuery(settingsQuery);
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", token],
    enabled: UUID.test(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invoice", { _token: token });
      if (error) throw error;
      return data as InvoiceData | null;
    },
  });

  // The PDF saved from the print dialog takes its file name from the document title
  useEffect(() => {
    if (invoice) document.title = `فاتورة ${invoice.order_number}`;
  }, [invoice]);

  const wa = normalizeWhatsappNumber(s?.whatsapp_number);

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream" aria-busy="true">
        <p className="text-sm text-muted-foreground">جارٍ تحميل الفاتورة…</p>
      </div>
    );

  if (!invoice)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
          <FileWarning className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-base text-navy">لم نجد هذه الفاتورة</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          تأكد من نسخ الرابط كاملاً كما وصلك، أو تواصل معنا وسنرسله لك من جديد.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {wa && (
            <Button asChild className="h-10 gap-2">
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                <WhatsappIcon className="h-4 w-4" /> تواصل معنا
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="h-10">
            <Link to="/">الذهاب إلى المتجر</Link>
          </Button>
        </div>
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
      <div className="sticky top-0 z-10 border-b border-gold/30 bg-navy print:hidden">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
          <Link to="/" aria-label="الذهاب إلى المتجر">
            <Logo className="h-9" />
          </Link>
          <div className="flex items-center gap-2">
            {wa && (
              <Button
                asChild
                variant="ghostGold"
                className="h-10 gap-2 px-3"
                aria-label="تواصل معنا عبر واتساب"
              >
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(`مرحباً، بخصوص الفاتورة رقم ${invoice.order_number}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsappIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">استفسار</span>
                </a>
              </Button>
            )}
            <Button
              variant="gold"
              onClick={() => window.print()}
              className="h-10 gap-2"
              title="اختر «حفظ بصيغة PDF» من نافذة الطباعة"
            >
              <Printer className="h-4 w-4" /> طباعة / PDF
            </Button>
          </div>
        </div>
      </div>

      <main className="px-3 py-6 sm:px-6 sm:py-10 print:p-0">
        <InvoiceSheet invoice={invoice} settings={s} />
        <p className="mx-auto mt-4 max-w-[210mm] px-2 text-center text-xs text-muted-foreground print:hidden">
          لحفظ الفاتورة كملف PDF اختر «حفظ بصيغة PDF» في نافذة الطباعة.
        </p>
      </main>
    </div>
  );
}
