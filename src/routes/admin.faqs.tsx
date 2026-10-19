import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Faq } from "@/lib/data";
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
import { Field, inp } from "./admin.categories";

export const Route = createFileRoute("/admin/faqs")({ component: Faqs });

type Draft = Partial<Faq>;
const KEY = ["admin", "faqs"] as const;
const Q_MAX = 200;
const A_MAX = 2000;

function Faqs() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Faq | null>(null);
  const [reordering, setReordering] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const rows = data ?? [];
  const published = rows.filter((f) => f.is_published).length;

  const refresh = () =>
    Promise.all([["admin"], ["faqs"]].map((queryKey) => qc.invalidateQueries({ queryKey })));

  const save = async () => {
    if (!edit || busy) return;
    const question = edit.question?.trim() ?? "";
    const answer = edit.answer?.trim() ?? "";
    if (question.length < 3) return void toast.error("اكتب السؤال");
    if (answer.length < 2) return void toast.error("اكتب الإجابة");
    setBusy(true);
    const row = {
      question,
      answer,
      is_published: edit.is_published ?? true,
      sort_order:
        edit.sort_order ?? (rows.length ? Math.max(...rows.map((f) => f.sort_order)) + 10 : 0),
    };
    const { error } = edit.id
      ? await supabase.from("faqs").update(row).eq("id", edit.id)
      : await supabase.from("faqs").insert(row);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(edit.id ? "تم حفظ التعديلات" : "تمت إضافة السؤال");
    setEdit(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("faqs").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("تم حذف السؤال");
    setToDelete(null);
    refresh();
  };

  const togglePublished = async (f: Faq) => {
    qc.setQueryData<Faq[]>(KEY, (old) =>
      old?.map((x) => (x.id === f.id ? { ...x, is_published: !f.is_published } : x)),
    );
    const { error } = await supabase
      .from("faqs")
      .update({ is_published: !f.is_published })
      .eq("id", f.id);
    if (error) toast.error("تعذر تحديث السؤال");
    refresh();
  };

  /** Swap with a neighbour and renumber sort_order in steps of 10. */
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (reordering || j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const renumbered = next.map((f, idx) => ({ ...f, sort_order: idx * 10 }));
    qc.setQueryData<Faq[]>(KEY, renumbered);
    setReordering(true);
    const changed = renumbered.filter(
      (f) => rows.find((r) => r.id === f.id)?.sort_order !== f.sort_order,
    );
    const results = await Promise.all(
      changed.map((f) => supabase.from("faqs").update({ sort_order: f.sort_order }).eq("id", f.id)),
    );
    setReordering(false);
    if (results.some((r) => r.error)) toast.error("تعذر حفظ الترتيب");
    refresh();
  };

  const set = (patch: Draft) => setEdit((d) => ({ ...d, ...patch }));

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">الأسئلة الشائعة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} سؤال · {published} ظاهر في صفحة المتجر · الترتيب هنا هو ترتيب ظهورها
          </p>
        </div>
        <Button onClick={() => setEdit({ is_published: true })} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة سؤال
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse bg-ivory" />
          ))}
        {isError && (
          <div className="bg-ivory p-10 text-center text-sm text-muted-foreground">
            تعذر تحميل الأسئلة.{" "}
            <button onClick={() => refetch()} className="text-navy underline hover:text-gold">
              إعادة المحاولة
            </button>
          </div>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="bg-ivory p-10 text-center text-sm text-muted-foreground">
            لا توجد أسئلة بعد. أضف أسئلة عن التوصيل والدفع والتصنيع حسب الطلب لتظهر أسفل صفحة
            المتجر.
          </div>
        )}
        {rows.map((f, i) => (
          <article
            key={f.id}
            className={cn("flex gap-4 bg-ivory p-4 sm:p-5", !f.is_published && "opacity-60")}
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
              <p className="flex flex-wrap items-center gap-2 text-navy">
                {f.question}
                {!f.is_published && (
                  <span className="bg-muted px-2 py-0.5 text-xs text-muted-foreground">مخفي</span>
                )}
              </p>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {f.answer}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-3">
              <Switch
                checked={f.is_published}
                onCheckedChange={() => togglePublished(f)}
                aria-label="ظاهر في المتجر"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setEdit(f)}
                  aria-label="تعديل"
                  title="تعديل"
                  className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-gold/15 hover:text-navy"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setToDelete(f)}
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

      <Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[92vh] flex-col gap-0 bg-ivory p-0 sm:max-w-xl"
        >
          <DialogHeader className="border-b px-6 py-4 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل السؤال" : "سؤال جديد"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6 text-sm">
                <Field label="السؤال *">
                  <input
                    className={inp}
                    value={edit.question ?? ""}
                    onChange={(e) => set({ question: e.target.value })}
                    maxLength={Q_MAX}
                    placeholder="مثال: كم تستغرق مدة التوصيل؟"
                    autoFocus
                  />
                </Field>
                <Field label="الإجابة *">
                  <textarea
                    rows={7}
                    className={`${inp} h-auto py-2`}
                    value={edit.answer ?? ""}
                    onChange={(e) => set({ answer: e.target.value })}
                    maxLength={A_MAX}
                  />
                  <span className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>يمكنك كتابة أكثر من سطر؛ تظهر الأسطر كما هي.</span>
                    <span>
                      {(edit.answer ?? "").length}/{A_MAX}
                    </span>
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
                    {edit.id ? "حفظ التعديلات" : "إضافة السؤال"}
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
            <AlertDialogTitle>حذف السؤال؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{toDelete?.question}» نهائياً. لإخفائه مؤقتاً أوقف «ظاهر في المتجر» بدلاً من
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
