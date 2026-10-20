import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ChevronDown,
  ChevronLeft,
  Loader2,
  PackageSearch,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, settingsQuery, type Category } from "@/lib/data";
import { breadcrumbJsonLd, pageHead } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { CURRENCIES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/ProductCard";
import { FaqSection } from "@/components/FaqSection";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const PAGE = 12;
const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  avail: z.enum(["in_stock", "made_to_order"]).optional(),
  page: z.coerce.number().optional(),
});
type ShopSearch = z.infer<typeof searchSchema>;

const SORTS = [
  ["newest", "الأحدث"],
  ["price_asc", "السعر: من الأقل"],
  ["price_desc", "السعر: من الأعلى"],
] as const;
const AVAIL = [
  ["", "كل الحالات"],
  ["in_stock", "متوفر"],
  ["made_to_order", "حسب الطلب"],
] as const;
const n = new Intl.NumberFormat("ar-EG");
const pieces = (count: number) => `${n.format(count)} ${count === 1 ? "قطعة" : "قطع"}`;

/** One page of results (pages are cumulative: page 2 returns the first 24). */
const shopQuery = (sp: ShopSearch, cats: Category[] | undefined) =>
  queryOptions({
    queryKey: ["shop", sp, cats?.length],
    queryFn: async () => {
      const page = sp.page ?? 1;
      let qb = supabase.from("products").select("*", { count: "exact" }).eq("is_published", true);
      if (sp.q) qb = qb.ilike("name", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
      if (sp.cat) {
        const c = cats?.find((x) => x.slug === sp.cat);
        if (c) qb = qb.eq("category_id", c.id);
      }
      if (sp.min != null) qb = qb.gte("price", sp.min);
      if (sp.max != null) qb = qb.lte("price", sp.max);
      if (sp.avail) qb = qb.eq("availability", sp.avail);
      if (sp.sort === "price_asc") qb = qb.order("price", { ascending: true });
      else if (sp.sort === "price_desc") qb = qb.order("price", { ascending: false });
      else qb = qb.order("created_at", { ascending: false });
      const { data, count, error } = await qb.order("id").range(0, page * PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  // Products are in the server HTML so search engines index the listing
  loader: async ({ context: { queryClient }, deps }) => {
    const [{ seo, store }, cats] = await Promise.all([
      loadSeo(queryClient),
      queryClient.ensureQueryData(categoriesQuery).catch(() => undefined),
    ]);
    await queryClient.ensureQueryData(shopQuery(deps, cats)).catch(() => null);
    const cat = cats?.find((c) => c.slug === deps.cat);
    return {
      seo,
      store,
      cat: cat
        ? {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            image_url: cat.image_url,
            seo_title: cat.seo_title,
            seo_description: cat.seo_description,
          }
        : null,
      isSearch: !!deps.q,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { seo, store, cat, isSearch } = loaderData;
    // Sorting, price/availability filters and paging all canonicalise to the plain listing or
    // category; on-site search results are kept out of the index entirely.
    const path = cat ? `/shop?cat=${encodeURIComponent(cat.slug)}` : "/shop";
    return pageHead({
      seo,
      store,
      title: cat ? cat.seo_title || cat.name : "المتجر — كل القطع",
      description: cat
        ? cat.seo_description ||
          cat.description ||
          `تسوّق ${cat.name} من ${store}: أثاث فاخر بتفاصيل حرفية.`
        : `تصفح مجموعة ${store} الكاملة من الأثاث الفاخر: كنب، سفرة، غرف نوم، طاولات وقطع ديكور.`,
      image: cat?.image_url,
      path,
      noindex: isSearch,
      jsonLd: [
        breadcrumbJsonLd(seo, [
          { name: "الرئيسية", path: "/" },
          { name: "المتجر", path: "/shop" },
          ...(cat ? [{ name: cat.name, path }] : []),
        ]),
      ],
    });
  },
  component: Shop,
});

function Shop() {
  const sp = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const { data: cats } = useQuery(categoriesQuery);
  const { data: s } = useQuery(settingsQuery);
  const page = sp.page ?? 1;
  const currencyShort = CURRENCIES[s?.currency ?? "EGP"]?.[0] ?? s?.currency ?? "";
  const [filtersOpen, setFiltersOpen] = useState(false);

  /** Filter changes reset paging and keep the scroll position. */
  const set = (patch: Partial<ShopSearch>, replace = false) =>
    navigate({
      search: (prev) => ({ ...prev, page: undefined, ...patch }),
      resetScroll: false,
      replace,
    });

  // Search box: local text, debounced into the URL; also follows URL changes (e.g. header search)
  const [q, setQ] = useState(sp.q ?? "");
  useEffect(() => setQ(sp.q ?? ""), [sp.q]);
  useEffect(() => {
    const next = q.trim() || undefined;
    if (next === sp.q) return;
    const t = window.setTimeout(() => set({ q: next }, true), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    ...shopQuery(sp, cats),
    placeholderData: keepPreviousData,
    enabled: !sp.cat || !!cats,
  });

  const activeCat = cats?.find((c) => c.slug === sp.cat);
  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const loadingMore = isFetching && isPlaceholderData && page > 1 && rows.length < page * PAGE;

  const chips = [
    activeCat && { key: "cat", label: activeCat.name, clear: { cat: undefined } },
    sp.q && { key: "q", label: `«${sp.q}»`, clear: { q: undefined } },
    sp.min != null && {
      key: "min",
      label: `من ${n.format(sp.min)} ${currencyShort}`,
      clear: { min: undefined },
    },
    sp.max != null && {
      key: "max",
      label: `حتى ${n.format(sp.max)} ${currencyShort}`,
      clear: { max: undefined },
    },
    sp.avail && {
      key: "avail",
      label: sp.avail === "in_stock" ? "متوفر" : "حسب الطلب",
      clear: { avail: undefined },
    },
  ].filter(Boolean) as { key: string; label: string; clear: Partial<ShopSearch> }[];
  // Filters that live behind the mobile sheet (sort included, since it moves there on mobile)
  const sheetFilters = [
    sp.min != null,
    sp.max != null,
    !!sp.avail,
    !!sp.sort && sp.sort !== "newest",
  ].filter(Boolean).length;
  const clearAll = () => navigate({ search: {}, resetScroll: false });

  return (
    <main className="pt-20">
      {/* Compact header: title first, so products start near the fold */}
      <section className="bg-silk text-cream">
        <div className="mx-auto max-w-7xl px-5 py-10 md:py-14 lg:px-10">
          <nav aria-label="مسار التصفح" className="text-sm text-cream/65">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link to="/" className="transition-colors hover:text-gold">
                  الرئيسية
                </Link>
              </li>
              <ChevronLeft aria-hidden className="h-3.5 w-3.5 text-gold/70" />
              {activeCat ? (
                <>
                  <li>
                    <Link to="/shop" className="transition-colors hover:text-gold">
                      المتجر
                    </Link>
                  </li>
                  <ChevronLeft aria-hidden className="h-3.5 w-3.5 text-gold/70" />
                  <li aria-current="page" className="text-cream">
                    {activeCat.name}
                  </li>
                </>
              ) : (
                <li aria-current="page" className="text-cream">
                  المتجر
                </li>
              )}
            </ol>
          </nav>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h1 className="font-display text-4xl text-balance md:text-5xl">
              {activeCat?.name ?? "كل القطع"}
            </h1>
            {!isLoading && !error && (
              <p className="pb-1.5 text-sm text-cream/70">{pieces(total)}</p>
            )}
          </div>
          {activeCat?.description && (
            <p className="mt-3 max-w-2xl leading-relaxed text-cream/75">{activeCat.description}</p>
          )}
        </div>
      </section>

      {/* Sticky toolbar: categories, then search / filters / sort */}
      <div className="sticky top-20 z-20 border-b hairline bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
        <div className="mx-auto max-w-7xl px-5 lg:px-10">
          <div
            role="group"
            aria-label="الفئات"
            className="-mx-5 flex gap-2 overflow-x-auto border-b border-border/70 px-5 py-3 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <Pill active={!sp.cat} onClick={() => set({ cat: undefined })}>
              الكل
            </Pill>
            {cats?.map((c) => (
              <Pill key={c.id} active={sp.cat === c.slug} onClick={() => set({ cat: c.slug })}>
                {c.name}
              </Pill>
            ))}
          </div>

          <div className="flex items-center gap-2 py-3 sm:gap-3">
            <div className="relative min-w-0 flex-1 md:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن قطعة..."
                aria-label="بحث"
                className="h-10 w-full border border-navy/15 bg-ivory ps-9 pe-9 text-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 [&::-webkit-search-cancel-button]:hidden"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="مسح البحث"
                  className="absolute top-1/2 end-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-navy"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Desktop filters */}
            <div className="hidden items-center gap-3 lg:flex">
              <PriceRange sp={sp} currency={currencyShort} onApply={set} />
              <SelectBox
                label="الحالة"
                value={sp.avail ?? ""}
                onChange={(v) => set({ avail: (v || undefined) as ShopSearch["avail"] })}
                options={AVAIL}
              />
            </div>

            <div className="ms-auto hidden md:block">
              <SelectBox
                label="ترتيب"
                value={sp.sort ?? "newest"}
                onChange={(v) => set({ sort: v as ShopSearch["sort"] })}
                options={SORTS}
              />
            </div>

            {/* Below lg, everything except search lives in the sheet */}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex h-10 shrink-0 items-center gap-2 border border-navy/15 bg-ivory px-3 text-sm text-navy transition-colors hover:border-gold lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              فلترة
              {sheetFilters > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-[0.65rem] text-cream tabular-nums">
                  {n.format(sheetFilters)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-6 pb-20 lg:px-10 lg:pt-8">
        {/* Results summary + active filters */}
        <div className="mb-8 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-3 text-sm lg:mb-10">
          <p className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
            {isLoading ? "جارٍ التحميل..." : <span className="text-navy">{pieces(total)}</span>}
            {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
          </p>
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => set(c.clear)}
                  className="flex h-8 items-center gap-1.5 border border-navy/15 bg-ivory px-3 text-xs text-navy transition-colors hover:border-gold"
                  aria-label={`إزالة فلتر ${c.label}`}
                >
                  {c.label} <X className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
              {chips.length > 1 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-1 text-xs text-navy underline underline-offset-4 decoration-gold hover:decoration-navy"
                >
                  مسح الكل
                </button>
              )}
            </div>
          )}
        </div>

        {error ? (
          <div className="mx-auto max-w-md py-24 text-center">
            <p className="font-display text-2xl text-navy">تعذر تحميل المنتجات</p>
            <p className="mt-2 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-6 gap-2">
              <RotateCw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          </div>
        ) : isLoading ? (
          <Grid>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[4/5] animate-pulse bg-muted" />
                <div className="mt-5 h-4 w-3/4 animate-pulse bg-muted" />
                <div className="mt-2 h-3 w-1/3 animate-pulse bg-muted" />
              </div>
            ))}
          </Grid>
        ) : rows.length === 0 ? (
          <div className="mx-auto max-w-md py-24 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-gold" />
            <p className="mt-5 font-display text-3xl text-navy">لا توجد قطع مطابقة</p>
            <p className="mt-3 text-sm text-muted-foreground">
              جرّب كلمة بحث أخرى أو وسّع نطاق السعر.
            </p>
            {chips.length > 0 && (
              <Button variant="outline" onClick={clearAll} className="mt-6">
                مسح كل الفلاتر
              </Button>
            )}
          </div>
        ) : (
          <>
            <Grid
              className={cn(
                "transition-opacity",
                isPlaceholderData && !loadingMore && "opacity-50",
              )}
            >
              {rows.map((p) => (
                <ProductCard key={p.id} p={p} currency={s?.currency} />
              ))}
            </Grid>
            {rows.length < total && (
              <div className="mx-auto mt-16 max-w-xs text-center">
                <p className="text-xs text-muted-foreground tabular-nums">
                  عرض {n.format(rows.length)} من {n.format(total)}
                </p>
                <div className="mt-3 h-0.5 bg-muted">
                  <div
                    className="h-full bg-gold transition-[width] duration-500"
                    style={{ width: `${(rows.length / total) * 100}%` }}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() =>
                    navigate({
                      search: (prev) => ({ ...prev, page: page + 1 }),
                      resetScroll: false,
                      replace: true,
                    })
                  }
                  className="mt-6 h-11 w-full gap-2"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  عرض المزيد
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <FaqSection />

      {/* Mobile/tablet filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          dir="rtl"
          className="max-h-[85dvh] overflow-y-auto bg-cream p-0 [&>button]:hidden"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-navy/15" aria-hidden />
          <div className="flex items-center justify-between px-5 pt-3 pb-4">
            <SheetTitle className="font-display text-xl text-navy">فلترة وترتيب</SheetTitle>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="إغلاق"
              className="-me-2 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-navy"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-7 border-t hairline px-5 py-6 text-sm">
            <SheetGroup title="الترتيب">
              {SORTS.map(([v, l]) => (
                <Pill key={v} active={(sp.sort ?? "newest") === v} onClick={() => set({ sort: v })}>
                  {l}
                </Pill>
              ))}
            </SheetGroup>
            <SheetGroup title={`السعر (${currencyShort})`}>
              <PriceRange sp={sp} currency={currencyShort} onApply={set} wide />
            </SheetGroup>
            <SheetGroup title="الحالة">
              {AVAIL.map(([v, l]) => (
                <Pill
                  key={v}
                  active={(sp.avail ?? "") === v}
                  onClick={() => set({ avail: (v || undefined) as ShopSearch["avail"] })}
                >
                  {l}
                </Pill>
              ))}
            </SheetGroup>
          </div>
          <div className="sticky bottom-0 flex gap-3 border-t hairline bg-cream px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={() =>
                set({ min: undefined, max: undefined, avail: undefined, sort: undefined })
              }
            >
              إعادة ضبط
            </Button>
            <Button className="h-11 flex-[2]" onClick={() => setFiltersOpen(false)}>
              عرض {pieces(total)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Grid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-y-14",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 whitespace-nowrap border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        active
          ? "border-navy bg-navy text-cream"
          : "border-navy/15 bg-ivory text-navy hover:border-gold",
      )}
    >
      {children}
    </button>
  );
}

function SheetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-navy">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** Native select with the brand's field styling and a drawn chevron. */
function SelectBox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="relative flex h-10 items-center border border-navy/15 bg-ivory text-sm transition-[border-color,box-shadow] focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25 hover:border-gold/70">
      <span className="ps-3 text-muted-foreground">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer appearance-none bg-transparent ps-1.5 pe-8 text-navy focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 end-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </label>
  );
}

/** Min/max price inputs; applied on Enter or blur. Follows URL changes. */
function PriceRange({
  sp,
  currency,
  onApply,
  wide,
}: {
  sp: ShopSearch;
  currency: string;
  onApply: (patch: Partial<ShopSearch>) => void;
  wide?: boolean;
}) {
  const [min, setMin] = useState(sp.min?.toString() ?? "");
  const [max, setMax] = useState(sp.max?.toString() ?? "");
  useEffect(() => setMin(sp.min?.toString() ?? ""), [sp.min]);
  useEffect(() => setMax(sp.max?.toString() ?? ""), [sp.max]);

  const apply = () => {
    const lo = min === "" ? undefined : Math.max(0, Number(min));
    const hi = max === "" ? undefined : Math.max(0, Number(max));
    // Swap if entered the wrong way round
    const [a, b] = lo != null && hi != null && lo > hi ? [hi, lo] : [lo, hi];
    if (a !== sp.min || b !== sp.max) onApply({ min: a, max: b });
  };
  const field = cn(
    "h-10 border border-navy/15 bg-ivory px-3 text-sm tabular-nums transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25",
    wide ? "min-w-0 flex-1" : "w-28",
  );
  const props = {
    type: "number",
    inputMode: "numeric" as const,
    min: 0,
    dir: "ltr" as const,
    onBlur: apply,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && apply(),
  };

  return (
    <div className={cn("flex items-center gap-2", wide && "w-full")}>
      <input
        {...props}
        value={min}
        onChange={(e) => setMin(e.target.value)}
        placeholder={`من (${currency})`}
        aria-label="أقل سعر"
        className={field}
      />
      <span className="text-muted-foreground" aria-hidden>
        –
      </span>
      <input
        {...props}
        value={max}
        onChange={(e) => setMax(e.target.value)}
        placeholder={`إلى (${currency})`}
        aria-label="أعلى سعر"
        className={field}
      />
    </div>
  );
}
