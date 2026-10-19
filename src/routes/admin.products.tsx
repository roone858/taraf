import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ImageOff, Loader2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Product } from "@/lib/data";
import { availabilityLabel, effectivePrice, formatPrice, LOW_STOCK, slugify } from "@/lib/format";
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
import { Field, inp } from "./admin.categories";

export const Route = createFileRoute("/admin/products")({ component: Products });

/** Form state: price may be empty while editing. */
type Draft = Omit<Partial<Product>, "price"> & { price?: number | null };
type StatusFilter = "all" | "published" | "draft";

const PRODUCTS_KEY = ["admin", "products"] as const;
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
  is_published: false,
  is_featured: false,
});

function validate(d: Draft): string | null {
  if (!d.name?.trim()) return "اسم المنتج مطلوب";
  if (d.price == null || d.price <= 0) return "أدخل سعراً صحيحاً أكبر من صفر";
  if (d.sale_price != null && (d.sale_price <= 0 || d.sale_price >= d.price))
    return "سعر العرض يجب أن يكون أقل من السعر الأصلي";
  if (d.stock != null && (d.stock < 0 || !Number.isInteger(d.stock)))
    return "المخزون يجب أن يكون عدداً صحيحاً غير سالب";
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
  const { data, isLoading, isError, refetch } = useQuery({
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
  const stats = {
    total: all.length,
    published: all.filter((p) => p.is_published).length,
    lowStock: all.filter((p) => p.availability === "in_stock" && p.stock <= LOW_STOCK).length,
  };
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!term ||
          p.name.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.slug.includes(term)) &&
        (!cat || (cat === "none" ? !p.category_id : p.category_id === cat)) &&
        (status === "all" || (status === "published") === p.is_published),
    );
  }, [all, q, cat, status]);

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
      is_published: edit.is_published ?? false,
      is_featured: edit.is_featured ?? false,
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
    setToDelete(null);
    refresh();
  };

  /** Optimistic toggle of a boolean flag; reverts via refetch on failure. */
  const toggle = async (p: Product, field: "is_published" | "is_featured") => {
    const value = !p[field];
    qc.setQueryData<Product[]>(PRODUCTS_KEY, (old) =>
      old?.map((x) => (x.id === p.id ? { ...x, [field]: value } : x)),
    );
    const { error } = await supabase
      .from("products")
      .update(field === "is_published" ? { is_published: value } : { is_featured: value })
      .eq("id", p.id);
    if (error) toast.error("تعذر تحديث المنتج");
    refresh();
  };

  const duplicate = (p: Product) => {
    const { id: _id, created_at: _c, updated_at: _u, slug: _s, ...rest } = p;
    setEdit({ ...rest, name: `${p.name} (نسخة)`, is_published: false });
  };

  const set = (patch: Draft) => setEdit((d) => ({ ...d, ...patch }));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">المنتجات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total} منتج · {stats.published} منشور · {stats.total - stats.published} مسودة
            {stats.lowStock > 0 && (
              <span className="text-destructive"> · {stats.lowStock} مخزون منخفض</span>
            )}
          </p>
        </div>
        <Button onClick={() => setEdit(blank())} className="gap-2">
          <Plus className="h-4 w-4" /> منتج جديد
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 bg-ivory p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="بحث بالاسم أو SKU"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(inp, "mt-0 ps-9")}
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className={cn(inp, "mt-0 w-auto min-w-[10rem]")}
          aria-label="الفئة"
        >
          <option value="">كل الفئات</option>
          {cats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">بدون فئة</option>
        </select>
        <div className="flex border bg-cream text-sm" role="group" aria-label="الحالة">
          {(
            [
              ["all", "الكل"],
              ["published", "منشور"],
              ["draft", "مسودة"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setStatus(v)}
              className={cn(
                "h-10 px-4 transition-colors",
                status === v ? "bg-navy text-cream" : "text-navy hover:bg-gold/15",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto bg-ivory">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-normal">المنتج</th>
              <th className="p-3 text-start font-normal">السعر</th>
              <th className="p-3 text-start font-normal">المخزون</th>
              <th className="p-3 text-center font-normal">مميز</th>
              <th className="p-3 text-center font-normal">منشور</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading &&
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-3">
                    <div className="h-12 animate-pulse bg-cream" />
                  </td>
                </tr>
              ))}
            {isError && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  تعذر تحميل المنتجات.{" "}
                  <button onClick={() => refetch()} className="text-navy underline hover:text-gold">
                    إعادة المحاولة
                  </button>
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {all.length === 0
                    ? "لا توجد منتجات بعد. ابدأ بإضافة أول منتج."
                    : "لا توجد نتائج مطابقة للبحث أو الفلاتر."}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const price = effectivePrice(p);
              const onSale = price < Number(p.price);
              return (
                <tr key={p.id} className="transition-colors hover:bg-cream/60">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt="" className="h-14 w-11 shrink-0 object-cover" />
                      ) : (
                        <span className="flex h-14 w-11 shrink-0 items-center justify-center bg-cream text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <button
                          onClick={() => setEdit(p)}
                          className="block truncate text-start text-navy hover:text-gold"
                        >
                          {p.name}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          {(p.category_id && catName.get(p.category_id)) || "بدون فئة"}
                          {p.sku && <span dir="ltr"> · {p.sku}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <span className="text-navy">{formatPrice(price, currency)}</span>
                    {onSale && (
                      <span className="ms-2 text-xs text-muted-foreground line-through">
                        {formatPrice(Number(p.price), currency)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <StockBadge p={p} />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggle(p, "is_featured")}
                      aria-label={p.is_featured ? "إلغاء التمييز" : "تمييز"}
                      title={p.is_featured ? "إلغاء التمييز" : "تمييز"}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center",
                        p.is_featured ? "text-gold" : "text-muted-foreground/40 hover:text-gold",
                      )}
                    >
                      <Star className="h-4 w-4" fill={p.is_featured ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={p.is_published}
                      onCheckedChange={() => toggle(p, "is_published")}
                      aria-label="منشور"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <IconBtn label="تعديل" onClick={() => setEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="نسخ" onClick={() => duplicate(p)}>
                        <Copy className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="حذف" danger onClick={() => setToDelete(p)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && !saving && setEdit(null)}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[92vh] flex-col gap-0 bg-ivory p-0 sm:max-w-3xl"
        >
          <DialogHeader className="border-b px-6 py-4 text-start">
            <DialogTitle className="font-display text-2xl text-navy">
              {edit?.id ? "تعديل المنتج" : "منتج جديد"}
            </DialogTitle>
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
                        <span className="mt-1 block text-xs text-gold">
                          خصم {Math.round((1 - edit.sale_price / edit.price) * 100)}%
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
                  <Field label="الحالة">
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
                  <div className="sm:col-span-3 grid gap-4 sm:grid-cols-2">
                    <Field label="التشطيبات (مفصولة بفاصلة)">
                      <input
                        className={inp}
                        defaultValue={edit.finishes?.join("، ")}
                        onBlur={(e) => set({ finishes: list(e.target.value.replace(/،/g, ",")) })}
                      />
                    </Field>
                    <Field label="الألوان (مفصولة بفاصلة)">
                      <input
                        className={inp}
                        defaultValue={edit.colors?.join("، ")}
                        onBlur={(e) => set({ colors: list(e.target.value.replace(/،/g, ",")) })}
                      />
                    </Field>
                  </div>
                </Section>

                <section>
                  <ImageUploader
                    folder="products"
                    images={edit.images ?? []}
                    onChange={(update) =>
                      setEdit((d) => ({ ...d, images: update(d?.images ?? []) }))
                    }
                  />
                </section>
              </div>

              {/* Sticky footer */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t bg-ivory px-6 py-4 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={edit.is_published ?? false}
                    onCheckedChange={(v) => set({ is_published: v })}
                  />{" "}
                  منشور
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={edit.is_featured ?? false}
                    onCheckedChange={(v) => set({ is_featured: v })}
                  />{" "}
                  مميز
                </label>
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
                    إلغاء
                  </Button>
                  <Button onClick={save} disabled={saving} className="min-w-28 gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {edit.id ? "حفظ التعديلات" : "إضافة المنتج"}
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
            <AlertDialogTitle>حذف المنتج؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{toDelete?.name}» نهائياً ولا يمكن التراجع. لإخفائه مؤقتاً يمكنك إلغاء النشر
              بدلاً من الحذف.
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
      <h3 className="eyebrow mb-4 border-b hairline pb-2 font-sans">{title}</h3>
      <div className={cn("grid gap-4", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {children}
      </div>
    </section>
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
      className={cn(inp, "text-end")}
      value={value ?? ""}
      onChange={(e) => onChange(num(e.target.value))}
      {...rest}
    />
  );
}

function StockBadge({ p }: { p: Product }) {
  if (p.availability === "unavailable")
    return <span className="bg-muted px-2 py-0.5 text-xs text-muted-foreground">غير متوفر</span>;
  if (p.availability === "made_to_order")
    return <span className="bg-gold/15 px-2 py-0.5 text-xs text-navy">حسب الطلب</span>;
  if (p.stock <= 0)
    return (
      <span className="bg-destructive/10 px-2 py-0.5 text-xs text-destructive">نفد المخزون</span>
    );
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-xs",
        p.stock <= LOW_STOCK ? "bg-destructive/10 text-destructive" : "bg-navy/5 text-navy",
      )}
    >
      {p.stock} قطعة
    </span>
  );
}

function IconBtn({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors",
        danger
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-gold/15 hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}
