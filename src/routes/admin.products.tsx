import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Flame,
  ImageOff,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Product } from "@/lib/data";
import { availabilityLabel, effectivePrice, formatPrice, LOW_STOCK, slugify } from "@/lib/format";
import { cleanSizes, productSizes, type SizeOption } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/ImageUploader";
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
  FilterTabs,
  IconButton,
  ListSkeleton,
  ResultBar,
  SearchInput,
  SectionTitle,
  inp,
} from "@/components/admin/kit";
import { SeoFields } from "@/components/admin/SeoFields";

export const Route = createFileRoute("/admin/products")({
  // ?edit=<id> opens that item (used by the SEO health check)
  validateSearch: z.object({ edit: z.string().optional() }),
  component: Products,
});

/** Form state: price may be empty while editing; sizes are parsed from the jsonb column. */
type Draft = Omit<Partial<Product>, "price" | "sizes"> & {
  price?: number | null;
  sizes?: SizeOption[];
};
type StatusFilter = "all" | "published" | "draft";

const toDraft = (p: Product): Draft => ({ ...p, sizes: productSizes(p) });
const PRODUCTS_KEY = ["admin", "products"] as const;
const count = new Intl.NumberFormat("ar-EG");
const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const num = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const blank = (): Draft => ({
  availability: "in_stock",
  stock: 0,
  images: [],
  finishes: [],
  colors: [],
  sizes: [],
  is_published: false,
  is_featured: false,
});
const STATUS_TABS: [StatusFilter, string][] = [
  ["all", "الكل"],
  ["published", "منشور"],
  ["draft", "مسودة"],
];

function validate(d: Draft): string | null {
  if (!d.name?.trim()) return "اسم المنتج مطلوب";
  if (d.price == null || d.price <= 0) return "أدخل سعراً صحيحاً أكبر من صفر";
  if (d.sale_price != null && (d.sale_price <= 0 || d.sale_price >= d.price))
    return "سعر العرض يجب أن يكون أقل من السعر الأصلي";
  if (d.stock != null && (d.stock < 0 || !Number.isInteger(d.stock)))
    return "المخزون يجب أن يكون عدداً صحيحاً غير سالب";
  const labels = (d.sizes ?? []).map((s) => s.label.trim());
  if (labels.some((l) => !l)) return "اكتب اسم كل مقاس أو احذف الصف الفارغ";
  if (new Set(labels).size !== labels.length) return "يوجد مقاس مكرر";
  if ((d.sizes ?? []).some((s) => s.price != null && s.price <= 0))
    return "سعر المقاس يجب أن يكون أكبر من صفر";
  return null;
}

