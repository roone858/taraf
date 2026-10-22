import { createFileRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ExternalLink,
  Eye,
  FileText,
  History,
  Languages,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { policiesAdminQuery, policyRevisionsQuery } from "@/lib/data";
import {
  formatPolicyDate,
  isValidPolicySlug,
  normalizePolicySlug,
  POLICY_KINDS,
  POLICY_LANGUAGES,
  POLICY_STATUSES,
  policyLanguageLabel,
  policyPath,
  policyStatusLabel,
  todayIso,
  type PolicyKind,
  type PolicyLanguage,
  type PolicyPage,
  type PolicyRevision,
  type PolicyStatus,
} from "@/lib/policies";
import { htmlToText, sanitizeHtml } from "@/lib/sanitize";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { SeoFields } from "@/components/admin/SeoFields";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  FilterTabs,
  IconButton,
  ListSkeleton,
  PageHeader,
  ReorderButtons,
  Surface,
  adminNum,
  inp,
  type Tone,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/policies")({ component: PoliciesAdmin });

type Draft = Partial<PolicyPage>;
type StatusFilter = "all" | PolicyStatus;

const STATUS_TONE: Record<PolicyStatus, Tone> = {
  published: "gold",
  draft: "muted",
  archived: "navy",
};

/** Suggested address for a known policy type, used when a new page has no slug yet. */
const KIND_SLUGS: Record<PolicyKind, string> = {
  privacy: "privacy-policy",
  terms: "terms-and-conditions",
  returns: "return-policy",
  shipping: "shipping-policy",
  cookies: "cookie-policy",
};

function PoliciesAdmin() {
  const qc = useQueryClient();
  const router = useRouter();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<PolicyPage | null>(null);
  const [language, setLanguage] = useState<PolicyLanguage>("ar");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reordering, setReordering] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery(policiesAdminQuery);
  const rows = data ?? [];

  // One language at a time: that is also the unit the tab/footer order applies to
  const group = rows
    .filter((p) => p.language === language)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  const shown = group.filter((p) => statusFilter === "all" || p.status === statusFilter);
  const countIn = (lang: PolicyLanguage) => rows.filter((p) => p.language === lang).length;
  const countStatus = (s: PolicyStatus) => group.filter((p) => p.status === s).length;
  const publishedTotal = rows.filter((p) => p.status === "published").length;
  const other: PolicyLanguage = language === "ar" ? "en" : "ar";
  const hasTranslation = (p: PolicyPage) =>
    !p.kind || rows.some((x) => x.language === other && x.kind === p.kind);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["policies"] }),
      qc.invalidateQueries({ queryKey: ["policy"] }),
      qc.invalidateQueries({ queryKey: ["policy-revisions"] }),
    ]);
    router.invalidate();
  };

  const open = (d: Draft) => {
    setEdit(d);
    setOriginal(JSON.stringify(d));
  };

  const newOne = () =>
    open({
      language,
      status: "draft",
      title: "",
      slug: "",
      content: "",
      kind: null,
      seo_title: "",
      seo_description: "",
      last_updated_on: todayIso(),
      sort_order: nextSortOrder(rows, language),
    });

  const save = async () => {
    if (!edit || busy) return;
    const title = (edit.title ?? "").trim();
    const slug = normalizePolicySlug(edit.slug ?? "");
    const lang: PolicyLanguage = edit.language === "en" ? "en" : "ar";
    const status: PolicyStatus = edit.status ?? "draft";
    const content = sanitizeHtml(edit.content ?? "");

    if (title.length < 2) return void toast.error("اكتب عنوان الصفحة");
    if (!isValidPolicySlug(slug))
      return void toast.error(
        "الرابط يجب أن يحتوي حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط، ولا يكون رابطًا محجوزًا مثل policies أو shop",
      );
    if (status === "published" && htmlToText(content).length < 20)
      return void toast.error("لا يمكن نشر صفحة بمحتوى فارغ أو قصير جدًا");

    const payload = {
      title,
      slug,
      language: lang,
      content,
      status,
      kind: edit.kind || null,
      seo_title: (edit.seo_title ?? "").trim() || null,
      seo_description: (edit.seo_description ?? "").trim() || null,
      last_updated_on: edit.last_updated_on || todayIso(),
    };

    setBusy(true);
    const { error } = edit.id
      ? await supabase.from("policy_pages").update(payload).eq("id", edit.id)
      : await supabase.from("policy_pages").insert({
          ...payload,
          sort_order: edit.sort_order ?? nextSortOrder(rows, lang),
        });
    setBusy(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "هذا الرابط أو نوع الصفحة مستخدم بالفعل لنفس اللغة"
          : error.message,
      );
      return;
    }
    toast.success(edit.id ? "تم حفظ الصفحة" : "تم إنشاء الصفحة");
    setEdit(null);
    refresh();
  };

  const setStatus = async (page: PolicyPage, status: PolicyStatus) => {
    const { error } = await supabase.from("policy_pages").update({ status }).eq("id", page.id);
    if (error) toast.error(error.message);
    else
      toast.success(
        status === "published"
          ? "تم نشر الصفحة"
          : status === "archived"
            ? "تمت أرشفة الصفحة"
            : "تم إلغاء النشر — الصفحة الآن مسودة",
      );
    refresh();
  };

  /** Swap with a neighbour in the same language and renumber sort_order in steps of 10. */
  const move = async (page: PolicyPage, dir: -1 | 1) => {
    if (reordering) return;
    const i = group.findIndex((p) => p.id === page.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= group.length) return;

    const next = [...group];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const renumbered = next.map((p, idx) => ({ ...p, sort_order: idx * 10 }));

    setReordering(true);
    const changed = renumbered.filter(
      (p) => group.find((g) => g.id === p.id)?.sort_order !== p.sort_order,
    );
    const results = await Promise.all(
      changed.map((p) =>
        supabase.from("policy_pages").update({ sort_order: p.sort_order }).eq("id", p.id),
      ),
    );
    setReordering(false);
    if (results.some((r) => r.error)) toast.error("تعذر حفظ الترتيب");
    refresh();
  };

  const statusPills: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "الكل", count: group.length },
    { value: "published", label: "منشورة", count: countStatus("published") },
    { value: "draft", label: "مسودات", count: countStatus("draft") },
    { value: "archived", label: "مؤرشفة", count: countStatus("archived") },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="السياسات"
        meta={
          isLoading ? (
            "جارٍ تحميل الصفحات…"
          ) : (
            <>
              <span className="text-navy tabular-nums">{adminNum.format(rows.length)}</span> صفحة ·{" "}
              <span className="text-navy tabular-nums">{adminNum.format(publishedTotal)}</span>{" "}
              منشورة على الموقع
            </>
          )
        }
        actions={
          <>
            <Button asChild variant="outline" className="h-10 gap-2">
              <a
                href={language === "en" ? "/en/policies" : "/policies"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">عرض الصفحة</span>
              </a>
            </Button>
            <Button onClick={newOne} className="h-10 gap-2">
              <Plus className="h-4 w-4" /> صفحة جديدة
            </Button>
          </>
        }
      />

      <Surface className="mt-8">
        <FilterTabs
          label="لغة الصفحات"
          value={language}
          onChange={(v) => {
            setLanguage(v);
            setStatusFilter("all");
          }}
          items={POLICY_LANGUAGES.map((l) => ({
            value: l.value,
            label: l.label,
            count: countIn(l.value),
          }))}
        />

        <div className="flex flex-col gap-3 border-b border-navy/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب حالة النشر">
            {statusPills.map((s) => {
              const active = statusFilter === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatusFilter(s.value)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                    active
                      ? "border-navy bg-navy text-cream"
                      : "border-navy/15 text-muted-foreground hover:border-navy/30 hover:text-navy",
                  )}
                >
                  {s.label}
                  <span className="tabular-nums opacity-70">{adminNum.format(s.count)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            الترتيب هنا هو ترتيب التبويبات في صفحة السياسات وروابط التذييل.
          </p>
        </div>

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <ErrorState what="الصفحات القانونية" onRetry={() => refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              group.length === 0
                ? `لا توجد صفحات ${language === "en" ? "إنجليزية" : "عربية"} بعد`
                : "لا توجد صفحات بهذه الحالة"
            }
            text="الصفحات المنشورة فقط تظهر للزوار. المسودات والمؤرشفة تبقى هنا."
            action={
              <Button onClick={newOne} className="h-10 gap-2">
                <Plus className="h-4 w-4" /> صفحة جديدة
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-navy/[0.07]">
            {shown.map((p) => {
              const index = group.findIndex((g) => g.id === p.id);
              const published = p.status === "published";
              return (
                <li
                  key={p.id}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-3 transition-colors hover:bg-cream/60 sm:gap-x-4 sm:px-4",
                    p.status === "archived" && "bg-navy/[0.02]",
                  )}
                >
                  <ReorderButtons
                    name={p.title}
                    first={index <= 0}
                    last={index === group.length - 1}
                    disabled={reordering}
                    onMove={(dir) => move(p, dir)}
                  />

                  <button
                    type="button"
                    onClick={() => open(p)}
                    className={cn(
                      "min-w-0 rounded-md py-1 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      p.status === "archived" && "opacity-60",
                    )}
                    aria-label={`تعديل ${p.title}`}
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-navy">{p.title}</span>
                      <Badge tone={STATUS_TONE[p.status]}>{policyStatusLabel(p.status)}</Badge>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span dir="ltr" className="truncate">
                        {policyPath(p.slug, language)}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatPolicyDate(p.last_updated_on, "ar")}</span>
                    </span>
                    {!hasTranslation(p) && (
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-navy/70">
                        <Languages className="h-3.5 w-3.5 text-gold" aria-hidden />
                        لا توجد نسخة {policyLanguageLabel(other)} من هذه الصفحة
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <label className="flex items-center gap-2 px-1.5">
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {published ? "منشورة" : "غير منشورة"}
                      </span>
                      <Switch
                        checked={published}
                        disabled={p.status === "archived"}
                        onCheckedChange={(v) => setStatus(p, v ? "published" : "draft")}
                        aria-label={`${published ? "إلغاء نشر" : "نشر"} ${p.title}`}
                      />
                    </label>
                    <span className="hidden sm:block">
                      <IconButton label={`تعديل ${p.title}`} onClick={() => open(p)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                    </span>
                    <DropdownMenu dir="rtl">
                      <DropdownMenuTrigger
                        aria-label={`المزيد من الإجراءات لـ ${p.title}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-gold/15 hover:text-navy focus-visible:outline-2 focus-visible:outline-gold"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48 bg-ivory">
                        <DropdownMenuItem onSelect={() => open(p)} className="gap-2 sm:hidden">
                          <Pencil className="h-4 w-4" /> تعديل
                        </DropdownMenuItem>
                        {published && (
                          <DropdownMenuItem asChild className="gap-2">
                            <a
                              href={policyPath(p.slug, language)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" /> فتح على الموقع
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setHistoryFor(p)} className="gap-2">
                          <History className="h-4 w-4" /> النسخ السابقة
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.status === "archived" ? (
                          <DropdownMenuItem
                            onSelect={() => setStatus(p, "draft")}
                            className="gap-2"
                          >
                            <ArchiveRestore className="h-4 w-4" /> استعادة كمسودة
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => setStatus(p, "archived")}
                            className="gap-2"
                          >
                            <Archive className="h-4 w-4" /> أرشفة
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      <EditPolicyDialog
        edit={edit}
        dirty={!!edit && JSON.stringify(edit) !== original}
        setEdit={setEdit}
        busy={busy}
        onSave={save}
      />

      <HistoryDialog
        page={historyFor}
        onClose={() => setHistoryFor(null)}
        onRestored={() => {
          setHistoryFor(null);
          refresh();
        }}
      />
    </div>
  );
}

function nextSortOrder(rows: PolicyPage[], language: PolicyLanguage) {
  const values = rows.filter((p) => p.language === language).map((p) => p.sort_order);
  return values.length ? Math.max(...values) + 10 : 10;
}

/** Side-panel block in the editor. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-navy/10 bg-ivory p-4">
      <h3 className="mb-3 text-sm font-medium text-navy">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function EditPolicyDialog({
  edit,
  dirty,
  setEdit,
  busy,
  onSave,
}: {
  edit: Draft | null;
  dirty: boolean;
  setEdit: (update: Draft | null | ((d: Draft | null) => Draft | null)) => void;
  busy: boolean;
  onSave: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const language: PolicyLanguage = edit?.language === "en" ? "en" : "ar";
  const slug = normalizePolicySlug(edit?.slug ?? "");
  const content = sanitizeHtml(edit?.content ?? "");
  const set = (patch: Draft) => setEdit((d) => (d ? { ...d, ...patch } : d));

  // Each opening starts in edit mode
  const editId = edit ? (edit.id ?? "new") : null;
  useEffect(() => setPreview(false), [editId]);

  // Ctrl/⌘ + S saves while the editor is open
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit, onSave]);

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else setEdit(null);
  };

  const onTitle = (title: string) => {
    // English titles of new pages suggest the address; Arabic ones can't be transliterated
    if (!edit?.id && language === "en" && !edit?.kind)
      set({ title, slug: normalizePolicySlug(title) });
    else set({ title });
  };

  const onKind = (kind: string) => {
    const k = (kind || null) as PolicyKind | null;
    set(!edit?.id && k && !slug ? { kind: k, slug: KIND_SLUGS[k] } : { kind: k });
  };

  const words = htmlToText(content).split(/\s+/).filter(Boolean).length;

  return (
    <>
      <Dialog open={!!edit} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent
          dir="rtl"
          className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none bg-cream p-0 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-xl"
        >
          <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-navy/10 bg-ivory px-5 py-4 text-start sm:px-6">
            <div className="min-w-0">
              <DialogTitle className="truncate font-display text-2xl text-navy">
                {edit?.id ? edit.title || "تعديل الصفحة" : "صفحة جديدة"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {edit?.id ? "تعديل صفحة قانونية" : "إنشاء صفحة قانونية"}
                {dirty && <span className="text-gold"> · تغييرات غير محفوظة</span>}
              </p>
            </div>
          </DialogHeader>

          {edit && (
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
                  {/* Main: title, content, SEO */}
                  <div className="min-w-0 space-y-5">
                    <Field label="عنوان الصفحة *">
                      <input
                        className={cn(inp, "h-12 font-display text-lg")}
                        value={edit.title ?? ""}
                        onChange={(e) => onTitle(e.target.value)}
                        maxLength={200}
                        placeholder={language === "en" ? "Privacy Policy" : "مثال: سياسة الخصوصية"}
                        dir={language === "en" ? "ltr" : "rtl"}
                        autoFocus={!edit.id}
                      />
                    </Field>

                    <section>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm text-muted-foreground">
                          المحتوى{" "}
                          <span className="text-xs tabular-nums">
                            ({adminNum.format(words)} كلمة)
                          </span>
                        </h3>
                        <div
                          className="flex overflow-hidden rounded-lg border border-navy/15 bg-ivory"
                          role="group"
                          aria-label="وضع المحتوى"
                        >
                          {(
                            [
                              [false, "تحرير", Pencil],
                              [true, "معاينة", Eye],
                            ] as const
                          ).map(([value, label, Icon]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setPreview(value)}
                              aria-pressed={preview === value}
                              className={cn(
                                "flex h-8 items-center gap-1.5 px-3 text-xs transition-colors",
                                preview === value
                                  ? "bg-navy text-cream"
                                  : "text-muted-foreground hover:text-navy",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" /> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {preview ? (
                        <div className="min-h-80 rounded-lg border border-navy/15 bg-ivory px-5 py-4">
                          {content ? (
                            <div
                              lang={language}
                              dir={language === "en" ? "ltr" : "rtl"}
                              className="policy-content max-w-[72ch]"
                              dangerouslySetInnerHTML={{ __html: content }}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">لا يوجد محتوى بعد.</p>
                          )}
                        </div>
                      ) : (
                        <RichTextEditor
                          value={edit.content ?? ""}
                          onChange={(html) => set({ content: html })}
                          dir={language === "en" ? "ltr" : "rtl"}
                          placeholder="اكتب نص السياسة… استخدم العناوين (H2) لتقسيمها؛ تظهر كقائمة محتويات للزائر."
                        />
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        العناوين الرئيسية تصبح قائمة «في هذه الصفحة» على الموقع.
                      </p>
                    </section>

                    <details className="group rounded-xl border border-navy/10 bg-ivory">
                      <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm text-navy [&::-webkit-details-marker]:hidden">
                        <span>
                          تحسين محركات البحث (SEO){" "}
                          <span className="text-xs text-muted-foreground">— اختياري</span>
                        </span>
                        <ChevronDown className="h-4 w-4 text-gold transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-navy/10 p-4">
                        <SeoFields
                          title={edit.seo_title ?? ""}
                          description={edit.seo_description ?? ""}
                          onTitle={(v) => set({ seo_title: v })}
                          onDescription={(v) => set({ seo_description: v })}
                          fallbackTitle={edit.title ?? ""}
                          fallbackDescription={htmlToText(content)}
                          path={policyPath(slug || "page", language)}
                        />
                      </div>
                    </details>
                  </div>

                  {/* Side: publishing and address */}
                  <aside className="space-y-4 lg:sticky lg:top-0">
                    <Panel title="النشر">
                      <div
                        className="grid grid-cols-3 overflow-hidden rounded-lg border border-navy/15"
                        role="radiogroup"
                        aria-label="حالة النشر"
                      >
                        {POLICY_STATUSES.map((s) => {
                          const active = (edit.status ?? "draft") === s.value;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => set({ status: s.value })}
                              className={cn(
                                "h-9 text-xs transition-colors",
                                active
                                  ? "bg-navy text-cream"
                                  : "bg-cream text-muted-foreground hover:text-navy",
                              )}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="-mt-2 text-xs text-muted-foreground">
                        {edit.status === "published"
                          ? "ظاهرة للزوار بعد الحفظ."
                          : "لن تظهر على الموقع."}
                      </p>
                      <Field label="تاريخ آخر تحديث">
                        <input
                          type="date"
                          className={inp}
                          value={edit.last_updated_on ?? todayIso()}
                          onChange={(e) => set({ last_updated_on: e.target.value })}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => set({ last_updated_on: todayIso() })}
                        className="-mt-2 text-xs text-navy underline decoration-gold underline-offset-4 hover:decoration-navy"
                      >
                        اجعله تاريخ اليوم
                      </button>
                    </Panel>

                    <Panel title="الرابط والنوع">
                      <Field label="نوع الصفحة">
                        <select
                          className={inp}
                          value={edit.kind ?? ""}
                          onChange={(e) => onKind(e.target.value)}
                        >
                          <option value="">صفحة عامة</option>
                          {POLICY_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="اللغة">
                        <select
                          className={inp}
                          value={language}
                          onChange={(e) => set({ language: e.target.value })}
                        >
                          {POLICY_LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="رابط الصفحة *">
                        <div className="mt-1.5 flex items-stretch" dir="ltr">
                          <span className="flex h-10 items-center rounded-s-lg border border-e-0 border-navy/15 bg-muted px-2.5 text-xs text-muted-foreground">
                            {language === "en" ? "/en/" : "/"}
                          </span>
                          <input
                            className={cn(inp, "mt-0 min-w-0 rounded-s-none")}
                            value={edit.slug ?? ""}
                            onChange={(e) => set({ slug: normalizePolicySlug(e.target.value) })}
                            maxLength={80}
                            placeholder="privacy-policy"
                          />
                        </div>
                      </Field>
                      <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
                        حروف إنجليزية صغيرة وأرقام وشرطات.
                        {edit.id && " تغيير الرابط يوقف الروابط القديمة."}
                      </p>
                      {(edit.kind === "terms" || edit.kind === "returns") && (
                        <p className="text-xs text-muted-foreground">
                          يظهر رابطها أيضًا في صفحة إتمام الطلب.
                        </p>
                      )}
                    </Panel>
                  </aside>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-navy/10 bg-ivory px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-6">
                {edit.id && edit.status === "published" && edit.slug ? (
                  <a
                    href={policyPath(edit.slug, language)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden h-10 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-navy sm:inline-flex"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> عرض على الموقع
                  </a>
                ) : (
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Ctrl + S للحفظ
                  </span>
                )}
                <div className="flex flex-1 gap-2 sm:ms-auto sm:flex-none">
                  <Button
                    variant="outline"
                    onClick={requestClose}
                    disabled={busy}
                    className="h-11 flex-1 sm:h-10 sm:flex-none"
                  >
                    إغلاق
                  </Button>
                  <Button
                    onClick={onSave}
                    disabled={busy || (!!edit.id && !dirty)}
                    className="h-11 min-w-32 flex-[2] gap-2 sm:h-10 sm:flex-none"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {edit.id ? "حفظ التغييرات" : "إنشاء الصفحة"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent dir="rtl" className="bg-ivory sm:rounded-xl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>تجاهل التغييرات؟</AlertDialogTitle>
            <AlertDialogDescription>
              لديك تغييرات غير محفوظة على هذه الصفحة. إذا أغلقت الآن ستفقدها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>متابعة التعديل</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                setEdit(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تجاهل وإغلاق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function HistoryDialog({
  page,
  onClose,
  onRestored,
}: {
  page: PolicyPage | null;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [busyId, setBusyId] = useState<string>();
  const { data, isLoading, isError } = useQuery(policyRevisionsQuery(page?.id));

  const restore = async (revision: PolicyRevision) => {
    if (!page) return;
    setBusyId(revision.id);
    const { error } = await supabase
      .from("policy_pages")
      .update({
        title: revision.title,
        content: revision.content,
        seo_title: revision.seo_title,
        seo_description: revision.seo_description,
        last_updated_on: revision.last_updated_on,
      })
      .eq("id", page.id);
    setBusyId(undefined);
    if (error) return void toast.error(error.message);
    toast.success("تمت استعادة النسخة السابقة");
    onRestored();
  };

  return (
    <Dialog open={!!page} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-lg sm:rounded-xl"
      >
        <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
          <DialogTitle className="font-display text-2xl text-navy">النسخ السابقة</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {page?.title} · تُحفظ آخر 20 نسخة قبل كل تعديل. الاستعادة تستبدل المحتوى الحالي وتبقى
            حالة النشر كما هي.
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل النسخ…
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              تعذر تحميل النسخ. حاول إغلاق النافذة وفتحها مجددًا.
            </p>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">
              لا توجد نسخ سابقة بعد. تُنشأ النسخة تلقائيًا قبل أول تعديل على المحتوى.
            </p>
          ) : (
            <ul className="divide-y divide-navy/10">
              {data.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                    <History className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-navy">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("ar-EG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(r.created_at))}{" "}
                      · {policyStatusLabel(r.status)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => restore(r)}
                    disabled={busyId === r.id}
                    className="h-9 shrink-0 gap-1.5 px-3 text-xs"
                  >
                    {busyId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    استعادة
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
