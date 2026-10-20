import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  FileCode2,
  Globe,
  ImageIcon,
  ListChecks,
  TriangleAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import {
  DEFAULT_SEO,
  extractVerification,
  normalizeOrigin,
  parseSeo,
  seoIssues,
  storeName,
  type SeoSettings,
} from "@/lib/seo";
import { cn } from "@/lib/utils";
import { SingleImageUpload } from "@/components/SingleImageUpload";
import { SeoFields } from "@/components/admin/SeoFields";
import {
  adminNum,
  Badge,
  Field,
  FormCard,
  inp,
  PageHeader,
  Panel,
  SaveBar,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/seo")({ component: SeoPage });

const AUDIT_KEY = ["admin", "seo-audit"] as const;

function SeoPage() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const saved = useMemo(() => parseSeo(s?.seo), [s?.seo]);
  const [d, setD] = useState<SeoSettings>(DEFAULT_SEO);
  const [saving, setSaving] = useState(false);
  useEffect(() => setD(saved), [saved]);

  const audit = useQuery({
    queryKey: AUDIT_KEY,
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, description, images, seo_title, seo_description")
          .eq("is_published", true),
        supabase
          .from("categories")
          .select("id, name, slug, description, image_url, seo_description")
          .eq("is_active", true),
      ]);
      if (p.error) throw p.error;
      if (c.error) throw c.error;
      return { products: p.data, categories: c.data };
    },
  });

  const issues = useMemo(() => {
    if (!audit.data) return [];
    const list = seoIssues(audit.data.products, audit.data.categories);
    // Invisible characters in a link break sharing and show up as %E2%81%A0 in Google
    for (const c of audit.data.categories)
      if (/[\u200B-\u200F\u2060\uFEFF]/.test(c.slug))
        list.unshift({
          kind: "category",
          id: c.id,
          name: c.name,
          problem: "الرابط يحتوي على رمز مخفي",
          severity: "high",
        });
    return list;
  }, [audit.data]);

  const total = (audit.data?.products.length ?? 0) + (audit.data?.categories.length ?? 0);
  const withIssue = new Set(issues.filter((i) => i.severity === "high").map((i) => i.id)).size;
  const ready = total ? Math.round(((total - withIssue) / total) * 100) : 100;

  const store = storeName(s);
  const origin = d.siteUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = (patch: Partial<SeoSettings>) => setD((x) => ({ ...x, ...patch }));

  const save = async () => {
    if (saving) return;
    const siteUrl = normalizeOrigin(d.siteUrl);
    if (d.siteUrl.trim() && !siteUrl) return void toast.error("رابط الموقع غير صحيح");
    if (!/\{title\}/.test(d.titleTemplate))
      return void toast.error("قالب العنوان يجب أن يحتوي على {title}");
    setSaving(true);
    const next: SeoSettings = {
      ...d,
      siteUrl,
      homeTitle: d.homeTitle.trim(),
      homeDescription: d.homeDescription.trim(),
      googleVerification: extractVerification(d.googleVerification),
    };
    const { error } = await supabase.from("store_settings").update({ seo: next }).eq("id", 1);
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ إعدادات الظهور");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  if (!s) {
    return (
      <div className="max-w-5xl space-y-6" aria-busy="true" aria-label="جارٍ التحميل">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-ivory" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl bg-ivory" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl pb-28">
      <PageHeader
        title="تحسين الظهور"
        meta="كيف يظهر المتجر في جوجل وعند مشاركة الروابط في واتساب ووسائل التواصل."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <FormCard
            title="الموقع"
            description="رابط الموقع يُستخدم في خريطة الموقع والروابط الأساسية وصور المشاركة."
          >
            <div className="grid gap-4">
              <Field label="رابط الموقع">
                <div className="relative" dir="ltr">
                  <Globe className="pointer-events-none absolute top-1/2 left-3 mt-0.75 h-4 w-4 -translate-y-1/2 text-gold" />
                  <input
                    className={cn(inp, "pl-9")}
                    placeholder="https://taraf.sa"
                    value={d.siteUrl}
                    onChange={(e) => set({ siteUrl: e.target.value })}
                  />
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {d.siteUrl
                    ? "الدومين الرسمي للمتجر."
                    : `غير محدد — يُستخدم حالياً ${origin || "رابط الاستضافة"}. حدّده بعد ربط الدومين الخاص بك.`}
                </span>
              </Field>
              <Field label="قالب عنوان الصفحات">
                <input
                  className={inp}
                  dir="ltr"
                  value={d.titleTemplate}
                  onChange={(e) => set({ titleTemplate: e.target.value })}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  مثال:{" "}
                  <span dir="ltr">
                    {d.titleTemplate.replace("{title}", "كنبة ميلانو").replace("{store}", store)}
                  </span>
                </span>
              </Field>
              <Field label="كود التحقق من Google Search Console">
                <input
                  className={inp}
                  dir="ltr"
                  placeholder='<meta name="google-site-verification" content="…">'
                  value={d.googleVerification}
                  onChange={(e) => set({ googleVerification: e.target.value })}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  الصق الوسم كاملاً أو الكود فقط، من طريقة التحقق «HTML tag».
                </span>
              </Field>
            </div>
          </FormCard>

          <FormCard
            title="الصفحة الرئيسية"
            description="العنوان والوصف اللذان يظهران في نتائج البحث للصفحة الرئيسية."
          >
            <SeoFields
              rawTitle
              title={d.homeTitle}
              description={d.homeDescription}
              onTitle={(homeTitle) => set({ homeTitle })}
              onDescription={(homeDescription) => set({ homeDescription })}
              fallbackTitle={`${store} — ${s.hero_title || "أناقة خالدة تُصاغ بالحرفة"}`}
              fallbackDescription={s.hero_subtitle ?? ""}
              path="/"
            />
          </FormCard>

          <FormCard
            title="صورة المشاركة"
            description="تظهر عند مشاركة رابط الصفحة الرئيسية. صفحات المنتجات تستخدم صورة المنتج تلقائياً."
          >
            <SingleImageUpload
              label="صورة المشاركة"
              folder="seo"
              url={d.shareImage || null}
              onChange={(url) => set({ shareImage: url ?? "" })}
              className="aspect-[1200/630] rounded-lg"
              emptyTitle="اختر صورة بمقاس 1200×630"
              emptyHint="بدونها تُستخدم صورة واجهة الصفحة الرئيسية"
            />
          </FormCard>
        </div>

        <div className="space-y-6">
          <Panel title="فحص الموقع" icon={ListChecks}>
            {audit.isLoading ? (
              <div className="space-y-3" aria-busy="true">
                <div className="h-4 w-2/3 animate-pulse rounded bg-cream" />
                <div className="h-2 animate-pulse rounded bg-cream" />
                <div className="h-24 animate-pulse rounded bg-cream" />
              </div>
            ) : audit.isError ? (
              <p className="text-sm text-destructive">تعذر تحميل الفحص.</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-navy">
                    <span className="font-display text-3xl tabular-nums">
                      {adminNum.format(ready)}٪
                    </span>{" "}
                    من الصفحات جاهزة
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {adminNum.format(total)} صفحة
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      ready === 100 ? "bg-emerald-600" : "bg-gold",
                    )}
                    style={{ width: `${ready}%` }}
                  />
                </div>
                {issues.length === 0 ? (
                  <p className="mt-5 flex items-center gap-2 text-sm text-navy">
                    <CircleCheck className="h-4 w-4 text-emerald-600" /> كل المنتجات والفئات مكتملة.
                  </p>
                ) : (
                  <ul className="mt-5 max-h-[26rem] divide-y divide-navy/10 overflow-y-auto">
                    {issues.map((i, n) => (
                      <li
                        key={`${i.id}-${i.problem}-${n}`}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <TriangleAlert
                          className={cn(
                            "h-4 w-4 shrink-0",
                            i.severity === "high" ? "text-[#b45309]" : "text-muted-foreground",
                          )}
                          aria-label={i.severity === "high" ? "مهم" : "تحسين"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-navy">{i.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.kind === "product" ? "منتج" : "فئة"} · {i.problem}
                          </p>
                        </div>
                        <Link
                          to={i.kind === "product" ? "/admin/products" : "/admin/categories"}
                          search={{ edit: i.id }}
                          className="shrink-0 rounded-md px-2 py-1 text-xs text-navy underline decoration-gold underline-offset-4 hover:bg-cream"
                        >
                          تعديل
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>

          <Panel title="الملفات التلقائية" icon={FileCode2}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              تُحدَّث تلقائياً عند إضافة أو تعديل المنتجات، ولا تحتاج أي إجراء.
            </p>
            <div className="mt-4 space-y-2">
              <CopyRow label="خريطة الموقع" url={`${origin}/sitemap.xml`} />
              <CopyRow label="robots.txt" url={`${origin}/robots.txt`} />
            </div>
          </Panel>

          <Panel title="خطوات بعد الحفظ" icon={ImageIcon}>
            <ol className="space-y-3 text-sm text-navy">
              <Step done={!!saved.siteUrl}>حدّد رابط الموقع الرسمي.</Step>
              <Step done={!!saved.googleVerification}>
                سجّل الموقع في{" "}
                <ExtLink href="https://search.google.com/search-console">
                  Google Search Console
                </ExtLink>{" "}
                والصق كود التحقق هنا.
              </Step>
              <Step done={false}>أضف رابط خريطة الموقع في Search Console ← Sitemaps.</Step>
              <Step done={false}>
                اختبر صفحة منتج في{" "}
                <ExtLink href="https://search.google.com/test/rich-results">
                  اختبار النتائج المنسّقة
                </ExtLink>
                .
              </Step>
            </ol>
          </Panel>
        </div>
      </div>

      <SaveBar visible={dirty} saving={saving} onSave={save} onReset={() => setD(saved)} />
    </div>
  );
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("تعذر النسخ");
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-navy/10 bg-cream/60 p-2 ps-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm text-navy" dir="ltr">
          {url}
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`فتح ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-ivory hover:text-navy"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={`نسخ رابط ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-ivory hover:text-navy"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      {done ? (
        <Badge tone="gold">تم</Badge>
      ) : (
        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-navy/30" />
      )}
      <span className={cn("leading-relaxed", done && "text-muted-foreground")}>{children}</span>
    </li>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-gold underline-offset-4 hover:decoration-navy"
    >
      {children}
    </a>
  );
}
