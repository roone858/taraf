import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, settingsQuery } from "@/lib/data";
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

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "المتجر — TARAF FURNITURE" },
      {
        name: "description",
        content: "تصفح مجموعة طرف الكاملة من الأثاث الفاخر حسب الفئة والسعر.",
      },
      { property: "og:title", content: "متجر TARAF FURNITURE" },
      { property: "og:description", content: "كنب، سفرة، غرف نوم، طاولات وقطع ديكور فاخرة." },
    ],
  }),
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
    queryKey: ["shop", sp, cats?.length],
    placeholderData: keepPreviousData,
    enabled: !sp.cat || !!cats,
    queryFn: async () => {
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
  const extraFilters = [sp.min != null, sp.max != null, !!sp.avail].filter(Boolean).length;
  const clearAll = () => navigate({ search: {}, resetScroll: false });

  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="bg-silk px-5 py-16 text-center text-cream md:py-20">
        <nav aria-label="مسار التصفح" className="text-xs text-cream/60">
          <Link to="/" className="hover:text-gold">
            الرئيسية
          </Link>
          <span className="mx-2 text-gold/60">/</span>
          {activeCat ? (
            <>
              <Link to="/shop" className="hover:text-gold">
                المتجر
              </Link>
              <span className="mx-2 text-gold/60">/</span>
              <span className="text-cream/90">{activeCat.name}</span>
            </>
          ) : (
            <span className="text-cream/90">المتجر</span>
          )}
        </nav>
        <h1 className="mt-5 font-display text-4xl md:text-5xl">{activeCat?.name ?? "كل القطع"}</h1>
        {activeCat?.description && (
          <p className="mx-auto mt-4 max-w-xl text-cream/70">{activeCat.description}</p>
        )}
        <div className="mx-auto mt-6 h-px w-16 bg-gold/60" />
      </section>

      {/* Category chips — scroll horizontally on small screens */}
      <div className="border-b hairline bg-cream">
        <div className="mx-auto max-w-7xl px-5 lg:px-10">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
            <CatChip active={!sp.cat} onClick={() => set({ cat: undefined })}>
              الكل
            </CatChip>
            {cats?.map((c) => (
              <CatChip key={c.id} active={sp.cat === c.slug} onClick={() => set({ cat: c.slug })}>
                {c.name}
              </CatChip>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-20 z-20 border-b hairline bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 lg:px-10">
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن قطعة..."
              aria-label="بحث"
              className="h-10 w-full border bg-ivory ps-9 pe-9 text-sm focus:border-gold focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
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
            <select
              value={sp.avail ?? ""}
              onChange={(e) => set({ avail: (e.target.value || undefined) as ShopSearch["avail"] })}
              className="h-10 border bg-ivory px-3 text-sm focus:border-gold focus:outline-none"
              aria-label="الحالة"
            >
              {AVAIL.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile filters button */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex h-10 shrink-0 items-center gap-2 border bg-ivory px-3 text-sm text-navy lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            فلترة
            {extraFilters > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] text-ink">
                {extraFilters}
              </span>
            )}
          </button>

          <select
            value={sp.sort ?? "newest"}
            onChange={(e) => set({ sort: e.target.value as ShopSearch["sort"] })}
            className="ms-auto h-10 shrink-0 border bg-ivory px-3 text-sm focus:border-gold focus:outline-none"
            aria-label="ترتيب"
          >
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-8 pb-20 lg:px-10">
        {/* Results summary + active filters */}
        <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
          <p className="text-muted-foreground" aria-live="polite">
            {isLoading ? (
              "جارٍ التحميل..."
            ) : (
              <>
                <span className="text-navy">{n.format(total)}</span> {total === 1 ? "قطعة" : "قطع"}
              </>
            )}
            {isFetching && !isLoading && (
              <Loader2 className="ms-2 inline h-3.5 w-3.5 animate-spin text-gold" />
            )}
          </p>
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => set(c.clear)}
                  className="flex items-center gap-1.5 border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-navy transition-colors hover:border-gold"
                  aria-label={`إزالة فلتر ${c.label}`}
                >
                  {c.label} <X className="h-3 w-3" />
                </button>
              ))}
              {chips.length > 1 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-gold underline-offset-4 hover:underline"
                >
                  مسح الكل
                </button>
              )}
            </div>
          )}
        </div>

        {error ? (
          <div className="py-24 text-center">
            <p className="text-destructive">تعذر تحميل المنتجات.</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">
              إعادة المحاولة
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
            <PackageSearch className="mx-auto h-12 w-12 text-gold/70" />
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
                <p className="text-xs text-muted-foreground">
                  عرض {n.format(rows.length)} من {n.format(total)}
                </p>
                <div className="mt-3 h-0.5 bg-muted">
                  <div
                    className="h-full bg-gold transition-all"
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
                  className="mt-6 w-full gap-2"
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

      {/* Mobile filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" dir="rtl" className="bg-cream p-0 [&>button]:hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <SheetTitle className="font-display text-xl text-navy">فلترة النتائج</SheetTitle>
            <button
              onClick={() => setFiltersOpen(false)}
              aria-label="إغلاق"
              className="text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-6 px-5 py-6 text-sm">
            <div>
              <p className="mb-2 text-muted-foreground">السعر ({currencyShort})</p>
              <PriceRange sp={sp} currency={currencyShort} onApply={set} wide />
            </div>
            <div>
              <p className="mb-2 text-muted-foreground">الحالة</p>
              <div className="flex flex-wrap gap-2">
                {AVAIL.map(([v, l]) => (
                  <CatChip
                    key={v}
                    active={(sp.avail ?? "") === v}
                    onClick={() => set({ avail: (v || undefined) as ShopSearch["avail"] })}
                  >
                    {l}
                  </CatChip>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => set({ min: undefined, max: undefined, avail: undefined })}
            >
              إعادة ضبط
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              عرض {n.format(total)} {total === 1 ? "قطعة" : "قطع"}
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

function CatChip({
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
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 whitespace-nowrap border px-4 py-2 text-sm transition-colors",
        active
          ? "border-navy bg-navy text-cream"
          : "border-gold/30 bg-ivory text-navy hover:border-gold",
      )}
    >
      {children}
    </button>
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
    "h-10 border bg-ivory px-3 text-sm focus:border-gold focus:outline-none",
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
      <span className="text-muted-foreground">–</span>
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
