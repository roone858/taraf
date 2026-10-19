import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/data";
import { slugify } from "@/lib/format";
import { uploadImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/categories")({ component: Categories });

type Draft = Partial<Category>;

function Categories() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const [{ data: cats, error }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("category_id"),
      ]);
      if (error) throw error;
      return (cats ?? []).map((c) => ({ ...c, count: prods?.filter((p) => p.category_id === c.id).length ?? 0 }));
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["categories"] }); };

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error("الاسم مطلوب");
    setBusy(true);
    const row = {
      name: edit.name.trim(),
      slug: edit.slug?.trim() || slugify(edit.name),
      description: edit.description || null,
      image_url: edit.image_url || null,
      is_active: edit.is_active ?? true,
      sort_order: Number(edit.sort_order ?? 0),
    };
    const { error } = edit.id
      ? await supabase.from("categories").update(row).eq("id", edit.id)
      : await supabase.from("categories").insert(row);
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "الرابط مستخدم بالفعل" : error.message);
    toast.success("تم الحفظ");
    setEdit(null);
    refresh();
    return undefined;
  };

  const remove = async (c: Category & { count: number }) => {
    if (c.count > 0) return toast.error("لا يمكن حذف فئة تحتوي على منتجات. انقل المنتجات أولاً.");
    if (!confirm(`حذف فئة "${c.name}"؟`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    refresh();
    return undefined;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-navy">الفئات</h1>
        <Button onClick={() => setEdit({ is_active: true })}>فئة جديدة</Button>
      </div>
      <div className="mt-8 overflow-x-auto bg-ivory">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground"><tr><th className="p-3 text-right">الفئة</th><th className="p-3 text-right">الرابط</th><th className="p-3">المنتجات</th><th className="p-3">الحالة</th><th /></tr></thead>
          <tbody className="divide-y">
            {data?.map((c) => (
              <tr key={c.id}>
                <td className="flex items-center gap-3 p-3">{c.image_url && <img src={c.image_url} alt="" className="h-10 w-10 object-cover" />}{c.name}</td>
                <td className="p-3 text-muted-foreground" dir="ltr">{c.slug}</td>
                <td className="p-3 text-center">{c.count}</td>
                <td className="p-3 text-center">{c.is_active ? "ظاهرة" : "مخفية"}</td>
                <td className="p-3 text-left whitespace-nowrap">
                  <button onClick={() => setEdit(c)} className="text-navy hover:text-gold">تعديل</button>
                  <button onClick={() => remove(c)} className="ms-4 text-destructive">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl" className="bg-ivory">
          <DialogHeader><DialogTitle>{edit?.id ? "تعديل الفئة" : "فئة جديدة"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3 text-sm">
              <Field label="الاسم"><input className={inp} value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="الرابط (slug)"><input className={inp} dir="ltr" value={edit.slug ?? ""} placeholder="تلقائي" onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
              <Field label="الوصف"><textarea className={`${inp} h-auto py-2`} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="الترتيب"><input type="number" className={inp} value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
              <Field label="الصورة">
                {edit.image_url && <img src={edit.image_url} alt="" className="mb-2 h-24 object-cover" />}
                <input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try { toast.loading("جارٍ الرفع...", { id: "up" }); const url = await uploadImage(f, "categories"); setEdit((d) => ({ ...d, image_url: url })); toast.success("تم الرفع", { id: "up" }); }
                  catch { toast.error("فشل الرفع", { id: "up" }); }
                }} />
              </Field>
              <label className="flex items-center gap-3"><Switch checked={edit.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> ظاهرة في المتجر</label>
              <Button onClick={save} disabled={busy} className="w-full">حفظ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const inp = "mt-1 h-10 w-full border bg-cream px-3 focus:outline-none focus:border-gold";
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-muted-foreground">{label}</span>{children}</label>;
}
