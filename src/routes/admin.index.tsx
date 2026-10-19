import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
  ImageOff,
  Package,
  PackageX,
  Plus,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/data";
import { effectivePrice, formatPrice, LOW_STOCK } from "@/lib/format";
import { orderStatusLabel, STOCK_HOLDING } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SiteTrafficPanel } from "@/components/SiteTrafficPanel";

export const Route = createFileRoute("/admin/")({ component: Overview });

const dateFmt = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" });

function Overview() {
  const { data: settings } = useQuery(settingsQuery);
  const { data, isLoading, isError, refetch } = useQuery({
    // Key changed with the query's shape so stale cache entries from the old selection are never reused
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [
        { data: products, error },
        { data: cats, error: e2 },
        { data: recentOrders, error: e3 },
        { data: monthOrders, error: e4 },
        { count: newOrders, error: e5 },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,images,price,sale_price,is_published,stock,availability,category_id,created_at",
          )
          .order("created_at", { ascending: false })
          .order("id"),
        supabase
          .from("categories")
          .select("id,name,image_url,is_active")
          .order("sort_order")
          .order("name"),
        supabase
          .from("orders")
          .select("id,order_number,customer_name,city,total,currency,status,created_at")
          .order("created_at", { ascending: false })
          .order("id")
          .limit(6),
        supabase.from("orders").select("total,status").gte("created_at", monthStart.toISOString()),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      const firstError = error ?? e2 ?? e3 ?? e4 ?? e5;
      if (firstError) throw firstError;
      return {
        products: products ?? [],
        cats: cats ?? [],
        recentOrders: recentOrders ?? [],
        monthOrders: monthOrders ?? [],
        newOrders: newOrders ?? 0,
      };
    },
  });

  if (isError) {
    return (
      <div className="bg-ivory p-10 text-center text-sm text-muted-foreground">
        تعذر تحميل البيانات.{" "}
        <button onClick={() => refetch()} className="text-navy underline hover:text-gold">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const p = data?.products ?? [];
  const cats = data?.cats ?? [];
  const published = p.filter((x) => x.is_published);
  const inStock = p.filter((x) => x.availability === "in_stock");
  const soldOut = inStock.filter((x) => x.stock <= 0);
  const lowStock = inStock.filter((x) => x.stock > 0 && x.stock <= LOW_STOCK);
  const noImages = p.filter((x) => !x.images?.length);
  const drafts = p.filter((x) => !x.is_published);
  const countByCat = new Map<string, number>();
  for (const x of p)
    if (x.category_id) countByCat.set(x.category_id, (countByCat.get(x.category_id) ?? 0) + 1);
  const uncategorized = p.filter((x) => !x.category_id).length;
  const newOrders = data?.newOrders ?? 0;
  const recentOrders = data?.recentOrders ?? [];
  // Sales = orders confirmed (or further) this month; new and cancelled orders don't count
  const monthSales = (data?.monthOrders ?? []).filter((o) => STOCK_HOLDING.includes(o.status));
  const monthRevenue = monthSales.reduce((s, o) => s + Number(o.total), 0);

  const stats = [
    {
      label: "طلبات جديدة",
      value: newOrders,
      sub: "بانتظار التأكيد",
      Icon: ClipboardList,
      to: "/admin/orders",
    },
    {
      label: "مبيعات الشهر",
      value: formatPrice(monthRevenue, settings?.currency),
      sub: `${monthSales.length} طلب مؤكد`,
      Icon: TrendingUp,
      to: "/admin/orders",
    },
    {
      label: "منتجات منشورة",
      value: published.length,
      sub: `من ${p.length} · ${drafts.length} مسودة`,
      Icon: Package,
      to: "/admin/products",
    },
    {
      label: "نفد أو منخفض",
      value: soldOut.length + lowStock.length,
      sub: `المخزون ≤ ${LOW_STOCK}`,
      Icon: PackageX,
      to: "/admin/products",
      alert: soldOut.length + lowStock.length > 0,
    },
  ] as const;

  const attention = [
    ...soldOut.map((x) => ({
      id: x.id,
      name: x.name,
      note: "نفد المخزون",
      tone: "danger" as const,
    })),
    ...lowStock.map((x) => ({
      id: x.id,
      name: x.name,
      note: `متبقٍ ${x.stock}`,
      tone: "danger" as const,
    })),
    ...noImages.map((x) => ({ id: x.id, name: x.name, note: "بدون صور", tone: "warn" as const })),
  ];

  const checklist = [
    {
      done: !!settings?.whatsapp_number,
      label: "رقم واتساب لاستقبال الطلبات",
      to: "/admin/settings",
    },
    { done: !!settings?.hero_image_url, label: "صورة الواجهة الرئيسية", to: "/admin/settings" },
    {
      done: !!(
        settings?.instagram_url ||
        settings?.facebook_url ||
        settings?.snapchat_url ||
        settings?.twitter_url
      ),
      label: "رابط حساب تواصل اجتماعي واحد على الأقل",
      to: "/admin/settings",
    },
    {
      done: cats.length > 0 && cats.every((c) => c.image_url),
      label: "صور لكل الفئات",
      to: "/admin/categories",
    },
    { done: published.length > 0, label: "منتج منشور واحد على الأقل", to: "/admin/products" },
  ] as const;
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">نظرة عامة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("ar-EG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> عرض المتجر
            </a>
          </Button>
          <Button asChild className="gap-2">
            <Link to="/admin/products">
              <Plus className="h-4 w-4" /> إدارة المنتجات
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={cn(
              "group border-t-2 bg-ivory p-5 transition-colors hover:bg-cream",
              "alert" in s && s.alert ? "border-destructive" : "border-gold",
            )}
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <s.Icon
                className={cn(
                  "h-5 w-5",
                  "alert" in s && s.alert ? "text-destructive" : "text-gold",
                )}
              />
            </div>
            {isLoading ? (
              <div className="mt-3 h-9 w-16 animate-pulse bg-cream" />
            ) : (
              <p
                className={cn(
                  "mt-2 font-display text-navy",
                  typeof s.value === "number" ? "text-4xl" : "text-2xl leading-[2.25rem]",
                )}
              >
                {s.value}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </Link>
        ))}
      </div>

      <SiteTrafficPanel />

      <div className="mt-6 grid gap-6 lg:grid-flow-dense lg:grid-cols-3">
        {/* Needs attention */}
        <Panel
          title="يحتاج انتباهك"
          className="lg:col-span-2"
          action={<PanelLink to="/admin/products">المنتجات</PanelLink>}
        >
          {isLoading ? (
            <Skeleton rows={4} />
          ) : attention.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-gold" /> كل المنتجات بحالة جيدة: المخزون كافٍ
              ولكل منتج صور.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {attention.slice(0, 8).map((a) => (
                <li
                  key={`${a.id}-${a.note}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {a.tone === "danger" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <ImageOff className="h-4 w-4 shrink-0 text-gold" />
                    )}
                    <span className="truncate text-navy">{a.name}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 text-xs",
                      a.tone === "danger"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-gold/15 text-navy",
                    )}
                  >
                    {a.note}
                  </span>
                </li>
              ))}
              {attention.length > 8 && (
                <li className="pt-2.5 text-xs text-muted-foreground">
                  و{attention.length - 8} عناصر أخرى
                </li>
              )}
            </ul>
          )}
        </Panel>

        {/* Store readiness */}
        <Panel
          title="جاهزية المتجر"
          action={
            <span className="text-xs text-muted-foreground">
              {doneCount}/{checklist.length}
            </span>
          }
        >
          <div className="mb-4 h-1 bg-cream">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${(doneCount / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-1 text-sm">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  to={c.to}
                  className={cn(
                    "flex items-start gap-2 py-1.5 transition-colors",
                    c.done ? "text-muted-foreground" : "text-navy hover:text-gold",
                  )}
                >
                  {c.done ? (
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-gold" />
                  ) : (
                    <Circle className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={cn(c.done && "line-through decoration-gold/40")}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Recent orders */}
        <Panel
          title="أحدث الطلبات"
          className="lg:col-span-2"
          action={<PanelLink to="/admin/orders">كل الطلبات</PanelLink>}
        >
          {isLoading ? (
            <Skeleton rows={4} />
          ) : recentOrders.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              لا توجد طلبات بعد. ستظهر هنا فور إرسال العملاء طلباتهم من الموقع.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-navy">
                      <span dir="ltr">{o.order_number}</span> · {o.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.city} · {dateFmt.format(new Date(o.created_at))}
                    </p>
                  </div>
                  <span className="hidden whitespace-nowrap text-navy sm:inline">
                    {formatPrice(Number(o.total), o.currency)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 text-center text-xs",
                      o.status === "new"
                        ? "bg-gold/20 text-navy"
                        : o.status === "cancelled"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-navy/5 text-navy",
                    )}
                  >
                    {orderStatusLabel[o.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent products */}
        <Panel
          title="أحدث المنتجات"
          className="lg:col-span-3"
          action={<PanelLink to="/admin/products">عرض الكل</PanelLink>}
        >
          {isLoading ? (
            <Skeleton rows={5} />
          ) : p.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">لا توجد منتجات بعد.</p>
          ) : (
            <ul className="divide-y text-sm">
              {p.slice(0, 6).map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5">
                  {x.images?.[0] ? (
                    <img src={x.images[0]} alt="" className="h-11 w-9 shrink-0 object-cover" />
                  ) : (
                    <span className="flex h-11 w-9 shrink-0 items-center justify-center bg-cream text-muted-foreground">
                      <ImageOff className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-navy">{x.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(x.created_at))}
                    </p>
                  </div>
                  <span className="hidden whitespace-nowrap text-navy sm:inline">
                    {formatPrice(effectivePrice(x), settings?.currency)}
                  </span>
                  <span
                    className={cn(
                      "w-14 shrink-0 px-2 py-0.5 text-center text-xs",
                      x.is_published ? "bg-navy/5 text-navy" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {x.is_published ? "منشور" : "مسودة"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* By category */}
        <Panel
          title="المنتجات حسب الفئة"
          action={<PanelLink to="/admin/categories">الفئات</PanelLink>}
        >
          {isLoading ? (
            <Skeleton rows={4} />
          ) : (
            <ul className="divide-y text-sm">
              {cats.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <span
                    className={cn("truncate", c.is_active ? "text-navy" : "text-muted-foreground")}
                  >
                    {c.name}
                    {!c.is_active && <span className="ms-2 text-xs">(مخفية)</span>}
                  </span>
                  <span className="text-muted-foreground">{countByCat.get(c.id) ?? 0}</span>
                </li>
              ))}
              {uncategorized > 0 && (
                <li className="flex items-center justify-between py-2.5 text-muted-foreground">
                  <span>بدون فئة</span>
                  <span>{uncategorized}</span>
                </li>
              )}
              {cats.length === 0 && uncategorized === 0 && (
                <li className="py-6 text-muted-foreground">لا توجد فئات بعد.</li>
              )}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-ivory p-5", className)}>
      <div className="mb-3 flex items-center justify-between border-b hairline pb-3">
        <h2 className="text-lg text-navy">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({
  to,
  children,
}: {
  to: "/admin/products" | "/admin/categories" | "/admin/orders";
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs text-gold hover:text-navy">
      {children} <ArrowLeft className="h-3 w-3" />
    </Link>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 animate-pulse bg-cream" />
      ))}
    </div>
  );
}
