import { useQuery } from "@tanstack/react-query";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { faqsQuery, settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { WhatsappIcon } from "./BrandIcons";

/** Shop-page FAQ, managed from Admin → الأسئلة الشائعة. Renders nothing until at least one is published. */
export function FaqSection({
  eyebrow = "مساعدة",
  title = "الأسئلة الشائعة",
}: { eyebrow?: string; title?: string } = {}) {
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
    <section
      className="border-b hairline bg-silk py-16 text-cream md:py-24"
      aria-labelledby="faq-title"
    >
      {/* Mobile: intro → questions → contact. lg: intro and contact share the start column. */}
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-8 lg:px-10">
        <div className="lg:col-start-1 lg:row-start-1">
          <h2 id="faq-title" className="font-display text-3xl text-balance text-cream md:text-5xl">
            {title}
          </h2>
          {/* The admin-managed short label reads as a lead under the title */}
          {eyebrow && (
            <p className="mt-4 flex items-center gap-3 text-gold">
              <span aria-hidden className="h-px w-8 bg-gold/70" />
              {eyebrow}
            </p>
          )}
          <p className="mt-4 max-w-sm leading-relaxed text-cream/75">
            إجابات سريعة عن الطلب والتوصيل والتصنيع حسب الطلب.
          </p>
        </div>

        <AccordionPrimitive.Root
          type="single"
          collapsible
          defaultValue={faqs[0]?.id}
          className="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {faqs.map((f) => (
            <AccordionPrimitive.Item
              key={f.id}
              value={f.id}
              className="border border-cream/10 bg-cream/[0.03] transition-colors duration-300 data-[state=open]:border-gold/35 data-[state=open]:bg-cream/[0.06]"
            >
              <AccordionPrimitive.Header>
                <AccordionPrimitive.Trigger className="group flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-4 text-start text-base text-cream transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset data-[state=open]:text-gold sm:px-6 sm:py-5 sm:text-lg">
                  <span className="min-w-0 leading-relaxed text-balance">{f.question}</span>
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center border border-gold/40 text-gold transition-[transform,background-color,color] duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:bg-gold group-data-[state=open]:text-ink"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="max-w-[65ch] px-4 pb-5 leading-loose whitespace-pre-line text-cream/80 sm:px-6 sm:pb-6">
                  {f.answer}
                </p>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>

        {wa && (
          <div className="border-t border-cream/10 pt-8 lg:col-start-1 lg:row-start-2 lg:self-start lg:border-t-0 lg:pt-0">
            <p className="text-cream">لم تجد إجابتك؟</p>
            <p className="mt-1 text-sm text-cream/65">فريقنا يرد على استفساراتك عبر واتساب.</p>
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent("مرحباً، لدي سؤال عن منتجاتكم")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center gap-2 bg-gold px-5 text-sm text-ink transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              <WhatsappIcon className="h-4 w-4" /> تواصل معنا
            </a>
          </div>
        )}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
