import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, settingsQuery } from "@/lib/data";
import { parseHomeConfig } from "@/lib/home-config";
import { parseProjects } from "@/lib/custom-requests";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { breadcrumbJsonLd, pageHead } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Emblem } from "@/components/Logo";
import { WhatsappIcon } from "@/components/BrandIcons";
import { FaqSection, type FaqItem } from "@/components/FaqSection";
import { CustomRequestForm } from "@/components/CustomRequestForm";

/** What the custom-order service focuses on (category slugs, in display order). */
const FOCUS_SLUGS = ["beds", "dressing-rooms", "mattresses"];

const TITLE = "أنت تختار الفكرة، ونحن نهتم بالتفاصيل.";

/**
 * What the catalogue already makes to order: how many made-to-order pieces there are, and the
 * fabrics those pieces are offered in. Shown as evidence, never as a full list of capabilities.
 */
const madeToOrderQuery = queryOptions({
  queryKey: ["products", "made-to-order-summary"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("colors")
      .eq("is_published", true)
      .eq("availability", "made_to_order")
      .limit(1000);
    if (error) throw error;
    // «قماش مخمل» and «مخمل» are the same fabric; colour codes (pc-656) are left out
    const fabrics = new Set<string>();
    for (const p of data)
      for (const c of p.colors) {
        const v = c.replace(/^قماش\s+/, "").trim();
        if (/قماش/.test(c) || /^(شانيل|مخمل|خيش|كتان|جلد)/.test(v)) fabrics.add(v);
      }
    return { count: data.length, fabrics: [...fabrics].slice(0, 8) };
  },
});

export const Route = createFileRoute("/custom")({
  validateSearch: z.object({ type: z.string().optional() }),
  loader: async ({ context: { queryClient } }) => {
    const warm = (p: Promise<unknown>) => p.catch(() => null);
    const [{ s, seo, store }] = await Promise.all([
      loadSeo(queryClient),
      warm(queryClient.ensureQueryData(categoriesQuery)),
      warm(queryClient.ensureQueryData(madeToOrderQuery)),
    ]);
    return { s, seo, store };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { seo, store } = loaderData;
    return pageHead({
      seo,
      store,
      title: "التفصيل حسب الطلب",
      description: `فصّل سريرك ودولاب ملابسك ومرتبتك بمقاسات مساحتك مع ${store}: اختر المقاسات والخامات والأقمشة والتشطيب، وأرسل فكرتك ليراجعها فريقنا ويتواصل معك.`,
      path: "/custom",
      jsonLd: [
        breadcrumbJsonLd(seo, [
          { name: "الرئيسية", path: "/" },
          { name: "التفصيل حسب الطلب", path: "/custom" },
        ]),
      ],
    });
  },
  component: CustomPage,
});

/** Non-committal by design: no figure here is a published TARAF policy. */
const FAQ: FaqItem[] = [
  {
    id: "price",
    question: "كم تكلفة القطعة المفصّلة؟",
    answer:
      "يعتمد السعر على المقاسات والخامات والقماش والتشطيب. بعد مراجعة طلبك يتواصل معك فريقنا ويرسل لك عرض السعر، ولا يبدأ التصنيع إلا بعد موافقتك عليه.",
  },
  {
    id: "time",
    question: "كم تستغرق مدة التصنيع؟",
    answer:
      "تختلف المدة حسب القطعة ودرجة التخصيص. يخبرك فريقنا بالمدة المتوقعة مع عرض السعر، قبل أن تؤكد الطلب.",
  },
  {
    id: "what",
    question: "ما الذي يمكنني تخصيصه؟",
    answer:
      "اكتب لنا المقاسات والخامات والقماش واللون والتشطيب الذي تفضله، أو أرفق صوراً مرجعية. يراجع فريقنا فكرتك ويوضح لك ما يمكن تنفيذه والبدائل المناسبة.",
  },
  {
    id: "delivery",
    question: "كيف يتم التوصيل؟",
    answer:
      "اكتب مدينة أو حي التوصيل في الطلب، ويتفق معك فريقنا على تفاصيل التوصيل وموعده عند تأكيد الطلب.",
  },
  {
    id: "track",
    question: "كيف أتابع طلبي؟",
    answer:
      "بعد الإرسال يظهر لك رقم طلب التفصيل (يبدأ بـ TFS). أرسله لنا عبر واتساب أو اذكره عند الاتصال، وسيطلعك فريقنا على مرحلة طلبك.",
  },
];

