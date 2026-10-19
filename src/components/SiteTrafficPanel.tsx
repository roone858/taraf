import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  Facebook,
  FileText,
  Globe,
  Globe2,
  Home,
  Instagram,
  Layers,
  Link2,
  Loader2,
  Minus,
  Monitor,
  MonitorSmartphone,
  Package,
  Search,
  Share2,
  ShoppingBag,
  Smartphone,
  Store,
  Tablet,
  TrendingUp,
  Twitter,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getSiteAnalytics,
  type AnalyticsRange,
  type SiteAnalytics,
  type TopItem,
} from "@/lib/site-analytics";
import { flag, mergeByLabel, pageLabel, percentChange, sourceLabel } from "@/lib/analytics-labels";
import { cn } from "@/lib/utils";
import { SnapchatIcon, WhatsappIcon } from "./BrandIcons";

const num = new Intl.NumberFormat("ar-EG");
const dec = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });
const dayFmt = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDayFmt = new Intl.DateTimeFormat("ar-EG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const regionName = (() => {
  try {
    return new Intl.DisplayNames(["ar"], { type: "region" });
  } catch {
    return null;
  }
})();

const RANGES: { days: AnalyticsRange; label: string; previous: string }[] = [
  { days: 7, label: "٧ أيام", previous: "الأسبوع السابق" },
  { days: 30, label: "٣٠ يوماً", previous: "الشهر السابق" },
  { days: 90, label: "٩٠ يوماً", previous: "الفترة السابقة" },
];
const DEVICE: Record<string, string> = { desktop: "كمبيوتر", mobile: "موبايل", tablet: "تابلت" };
const countryLabel = (c: string) => (c === "—" ? "غير معروف" : (regionName?.of(c) ?? c));
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

type IconLike = LucideIcon | ((p: { className?: string }) => React.ReactElement);
type Row = TopItem & { icon?: IconLike; emoji?: string };
type Ok = Extract<SiteAnalytics, { status: "ok" }>;

const SOURCE_ICONS: Record<string, IconLike> = {
  إنستجرام: Instagram,
  فيسبوك: Facebook,
  واتساب: WhatsappIcon,
  "سناب شات": SnapchatIcon,
  X: Twitter,
  جوجل: Search,
  "دخول مباشر": Link2,
};
const DEVICE_ICONS: Record<string, IconLike> = {
  كمبيوتر: Monitor,
  موبايل: Smartphone,
  تابلت: Tablet,
};
const PAGE_ICONS: Record<string, IconLike> = {
  "الصفحة الرئيسية": Home,
  المتجر: Store,
  "إتمام الطلب": ShoppingBag,
};

/** Admin «الزيارات» page: KPI cards, daily trend and four breakdowns from Vercel Web Analytics. */
export function SiteTrafficPanel({ className }: { className?: string }) {
  const [days, setDays] = useState<AnalyticsRange>(7);
  const range = RANGES.find((r) => r.days === days)!;
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "site-analytics", days],
    queryFn: () => getSiteAnalytics({ data: { days } }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-full border border-navy/10 bg-ivory p-1 text-sm shadow-sm"
          role="group"
          aria-label="الفترة"
        >
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={cn(
                "h-9 rounded-full px-5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                days === r.days ? "bg-navy text-cream shadow" : "text-navy/70 hover:text-navy",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs",
            isFetching ? "bg-gold/15 text-navy" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
          )}
          {isFetching ? "يجري التحديث" : "بيانات مباشرة"}
        </span>
      </div>

      {isLoading ? (
        <Skeleton />
      ) : !data || data.status === "not_configured" ? (
        <SetupNotice />
      ) : data.status === "error" ? (
        <ErrorNotice code={data.code} />
      ) : (
        <Report data={data} range={range} />
      )}
    </div>
  );
}