function Products() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data: settings } = useQuery(settingsQuery);
  const currency = settings?.currency;
  const { data: cats } = useQuery({
    queryKey: ["admin", "cats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        // Tiebreaker: rows sharing a timestamp (e.g. seeded together) would otherwise reshuffle after any update
        .order("id");
      if (error) throw error;
      return data;
    },
  });

  const catName = useMemo(() => new Map(cats?.map((c) => [c.id, c.name])), [cats]);
  const all = useMemo(() => data ?? [], [data]);
  const lowStock = all.filter((p) => p.availability === "in_stock" && p.stock <= LOW_STOCK).length;
  // Search + category narrow the set first; the status tab counts describe that narrowed set
  const scoped = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!term ||
          p.name.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.slug.includes(term)) &&
        (!cat || (cat === "none" ? !p.category_id : p.category_id === cat)),
    );
  }, [all, q, cat]);
  const tabCount: Record<StatusFilter, number> = {
    all: scoped.length,
    published: scoped.filter((p) => p.is_published).length,
    draft: scoped.filter((p) => !p.is_published).length,
  };

  // Deep link from Admin → تحسين الظهور: open the requested item once the list has loaded
  const { edit: editId } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!editId || !data) return;
    const hit = data.find((x) => x.id === editId);
    if (hit) setEdit(toDraft(hit));
    navigate({ to: ".", search: {}, replace: true });
  }, [editId, data, navigate]);

  const rows = useMemo(
    () => scoped.filter((p) => status === "all" || (status === "published") === p.is_published),
    [scoped, status],
  );
  const filtered = status !== "all" || q.trim() !== "" || cat !== "";
  const clearFilters = () => {
    setStatus("all");
    setQ("");
    setCat("");
  };

  const refresh = () =>
    Promise.all(
      [["admin"], ["products"], ["product"], ["shop"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );

  const save = async () => {
    if (!edit || saving) return;
    const err = validate(edit);
    if (err) return void toast.error(err);
    setSaving(true);
    const row = {
      name: edit.name!.trim(),
      slug: edit.slug?.trim() || slugify(edit.name!),
      description: edit.description?.trim() || null,
      sku: edit.sku?.trim() || null,
      category_id: edit.category_id || null,
      price: edit.price!,
      sale_price: edit.sale_price ?? null,
      stock: edit.stock ?? 0,
      availability: edit.availability ?? "in_stock",
      images: edit.images ?? [],
      width_cm: edit.width_cm ?? null,
      height_cm: edit.height_cm ?? null,
      depth_cm: edit.depth_cm ?? null,
      materials: edit.materials?.trim() || null,
      finishes: edit.finishes ?? [],
      colors: edit.colors ?? [],
      sizes: cleanSizes(edit.sizes ?? []),
      is_published: edit.is_published ?? false,
      is_featured: edit.is_featured ?? false,
      is_bestseller: edit.is_bestseller ?? false,
      seo_title: edit.seo_title?.trim() || null,
      seo_description: edit.seo_description?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = edit.id
      ? await supabase.from("products").update(row).eq("id", edit.id)
      : await supabase.from("products").insert(row);
    setSaving(false);
    if (error)
      return void toast.error(
        error.code === "23505" ? "الرابط مستخدم بالفعل لمنتج آخر" : error.message,
      );
    toast.success(edit.id ? "تم حفظ التعديلات" : "تمت إضافة المنتج");
    setEdit(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("تم حذف المنتج");
    if (edit?.id === toDelete.id) setEdit(null);
    setToDelete(null);
    refresh();
  };

  /** Optimistic toggle of a boolean flag; reverts via refetch on failure. */
  const toggle = async (p: Product, field: "is_published" | "is_featured" | "is_bestseller") => {
    const value = !p[field];
    qc.setQueryData<Product[]>(PRODUCTS_KEY, (old) =>
      old?.map((x) => (x.id === p.id ? { ...x, [field]: value } : x)),
    );
    const patch =
      field === "is_published"
        ? { is_published: value }
        : field === "is_featured"
          ? { is_featured: value }
          : { is_bestseller: value };
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) toast.error("تعذر تحديث المنتج");
    refresh();
  };

  const duplicate = (p: Product) => {
    const { id: _id, created_at: _c, updated_at: _u, slug: _s, ...rest } = p;
    setEdit({ ...rest, sizes: productSizes(p), name: `${p.name} (نسخة)`, is_published: false });
  };

  const set = (patch: Draft) => setEdit((d) => ({ ...d, ...patch }));
  const editing = edit?.id ? all.find((p) => p.id === edit.id) : undefined;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight text-navy">المنتجات</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLoading ? (
              "جارٍ تحميل المنتجات…"
            ) : (
              <>
                <span className="text-navy tabular-nums">{count.format(all.length)}</span> منتج
                {lowStock > 0 && (
                  <>
                    {" · "}
                    <span className="text-destructive tabular-nums">
                      {count.format(lowStock)}
                    </span>{" "}
                    بمخزون منخفض
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-10 gap-2"
            aria-label="تحديث القائمة"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button onClick={() => setEdit(blank())} className="h-10 gap-2">
            <Plus className="h-4 w-4" /> منتج جديد
          </Button>
        </div>
      </header>

      <div className="mt-8 overflow-hidden rounded-xl border border-navy/10 bg-ivory shadow-[0_1px_2px_oklch(0.19_0.03_260/0.06)]">
        <FilterTabs
          label="تصفية حسب الحالة"
          value={status}
          onChange={setStatus}
          items={STATUS_TABS.map(([v, label]) => ({ value: v, label, count: tabCount[v] }))}
        />

        {/* Search + category */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput
            className="flex-1"
            label="بحث في المنتجات"
            placeholder="الاسم، SKU، أو الرابط"
            value={q}
            onChange={setQ}
          />
          <label>
            <span className="sr-only">الفئة</span>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className={cn(inp, "mt-0 h-11 rounded-lg sm:w-48")}
            >
              <option value="">كل الفئات</option>
              {cats?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">بدون فئة</option>
            </select>
          </label>
        </div>

        {/* Result summary */}
        {!isLoading && !isError && all.length > 0 && filtered && (
          <ResultBar onClear={clearFilters}>
            <span className="text-navy tabular-nums">{count.format(rows.length)}</span> من{" "}
            <span className="tabular-nums">{count.format(all.length)}</span> منتج
          </ResultBar>
        )}

        {/* Results */}
        <div className="border-t border-navy/10">
          {isLoading ? (
            <ListSkeleton thumb="tall" />
          ) : isError ? (
            <ErrorState what="المنتجات" onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            all.length === 0 ? (
              <EmptyState
                icon={PackagePlus}
                title="لا توجد منتجات بعد"
                text="أضف أول منتج بصوره وسعره، ثم انشره ليظهر في المتجر."
                action={
                  <Button onClick={() => setEdit(blank())} className="h-10 gap-2">
                    <Plus className="h-4 w-4" /> منتج جديد
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title="لا توجد منتجات مطابقة"
                text="جرّب كلمة بحث أخرى أو فئة مختلفة."
                action={
                  <Button variant="outline" onClick={clearFilters} className="h-10">
                    مسح الفلاتر
                  </Button>
                }
              />
            )
          ) : (
            <>
              {/* Phones: divided list — tap a row to edit; publish toggles in place */}
              <ul className="divide-y divide-navy/[0.07] md:hidden">
                {rows.map((p) => (
                  <li key={p.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setEdit(toDraft(p))}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 ps-4 pe-2 text-start transition-colors duration-150 hover:bg-cream/70 focus-visible:bg-cream focus-visible:outline-none active:bg-cream"
                      aria-label={`تعديل ${p.name}`}
                    >
                      <Thumb p={p} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm text-navy">
                          <span className="truncate">{p.name}</span>
                          <Flags p={p} />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {(p.category_id && catName.get(p.category_id)) || "بدون فئة"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Price p={p} currency={currency} />
                          <StockBadge p={p} />
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-s border-navy/[0.07] px-3">
                      <Switch
                        checked={p.is_published}
                        onCheckedChange={() => toggle(p, "is_published")}
                        aria-label={`نشر ${p.name}`}
                      />
                      <span className="text-[0.65rem] text-muted-foreground">
                        {p.is_published ? "منشور" : "مسودة"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* md and up: table */}
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-navy/[0.03] text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      المنتج
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-normal">
                      السعر
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      المخزون
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-normal">
                      الظهور في المتجر
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">إجراءات</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/[0.07]">
                  {rows.map((p) => (
                    <tr key={p.id} className="transition-colors duration-150 hover:bg-cream/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb p={p} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setEdit(toDraft(p))}
                              className="block max-w-xs truncate rounded-sm text-start text-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                            >
                              {p.name}
                            </button>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {(p.category_id && catName.get(p.category_id)) || "بدون فئة"}
                              {p.sku && (
                                <>
                                  {" · "}
                                  <bdi className="tabular-nums">{p.sku}</bdi>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Price p={p} currency={currency} stacked />
                      </td>
                      <td className="px-4 py-3">
                        <StockBadge p={p} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={p.is_published}
                            onCheckedChange={() => toggle(p, "is_published")}
                            aria-label={`نشر ${p.name}`}
                          />
                          <span className="w-10 text-xs text-muted-foreground">
                            {p.is_published ? "منشور" : "مسودة"}
                          </span>
                          <span className="h-5 w-px bg-navy/10" aria-hidden />
                          <FlagToggle
                            icon={Star}
                            active={p.is_featured}
                            onClick={() => toggle(p, "is_featured")}
                            label={p.is_featured ? "إلغاء التمييز" : "تمييز المنتج"}
                          />
                          <FlagToggle
                            icon={Flame}
                            active={p.is_bestseller}
                            onClick={() => toggle(p, "is_bestseller")}
                            label={
                              p.is_bestseller ? "إزالة من الأكثر مبيعاً" : "إضافة إلى الأكثر مبيعاً"
                            }
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconButton label={`تعديل ${p.name}`} onClick={() => setEdit(toDraft(p))}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={`نسخ ${p.name}`} onClick={() => duplicate(p)}>
                            <Copy className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={`حذف ${p.name}`} danger onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && !saving && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 bg-ivory p-0 sm:max-w-3xl sm:rounded-xl"
        >
          <DialogHeader className="border-b border-navy/10 px-6 py-5 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل المنتج" : "منتج جديد"}
            </DialogTitle>
            {/* Duplicate / delete live here too, so they're reachable on phones */}
            {editing && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => duplicate(editing)}
                  className="h-8 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> نسخ كمنتج جديد
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setToDelete(editing)}
                  className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </Button>
              </div>
            )}
          </DialogHeader>
          {edit && (
            <>
              <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 text-sm">
                <Section title="المعلومات الأساسية">
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
                      placeholder={edit.name ? slugify(edit.name) : "يُنشأ تلقائياً من الاسم"}
                      value={edit.slug ?? ""}
                      onChange={(e) => set({ slug: e.target.value })}
                    />
                  </Field>
                  <Field label="الفئة">
                    <select
                      className={inp}
                      value={edit.category_id ?? ""}
                      onChange={(e) => set({ category_id: e.target.value || null })}
                    >
                      <option value="">بدون فئة</option>
                      {cats?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="SKU">
                    <input
                      className={inp}
                      dir="ltr"
                      value={edit.sku ?? ""}
                      onChange={(e) => set({ sku: e.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="الوصف">
                      <textarea
                        rows={4}
                        className={`${inp} h-auto py-2`}
                        value={edit.description ?? ""}
                        onChange={(e) => set({ description: e.target.value })}
                      />
                    </Field>
                  </div>
                </Section>

                <section>
                  <SectionTitle>الصور</SectionTitle>
                  <ImageUploader
                    folder="products"
                    images={edit.images ?? []}
                    onChange={(update) =>
                      setEdit((d) => ({ ...d, images: update(d?.images ?? []) }))
                    }
                  />
                </section>

                <Section title="التسعير والمخزون">
                  <Field label="السعر *">
                    <NumberInput value={edit.price} onChange={(price) => set({ price })} min={0} />
                  </Field>
                  <Field label="سعر العرض">
                    <NumberInput
                      value={edit.sale_price}
                      onChange={(sale_price) => set({ sale_price })}
                      min={0}
                      placeholder="اختياري"
                    />
                    {edit.price != null &&
                      edit.sale_price != null &&
                      edit.sale_price < edit.price && (
                        <span className="mt-1 block text-xs text-navy">
                          خصم{" "}
                          <span className="tabular-nums">
                            {Math.round((1 - edit.sale_price / edit.price) * 100)}٪
                          </span>
                        </span>
                      )}
                  </Field>
                  <Field label="المخزون">
                    <NumberInput
                      value={edit.stock}
                      onChange={(v) => set({ stock: v ?? 0 })}
                      min={0}
                      step={1}
                    />
                  </Field>
                  <Field label="التوفر">
                    <select
                      className={inp}
                      value={edit.availability}
                      onChange={(e) => set({ availability: e.target.value })}
                    >
                      {Object.entries(availabilityLabel).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </Section>

                <section>
                  <SectionTitle>المقاسات</SectionTitle>
                  <SizesEditor
                    sizes={edit.sizes ?? []}
                    onChange={(sizes) => set({ sizes })}
                    basePrice={
                      edit.sale_price != null && edit.price != null && edit.sale_price < edit.price
                        ? edit.sale_price
                        : edit.price
                    }
                  />
                </section>

                <Section title="الأبعاد والخامات" cols={3}>
                  <Field label="العرض (سم)">
                    <NumberInput
                      value={edit.width_cm}
                      onChange={(width_cm) => set({ width_cm })}
                      min={0}
                    />
                  </Field>
                  <Field label="الارتفاع (سم)">
                    <NumberInput
                      value={edit.height_cm}
                      onChange={(height_cm) => set({ height_cm })}
                      min={0}
                    />
                  </Field>
                  <Field label="العمق (سم)">
                    <NumberInput
                      value={edit.depth_cm}
                      onChange={(depth_cm) => set({ depth_cm })}
                      min={0}
                    />
                  </Field>
                  <div className="sm:col-span-3">
                    <Field label="الخامات">
                      <input
                        className={inp}
                        value={edit.materials ?? ""}
                        onChange={(e) => set({ materials: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:col-span-3 sm:grid-cols-2">
                    <Field label="التشطيبات (افصل بينها بفاصلة)">
                      <input
                        className={inp}
                        defaultValue={edit.finishes?.join("، ")}
                        onBlur={(e) => set({ finishes: list(e.target.value.replace(/،/g, ",")) })}
                      />
                    </Field>
                    <Field label="الألوان (افصل بينها بفاصلة)">
                      <input
                        className={inp}
                        defaultValue={edit.colors?.join("، ")}
                        onBlur={(e) => set({ colors: list(e.target.value.replace(/،/g, ",")) })}
                      />
                    </Field>
                  </div>
                </Section>

                <details className="group" open={!!(edit.seo_title || edit.seo_description)}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <SectionTitle>الظهور في جوجل</SectionTitle>
                    <span className="text-xs text-muted-foreground group-open:hidden">
                      اختياري — اضغط للتعديل
                    </span>
                  </summary>
                  <div className="mt-4">
                    <SeoFields
                      title={edit.seo_title ?? ""}
                      description={edit.seo_description ?? ""}
                      onTitle={(seo_title) => set({ seo_title })}
                      onDescription={(seo_description) => set({ seo_description })}
                      fallbackTitle={edit.name ?? ""}
                      fallbackDescription={edit.description ?? ""}
                      path={`/product/${edit.slug?.trim() || slugify(edit.name ?? "")}`}
                    />
                  </div>
                </details>
              </div>

              {/* Sticky footer */}
              <div className="border-t border-navy/10 bg-ivory px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                  <FooterSwitch
                    checked={edit.is_published ?? false}
                    onChange={(v) => set({ is_published: v })}
                    label="منشور"
                  />
                  <FooterSwitch
                    checked={edit.is_featured ?? false}
                    onChange={(v) => set({ is_featured: v })}
                    label="مميز"
                  />
                  <FooterSwitch
                    checked={edit.is_bestseller ?? false}
                    onChange={(v) => set({ is_bestseller: v })}
                    label="الأكثر مبيعاً"
                  />
                  <div className="flex w-full gap-2 sm:ms-auto sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => setEdit(null)}
                      disabled={saving}
                      className="h-10 flex-1 sm:flex-none"
                    >
                      إلغاء
                    </Button>
                    <Button
                      onClick={save}
                      disabled={saving}
                      className="h-10 min-w-32 flex-1 gap-2 sm:flex-none"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {edit.id ? "حفظ التعديلات" : "إضافة المنتج"}
                    </Button>
                  </div>
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
              يُحذف المنتج نهائياً ولا يمكن التراجع. لإخفائه مؤقتاً ألغِ النشر بدلاً من الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف المنتج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  cols = 2,
  children,
}: {
  title: string;
  cols?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className={cn("grid gap-4", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {children}
      </div>
    </section>
  );
}

function Thumb({ p }: { p: Product }) {
  return p.images[0] ? (
    <img
      src={p.images[0]}
      alt=""
      loading="lazy"
      className="h-14 w-11 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-cream text-muted-foreground">
      <ImageOff className="h-4 w-4" />
    </span>
  );
}

function Price({
  p,
  currency,
  stacked,
}: {
  p: Product;
  currency: string | undefined;
  stacked?: boolean;
}) {
  const price = effectivePrice(p);
  const onSale = price < Number(p.price);
  return (
    <span
      className={cn(
        "tabular-nums",
        stacked ? "flex flex-col items-end" : "inline-flex items-baseline gap-2",
      )}
    >
      <span className="text-navy">{formatPrice(price, currency)}</span>
      {onSale && (
        <span className="text-xs text-muted-foreground line-through">
          {formatPrice(Number(p.price), currency)}
        </span>
      )}
    </span>
  );
}

/** Small read-only markers on the phone list (toggles live in the editor there). */
function Flags({ p }: { p: Product }) {
  if (!p.is_featured && !p.is_bestseller) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-gold">
      {p.is_featured && <Star className="h-3.5 w-3.5" fill="currentColor" aria-label="مميز" />}
      {p.is_bestseller && (
        <Flame className="h-3.5 w-3.5" fill="currentColor" aria-label="الأكثر مبيعاً" />
      )}
    </span>
  );
}

function FlagToggle({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold",
        active
          ? "bg-gold/15 text-gold"
          : "text-muted-foreground/50 hover:bg-gold/10 hover:text-gold",
      )}
    >
      <Icon className="h-4 w-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}

function FooterSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-navy">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  ...rest
}: { value: number | null | undefined; onChange: (v: number | null) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      dir="ltr"
      className={cn(inp, "text-end tabular-nums")}
      value={value ?? ""}
      onChange={(e) => onChange(num(e.target.value))}
      {...rest}
    />
  );
}

function StockBadge({ p }: { p: Product }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs whitespace-nowrap";
  const dot = (c: string) => <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", c)} />;
  if (p.availability === "unavailable")
    return (
      <span className={cn(base, "bg-muted text-muted-foreground")}>
        {dot("bg-muted-foreground/60")}غير متوفر
      </span>
    );
  if (p.availability === "made_to_order")
    return <span className={cn(base, "bg-gold/15 text-navy")}>{dot("bg-gold")}حسب الطلب</span>;
  if (p.stock <= 0)
    return (
      <span className={cn(base, "bg-destructive/10 text-destructive")}>
        {dot("bg-destructive")}نفد المخزون
      </span>
    );
  const low = p.stock <= LOW_STOCK;
  return (
    <span
      className={cn(base, low ? "bg-destructive/10 text-destructive" : "bg-navy/[0.06] text-navy")}
    >
      {dot(low ? "bg-destructive" : "bg-navy/60")}
      <span className="tabular-nums">{count.format(p.stock)}</span> قطعة
    </span>
  );
}

/** Size options editor: label + optional price (empty = the product's price). */
function SizesEditor({
  sizes,
  onChange,
  basePrice,
}: {
  sizes: SizeOption[];
  onChange: (sizes: SizeOption[]) => void;
  basePrice: number | null | undefined;
}) {
  const update = (i: number, patch: Partial<SizeOption>) =>
    onChange(sizes.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sizes.length) return;
    const next = [...sizes];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const labels = sizes.map((s) => s.label.trim());
  const duplicate = (i: number) => !!labels[i] && labels.indexOf(labels[i]!) !== i;

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        اختياري. عند إضافة مقاسات يختار العميل مقاساً قبل الإضافة للسلة. اترك السعر فارغاً ليُستخدم
        سعر المنتج{basePrice ? ` (${basePrice})` : ""}.
      </p>
      {sizes.length > 0 && (
        <ul className="mb-3 space-y-2">
          {sizes.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="mt-1 flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`تقديم المقاس ${i + 1}`}
                  className="flex h-5 w-8 items-center justify-center rounded text-muted-foreground hover:bg-navy/5 hover:text-navy disabled:opacity-25"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === sizes.length - 1}
                  aria-label={`تأخير المقاس ${i + 1}`}
                  className="flex h-5 w-8 items-center justify-center rounded text-muted-foreground hover:bg-navy/5 hover:text-navy disabled:opacity-25"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="grid flex-1 grid-cols-[1fr_8.5rem] gap-2">
                <div>
                  <input
                    className={cn(
                      inp,
                      (duplicate(i) || !s.label.trim()) && "border-destructive/60",
                    )}
                    value={s.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    placeholder="مثال: ١٦٠×٢٠٠ سم"
                    maxLength={60}
                    aria-label={`اسم المقاس ${i + 1}`}
                    aria-invalid={duplicate(i) || !s.label.trim()}
                  />
                  {duplicate(i) && (
                    <span className="mt-1 block text-xs text-destructive">مقاس مكرر</span>
                  )}
                </div>
                <NumberInput
                  value={s.price}
                  onChange={(price) => update(i, { price })}
                  min={0}
                  placeholder="سعر المنتج"
                  aria-label={`سعر المقاس ${i + 1}`}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(sizes.filter((_, j) => j !== i))}
                aria-label={`حذف المقاس ${i + 1}`}
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...sizes, { label: "", price: null }])}
        className="h-10 gap-2"
      >
        <Ruler className="h-4 w-4" /> إضافة مقاس
      </Button>
    </div>
  );
}
