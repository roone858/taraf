import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import { getSiteAnalytics, type AnalyticsRange, type TopItem } from "@/lib/site-analytics";
import { cn } from "@/lib/utils";

const num = new Intl.NumberFormat("ar-EG");
const dec = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });
const dayFmt = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" });
const regionName = (() => {
  try {
    return new Intl.DisplayNames(["ar"], { type: "region" });
  } catch {
    return null;
  }
})();

const RANGES: [AnalyticsRange, string][] = [
  [7, "٧ أيام"],
  [30, "٣٠ يوماً"],
  [90, "٩٠ يوماً"],
];
const DEVICE: Record<string, string> = { desktop: "كمبيوتر", mobile: "موبايل", tablet: "تابلت" };
const PAGE: Record<string, string> = {
  "/": "الرئيسية",
  "/shop": "المتجر",
  "/checkout": "إتمام الطلب",
};

const pageLabel = (p: string) => {
  if (PAGE[p]) return PAGE[p];
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
};
const countryLabel = (c: string) => (c === "—" ? "غير معروف" : (regionName?.of(c) ?? c));

/** Admin dashboard panel: Vercel Web Analytics traffic (visits, visitors, daily trend, top lists). */
export function SiteTrafficPanel() {
  const [days, setDays] = useState<AnalyticsRange>(7);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "site-analytics", days],
    queryFn: () => getSiteAnalytics({ data: { days } }),
    staleTime: 5 * 60_000,
  });

  return (
    <section className="mt-6 bg-ivory p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b hairline pb-3">
        <h2 className="flex items-center gap-2 text-lg text-navy">
          <Activity className="h-5 w-5 text-gold" /> زيارات الموقع
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
        </h2>
        <div className="flex border bg-cream text-xs" role="group" aria-label="الفترة">
          {RANGES.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setDays(v)}
              aria-pressed={days === v}
              className={cn(
                "h-8 px-3 transition-colors",
                days === v ? "bg-navy text-cream" : "text-navy hover:bg-gold/15",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-cream" />
            ))}
          </div>
          <div className="h-40 animate-pulse bg-cream" />
        </div>
      ) : !data || data.status === "not_configured" ? (
        <SetupNotice />
      ) : data.status === "error" ? (
        <p className="py-6 text-sm text-muted-foreground">
          {data.code === 401 || data.code === 403
            ? "توكن Vercel غير صالح أو لا يملك صلاحية على المشروع. راجع VERCEL_ANALYTICS_TOKEN."
            : data.code === 404
              ? "لم يُعثر على المشروع. راجع VERCEL_ANALYTICS_PROJECT_ID (و VERCEL_TEAM_ID إن كان المشروع تابعاً لفريق)."
              : data.code === 402
                ? "الفترة المطلوبة خارج حدود خطة Vercel الحالية. جرّب فترة أقصر."
                : "تعذر جلب الإحصائيات من Vercel حالياً. حاول لاحقاً."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Kpi
              label="الزيارات"
              value={num.format(data.totals.pageviews)}
              hint="مشاهدات الصفحات"
            />
            <Kpi label="الزوار" value={num.format(data.totals.visitors)} hint="زوار مختلفون" />
            <Kpi
              label="صفحات لكل زائر"
              value={
                data.totals.visitors
                  ? dec.format(data.totals.pageviews / data.totals.visitors)
                  : "—"
              }
              hint="متوسط التصفح"
            />
          </div>

          <DailyBars daily={data.daily} />

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TopList title="أكثر الصفحات زيارة" items={data.pages} format={pageLabel} ltr />
            <TopList
              title="مصادر الزيارات"
              items={data.referrers}
              format={(r) => (r === "—" ? "مباشر / غير معروف" : r)}
              ltr
            />
            <TopList title="الدول" items={data.countries} format={countryLabel} />
            <TopList title="الأجهزة" items={data.devices} format={(d) => DEVICE[d] ?? d} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            المصدر: Vercel Web Analytics · لا تُحتسب زيارات لوحة التحكم · قد تتأخر البيانات بضع
            دقائق
          </p>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-s-2 border-gold ps-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl text-navy">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Single-series daily page views; bars anchored to the baseline, hover tooltip, table fallback for screen readers. */
function DailyBars({ daily }: { daily: { date: string; pageviews: number; visitors: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.pageviews));
  if (daily.length === 0)
    return <p className="mt-6 text-sm text-muted-foreground">لا توجد زيارات في هذه الفترة بعد.</p>;
  const h = hover != null ? daily[hover] : null;
  const label = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

  return (
    <figure className="mt-6">
      <figcaption className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>الزيارات يومياً</span>
        <span>الأعلى: {num.format(max)}</span>
      </figcaption>
      {/* Chronological left→right reads naturally for time even in RTL, matching most analytics tools */}
      <div className="relative" dir="ltr">
        <div
          className="absolute inset-x-0 top-0 border-t border-dashed border-navy/10"
          aria-hidden
        />
        <div
          className="flex h-40 items-end gap-[2px] border-b border-navy/20"
          aria-hidden
          onMouseLeave={() => setHover(null)}
        >
          {daily.map((d, i) => (
            <div
              key={d.date}
              className="flex h-full min-w-0 flex-1 cursor-default items-end"
              onMouseEnter={() => setHover(i)}
            >
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  hover === i ? "bg-gold" : "bg-navy/80",
                  d.pageviews === 0 && "bg-navy/10",
                )}
                style={{ height: `${Math.max(d.pageviews ? 2 : 1, (d.pageviews / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        {h && hover != null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap bg-ink px-3 py-2 text-xs text-cream shadow-lg"
            style={{ left: `${((hover + 0.5) / daily.length) * 100}%` }}
            dir="rtl"
          >
            <p className="text-cream/70">{label(h.date)}</p>
            <p>
              {num.format(h.pageviews)} زيارة · {num.format(h.visitors)} زائر
            </p>
          </div>
        )}
        <div
          className="mt-1.5 flex justify-between text-[0.7rem] text-muted-foreground"
          aria-hidden
        >
          <span>{label(daily[0]!.date)}</span>
          {daily.length > 2 && <span>{label(daily[Math.floor(daily.length / 2)]!.date)}</span>}
          <span>{label(daily[daily.length - 1]!.date)}</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>الزيارات اليومية</caption>
        <thead>
          <tr>
            <th>اليوم</th>
            <th>الزيارات</th>
            <th>الزوار</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <td>{label(d.date)}</td>
              <td>{d.pageviews}</td>
              <td>{d.visitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function TopList({
  title,
  items,
  format,
  ltr,
}: {
  title: string;
  items: TopItem[];
  format: (label: string) => string;
  ltr?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.pageviews));
  return (
    <div>
      <h3 className="mb-2 text-sm text-navy">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد بيانات بعد.</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {items.map((it) => (
            <li
              key={it.label}
              className="relative"
              title={`${num.format(it.pageviews)} زيارة · ${num.format(it.visitors)} زائر`}
            >
              <div
                className="absolute inset-y-0 start-0 bg-navy/[0.07]"
                style={{ width: `${(it.pageviews / max) * 100}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-navy" dir={ltr ? "auto" : undefined}>
                  {it.label === "Others" ? "أخرى" : format(it.label)}
                </span>
                <span className="shrink-0 text-muted-foreground">{num.format(it.pageviews)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="space-y-3 py-2 text-sm text-navy">
      <p>لعرض زيارات الموقع هنا، فعّل Vercel Web Analytics واربط الحساب:</p>
      <ol className="list-inside list-decimal space-y-1.5 text-muted-foreground">
        <li>
          في Vercel: المشروع ← <b className="text-navy">Analytics</b> ←{" "}
          <b className="text-navy">Enable</b>.
        </li>
        <li>
          أنشئ توكن من{" "}
          <b className="text-navy" dir="ltr">
            Account Settings → Tokens
          </b>
          .
        </li>
        <li>
          أضف في{" "}
          <b className="text-navy" dir="ltr">
            Settings → Environment Variables
          </b>
          :{" "}
          <code dir="ltr" className="bg-cream px-1">
            VERCEL_ANALYTICS_TOKEN
          </code>{" "}
          و{" "}
          <code dir="ltr" className="bg-cream px-1">
            VERCEL_ANALYTICS_PROJECT_ID
          </code>{" "}
          (اسم المشروع أو معرّفه)، و{" "}
          <code dir="ltr" className="bg-cream px-1">
            VERCEL_TEAM_ID
          </code>{" "}
          إن كان المشروع تابعاً لفريق، ثم أعد النشر.
        </li>
      </ol>
    </div>
  );
}
