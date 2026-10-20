import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { HelpCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
    if (edit?.id === toDelete.id) setEdit(null);
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
  const newOne = () => setEdit({ is_published: true });
  const editing = edit?.id ? rows.find((f) => f.id === edit.id) : undefined;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="الأسئلة الشائعة"
        meta={
          isLoading ? (
            "جارٍ تحميل الأسئلة…"
          ) : (
            <>
              <span className="text-navy tabular-nums">{adminNum.format(rows.length)}</span> سؤال ·{" "}
              <span className="text-navy tabular-nums">{adminNum.format(published)}</span> ظاهر في
              المتجر · الترتيب هنا هو ترتيب ظهورها
            </>
          )
        }
        actions={
          <Button onClick={newOne} className="h-10 gap-2">
            <Plus className="h-4 w-4" /> إضافة سؤال
          </Button>
        }
      />

      <Surface className="mt-8">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState what="الأسئلة" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="لا توجد أسئلة بعد"
            text="أضف أسئلة عن التوصيل والدفع والتصنيع حسب الطلب لتظهر في المتجر والصفحة الرئيسية."
            action={
              <Button onClick={newOne} className="h-10 gap-2">
                <Plus className="h-4 w-4" /> إضافة سؤال
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-navy/[0.07]">
            {rows.map((f, i) => (
              <li
                key={f.id}
                className="flex items-start gap-3 px-3 py-4 transition-colors duration-150 hover:bg-cream/60 sm:gap-4 sm:px-4"
              >
                <ReorderButtons
                  name={f.question}
                  first={i === 0}
                  last={i === rows.length - 1}
                  disabled={reordering}
                  onMove={(dir) => move(i, dir)}
                />
                <button
                  type="button"
                  onClick={() => setEdit(f)}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                    !f.is_published && "opacity-60",
                  )}
                  aria-label={`تعديل السؤال: ${f.question}`}
                >
                  <span className="block text-navy">{f.question}</span>
                  <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                    {f.answer}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                  <Switch
                    checked={f.is_published}
                    onCheckedChange={() => togglePublished(f)}
                    aria-label={`إظهار السؤال: ${f.question}`}
                  />
                  <span className="text-[0.65rem] text-muted-foreground">
                    {f.is_published ? "ظاهر" : "مخفي"}
                  </span>
                </div>
                <div className="hidden shrink-0 gap-0.5 sm:flex">
                  <IconButton label="تعديل السؤال" onClick={() => setEdit(f)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="حذف السؤال" danger onClick={() => setToDelete(f)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-xl sm:rounded-xl"
        >
          <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل السؤال" : "سؤال جديد"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 text-sm">
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
                    className={cn(inp, "h-auto py-2.5")}
                    value={edit.answer ?? ""}
                    onChange={(e) => set({ answer: e.target.value })}
                    maxLength={A_MAX}
                  />
                  <span className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>يمكنك كتابة أكثر من سطر؛ تظهر الأسطر كما هي.</span>
                    <span className="shrink-0 tabular-nums">
                      {adminNum.format((edit.answer ?? "").length)}/{adminNum.format(A_MAX)}
                    </span>
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
                    {edit.id ? "حفظ التعديلات" : "إضافة السؤال"}
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
            <AlertDialogTitle>حذف هذا السؤال؟</AlertDialogTitle>
            <AlertDialogDescription>
              يُحذف «{toDelete?.question}» نهائياً. لإخفائه مؤقتاً أوقف «ظاهر في المتجر» بدلاً من
              الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف السؤال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
