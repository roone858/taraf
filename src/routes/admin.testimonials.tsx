import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Testimonial } from "@/lib/data";
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
import { StarInput, Stars } from "@/components/StarRating";
import {
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

export const Route = createFileRoute("/admin/testimonials")({ component: Testimonials });

type Draft = Partial<Testimonial>;
const KEY = ["admin", "testimonials"] as const;
const BODY_MAX = 600;
const dec = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });

function Testimonials() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Testimonial | null>(null);
  const [reordering, setReordering] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const rows = data ?? [];
  const published = rows.filter((t) => t.is_published);
  const avg = published.length ? published.reduce((s, t) => s + t.rating, 0) / published.length : 0;

  const refresh = () =>
    Promise.all(
      [["admin"], ["testimonials"]].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );

  const save = async () => {
    if (!edit || busy) return;
    const name = edit.customer_name?.trim() ?? "";
    const body = edit.body?.trim() ?? "";
    if (name.length < 2) return void toast.error("اسم العميل مطلوب");
    if (body.length < 5) return void toast.error("نص التقييم قصير جداً");
    setBusy(true);
    const row = {
      customer_name: name,
      city: edit.city?.trim() || null,
      rating: edit.rating ?? 5,
      body,
      is_published: edit.is_published ?? true,
      // New entries go to the end
      sort_order:
        edit.sort_order ?? (rows.length ? Math.max(...rows.map((t) => t.sort_order)) + 10 : 0),
    };
    const { error } = edit.id
      ? await supabase.from("testimonials").update(row).eq("id", edit.id)
      : await supabase.from("testimonials").insert(row);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(edit.id ? "تم حفظ التعديلات" : "تمت إضافة التقييم");
    setEdit(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("تم حذف التقييم");
    if (edit?.id === toDelete.id) setEdit(null);
    setToDelete(null);
    refresh();
  };

  const togglePublished = async (t: Testimonial) => {
    qc.setQueryData<Testimonial[]>(KEY, (old) =>
      old?.map((x) => (x.id === t.id ? { ...x, is_published: !t.is_published } : x)),
    );
    const { error } = await supabase
      .from("testimonials")
      .update({ is_published: !t.is_published })
      .eq("id", t.id);
    if (error) toast.error("تعذر تحديث التقييم");
    refresh();
  };

  /** Swap with a neighbour and renumber sort_order in steps of 10. */
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (reordering || j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const renumbered = next.map((t, idx) => ({ ...t, sort_order: idx * 10 }));
    qc.setQueryData<Testimonial[]>(KEY, renumbered);
    setReordering(true);
    const changed = renumbered.filter(
      (t) => rows.find((r) => r.id === t.id)?.sort_order !== t.sort_order,
    );
    const results = await Promise.all(
      changed.map((t) =>
        supabase.from("testimonials").update({ sort_order: t.sort_order }).eq("id", t.id),
      ),
    );
    setReordering(false);
    if (results.some((r) => r.error)) toast.error("تعذر حفظ الترتيب");
    refresh();
  };

  const set = (patch: Draft) => setEdit((d) => ({ ...d, ...patch }));
  const newOne = () => setEdit({ rating: 5, is_published: true });
  const editing = edit?.id ? rows.find((t) => t.id === edit.id) : undefined;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="آراء العملاء"
        meta={
          isLoading ? (
            "جارٍ تحميل الآراء…"
          ) : (
            <>
              <span className="text-navy tabular-nums">{adminNum.format(published.length)}</span>{" "}
              ظاهر في الصفحة الرئيسية
              {published.length > 0 && (
                <>
                  {" · "}متوسط التقييم{" "}
                  <span className="text-navy tabular-nums">{dec.format(avg)}</span> من ٥
                </>
              )}
              {" · "}يعرض السلايدر أول ١٢ رأياً منشوراً بالترتيب
            </>
          )
        }
        actions={
          <Button onClick={newOne} className="h-10 gap-2">
            <Plus className="h-4 w-4" /> إضافة رأي
          </Button>
        }
      />

      <Surface className="mt-8">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState what="الآراء" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="لا توجد آراء بعد"
            text="أضف آراء عملائك الحقيقية لتظهر في قسم «آراء عملائنا» بالصفحة الرئيسية."
            action={
              <Button onClick={newOne} className="h-10 gap-2">
                <Plus className="h-4 w-4" /> إضافة رأي
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-navy/[0.07]">
            {rows.map((t, i) => (
              <li
                key={t.id}
                className="flex items-start gap-3 px-3 py-4 transition-colors duration-150 hover:bg-cream/60 sm:gap-4 sm:px-4"
              >
                <ReorderButtons
                  name={t.customer_name}
                  first={i === 0}
                  last={i === rows.length - 1}
                  disabled={reordering}
                  onMove={(dir) => move(i, dir)}
                />
                <button
                  type="button"
                  onClick={() => setEdit(t)}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                    !t.is_published && "opacity-60",
                  )}
                  aria-label={`تعديل رأي ${t.customer_name}`}
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={t.rating} />
                    <span className="text-sm text-navy">{t.customer_name}</span>
                    {t.city && <span className="text-xs text-muted-foreground">{t.city}</span>}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-navy/80">
                    {t.body}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                  <Switch
                    checked={t.is_published}
                    onCheckedChange={() => togglePublished(t)}
                    aria-label={`إظهار رأي ${t.customer_name}`}
                  />
                  <span className="text-[0.65rem] text-muted-foreground">
                    {t.is_published ? "ظاهر" : "مخفي"}
                  </span>
                </div>
                <div className="hidden shrink-0 gap-0.5 sm:flex">
                  <IconButton label={`تعديل رأي ${t.customer_name}`} onClick={() => setEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={`حذف رأي ${t.customer_name}`}
                    danger
                    onClick={() => setToDelete(t)}
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
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-lg sm:rounded-xl"
        >
          <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل الرأي" : "رأي جديد"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 text-sm">
                <div>
                  <span className="text-sm text-muted-foreground">التقييم</span>
                  <div className="mt-1.5">
                    <StarInput value={edit.rating ?? 5} onChange={(rating) => set({ rating })} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم العميل *">
                    <input
                      className={inp}
                      value={edit.customer_name ?? ""}
                      onChange={(e) => set({ customer_name: e.target.value })}
                      maxLength={80}
                      autoFocus
                    />
                  </Field>
                  <Field label="المدينة">
                    <input
                      className={inp}
                      value={edit.city ?? ""}
                      onChange={(e) => set({ city: e.target.value })}
                      maxLength={60}
                      placeholder="اختياري"
                    />
                  </Field>
                </div>
                <Field label="نص الرأي *">
                  <textarea
                    rows={5}
                    className={cn(inp, "h-auto py-2.5")}
                    value={edit.body ?? ""}
                    onChange={(e) => set({ body: e.target.value })}
                    maxLength={BODY_MAX}
                  />
                  <span className="mt-1 block text-end text-xs text-muted-foreground tabular-nums">
                    {adminNum.format((edit.body ?? "").length)}/{adminNum.format(BODY_MAX)}
                  </span>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-sm">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-navy">
                  <Switch
                    checked={edit.is_published ?? true}
                    onCheckedChange={(v) => set({ is_published: v })}
                  />
                  ظاهر في المتجر
                </label>
                {editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setToDelete(editing)}
                    className="h-10 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 sm:hidden"
                  >
                    <Trash2 className="h-4 w-4" /> حذف
                  </Button>
                )}
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
                    {edit.id ? "حفظ التعديلات" : "إضافة الرأي"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl" className="bg-ivory sm:rounded-xl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف رأي «{toDelete?.customer_name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              يُحذف الرأي نهائياً. لإخفائه مؤقتاً أوقف «ظاهر في المتجر» بدلاً من الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف الرأي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