const STEPS = [
  ["أرسل فكرتك", "املأ طلب التفصيل بالمقاسات والخامات، وأرفق صوراً إن وُجدت."],
  ["نراجعها معك", "يتواصل معك فريقنا لمناقشة التفاصيل واقتراح الخامات المناسبة."],
  ["عرض السعر والمدة", "نرسل لك السعر ومدة التصنيع المتوقعة، والقرار لك."],
  ["التصنيع", "نبدأ تنفيذ قطعتك بعد موافقتك وتأكيد الطلب."],
  ["التسليم", "نتفق معك على موعد التوصيل وتصل قطعتك إلى مساحتك."],
] as const;

const SPECS = [
  ["الأبعاد", "العرض والعمق والارتفاع بالسنتيمتر، لتناسب القطعة مساحتك تماماً."],
  ["الخامات", "نوع الخشب أو الهيكل الذي تفضله، أو اترك الاختيار لاقتراحات فريقنا."],
  ["الأقمشة", "ملمس القماش ونوعه لظهر السرير وإطاره، ولكسوة المرتبة."],
  ["الألوان", "درجة اللون التي تنسجم مع مساحتك، للقماش أو الخشب."],
  ["التشطيبات", "لمسة السطح النهائية: مطفي أو لامع، ودرجة الصباغة والتفاصيل."],
] as const;

