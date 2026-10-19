import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productQuery, settingsQuery } from "@/lib/data";
import { availabilityLabel, effectivePrice, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({
    meta: [
      { title: "تفاصيل القطعة — TARAF FURNITURE" },
      { name: "description", content: "تفاصيل قطعة أثاث فاخرة من طرف: المقاسات، الخامات والتشطيبات." },
      { property: "og:title", content: "قطعة من TARAF FURNITURE" },
      { property: "og:description", content: "أثاث فاخر بتفاصيل منحوتة." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p, isLoading } = useQuery(productQuery(slug));
  const { data: s } = useQuery(settingsQuery);
  const cart = useCart();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [finish, setFinish] = useState<string>();
  const [color, setColor] = useState<string>();

  const { data: related } = useQuery({
    queryKey: ["related", p?.id],
    enabled: !!p?.category_id,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("is_published", true).eq("category_id", p!.category_id!).neq("id", p!.id).limit(4);
      return data ?? [];
    },
  });

  if (isLoading) return <main className="min-h-screen pt-20" />;
  if (!p)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 pt-20">
        <p className="font-display text-3xl text-navy">هذه القطعة غير متاحة</p>
        <Link to="/shop" className="text-gold">العودة للمتجر</Link>
      </main>
    );

  const price = effectivePrice(p);
  const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price);
  const unavailable = p.availability === "unavailable" || (p.availability === "in_stock" && p.stock <= 0);
  const max = p.availability === "in_stock" ? p.stock : 99;
  const dims = [
    p.width_cm && `العرض ${p.width_cm} سم`,
    p.height_cm && `الارتفاع ${p.height_cm} سم`,
    p.depth_cm && `العمق ${p.depth_cm} سم`,
  ].filter(Boolean);
  const needFinish = p.finishes.length > 0;
  const needColor = p.colors.length > 0;

  const add = () => {
    if ((needFinish && !finish) || (needColor && !color)) {
      toast.error("يرجى اختيار التشطيب واللون أولاً");
      return;
    }
    const variant = [finish, color].filter(Boolean).join(" / ") || undefined;
    cart.add({ productId: p.id, slug: p.slug, name: p.name, image: p.images[0], variant, unitPrice: price, quantity: qty, maxQty: p.availability === "in_stock" ? p.stock : undefined });
    cart.setOpen(true);
  };

  const Chips = ({ items, value, onChange }: { items: string[]; value?: string; onChange: (v: string) => void }) => (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <button key={x} onClick={() => onChange(x)} className={`border px-4 py-2 text-sm ${value === x ? "border-navy bg-navy text-cream" : "hairline"}`}>
          {x}
        </button>
      ))}
    </div>
  );

  return (
    <main className="pt-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 lg:grid-cols-2 lg:px-10">
        <div>
          <div className="aspect-[4/5] overflow-hidden bg-muted">
            {p.images[img] && <img src={p.images[img]} alt={p.name} className="h-full w-full object-cover" />}
          </div>
          {p.images.length > 1 && (
            <div className="mt-4 grid grid-cols-5 gap-3">
              {p.images.map((src, i) => (
                <button key={src} onClick={() => setImg(i)} className={`aspect-square overflow-hidden border-2 ${i === img ? "border-gold" : "border-transparent"}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:pt-8">
          {p.categories && (
            <Link to="/shop" search={{ cat: p.categories.slug }} className="eyebrow">{p.categories.name}</Link>
          )}
          <h1 className="mt-4 font-display text-4xl text-navy md:text-5xl">{p.name}</h1>
          <div className="mt-6 flex items-baseline gap-4">
            <span className="text-2xl text-navy">{formatPrice(price, s?.currency)}</span>
            {onSale && <span className="text-muted-foreground line-through">{formatPrice(Number(p.price), s?.currency)}</span>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {unavailable ? "غير متوفر حالياً" : availabilityLabel[p.availability]}
            {p.sku && <span className="ms-4">SKU: {p.sku}</span>}
          </p>
          <div className="my-8 h-px bg-border" />
          {p.description && <p className="leading-loose text-foreground/80">{p.description}</p>}

          {needFinish && (
            <div className="mt-8">
              <p className="mb-3 text-sm">التشطيب</p>
              <Chips items={p.finishes} value={finish} onChange={setFinish} />
            </div>
          )}
          {needColor && (
            <div className="mt-6">
              <p className="mb-3 text-sm">اللون / القماش</p>
              <Chips items={p.colors} value={color} onChange={setColor} />
            </div>
          )}

          {!unavailable && (
            <div className="mt-10 flex gap-3">
              <div className="flex items-center border">
                <button aria-label="زيادة" className="p-3" onClick={() => setQty((q) => Math.min(max, q + 1))}><Plus className="h-4 w-4" /></button>
                <span className="w-10 text-center">{qty}</span>
                <button aria-label="إنقاص" className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button>
              </div>
              <Button onClick={add} className="h-12 flex-1">أضف إلى السلة</Button>
            </div>
          )}

          {(dims.length > 0 || p.materials) && (
            <dl className="mt-12 space-y-3 border-t pt-8 text-sm">
              {dims.length > 0 && (
                <div className="flex gap-6"><dt className="w-24 text-muted-foreground">المقاسات</dt><dd>{dims.join(" · ")}</dd></div>
              )}
              {p.materials && (
                <div className="flex gap-6"><dt className="w-24 text-muted-foreground">الخامات</dt><dd>{p.materials}</dd></div>
              )}
            </dl>
          )}
          {s?.policies && <p className="mt-8 whitespace-pre-line text-xs text-muted-foreground">{s.policies}</p>}
        </div>
      </div>
      {related && related.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-10">
          <h2 className="mb-10 font-display text-3xl text-navy">قطع ذات صلة</h2>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} p={r} currency={s?.currency} />)}
          </div>
        </section>
      )}
    </main>
  );
}
