import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Overview() {
  const { data } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const [{ data: products }, { data: cats }] = await Promise.all([
        supabase.from("products").select("id,name,slug,is_published,stock,availability,category_id,created_at").order("created_at", { ascending: false }),
        supabase.from("categories").select("id,name"),
      ]);
      return { products: products ?? [], cats: cats ?? [] };
    },
  });
  const p = data?.products ?? [];
  const stats = [
    { label: "منتجات منشورة", v: p.filter((x) => x.is_published).length },
    { label: "مسودات", v: p.filter((x) => !x.is_published).length },
    { label: "الفئات", v: data?.cats.length ?? 0 },
    { label: "مخزون منخفض (≤ 2)", v: p.filter((x) => x.availability === "in_stock" && x.stock <= 2).length },
  ];
  return (
    <div>
      <h1 className="font-display text-4xl text-navy">نظرة عامة</h1>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-t-2 border-gold bg-ivory p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-4xl text-navy">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="bg-ivory p-5">
          <h2 className="mb-4 text-lg text-navy">أحدث المنتجات</h2>
          <ul className="divide-y text-sm">
            {p.slice(0, 6).map((x) => (
              <li key={x.id} className="flex justify-between py-2">
                <span>{x.name}</span>
                <span className="text-muted-foreground">{x.is_published ? "منشور" : "مسودة"}</span>
              </li>
            ))}
          </ul>
          <Link to="/admin/products" className="mt-4 inline-block text-sm text-gold">إدارة المنتجات</Link>
        </section>
        <section className="bg-ivory p-5">
          <h2 className="mb-4 text-lg text-navy">المنتجات حسب الفئة</h2>
          <ul className="divide-y text-sm">
            {data?.cats.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>{c.name}</span>
                <span>{p.filter((x) => x.category_id === c.id).length}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
