import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, settingsQuery } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

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

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "المتجر — TARAF FURNITURE" },
      { name: "description", content: "تصفح مجموعة طرف الكاملة من الأثاث الفاخر حسب الفئة والسعر." },
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
  const set = (patch: Partial<typeof sp>) => navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }) });

  const { data, isLoading, error } = useQuery({
    queryKey: ["shop", sp, cats?.length],
    placeholderData: keepPreviousData,
    enabled: !sp.cat || !!cats,
    queryFn: async () => {
      let q = supabase.from("products").select("*", { count: "exact" }).eq("is_published", true);
      if (sp.q) q = q.ilike("name", `%${sp.q}%`);
      if (sp.cat) {
        const c = cats?.find((x) => x.slug === sp.cat);
        if (c) q = q.eq("category_id", c.id);
      }
      if (sp.min != null) q = q.gte("price", sp.min);
      if (sp.max != null) q = q.lte("price", sp.max);
      if (sp.avail) q = q.eq("availability", sp.avail);
      if (sp.sort === "price_asc") q = q.order("price", { ascending: true });
      else if (sp.sort === "price_desc") q = q.order("price", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      const { data, count, error } = await q.range(0, page * PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const activeCat = cats?.find((c) => c.slug === sp.cat);
  const field = "h-10 border bg-ivory px-3 text-sm focus:outline-none focus:border-gold";

  return (
    <main className="pt-20">
      <section className="bg-silk py-20 text-center text-cream">
        <p className="eyebrow">المجموعة</p>
        <h1 className="mt-4 font-display text-5xl">{activeCat?.name ?? "كل القطع"}</h1>
        {activeCat?.description && <p className="mt-4 text-cream/70">{activeCat.description}</p>}
      </section>
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => set({ cat: undefined })} className={`border px-4 py-2 text-sm ${!sp.cat ? "bg-navy text-cream" : "hairline"}`}>الكل</button>
          {cats?.map((c) => (
            <button key={c.id} onClick={() => set({ cat: c.slug })} className={`border px-4 py-2 text-sm ${sp.cat === c.slug ? "bg-navy text-cream" : "hairline"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="mb-12 flex flex-wrap items-center gap-3 border-y py-4">
          <input defaultValue={sp.q} placeholder="بحث بالاسم" className={field} onKeyDown={(e) => e.key === "Enter" && set({ q: e.currentTarget.value || undefined })} />
          <input type="number" defaultValue={sp.min} placeholder="أقل سعر" className={`${field} w-28`} onBlur={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })} />
          <input type="number" defaultValue={sp.max} placeholder="أعلى سعر" className={`${field} w-28`} onBlur={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })} />
          <select value={sp.avail ?? ""} onChange={(e) => set({ avail: (e.target.value || undefined) as never })} className={field}>
            <option value="">كل الحالات</option>
            <option value="in_stock">متوفر</option>
            <option value="made_to_order">حسب الطلب</option>
          </select>
          <select value={sp.sort ?? "newest"} onChange={(e) => set({ sort: e.target.value as never })} className={`${field} ms-auto`}>
            <option value="newest">الأحدث</option>
            <option value="price_asc">السعر: من الأقل</option>
            <option value="price_desc">السعر: من الأعلى</option>
          </select>
        </div>

        {error ? (
          <p className="py-20 text-center text-destructive">تعذر تحميل المنتجات. حاول مرة أخرى.</p>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse bg-muted" />)}
          </div>
        ) : data?.rows.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-display text-3xl text-navy">لا توجد قطع مطابقة</p>
            <Link to="/shop" className="mt-4 inline-block text-sm text-gold">مسح الفلاتر</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
              {data?.rows.map((p) => <ProductCard key={p.id} p={p} currency={s?.currency} />)}
            </div>
            {data && data.rows.length < data.count && (
              <div className="mt-16 text-center">
                <Button variant="outline" onClick={() => navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}>
                  عرض المزيد
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