function Report({ data, range }: { data: Ok; range: (typeof RANGES)[number] }) {
  const { data: productNames } = useQuery({
    queryKey: ["admin", "product-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("slug,name");
      if (error) throw error;
      return new Map(data.map((p) => [p.slug, p.name]));
    },
    staleTime: 10 * 60_000,
  });
  const names = productNames;

  const pages: Row[] = useMemo(() => {
    const productTitles = new Set(names?.values() ?? []);
    return mergeByLabel(data.pages, (p) => pageLabel(p, names ?? new Map())).map((r) => ({
      ...r,
      icon: PAGE_ICONS[r.label] ?? (productTitles.has(r.label) ? Package : FileText),
    }));
  }, [data.pages, names]);
  const sources: Row[] = useMemo(
    () =>
      mergeByLabel(data.referrers, sourceLabel).map((r) => ({
        ...r,
        icon: SOURCE_ICONS[r.label] ?? Globe,
      })),
    [data.referrers],
  );
  const countries: Row[] = data.countries.map((c) =>
    c.label === "Others"
      ? { ...c, label: "أخرى", icon: Globe }
      : { ...c, label: countryLabel(c.label), emoji: flag(c.label) || undefined, icon: Globe },
  );
  const devices: Row[] = mergeByLabel(data.devices, (d) => DEVICE[d] ?? d).map((r) => ({
    ...r,
    icon: DEVICE_ICONS[r.label] ?? MonitorSmartphone,
  }));

  const { visitors, pageviews } = data.totals;
  const prev = data.previous;
  const visitorsChange = percentChange(visitors, prev?.visitors);
  const pageviewsChange = percentChange(pageviews, prev?.pageviews);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="الزوار"
          value={num.format(visitors)}
          change={visitorsChange}
          vs={range.previous}
        />
        <Kpi
          icon={Eye}
          label="مشاهدات الصفحات"
          value={num.format(pageviews)}
          change={pageviewsChange}
          vs={range.previous}
        />
        <Kpi
          icon={Layers}
          label="صفحات لكل زائر"
          value={visitors ? dec.format(pageviews / visitors) : "—"}
          note="متوسط التصفح"
        />
        <Kpi
          icon={TrendingUp}
          label="الزوار في الفترة السابقة"
          value={prev ? num.format(prev.visitors) : "—"}
          note={prev ? range.previous : "خارج نطاق خطة Vercel"}
        />
      </div>

      <DailyTrend daily={data.daily} />

      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown
          icon={FileText}
          title="الصفحات الأكثر مشاهدة"
          unit="مشاهدة"
          metric="pageviews"
          items={pages}
        />
        <Breakdown
          icon={Share2}
          title="مصادر الزيارات"
          unit="زائر"
          metric="visitors"
          items={sources}
        />
        <Breakdown icon={Globe2} title="الدول" unit="زائر" metric="visitors" items={countries} />
        <Breakdown
          icon={MonitorSmartphone}
          title="الأجهزة"
          unit="زائر"
          metric="visitors"
          items={devices}
          asShare
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        المصدر: Vercel Web Analytics · الأيام بتوقيت UTC · زيارات لوحة التحكم غير محتسبة
      </p>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  change,
  vs,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: number | null;
  vs?: string;
  note?: string;
}) {
  return (
    <div className="group rounded-2xl border border-navy/[0.08] bg-ivory p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-ink">
          <Icon className="h-5 w-5" />
        </span>
        {change != null && <ChangeBadge change={change} />}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl text-navy tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {change != null && vs ? `مقارنة بـ${vs}` : note}
      </p>
    </div>
  );
}

function ChangeBadge({ change }: { change: number }) {
  const up = change > 0;
  const Icon = change === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs tabular-nums",
        change === 0
          ? "bg-muted text-muted-foreground"
          : up
            ? "bg-gold/20 text-navy"
            : "bg-navy/[0.07] text-navy/70",
      )}
      aria-label={`${up ? "زيادة" : change < 0 ? "انخفاض" : "بدون تغيير"} ${Math.abs(change)}٪`}
    >
      <Icon className="h-3.5 w-3.5" />
      {num.format(Math.abs(change))}٪
    </span>
  );
}

