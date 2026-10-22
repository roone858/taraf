import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, FileQuestion, Languages } from "lucide-react";
import {
  formatPolicyDate,
  policyTabLabel,
  withSectionAnchors,
  type PolicyLanguage,
  type PolicyPage,
} from "@/lib/policies";
import { htmlToText, sanitizeHtml } from "@/lib/sanitize";
import { buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "./BrandIcons";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** Link to a policy in the given language (`/{slug}` or `/en/{slug}`), keeping scroll position. */
function PolicyLink({
  slug,
  language,
  className,
  children,
  current,
  ...rest
}: {
  slug: string;
  language: PolicyLanguage;
  className?: string;
  children: ReactNode;
  current?: boolean;
  lang?: string;
}) {
  const shared = {
    params: { slug },
    className,
    resetScroll: false,
    "aria-current": current ? ("page" as const) : undefined,
    ...rest,
  };
  return language === "en" ? (
    <Link to="/en/$slug" {...shared}>
      {children}
    </Link>
  ) : (
    <Link to="/$slug" {...shared}>
      {children}
    </Link>
  );
}

/**
 * All published policies as one tabbed page. Each tab keeps its own URL (`/{slug}`, `/en/{slug}`)
 * so links from checkout, the footer and search engines land on the right tab; switching tabs
 * swaps the content in place without a page jump.
 */
export function PolicyPageView({
  page,
  others,
  counterpart,
  language,
  whatsappNumber,
}: {
  page: PolicyPage | null;
  /** Every published policy in this language, in tab order. */
  others: PolicyPage[];
  counterpart: PolicyPage | null;
  language: PolicyLanguage;
  whatsappNumber: string | null;
}) {
  const ar = language === "ar";
  if (!page) return <NotFound others={others} language={language} />;

  const t = ar
    ? {
        home: "الرئيسية",
        policies: "السياسات",
        updated: "آخر تحديث",
        read: (n: number) => `قراءة ${n.toLocaleString("ar-EG")} ${n <= 2 ? "دقيقة" : "دقائق"}`,
        onPage: "في هذه الصفحة",
        prev: "السابق",
        next: "التالي",
        help: "لديك سؤال عن سياساتنا؟",
        helpText: "فريق ترف يجيبك عن الطلبات والتوصيل والاستبدال.",
        wa: "تواصل عبر واتساب",
        tabs: "السياسات والصفحات القانونية",
      }
    : {
        home: "Home",
        policies: "Policies",
        updated: "Last updated",
        read: (n: number) => `${n} min read`,
        onPage: "On this page",
        prev: "Previous",
        next: "Next",
        help: "Questions about our policies?",
        helpText: "The TARAF team can help with orders, delivery and returns.",
        wa: "Chat on WhatsApp",
        tabs: "Policies and legal pages",
      };

  return (
    <main dir={ar ? "rtl" : "ltr"} lang={language} className="bg-cream pt-20">
      <PolicyBody
        key={language}
        page={page}
        tabs={others.length ? others : [page]}
        counterpart={counterpart}
        language={language}
        whatsappNumber={whatsappNumber}
        t={t}
      />
    </main>
  );
}

type Copy = {
  home: string;
  policies: string;
  updated: string;
  read: (n: number) => string;
  onPage: string;
  prev: string;
  next: string;
  help: string;
  helpText: string;
  wa: string;
  tabs: string;
};

function PolicyBody({
  page,
  tabs,
  counterpart,
  language,
  whatsappNumber,
  t,
}: {
  page: PolicyPage;
  tabs: PolicyPage[];
  counterpart: PolicyPage | null;
  language: PolicyLanguage;
  whatsappNumber: string | null;
  t: Copy;
}) {
  const ar = language === "ar";
  const { html, sections } = useMemo(
    () => withSectionAnchors(sanitizeHtml(page.content)),
    [page.content],
  );
  const minutes = Math.max(1, Math.round(htmlToText(page.content).split(/\s+/).length / 180));
  const index = Math.max(
    0,
    tabs.findIndex((p) => p.id === page.id),
  );
  const prev = tabs[index - 1];
  const next = tabs[index + 1];
  const Back = ar ? ArrowRight : ArrowLeft;
  const Forward = ar ? ArrowLeft : ArrowRight;

  const wa = normalizeWhatsappNumber(whatsappNumber);
  const waHref = wa
    ? buildWhatsappUrl(
        wa,
        ar
          ? `مرحبًا، لدي استفسار حول ${page.title}`
          : `Hello, I have a question about ${page.title}`,
      )
    : null;

  // Switching tabs: bring the new policy's start into view (only when the reader had scrolled past
  // it), and keep the active tab visible in the scrollable strip.
  const panel = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLUListElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const list = strip.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && active) {
      const l = list.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      list.scrollBy({ left: a.left + a.width / 2 - (l.left + l.width / 2), behavior: "smooth" });
    }
    if (first.current) {
      first.current = false;
      return;
    }
    const top = panel.current?.getBoundingClientRect().top ?? 0;
    if (top < 140) window.scrollTo({ top: window.scrollY + top - 150, behavior: "smooth" });
  }, [page.id]);

  // Highlight the section being read in the contents list
  const [activeSection, setActiveSection] = useState<string | null>(null);
  useEffect(() => {
    setActiveSection(sections[0]?.id ?? null);
    if (sections.length < 2 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting)[0];
        if (hit) setActiveSection(hit.target.id);
      },
      { rootMargin: "-160px 0px -65% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [sections]);

  return (
    <>
      {/* Title band */}
      <section className="bg-silk text-cream">
        <div className="mx-auto max-w-6xl px-5 pt-8 pb-10 lg:px-10 lg:pt-12 lg:pb-14">
          <nav aria-label={ar ? "مسار التنقل" : "Breadcrumb"}>
            <ol className="flex flex-wrap items-center gap-x-2 text-xs text-cream/60">
              <li>
                <Link to="/" className={cn("transition-colors hover:text-gold", focusRing)}>
                  {t.home}
                </Link>
              </li>
              <li aria-hidden className="text-gold/50">
                /
              </li>
              <li>
                {ar ? (
                  <Link
                    to="/policies"
                    className={cn("transition-colors hover:text-gold", focusRing)}
                  >
                    {t.policies}
                  </Link>
                ) : (
                  <Link
                    to="/en/policies"
                    className={cn("transition-colors hover:text-gold", focusRing)}
                  >
                    {t.policies}
                  </Link>
                )}
              </li>
            </ol>
          </nav>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-tight text-balance [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
                {page.title}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cream/65">
                <span>
                  {t.updated}:{" "}
                  <time dateTime={page.last_updated_on} className="text-cream/85">
                    {formatPolicyDate(page.last_updated_on, language)}
                  </time>
                </span>
                <span aria-hidden className="h-1 w-1 rounded-full bg-gold/60" />
                <span>{t.read(minutes)}</span>
              </p>
            </div>
            {counterpart && (
              <PolicyLink
                slug={counterpart.slug}
                language={ar ? "en" : "ar"}
                lang={ar ? "en" : "ar"}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 border border-gold/50 px-4 text-xs text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink",
                  focusRing,
                )}
              >
                <Languages className="h-3.5 w-3.5" aria-hidden />
                {ar ? "English" : "العربية"}
              </PolicyLink>
            )}
          </div>
        </div>
      </section>

      {/* Tabs: sticky under the site header, scrollable on phones */}
      {tabs.length > 1 && (
        <div className="sticky top-20 z-30 border-b border-navy/10 bg-cream/95 backdrop-blur">
          <nav aria-label={t.tabs} className="mx-auto max-w-6xl lg:px-10">
            <ul
              ref={strip}
              className="flex overflow-x-auto px-3 [mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)] [scrollbar-width:none] lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((p) => {
                const active = p.id === page.id;
                return (
                  <li key={p.id} className="shrink-0">
                    <PolicyLink
                      slug={p.slug}
                      language={language}
                      current={active}
                      className={cn(
                        "relative flex h-14 items-center px-4 text-sm whitespace-nowrap transition-colors duration-200",
                        "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold",
                        active ? "text-navy" : "text-muted-foreground hover:text-navy",
                      )}
                    >
                      {policyTabLabel(p, language)}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-3 bottom-0 h-0.5 bg-gold transition-transform duration-300",
                          active ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </PolicyLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}

      <div
        ref={panel}
        className={cn(
          "mx-auto max-w-6xl px-5 py-10 lg:px-10 lg:py-14",
          sections.length > 1 && "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14",
        )}
      >
        {/* Contents: sticky list on large screens */}
        {sections.length > 1 && (
          <aside className="hidden lg:block">
            <nav aria-label={t.onPage} className="sticky top-40">
              <p className="text-xs tracking-wide text-muted-foreground">{t.onPage}</p>
              <ul className="mt-3 border-s border-navy/10 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={cn(
                        "-ms-px block border-s-2 py-1.5 ps-4 leading-snug transition-colors",
                        activeSection === s.id
                          ? "border-gold text-navy"
                          : "border-transparent text-muted-foreground hover:text-navy",
                        focusRing,
                      )}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        <article className="min-w-0">
          {/* Contents: collapsible on phones and tablets */}
          {sections.length > 1 && (
            <details className="group mb-8 border border-navy/10 bg-ivory lg:hidden">
              <summary
                className={cn(
                  "flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm text-navy [&::-webkit-details-marker]:hidden",
                  focusRing,
                )}
              >
                {t.onPage}
                <ChevronDown
                  className="h-4 w-4 text-gold transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <ul className="border-t border-navy/10 px-4 py-2 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex min-h-10 items-center text-muted-foreground hover:text-navy"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="policy-content max-w-[72ch]" dangerouslySetInnerHTML={{ __html: html }} />

          {/* Previous / next policy */}
          {(prev || next) && (
            <nav
              aria-label={t.tabs}
              className="mt-14 grid max-w-[72ch] gap-3 border-t border-navy/10 pt-8 sm:grid-cols-2"
            >
              {prev ? (
                <PolicyLink
                  slug={prev.slug}
                  language={language}
                  className={cn(
                    "group flex flex-col border border-navy/10 bg-ivory px-4 py-3 transition-colors hover:border-gold",
                    focusRing,
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Back className="h-3.5 w-3.5" aria-hidden /> {t.prev}
                  </span>
                  <span className="mt-1 text-navy">{policyTabLabel(prev, language)}</span>
                </PolicyLink>
              ) : (
                <span className="hidden sm:block" />
              )}
              {next && (
                <PolicyLink
                  slug={next.slug}
                  language={language}
                  className={cn(
                    "group flex flex-col items-end border border-navy/10 bg-ivory px-4 py-3 text-end transition-colors hover:border-gold",
                    focusRing,
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t.next} <Forward className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="mt-1 text-navy">{policyTabLabel(next, language)}</span>
                </PolicyLink>
              )}
            </nav>
          )}

          {/* Help */}
          <div className="mt-8 flex max-w-[72ch] flex-col gap-4 bg-silk px-5 py-5 text-cream sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg text-gold">{t.help}</p>
              <p className="mt-1 text-sm text-cream/70">{t.helpText}</p>
            </div>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-gold px-5 text-sm text-ink transition-colors hover:bg-cream",
                  focusRing,
                )}
              >
                <WhatsappIcon className="h-4 w-4" aria-hidden />
                {t.wa}
              </a>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

function NotFound({ others, language }: { others: PolicyPage[]; language: PolicyLanguage }) {
  const ar = language === "ar";
  return (
    <main dir={ar ? "rtl" : "ltr"} lang={language} className="min-h-[60vh] bg-cream pt-20">
      <section className="bg-silk text-cream">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:py-24">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 text-gold">
            <FileQuestion className="h-6 w-6" />
          </span>
          <h1 className="mt-6 font-display text-4xl leading-tight text-balance [overflow-wrap:anywhere] sm:text-5xl">
            {ar ? "الصفحة غير موجودة" : "Page not found"}
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-cream/75">
            {ar
              ? "هذه الصفحة غير متاحة أو لم تُنشر بعد. يمكنك العودة للرئيسية أو مراجعة السياسات المنشورة."
              : "This page is unavailable or has not been published yet. Return home or browse the published policies."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className={cn(
                "inline-flex h-11 items-center gap-2 bg-gold px-6 text-sm text-ink transition-colors hover:bg-cream",
                focusRing,
              )}
            >
              {ar ? "العودة للرئيسية" : "Back home"}
            </Link>
            <Link
              to="/shop"
              className={cn(
                "inline-flex h-11 items-center gap-2 border border-gold/50 px-6 text-sm text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink",
                focusRing,
              )}
            >
              {ar ? "تصفح المنتجات" : "Browse products"}
            </Link>
          </div>
        </div>
      </section>
      {others.length > 0 && (
        <div className="mx-auto max-w-3xl px-5 py-10">
          <h2 className="font-display text-xl text-navy">
            {ar ? "صفحات قانونية أخرى" : "Other legal pages"}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-6 text-sm">
            {others.map((p) => (
              <li key={p.id}>
                <PolicyLink
                  slug={p.slug}
                  language={language}
                  className={cn(
                    "inline-flex min-h-11 items-center text-navy underline decoration-gold/50 underline-offset-4",
                    focusRing,
                  )}
                >
                  {p.title}
                </PolicyLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
