import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Product } from "@/lib/data";
import { formatPrice, slugify } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/ImageUploader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Field, inp } from "./admin.categories";

export const Route = createFileRoute("/admin/products")({ component: Products });

type Draft = Partial<Product>;
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

function Products() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const { data: settings } = useQuery(settingsQuery);
  const { data: cats } = useQuery({ queryKey: ["admin", "cats"], queryFn: async () => (await supabase.from("categories").select("id,name").order("sort_order")).data ?? [] });
  const { data } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => (await supabase.from("products").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const rows = (data ?? []).filter((p) => p.name.includes(q));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["shop"] }); };

  const save = async () => {
    if (!edit?.name?.trim() || edit.price == null) { toast.error("الاسم والسعر مطلوبان"); return; }
    const row = {
      name: edit.name.trim(), slug: edit.slug?.trim() || slugify(edit.name), description: edit.description || null, sku: edit.sku || null,
      category_id: edit.category_id || null, price: Number(edit.price), sale_price: num(edit.sale_price), stock: Number(edit.stock ?? 0),
      availability: edit.availability ?? "in_stock", images: edit.images ?? [], width_cm: num(edit.width_cm), height_cm: num(edit.height_cm),
      depth_cm: num(edit.depth_cm), materials: edit.materials || null, finishes: edit.finishes ?? [], colors: edit.colors ?? [],
      is_published: edit.is_published ?? false, is_featured: edit.is_featured ?? false, updated_at: new Date().toISOString(),
    };
    const { error } = edit.id ? await supabase.from("products").update(row).eq("id", edit.id) : await supabase.from("products").insert(row);
    if (error) { toast.error(error.code === "23505" ? "الرابط مستخدم بالفعل" : error.message); return; }
    toast.success("تم الحفظ"); setEdit(null); refresh();
  };
  const remove = async (p: Product) => {
    if (!confirm(`حذف "${p.name}"؟`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const togglePub = async (p: Product) => { await supabase.from("products").update({ is_published: !p.is_published }).eq("id", p.id); refresh(); };
  const set = (patch: Draft) => setEdit((d) => ({ ...d, ...patch }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-navy">المنتجات</h1>
        <div className="flex gap-2">
          <input placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} className={`${inp} mt-0 w-48`} />
          <Button onClick={() => setEdit({ availability: "in_stock", images: [], finishes: [], colors: [] })}>منتج جديد</Button>
        </div>
      </div>
      <div className="mt-8 overflow-x-auto bg-ivory">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground"><tr><th className="p-3 text-right">المنتج</th><th className="p-3">السعر</th><th className="p-3">المخزون</th><th className="p-3">منشور</th><th /></tr></thead>
          <tbody className="divide-y">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="flex items-center gap-3 p-3">{p.images[0] && <img src={p.images[0]} alt="" className="h-12 w-10 object-cover" />}{p.name}{p.is_featured && <span className="text-xs text-gold">مميز</span>}</td>
                <td className="p-3 text-center">{formatPrice(Number(p.sale_price ?? p.price), settings?.currency)}</td>
                <td className="p-3 text-center">{p.stock}</td>
                <td className="p-3 text-center"><Switch checked={p.is_published} onCheckedChange={() => togglePub(p)} /></td>
                <td className="whitespace-nowrap p-3 text-left">
                  <button onClick={() => setEdit(p)} className="text-navy hover:text-gold">تعديل</button>
                  <button onClick={() => remove(p)} className="ms-4 text-destructive">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto bg-ivory sm:max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "تعديل المنتج" : "منتج جديد"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="الاسم"><input className={inp} value={edit.name ?? ""} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="الرابط"><input className={inp} dir="ltr" placeholder="تلقائي" value={edit.slug ?? ""} onChange={(e) => set({ slug: e.target.value })} /></Field>
              <Field label="الفئة">
                <select className={inp} value={edit.category_id ?? ""} onChange={(e) => set({ category_id: e.target.value || null })}>
                  <option value="">—</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="SKU"><input className={inp} value={edit.sku ?? ""} onChange={(e) => set({ sku: e.target.value })} /></Field>
              <Field label="السعر"><input type="number" className={inp} value={edit.price ?? ""} onChange={(e) => set({ price: Number(e.target.value) })} /></Field>
              <Field label="سعر العرض"><input type="number" className={inp} value={edit.sale_price ?? ""} onChange={(e) => set({ sale_price: num(e.target.value) })} /></Field>
              <Field label="المخزون"><input type="number" className={inp} value={edit.stock ?? 0} onChange={(e) => set({ stock: Number(e.target.value) })} /></Field>
              <Field label="الحالة">
                <select className={inp} value={edit.availability} onChange={(e) => set({ availability: e.target.value })}>
                  <option value="in_stock">متوفر</option><option value="made_to_order">حسب الطلب</option><option value="unavailable">غير متوفر</option>
                </select>
              </Field>
              <Field label="العرض (سم)"><input type="number" className={inp} value={edit.width_cm ?? ""} onChange={(e) => set({ width_cm: num(e.target.value) })} /></Field>
              <Field label="الارتفاع (سم)"><input type="number" className={inp} value={edit.height_cm ?? ""} onChange={(e) => set({ height_cm: num(e.target.value) })} /></Field>
              <Field label="العمق (سم)"><input type="number" className={inp} value={edit.depth_cm ?? ""} onChange={(e) => set({ depth_cm: num(e.target.value) })} /></Field>
              <Field label="الخامات"><input className={inp} value={edit.materials ?? ""} onChange={(e) => set({ materials: e.target.value })} /></Field>
              <Field label="التشطيبات (مفصولة بفاصلة)"><input className={inp} defaultValue={edit.finishes?.join(", ")} onBlur={(e) => set({ finishes: list(e.target.value) })} /></Field>
              <Field label="الألوان (مفصولة بفاصلة)"><input className={inp} defaultValue={edit.colors?.join(", ")} onBlur={(e) => set({ colors: list(e.target.value) })} /></Field>
              <div className="col-span-2"><Field label="الوصف"><textarea rows={3} className={`${inp} h-auto py-2`} value={edit.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field></div>
              <div className="col-span-2">
                <ImageUploader
                  folder="products"
                  images={edit.images ?? []}
                  onChange={(update) => setEdit((d) => ({ ...d, images: update(d?.images ?? []) }))}
                />
              </div>
              <label className="flex items-center gap-3"><Switch checked={edit.is_published ?? false} onCheckedChange={(v) => set({ is_published: v })} /> منشور</label>
              <label className="flex items-center gap-3"><Switch checked={edit.is_featured ?? false} onCheckedChange={(v) => set({ is_featured: v })} /> مميز</label>
              <Button onClick={save} className="col-span-2">حفظ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