/** Daily unique visitors: single series, rounded bars, hover tooltip, peak highlighted, table for screen readers. */
function DailyTrend({ daily }: { daily: Ok["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const peakIndex = daily.reduce(
    (best, d, i) => (d.visitors > daily[best]!.visitors ? i : best),
    0,
  );
  const peak = daily[peakIndex]!;
  const empty = daily.every((d) => d.visitors === 0);
  const h = hover != null ? daily[hover] : null;

  return (
    <section
      className="rounded-2xl border border-navy/[0.08] bg-ivory p-5 shadow-sm md:p-6"
      aria-labelledby="trend-title"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 id="trend-title" className="flex items-center gap-3 text-lg text-navy">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold">
            <BarChart3 className="h-4 w-4" />
          </span>
          الزوار يومياً
        </h3>
        {!empty && (
          <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-xs text-navy">
            <span className="h-2 w-2 rounded-full bg-gold" />
            أعلى يوم: {longDayFmt.format(asDate(peak.date))} · {num.format(peak.visitors)} زائر
          </span>
        )}
      </div>

      {empty ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy/15 text-center">
          <BarChart3 className="h-8 w-8 text-gold/60" />
          <p className="text-sm text-navy">لا زيارات في هذه الفترة بعد</p>
          <p className="text-xs text-muted-foreground">
            شارك رابط المتجر على إنستجرام وواتساب لتبدأ الأرقام بالظهور.
          </p>
        </div>
      ) : (
        <div className="relative" dir="ltr">
          <span className="absolute -top-1 right-0 -translate-y-full text-[0.7rem] text-muted-foreground">
            {num.format(max)}
          </span>
          {[0, 50].map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-dashed border-navy/10"
              style={{ top: `${t}%` }}
              aria-hidden
            />
          ))}
          <div
            className={cn(
              "flex h-56 items-end border-b border-navy/20",
              daily.length > 31 ? "gap-px" : "gap-1",
            )}
            aria-hidden
            onMouseLeave={() => setHover(null)}
          >
            {daily.map((d, i) => (
              <div
                key={d.date}
                className="flex h-full min-w-0 flex-1 items-end"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={cn(
                    "w-full rounded-t-md transition-[height,background-color] duration-700 ease-out motion-reduce:transition-none",
                    d.visitors === 0
                      ? "bg-navy/10"
                      : hover === i || (hover == null && i === peakIndex)
                        ? "bg-gold"
                        : "bg-navy/75",
                  )}
                  style={{
                    height: grown
                      ? `${Math.max(d.visitors ? 3 : 1, (d.visitors / max) * 100)}%`
                      : "0%",
                    transitionDelay: grown ? `${Math.min(i * 12, 400)}ms` : "0ms",
                  }}
                />
              </div>
            ))}
          </div>

          {h && hover != null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs text-cream shadow-xl"
              style={{ left: `${((hover + 0.5) / daily.length) * 100}%` }}
              dir="rtl"
            >
              <p className="text-cream/60">{longDayFmt.format(asDate(h.date))}</p>
              <p className="mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-gold" /> {num.format(h.visitors)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-gold" /> {num.format(h.pageviews)}
                </span>
              </p>
            </div>
          )}

          <div
            className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground"
            aria-hidden
          >
            <span>{dayFmt.format(asDate(daily[0]!.date))}</span>
            {daily.length > 2 && (
              <span>{dayFmt.format(asDate(daily[Math.floor(daily.length / 2)]!.date))}</span>
            )}
            <span>اليوم</span>
          </div>
        </div>
      )}

      <table className="sr-only">
        <caption>الزوار يومياً</caption>
        <thead>
          <tr>
            <th>اليوم</th>
            <th>الزوار</th>
            <th>مشاهدات الصفحات</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <td>{longDayFmt.format(asDate(d.date))}</td>
              <td>{d.visitors}</td>
              <td>{d.pageviews}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Breakdown({
  icon: Icon,
  title,
  unit,
  metric,
  items,
  asShare,
}: {
  icon: LucideIcon;
  title: string;
  unit: string;
  metric: "pageviews" | "visitors";
  items: Row[];
  asShare?: boolean;
}) {
  const total = items.reduce((s, i) => s + i[metric], 0);
  const max = Math.max(1, ...items.map((i) => i[metric]));

  return (
    <section className="rounded-2xl border border-navy/[0.08] bg-ivory p-5 shadow-sm md:p-6">
      <h3 className="mb-5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-3 text-base text-navy">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{asShare ? "النسبة" : unit}</span>
      </h3>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Icon className="h-7 w-7 text-navy/20" />
          <p className="text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => {
            const value = it[metric];
            const share = total ? Math.round((value / total) * 100) : 0;
            const RowIcon = it.icon;
            const muted = it.label === "أخرى";
            return (
              <li
                key={it.label}
                className="group rounded-lg px-2 py-2 transition-colors hover:bg-cream"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      muted
                        ? "bg-navy/5 text-navy/40"
                        : "bg-navy/5 text-navy/70 group-hover:text-gold",
                    )}
                  >
                    {it.emoji ? (
                      <span className="text-base leading-none">{it.emoji}</span>
                    ) : RowIcon ? (
                      <RowIcon className="h-4 w-4" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={cn("truncate", muted ? "text-muted-foreground" : "text-navy")}
                        dir="auto"
                      >
                        {it.label}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {asShare ? `${num.format(share)}٪` : num.format(value)}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy/[0.06]"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          muted ? "bg-navy/20" : "bg-gradient-to-l from-gold to-navy/70",
                        )}
                        style={{ width: `${(value / max) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-ivory" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-ivory" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-ivory" />
        ))}
      </div>
    </div>
  );
}

function ErrorNotice({ code }: { code: number }) {
  const message =
    code === 401 || code === 403
      ? "رفضت Vercel التوكن. أنشئ توكن جديداً وضعه في VERCEL_ANALYTICS_TOKEN ثم أعد النشر."
      : code === 404
        ? "لم تجد Vercel المشروع. تأكد من VERCEL_ANALYTICS_PROJECT_ID، وأضف VERCEL_TEAM_ID إن كان المشروع تابعاً لفريق."
        : code === 402
          ? "هذه الفترة خارج حدود خطة Vercel الحالية. اختر فترة أقصر."
          : "لم تصل بيانات من Vercel الآن. أعد تحميل الصفحة بعد قليل.";
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-destructive/20 bg-ivory p-6 text-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <BarChart3 className="h-5 w-5" />
      </span>
      <div>
        <p className="text-base text-navy">تعذر عرض الزيارات</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-navy/[0.08] bg-ivory p-6 text-sm shadow-sm md:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <BarChart3 className="h-5 w-5" />
        </span>
        <p className="text-base text-navy">اربط Vercel Web Analytics لعرض الزيارات هنا</p>
      </div>
      <ol className="mt-6 space-y-3">
        {[
          <>
            في Vercel افتح المشروع ← <b className="text-navy">Analytics</b> ←{" "}
            <b className="text-navy">Enable</b>.
          </>,
          <>
            أنشئ توكن من{" "}
            <b className="text-navy" dir="ltr">
              Account Settings → Tokens
            </b>
            .
          </>,
          <>
            أضف في{" "}
            <b className="text-navy" dir="ltr">
              Settings → Environment Variables
            </b>
            :{" "}
            <code dir="ltr" className="rounded bg-cream px-1.5">
              VERCEL_ANALYTICS_TOKEN
            </code>{" "}
            و{" "}
            <code dir="ltr" className="rounded bg-cream px-1.5">
              VERCEL_ANALYTICS_PROJECT_ID
            </code>
            ، و{" "}
            <code dir="ltr" className="rounded bg-cream px-1.5">
              VERCEL_TEAM_ID
            </code>{" "}
            إن كان المشروع تابعاً لفريق، ثم أعد النشر.
          </>,
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-muted-foreground">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs text-cream">
              {num.format(i + 1)}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
