import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/data";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { SingleImageUpload } from "@/components/SingleImageUpload";

export const Route = createFileRoute("/admin/categories")({ component: Categories });

type Draft = Partial<Category>;
type Row = Category & { count: number };

const CATEGORIES_KEY = ["admin", "categories"] as const;

function Categories() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [reordering, setReordering] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async () => {
      const [{ data: cats, error }, { data: prods, error: e2 }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").order("name"),
        supabase.from("products").select("category_id"),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      const counts = new Map<string, number>();
      for (const p of prods ?? [])
        if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
      return (cats ?? []).map((c): Row => ({ ...c, count: counts.get(c.id) ?? 0 }));
    },
  });
  const rows = data ?? [];
  const activeCount = rows.filter((c) => c.is_active).length;

  const refresh = () =>
    Promise.all(
      [["admin"], ["categories"], ["shop"]].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );

  const save = async () => {
    if (!edit || busy) return;
    if (!edit.name?.trim()) return void toast.error("اسم الفئة مطلوب");
    setBusy(true);
    const row = {
      name: edit.name.trim(),
      slug: edit.slug?.trim() || slugify(edit.name),
      description: edit.description?.trim() || null,
      image_url: edit.image_url || null,
      is_active: edit.is_active ?? true,
      // New categories go to the end of the list
      sort_order:
        edit.sort_order ?? (rows.length ? Math.max(...rows.map((c) => c.sort_order)) + 10 : 0),
    };
    const { error } = edit.id
      ? await supabase.from("categories").update(row).eq("id", edit.id)
      : await supabase.from("categories").insert(row);
    setBusy(false);
    if (error)
      return void toast.error(
        error.code === "23505" ? "الرابط مستخدم بالفعل لفئة أخرى" : error.message,
      );
    toast.success(edit.id ? "تم حفظ التعديلات" : "تمت إضافة الفئة");
    setEdit(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("categories").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("تم حذف الفئة");
    setToDelete(null);
    refresh();
  };

  /** Optimistic visibility toggle. */
  const toggleActive = async (c: Row) => {
    qc.setQueryData<Row[]>(CATEGORIES_KEY, (old) =>
      old?.map((x) => (x.id === c.id ? { ...x, is_active: !c.is_active } : x)),
    );
    const { error } = await supabase
      .from("categories")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast.error("تعذر تحديث الفئة");
    refresh();
  };

  /** Moves a category and renumbers sort_order in steps of 10 (handles legacy duplicate values). */
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (reordering || j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const renumbered = next.map((c, idx) => ({ ...c, sort_order: idx * 10 }));
    qc.setQueryData<Row[]>(CATEGORIES_KEY, renumbered);
    setReordering(true);
    const changed = renumbered.filter(
      (c) => rows.find((r) => r.id === c.id)?.sort_order !== c.sort_order,
    );
    const results = await Promise.all(
      changed.map((c) =>
        supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id),
      ),
    );
    setReordering(false);
    if (results.some((r) => r.error)) toast.error("تعذر حفظ الترتيب");
    refresh();
  };

  const set = (patch: Draft) => setEdit((d) => ({ ...d, ...patch }));

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">الفئات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} فئة · {activeCount} ظاهرة في المتجر · الترتيب هنا هو ترتيب ظهورها في
            الموقع
          </p>
        </div>
        <Button onClick={() => setEdit({ is_active: true })} className="gap-2">
          <Plus className="h-4 w-4" /> فئة جديدة
        </Button>
      </div>

      {/* List */}
      <div className="mt-6 overflow-x-auto bg-ivory">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="w-16 p-3 font-normal">الترتيب</th>
              <th className="p-3 text-start font-normal">الفئة</th>
              <th className="p-3 text-center font-normal">المنتجات</th>
              <th className="p-3 text-center font-normal">ظاهرة</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading &&
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="p-3">
                    <div className="h-14 animate-pulse bg-cream" />
                  </td>
                </tr>
              ))}
            {isError && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  تعذر تحميل الفئات.{" "}
                  <button onClick={() => refetch()} className="text-navy underline hover:text-gold">
                    إعادة المحاولة
                  </button>
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  لا توجد فئات بعد. أضف أول فئة لتنظيم منتجاتك.
                </td>
              </tr>
            )}
            {rows.map((c, i) => (
              <tr
                key={c.id}
                className={cn("transition-colors hover:bg-cream/60", !c.is_active && "opacity-60")}
              >
                <td className="p-3">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || reordering}
                      aria-label="تحريك لأعلى"
                      className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-navy disabled:opacity-25"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === rows.length - 1 || reordering}
                      aria-label="تحريك لأسفل"
                      className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-navy disabled:opacity-25"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="h-14 w-14 shrink-0 object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-cream text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <button
                        onClick={() => setEdit(c)}
                        className="block truncate text-start text-navy hover:text-gold"
                      >
                        {c.name}
                      </button>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        /shop?cat={c.slug}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs",
                      c.count ? "bg-navy/5 text-navy" : "text-muted-foreground",
                    )}
                  >
                    {c.count}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={() => toggleActive(c)}
                    aria-label="ظاهرة في المتجر"
                  />
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <IconBtn label="تعديل" onClick={() => setEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      label={c.count ? "لا يمكن حذف فئة بها منتجات" : "حذف"}
                      danger
                      disabled={c.count > 0}
                      onClick={() => setToDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-xl"
        >
          <DialogHeader className="border-b px-6 py-4 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل الفئة" : "فئة جديدة"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6 text-sm">
                <SingleImageUpload
                  label="صورة الفئة"
                  folder="categories"
                  url={edit.image_url ?? null}
                  onChange={(image_url) => set({ image_url })}
                  className="aspect-[16/9]"
                  emptyTitle="اختر صورة للفئة"
                  emptyHint="تظهر كبطاقة في قسم المجموعات بالصفحة الرئيسية"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="الاسم *">
                    <input
                      className={inp}
                      value={edit.name ?? ""}
                      onChange={(e) => set({ name: e.target.value })}
                      autoFocus
                    />
                  </Field>
                  <Field label="الرابط">
                    <input
                      className={inp}
                      dir="ltr"
                      value={edit.slug ?? ""}
                      placeholder={edit.name ? slugify(edit.name) : "يُنشأ تلقائياً من الاسم"}
                      onChange={(e) => set({ slug: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="الوصف">
                  <textarea
                    rows={3}
                    className={`${inp} h-auto py-2`}
                    value={edit.description ?? ""}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t px-6 py-4 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={edit.is_active ?? true}
                    onCheckedChange={(v) => set({ is_active: v })}
                  />{" "}
                  ظاهرة في المتجر
                </label>
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>
                    إلغاء
                  </Button>
                  <Button onClick={save} disabled={busy} className="min-w-28 gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {edit.id ? "حفظ التعديلات" : "إضافة الفئة"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl" className="bg-ivory">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف الفئة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{toDelete?.name}» نهائياً. لإخفائها مؤقتاً يمكنك إيقاف «ظاهرة» بدلاً من
              الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IconBtn({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        danger
          ? "enabled:hover:bg-destructive/10 enabled:hover:text-destructive"
          : "hover:bg-gold/15 hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}

export const inp = "mt-1 h-10 w-full border bg-cream px-3 focus:outline-none focus:border-gold";
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
