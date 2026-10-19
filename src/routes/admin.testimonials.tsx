import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Field, inp } from "./admin.categories";

export const Route = createFileRoute("/admin/testimonials")({ component: Testimonials });

type Draft = Partial<Testimonial>;
const KEY = ["admin", "testimonials"] as const;
const BODY_MAX = 600;

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

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">آراء العملاء</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {published.length} ظاهر في الصفحة الرئيسية
            {published.length > 0 && (
              <>
                {" "}
                · متوسط التقييم{" "}
                {new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(avg)} من ٥
              </>
            )}{" "}
            · يعرض السلايدر أول ١٢ تقييماً منشوراً بالترتيب
          </p>
        </div>
        <Button onClick={() => setEdit({ rating: 5, is_published: true })} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة تقييم
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse bg-ivory" />
          ))}
        {isError && (
          <div className="bg-ivory p-10 text-center text-sm text-muted-foreground">
            تعذر تحميل التقييمات.{" "}
            <button onClick={() => refetch()} className="text-navy underline hover:text-gold">
              إعادة المحاولة
            </button>
          </div>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="bg-ivory p-10 text-center text-sm text-muted-foreground">
            لا توجد تقييمات بعد. أضف آراء عملائك الحقيقية لتظهر في قسم «آراء عملائنا» بالصفحة
            الرئيسية.
          </div>
        )}
        {rows.map((t, i) => (
          <article
            key={t.id}
            className={cn(
              "flex gap-4 bg-ivory p-4 transition-opacity sm:p-5",
              !t.is_published && "opacity-60",
            )}
          >
            <div className="flex shrink-0 flex-col items-center justify-center">
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
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={t.rating} />
                <span className="text-sm text-navy">{t.customer_name}</span>
                {t.city && <span className="text-xs text-muted-foreground">{t.city}</span>}
                {!t.is_published && (
                  <span className="bg-muted px-2 py-0.5 text-xs text-muted-foreground">مخفي</span>
                )}
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-navy/80">{t.body}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-3">
              <Switch
                checked={t.is_published}
                onCheckedChange={() => togglePublished(t)}
                aria-label="ظاهر في المتجر"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setEdit(t)}
                  aria-label="تعديل"
                  title="تعديل"
                  className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-gold/15 hover:text-navy"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setToDelete(t)}
                  aria-label="حذف"
                  title="حذف"
                  className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Editor */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-lg"
        >
          <DialogHeader className="border-b px-6 py-4 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل التقييم" : "تقييم جديد"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6 text-sm">
                <div>
                  <span className="text-muted-foreground">التقييم</span>
                  <div className="mt-1">
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
                <Field label="نص التقييم *">
                  <textarea
                    rows={5}
                    className={`${inp} h-auto py-2`}
                    value={edit.body ?? ""}
                    onChange={(e) => set({ body: e.target.value })}
                    maxLength={BODY_MAX}
                  />
                  <span className="mt-1 block text-end text-xs text-muted-foreground">
                    {(edit.body ?? "").length}/{BODY_MAX}
                  </span>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t px-6 py-4 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={edit.is_published ?? true}
                    onCheckedChange={(v) => set({ is_published: v })}
                  />{" "}
                  ظاهر في المتجر
                </label>
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>
                    إلغاء
                  </Button>
                  <Button onClick={save} disabled={busy} className="min-w-28 gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {edit.id ? "حفظ التعديلات" : "إضافة التقييم"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl" className="bg-ivory">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف التقييم؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف تقييم «{toDelete?.customer_name}» نهائياً. لإخفائه مؤقتاً أوقف «ظاهر في
              المتجر» بدلاً من الحذف.
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
