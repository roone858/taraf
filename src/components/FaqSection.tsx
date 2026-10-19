import { useQuery } from "@tanstack/react-query";
import { faqsQuery, settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WhatsappIcon } from "./BrandIcons";

/** Shop-page FAQ, managed from Admin → الأسئلة الشائعة. Renders nothing until at least one is published. */
export function FaqSection() {
  const { data: faqs } = useQuery(faqsQuery);
  const { data: s } = useQuery(settingsQuery);
  if (!faqs?.length) return null;

  const wa = normalizeWhatsappNumber(s?.whatsapp_number);
  // schema.org FAQPage so search engines can show the questions as rich results
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section className="border-b hairline bg-silk py-20 text-cream md:py-24" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-10">
        <div className="lg:sticky lg:top-40 lg:self-start">
          <p className="eyebrow">مساعدة</p>
          <h2 id="faq-title" className="mt-3 font-display text-4xl text-cream md:text-5xl">
            الأسئلة الشائعة
          </h2>
          <div className="my-6 h-px w-16 bg-gold/60" />
          <p className="text-sm leading-loose text-cream/70">
            إجابات سريعة عن الطلب والتوصيل والتصنيع حسب الطلب.
          </p>
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent("مرحباً، لدي سؤال عن منتجاتكم")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 border border-gold/60 px-5 py-3 text-sm text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink"
            >
              <WhatsappIcon className="h-4 w-4" /> لم تجد إجابتك؟ تواصل معنا
            </a>
          )}
        </div>

        <Accordion type="single" collapsible className="border-t border-cream/15">
          {faqs.map((f, i) => (
            <AccordionItem key={f.id} value={f.id} className="border-cream/15">
              <AccordionTrigger className="gap-4 py-5 text-start text-base font-normal text-cream hover:text-gold hover:no-underline data-[state=open]:text-gold [&>svg]:text-gold">
                <span className="flex items-baseline gap-4">
                  <span className="font-display text-sm text-gold/70" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {f.question}
                </span>
              </AccordionTrigger>
              <AccordionContent className="ps-10 pb-6 text-[0.95rem] leading-loose whitespace-pre-line text-cream/75">
                {f.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