function CustomPage() {
  const { type } = Route.useSearch();
  const { data: s } = useQuery(settingsQuery);
  const { data: cats } = useQuery(categoriesQuery);
  const { data: mto } = useQuery(madeToOrderQuery);
  const cfg = parseHomeConfig(s?.home_config);
  const projects = parseProjects(s?.custom_projects);
  const wa = normalizeWhatsappNumber(s?.whatsapp_number);
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent("مرحباً، أرغب في تفصيل قطعة أثاث")}`
    : null;

  // Only the focus categories that are active in the store, in FOCUS_SLUGS order
  const customCats = FOCUS_SLUGS.flatMap((slug) => cats?.find((c) => c.slug === slug) ?? []);
  const types = customCats.map((c) => c.name);
  const initialType = cats?.find((c) => c.slug === type)?.name;
  const [craftMain, craftInset] = cfg.storyImages;
  const heroImage = craftMain || s?.hero_image_url || "/images/hero.jpg";

  return (
    <main>
      {/* 1 · Hero */}
      <section className="relative overflow-hidden bg-silk text-cream">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-24 pb-16 md:pt-32 md:pb-24 lg:min-h-[min(100svh,58rem)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16 lg:px-10 lg:pt-28">
          <div className="order-2 lg:order-1">
            <h1 className="fade-up font-display text-[2.6rem] leading-[1.15] text-balance sm:text-6xl lg:text-7xl">
              {TITLE}
            </h1>
            <p
              className="fade-up mt-4 flex items-center gap-3 text-gold"
              style={{ animationDelay: ".1s" }}
            >
              <span aria-hidden className="h-px w-8 bg-gold/70" />
              التفصيل حسب الطلب
            </p>
            <p
              className="fade-up mt-6 max-w-xl text-base leading-loose text-cream/80 md:text-lg"
              style={{ animationDelay: ".2s" }}
            >
              سرير أو دولاب ملابس أو مرتبة بمقاسات مساحتك، بالخامة والقماش واللون الذي تختاره. أرسل
              فكرتك، ويتولى فريق ترف التفاصيل من المراجعة إلى التصنيع.
            </p>
            <div
              className="fade-up mt-9 flex flex-wrap gap-3 md:gap-4"
              style={{ animationDelay: ".3s" }}
            >
              <Button asChild variant="gold" className="h-13 flex-1 px-9 text-base sm:flex-none">
                <a href="#request">ابدأ طلب التفصيل</a>
              </Button>
              {waHref && (
                <Button asChild variant="ghostGold" className="h-13 flex-1 gap-2 px-7 sm:flex-none">
                  <a href={waHref} target="_blank" rel="noopener noreferrer">
                    <WhatsappIcon className="h-4 w-4" /> اسألنا عبر واتساب
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* A framed photograph crossed by a measuring line */}
          <figure className="relative order-1 lg:order-2">
            <div className="relative border hairline p-2 md:p-3">
              <img
                src={heroImage}
                alt="قطعة أثاث من ترف بتفاصيل منحوتة وتشطيب يدوي"
                className="aspect-[4/3] w-full object-cover lg:aspect-[4/5]"
                width={960}
                height={1200}
                fetchPriority="high"
              />
            </div>
            <div
              aria-hidden
              className="absolute inset-x-6 -bottom-5 flex items-center gap-2 md:inset-x-10"
            >
              <span className="h-3 w-px bg-gold" />
              <span className="h-px flex-1 bg-gold/70" />
              <span className="bg-ink px-2 text-xs tracking-widest text-gold">بمقاسك</span>
              <span className="h-px flex-1 bg-gold/70" />
              <span className="h-3 w-px bg-gold" />
            </div>
          </figure>
        </div>
      </section>

      {/* 2 · Categories */}
      {customCats.length > 0 && (
        <section
          className="mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-10"
          aria-labelledby="custom-cats"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-12">
            <div>
              <h2
                id="custom-cats"
                className="font-display text-3xl text-navy text-balance md:text-5xl"
              >
                ماذا نفصّل لك؟
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                نفصّل غرف النوم ودواليب الملابس والمراتب. اختر ما تريد لنبدأ به طلبك.
              </p>
            </div>
            {mto && mto.count > 0 && (
              <Link
                to="/shop"
                search={{ avail: "made_to_order" }}
                className="group inline-flex shrink-0 items-center gap-1.5 text-sm text-navy underline decoration-gold underline-offset-[6px] transition-colors hover:decoration-navy"
              >
                قطع المتجر المصنوعة حسب الطلب
                <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
              </Link>
            )}
          </div>
          <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            {customCats.map((c) => (
              <li key={c.id} className="w-[68%] shrink-0 snap-start sm:w-auto">
                <Link
                  to="/custom"
                  search={{ type: c.slug }}
                  hash="request"
                  resetScroll={false}
                  className="group relative block aspect-[4/5] overflow-hidden bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                >
                  {c.image_url && (
                    <img
                      src={c.image_url}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-[1.6s] ease-out group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-veil" />
                  <div className="absolute inset-x-4 bottom-4">
                    <h3 className="font-sans text-lg text-cream text-balance md:text-xl">
                      {c.name}
                    </h3>
                    <span className="mt-1 flex items-center gap-2 text-sm text-gold">
                      اطلبها بمقاسك
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3 · Process */}
      <section className="border-y hairline bg-ivory py-16 md:py-24" aria-labelledby="custom-steps">
        <div className="mx-auto max-w-7xl px-5 lg:px-10">
          <h2
            id="custom-steps"
            className="font-display text-3xl text-navy text-balance md:text-5xl"
          >
            من الفكرة إلى مساحتك
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            خمس خطوات واضحة، ولا يبدأ التصنيع إلا بعد موافقتك.
          </p>
          <ol className="mt-12 grid gap-y-10 md:grid-cols-5 md:gap-x-6">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="relative grid grid-cols-[3rem_1fr] gap-x-4 md:block">
                {/* Connecting rule between the numerals */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-12 bottom-[-2.5rem] start-6 w-px bg-gold/40 md:top-6 md:start-14 md:-end-6 md:bottom-auto md:h-px md:w-auto",
                    i === STEPS.length - 1 && "hidden",
                  )}
                />
                <span className="relative flex h-12 w-12 items-center justify-center border border-gold/60 bg-ivory font-display text-2xl text-navy">
                  {(i + 1).toLocaleString("ar-EG")}
                </span>
                <div className="md:mt-6">
                  <h3 className="font-sans text-lg text-navy">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 · Customization options, as a specification sheet */}
      <section
        className="mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-10"
        aria-labelledby="custom-specs"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2
              id="custom-specs"
              className="font-display text-3xl text-navy text-balance md:text-5xl"
            >
              كل تفصيلة باختيارك
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
              هذه هي التفاصيل التي تحددها في طلبك. لا تحتاج إلى معرفة المصطلحات؛ اكتب ما تتخيله
              وسيكمل فريقنا الباقي معك.
            </p>
          </div>
          <dl className="border-t border-navy/15">
            {SPECS.map(([term, text]) => (
              <div
                key={term}
                className="grid gap-2 border-b border-navy/15 py-6 sm:grid-cols-[9rem_1fr] sm:gap-8"
              >
                <dt className="font-display text-2xl text-navy">{term}</dt>
                <dd>
                  <p className="leading-relaxed text-navy/80">{text}</p>
                  {term === "الأقمشة" && mto && mto.fabrics.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">من أقمشة قطعنا الحالية:</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {mto.fabrics.map((f) => (
                          <li key={f} className="border border-gold/50 px-3 py-1 text-sm text-navy">
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 5 · Craftsmanship */}
      <section
        className="overflow-hidden bg-silk py-20 text-cream md:py-28"
        aria-labelledby="custom-craft"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:grid-cols-2 md:gap-16 lg:px-10">
          {craftInset && (
            <img
              src={craftInset}
              alt="تفاصيل الحرفة والتشطيب في قطعة من ترف"
              loading="lazy"
              className="aspect-[4/5] w-full object-cover md:w-4/5"
            />
          )}
          <div className={craftInset ? "" : "md:col-span-2 md:mx-auto md:max-w-2xl md:text-center"}>
            <Emblem className={cn("h-12 w-12", !craftInset && "md:mx-auto")} />
            <h2 id="custom-craft" className="mt-6 font-display text-3xl text-balance md:text-5xl">
              {s?.story_title || "حرفة تتجاوز الزمن"}
            </h2>
            <div className={cn("my-7 h-px w-20 bg-gold/60", !craftInset && "md:mx-auto")} />
            {s?.story_body && (
              <p className="max-w-[60ch] text-base leading-loose whitespace-pre-line text-cream/80 md:text-lg">
                {s.story_body}
              </p>
            )}
            {mto && mto.count > 0 && (
              <p className="mt-6 text-cream/70">
                <span className="font-display text-3xl text-gold">
                  {mto.count.toLocaleString("ar-EG")}
                </span>{" "}
                من قطع{" "}
                <Link
                  to="/shop"
                  search={{ avail: "made_to_order" }}
                  className="text-cream underline decoration-gold underline-offset-[6px] hover:text-gold"
                >
                  متجرنا
                </Link>{" "}
                تُصنع بالفعل حسب الطلب.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 6 · Completed projects (admin-managed; hidden until there are real ones) */}
      {projects.length > 0 && (
        <section
          className="mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-10"
          aria-labelledby="custom-work"
        >
          <h2 id="custom-work" className="font-display text-3xl text-navy text-balance md:text-5xl">
            قطع فصّلناها لعملائنا
          </h2>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
            {projects.map((p, i) => (
              <li
                key={`${p.image}-${i}`}
                className={cn(i === 0 && projects.length > 2 && "col-span-2 md:row-span-2")}
              >
                <figure className="group h-full">
                  <div className="overflow-hidden bg-muted">
                    <img
                      src={p.image}
                      alt={p.title ? `${p.title}، قطعة مفصّلة من ترف` : "قطعة مفصّلة من ترف"}
                      loading="lazy"
                      className={cn(
                        "w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105",
                        i === 0 && projects.length > 2
                          ? "aspect-square md:aspect-[4/5]"
                          : "aspect-square",
                      )}
                    />
                  </div>
                  {(p.title || p.note) && (
                    <figcaption className="mt-3">
                      {p.title && <p className="text-navy">{p.title}</p>}
                      {p.note && <p className="mt-0.5 text-sm text-muted-foreground">{p.note}</p>}
                    </figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7 · The request sheet */}
      <section
        id="request"
        className="scroll-mt-20 border-t hairline bg-cream py-16 md:py-24"
        aria-labelledby="custom-request"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:gap-20 lg:px-10">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2
              id="custom-request"
              className="font-display text-3xl text-navy text-balance md:text-5xl"
            >
              طلب التفصيل
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
              كلما زادت التفاصيل كانت مراجعتنا أدق. بعد الإرسال يصلك رقم الطلب، ويتواصل معك فريقنا
              لمناقشة التفاصيل وعرض السعر.
            </p>
            {(waHref || s?.contact_phone) && (
              <div className="mt-8 border-t border-navy/15 pt-6 text-sm">
                <p className="text-navy">تفضّل الحديث مباشرة؟</p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-navy underline decoration-gold underline-offset-[6px] hover:decoration-navy"
                    >
                      <WhatsappIcon className="h-4 w-4 text-gold" /> واتساب
                    </a>
                  )}
                  {s?.contact_phone && (
                    <a
                      href={`tel:${s.contact_phone.replace(/\s/g, "")}`}
                      className="text-navy underline decoration-gold underline-offset-[6px] hover:decoration-navy"
                    >
                      اتصل: <bdi dir="ltr">{s.contact_phone}</bdi>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          <CustomRequestForm
            types={types}
            initialType={initialType}
            whatsapp={wa}
            // Fallback only: offer a free choice if the focus categories are missing
            allowOther={types.length === 0}
          />
        </div>
      </section>

      {/* 8 · FAQ */}
      <FaqSection
        title="أسئلة عن التفصيل"
        eyebrow="قبل أن تبدأ"
        intro="السعر والمدة يحددهما فريقنا لكل طلب بعد المراجعة، وهذه أكثر الأسئلة تكراراً."
        askMessage="مرحباً، لدي سؤال عن التفصيل حسب الطلب"
        items={FAQ}
      />

      {/* 9 · Closing call */}
      <section className="bg-cream py-20 text-center md:py-28" aria-labelledby="custom-close">
        <div className="mx-auto max-w-3xl px-5">
          <Emblem className="mx-auto h-14 w-14" />
          <h2
            id="custom-close"
            className="mt-6 font-display text-3xl text-navy text-balance md:text-5xl"
          >
            قطعتك القادمة تبدأ بفكرة
          </h2>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
            شاركنا ما تتخيله، ولو كان صورة واحدة أو مقاساً تقريبياً.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild className="h-13 flex-1 px-9 text-base sm:flex-none">
              <a href="#request">ابدأ طلب التفصيل</a>
            </Button>
            {waHref && (
              <Button
                asChild
                variant="outline"
                className="h-13 flex-1 gap-2 border-navy/25 bg-transparent px-7 text-navy hover:border-gold hover:bg-gold sm:flex-none"
              >
                <a href={waHref} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon className="h-4 w-4" /> تواصل عبر واتساب
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
