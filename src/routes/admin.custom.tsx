import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ExternalLink,
  Images,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Trash2,
  Wallet,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import {
  CUSTOM_STATUSES,
  REFS_BUCKET,
  customStatusLabel,
  parseProjects,
  type CustomProject,
  type CustomRequest,
  type CustomRequestStatus,
} from "@/lib/custom-requests";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
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
import { WhatsappIcon } from "@/components/BrandIcons";
import { SingleImageUpload } from "@/components/SingleImageUpload";
import {
  Badge,
  EmptyState,
  ErrorState,
  FilterTabs,
  FormCard,
  IconButton,
  ListSkeleton,
  PageHeader,
  ReorderButtons,
  ResultBar,
  SaveBar,
  SearchInput,
  SectionTitle,
  Surface,
  inp,
  type Tone,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/custom")({ component: CustomRequests });

const KEY = ["admin", "custom-requests"] as const;
const num = new Intl.NumberFormat("ar-EG");
const dateTimeFmt = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const STATUS_TONE: Record<CustomRequestStatus, Tone> = {
  new: "gold",
  contacted: "navy",
  quoted: "navy",
  in_production: "soft",
  delivered: "muted",
  closed: "muted",
};

function CustomRequests() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CustomRequestStatus | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  const all = useMemo(() => data ?? [], [data]);
  const scoped = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return all.filter(
      (r) =>
        !term ||
        r.request_number.toLowerCase().includes(term) ||
        r.customer_name.toLowerCase().includes(term) ||
        r.furniture_type.toLowerCase().includes(term) ||
        (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [all, q]);
  const counts = useMemo(() => {
    const m = new Map<CustomRequestStatus, number>();
    for (const r of scoped) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [scoped]);
  const rows = scoped.filter((r) => status === "all" || r.status === status);
  const newCount = all.filter((r) => r.status === "new").length;
  const filtered = status !== "all" || q.trim() !== "";
  const clearFilters = () => {
    setStatus("all");
    setQ("");
  };
  const open = all.find((r) => r.id === openId) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  return (
    <div className="max-w-6xl space-y-10">
      <PageHeader
        title="طلبات التفصيل"
        meta={
          isLoading ? (
            "جارٍ تحميل الطلبات…"
          ) : (
            <>
              <span className="text-navy tabular-nums">{num.format(all.length)}</span> طلب
              {newCount > 0 && (
                <>
                  {" · "}
                  <span className="text-navy tabular-nums">{num.format(newCount)}</span> بانتظار
                  التواصل
                </>
              )}
            </>
          )
        }
        actions={
          <>
            <Button asChild variant="outline" className="h-10 gap-2">
              <Link to="/custom" target="_blank">
                <ExternalLink className="h-4 w-4" /> عرض الصفحة
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-10 gap-2"
              aria-label="تحديث الطلبات"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </>
        }
      />

      <Surface>
        <FilterTabs
          label="تصفية حسب الحالة"
          value={status}
          onChange={setStatus}
          items={(["all", ...CUSTOM_STATUSES] as const).map((v) => ({
            value: v,
            label: v === "all" ? "الكل" : customStatusLabel[v],
            count: v === "all" ? scoped.length : (counts.get(v) ?? 0),
            attention: v === "new",
          }))}
        />
        <div className="p-4">
          <SearchInput
            label="بحث في طلبات التفصيل"
            placeholder="رقم الطلب، الاسم، الهاتف، أو نوع القطعة"
            value={q}
            onChange={setQ}
          />
        </div>
        {!isLoading && !isError && all.length > 0 && (
          <ResultBar onClear={filtered ? clearFilters : undefined}>
            <span className="text-navy tabular-nums">{num.format(rows.length)}</span> طلب
          </ResultBar>
        )}
        <div className="border-t border-navy/10">
          {isLoading ? (
            <ListSkeleton thumb="round" />
          ) : isError ? (
            <ErrorState what="طلبات التفصيل" onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            all.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="لا توجد طلبات تفصيل بعد"
                text="تظهر هنا الطلبات المرسلة من صفحة «التفصيل حسب الطلب»."
              />
            ) : (
              <EmptyState
                icon={Search}
                title="لا توجد طلبات مطابقة"
                text="جرّب كلمة بحث أخرى أو حالة مختلفة."
                action={
                  <Button variant="outline" onClick={clearFilters} className="h-10">
                    مسح الفلاتر
                  </Button>
                }
              />
            )
          ) : (
            <ul className="divide-y divide-navy/[0.07]">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="group flex w-full items-center gap-4 px-4 py-4 text-start transition-colors duration-150 hover:bg-cream/70 focus-visible:bg-cream focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-navy tabular-nums" dir="ltr">
                          {r.request_number}
                        </span>
                        <StatusBadge status={r.status} />
                        {r.reference_images.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Images className="h-3.5 w-3.5" />{" "}
                            {num.format(r.reference_images.length)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-navy">
                        {r.furniture_type} — {r.customer_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.city} · {dateTimeFmt.format(new Date(r.created_at))}
                      </p>
                    </div>
                    <ChevronLeft
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:text-navy"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Surface>

      <ProjectsEditor />

      <RequestDialog
        key={open?.id}
        request={open}
        onClose={() => setOpenId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: CustomRequestStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{customStatusLabel[status]}</Badge>;
}

function RequestDialog({
  request: r,
  onClose,
  onChanged,
}: {
  request: CustomRequest | null;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<CustomRequestStatus | null>(null);
  const [notes, setNotes] = useState(r?.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reference photos live in a private bucket: sign them for an hour while the dialog is open
  const { data: photos } = useQuery({
    queryKey: ["admin", "custom-refs", r?.id],
    enabled: !!r?.reference_images.length,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(REFS_BUCKET)
        .createSignedUrls(r!.reference_images, 3600);
      if (error) throw error;
      return data.flatMap((d) => (d.signedUrl ? [d.signedUrl] : []));
    },
  });

  if (!r) return null;
  const customerWa = normalizeWhatsappNumber(r.phone);

  const changeStatus = async (s: CustomRequestStatus) => {
    if (s === r.status || pending) return;
    setPending(s);
    const { error } = await supabase
      .from("custom_requests")
      .update({ status: s, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    setPending(null);
    if (error) return void toast.error("تعذر تغيير الحالة");
    toast.success(`تم تغيير الحالة إلى «${customStatusLabel[s]}»`);
    await onChanged();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase
      .from("custom_requests")
      .update({ admin_notes: notes.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    setSavingNotes(false);
    if (error) return void toast.error("تعذر حفظ الملاحظات");
    toast.success("تم حفظ الملاحظات");
    await onChanged();
  };

  const remove = async () => {
    const { error } = await supabase.from("custom_requests").delete().eq("id", r.id);
    setConfirmDelete(false);
    if (error) return void toast.error("تعذر حذف الطلب");
    if (r.reference_images.length)
      await supabase.storage.from(REFS_BUCKET).remove(r.reference_images);
    toast.success("تم حذف الطلب");
    onClose();
    await onChanged();
  };

  const specs = [
    { Icon: Ruler, label: "المقاسات", value: r.dimensions },
    { Icon: Layers, label: "الخامات المفضلة", value: r.materials },
    { Icon: Wallet, label: "الميزانية التقريبية", value: r.budget },
  ].filter((x) => x.value);

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-2xl sm:rounded-xl"
        >
          <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
            <DialogTitle className="flex flex-wrap items-center gap-3 font-display text-2xl text-navy">
              <span dir="ltr" className="tabular-nums">
                {r.request_number}
              </span>
              <StatusBadge status={r.status} />
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {dateTimeFmt.format(new Date(r.created_at))} · {r.furniture_type}
            </p>
          </DialogHeader>

          <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6 text-sm">
            <section>
              <SectionTitle>تغيير الحالة</SectionTitle>
              <div className="flex flex-wrap gap-2" role="group" aria-label="حالة الطلب">
                {CUSTOM_STATUSES.map((s) => {
                  const current = s === r.status;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeStatus(s)}
                      disabled={!!pending}
                      aria-pressed={current}
                      className={cn(
                        "flex h-10 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors duration-150 disabled:cursor-wait disabled:opacity-60",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                        current
                          ? "border-navy bg-navy text-cream"
                          : "border-navy/15 text-navy hover:border-gold hover:bg-gold/10",
                      )}
                    >
                      {pending === s && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {customStatusLabel[s]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <SectionTitle>الطلب</SectionTitle>
              <p className="text-base text-navy">{r.furniture_type}</p>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-navy/85">
                {r.description}
              </p>
              {specs.length > 0 && (
                <dl className="mt-4 space-y-2 rounded-lg bg-cream/70 p-4">
                  {specs.map(({ Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <dt className="text-muted-foreground">{label}:</dt>
                      <dd className="text-navy">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {r.reference_images.length > 0 && (
              <section>
                <SectionTitle>الصور المرجعية</SectionTitle>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {r.reference_images.map((path, i) => {
                    const src = photos?.[i];
                    return (
                      <li
                        key={path}
                        className="aspect-square overflow-hidden rounded-md bg-navy/[0.06]"
                      >
                        {src ? (
                          <a
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`فتح الصورة ${i + 1}`}
                          >
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          </a>
                        ) : (
                          <div className="h-full w-full animate-pulse" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              <SectionTitle>العميل</SectionTitle>
              <div className="space-y-2.5 rounded-lg bg-cream/70 p-4">
                <p className="text-base text-navy">{r.customer_name}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gold" />
                    <a
                      href={`tel:${r.phone}`}
                      dir="ltr"
                      className="tabular-nums underline-offset-4 hover:text-navy hover:underline"
                    >
                      {r.phone}
                    </a>
                  </span>
                  {customerWa && (
                    <a
                      href={`https://wa.me/${customerWa}?text=${encodeURIComponent(`مرحباً ${r.customer_name}، بخصوص طلب التفصيل رقم ${r.request_number} من TARAF FURNITURE`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-navy transition-colors hover:bg-gold/15"
                    >
                      <WhatsappIcon className="h-3.5 w-3.5 text-gold" /> مراسلة على واتساب
                    </a>
                  )}
                </p>
                {r.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gold" />
                    <a href={`mailto:${r.email}`} dir="ltr" className="hover:underline">
                      {r.email}
                    </a>
                  </p>
                )}
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span>{r.city}</span>
                </p>
              </div>
            </section>

            <section>
              <SectionTitle>ملاحظات داخلية</SectionTitle>
              <label className="block">
                <span className="sr-only">ملاحظات داخلية</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="لا تظهر للعميل — مثل السعر المقترح أو موعد الزيارة"
                  className={cn(inp, "mt-0 h-auto rounded-lg py-2.5")}
                />
              </label>
              {notes.trim() !== (r.admin_notes ?? "") && (
                <Button
                  size="sm"
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="mt-2 h-9 gap-2"
                >
                  {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />} حفظ الملاحظات
                </Button>
              )}
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy/10 px-6 py-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> حذف الطلب
            </button>
            <Button variant="outline" onClick={onClose} disabled={!!pending}>
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent dir="rtl" className="bg-ivory sm:rounded-xl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف الطلب {r.request_number}؟</AlertDialogTitle>
            <AlertDialogDescription>
              يُحذف الطلب وصوره المرجعية نهائياً ولا يمكن استرجاعه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Completed projects shown on /custom (store_settings.custom_projects). */
function ProjectsEditor() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const saved = useMemo(() => parseProjects(s?.custom_projects), [s?.custom_projects]);
  const [items, setItems] = useState<CustomProject[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => setItems(saved), [saved]);

  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  const update = (i: number, patch: Partial<CustomProject>) =>
    setItems((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(i, 1);
      next.splice(i + dir, 0, it!);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const clean = items
      .filter((p) => p.image)
      .map((p) => ({ image: p.image, title: p.title.trim(), note: p.note.trim() }));
    const { error } = await supabase
      .from("store_settings")
      .update({ custom_projects: clean, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) return void toast.error("تعذر الحفظ");
    toast.success("تم حفظ الأعمال");
    await qc.invalidateQueries({ queryKey: settingsQuery.queryKey });
  };

  return (
    <>
      <FormCard
        title="أعمال تفصيل منجزة"
        description="صور لقطع فصّلتموها لعملائكم. تظهر في صفحة التفصيل، ويختفي القسم ما دامت القائمة فارغة."
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">لم تُضف أي أعمال بعد.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((p, i) => (
              <li
                key={i}
                className="flex flex-col gap-4 rounded-lg border border-navy/10 bg-cream/50 p-3 sm:flex-row sm:items-start"
              >
                <SingleImageUpload
                  url={p.image || null}
                  onChange={(url) => update(i, { image: url ?? "" })}
                  folder="custom-projects"
                  label={`صورة العمل ${i + 1}`}
                  emptyTitle="صورة العمل"
                  className="aspect-square w-full sm:w-36"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <label className="block">
                    <span className="text-sm text-muted-foreground">العنوان</span>
                    <input
                      className={inp}
                      value={p.title}
                      maxLength={80}
                      placeholder="مثال: كنبة زاوية بقماش مخمل"
                      onChange={(e) => update(i, { title: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-muted-foreground">ملاحظة قصيرة (اختيارية)</span>
                    <input
                      className={inp}
                      value={p.note}
                      maxLength={140}
                      placeholder="مثال: بمقاس 320 × 220 سم لمجلس في الرياض"
                      onChange={(e) => update(i, { note: e.target.value })}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-1 sm:flex-col">
                  <ReorderButtons
                    name={p.title || `العمل ${i + 1}`}
                    first={i === 0}
                    last={i === items.length - 1}
                    onMove={(d) => move(i, d)}
                  />
                  <IconButton
                    label={`حذف ${p.title || `العمل ${i + 1}`}`}
                    danger
                    onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="outline"
          className="mt-4 h-10 gap-2"
          onClick={() => setItems((list) => [...list, { image: "", title: "", note: "" }])}
        >
          <Plus className="h-4 w-4" /> إضافة عمل
        </Button>
      </FormCard>
      <SaveBar visible={dirty} saving={saving} onSave={save} onReset={() => setItems(saved)} />
    </>
  );
}
