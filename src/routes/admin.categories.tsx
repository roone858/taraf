import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  ListSkeleton,
  PageHeader,
  ReorderButtons,
  Surface,
  adminNum,
  inp,
} from "@/components/admin/kit";

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
  const newCategory = () => setEdit({ is_active: true });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="الفئات"
        meta={
          isLoading ? (
            "جارٍ تحميل الفئات…"
          ) : (
            <>
              <span className="text-navy tabular-nums">{adminNum.format(rows.length)}</span> فئة ·{" "}
              <span className="text-navy tabular-nums">{adminNum.format(activeCount)}</span> ظاهرة
              في المتجر · الترتيب هنا هو ترتيب ظهورها في الموقع
            </>
          )
        }
        actions={
          <Button onClick={newCategory} className="h-10 gap-2">
            <Plus className="h-4 w-4" /> فئة جديدة
          </Button>
        }
      />

      <Surface className="mt-8">
        {isLoading ? (
          <ListSkeleton rows={4} thumb="square" />
        ) : isError ? (
          <ErrorState what="الفئات" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="لا توجد فئات بعد"
            text="الفئات تنظّم منتجاتك في المتجر وتظهر كبطاقات في الصفحة الرئيسية."
            action={
              <Button onClick={newCategory} className="h-10 gap-2">
                <Plus className="h-4 w-4" /> فئة جديدة
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-navy/[0.07]">
            {rows.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-cream/60 sm:gap-4 sm:px-4"
              >
                <ReorderButtons
                  name={c.name}
                  first={i === 0}
                  last={i === rows.length - 1}
                  disabled={reordering}
                  onMove={(dir) => move(i, dir)}
                />
                <button
                  type="button"
                  onClick={() => setEdit(c)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                    !c.is_active && "opacity-60",
                  )}
                  aria-label={`تعديل ${c.name}`}
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-cream text-muted-foreground">
                      <ImageOff className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-navy">{c.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={c.count ? "soft" : "muted"}>
                        <span className="tabular-nums">{adminNum.format(c.count)}</span> منتج
                      </Badge>
                      <bdi className="hidden truncate text-xs text-muted-foreground sm:inline">
                        /shop?cat={c.slug}
                      </bdi>
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={() => toggleActive(c)}
                    aria-label={`إظهار ${c.name} في المتجر`}
                  />
                  <span className="text-[0.65rem] text-muted-foreground">
                    {c.is_active ? "ظاهرة" : "مخفية"}
                  </span>
                </div>
                <div className="hidden shrink-0 gap-0.5 sm:flex">
                  <IconButton label={`تعديل ${c.name}`} onClick={() => setEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={c.count ? "لا يمكن حذف فئة بها منتجات" : `حذف ${c.name}`}
                    danger
                    disabled={c.count > 0}
                    onClick={() => setToDelete(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* Editor */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-xl sm:rounded-xl"
        >
          <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل الفئة" : "فئة جديدة"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 text-sm">
                <SingleImageUpload
                  label="صورة الفئة"
                  folder="categories"
                  url={edit.image_url ?? null}
                  onChange={(image_url) => set({ image_url })}
                  className="aspect-[16/9] rounded-lg"
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
                    className={cn(inp, "h-auto py-2.5")}
                    value={edit.description ?? ""}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                </Field>
                {edit.id && (
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const r = rows.find((x) => x.id === edit.id);
                      return r?.count
                        ? `تحتوي على ${adminNum.format(r.count)} منتج، لذلك لا يمكن حذفها قبل نقل منتجاتها.`
                        : "لا تحتوي على منتجات.";
                    })()}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-sm">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-navy">
                  <Switch
                    checked={edit.is_active ?? true}
                    onCheckedChange={(v) => set({ is_active: v })}
                  />
                  ظاهرة في المتجر
                </label>
                {edit.id &&
                  (() => {
                    const r = rows.find((x) => x.id === edit.id);
                    return r && r.count === 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setToDelete(r)}
                        className="h-10 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 sm:hidden"
                      >
                        <Trash2 className="h-4 w-4" /> حذف
                      </Button>
                    ) : null;
                  })()}
                <div className="flex w-full gap-2 sm:ms-auto sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => setEdit(null)}
                    disabled={busy}
                    className="h-10 flex-1 sm:flex-none"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={save}
                    disabled={busy}
                    className="h-10 min-w-28 flex-1 gap-2 sm:flex-none"
                  >
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
        <AlertDialogContent dir="rtl" className="bg-ivory sm:rounded-xl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف «{toDelete?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              تُحذف الفئة نهائياً. لإخفائها مؤقتاً أوقف «ظاهرة في المتجر» بدلاً من الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = toDelete?.id;
                await confirmDelete();
                if (edit?.id === id) setEdit(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف الفئة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
