import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fillDays, rangeStart } from "./analytics-days";

export type AnalyticsRange = 7 | 30 | 90;
type Row = Record<string, unknown> & { pageviews?: number; visitors?: number; timestamp?: string };

export type TopItem = { label: string; pageviews: number; visitors: number };
export type SiteAnalytics =
  | { status: "not_configured" }
  | { status: "error"; code: number }
  | {
      status: "ok";
      days: AnalyticsRange;
      totals: { pageviews: number; visitors: number };
      /** Same-length period immediately before; null if outside the plan's reporting window. */
      previous: { pageviews: number; visitors: number } | null;
      daily: { date: string; pageviews: number; visitors: number }[];
      pages: TopItem[];
      referrers: TopItem[];
      countries: TopItem[];
      devices: TopItem[];
    };

const API = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const toItems = (rows: Row[], key: string): TopItem[] =>
  rows.map((r) => ({
    label: String(r[key] ?? "") || "—",
    pageviews: Number(r.pageviews ?? 0),
    visitors: Number(r.visitors ?? 0),
  }));

/**
 * Site traffic from Vercel Web Analytics, for the admin dashboard.
 * Admin-only; the Vercel token never leaves the server.
 * Env: VERCEL_ANALYTICS_TOKEN, VERCEL_ANALYTICS_PROJECT_ID (id or name), optional VERCEL_TEAM_ID.
 */
export const getSiteAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { days?: number } | undefined): { days: AnalyticsRange } => ({
    days: input?.days === 30 || input?.days === 90 ? input.days : 7,
  }))
  .handler(async ({ data, context }): Promise<SiteAnalytics> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const token = process.env["VERCEL_ANALYTICS_TOKEN"];
    const projectId = process.env["VERCEL_ANALYTICS_PROJECT_ID"];
    const teamId = process.env["VERCEL_TEAM_ID"];
    if (!token || !projectId) return { status: "not_configured" };

    // Range: from UTC midnight (days-1) days ago up to *now*. Passing a bare date for `until` would
    // cut off at the start of today and silently drop today's traffic.
    const now = Date.now();
    const sinceMs = rangeStart(now, data.days);

    const query = async (
      by: string,
      limit?: number,
      range: [number, number] = [sinceMs, now],
    ): Promise<Row[]> => {
      const params = new URLSearchParams({
        projectId,
        by,
        since: String(range[0]),
        until: String(range[1]),
      });
      if (limit) params.set("limit", String(limit));
      if (teamId) params.set("teamId", teamId);
      const res = await fetch(`${API}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw Object.assign(new Error(`vercel ${res.status}`), { status: res.status });
      const json = (await res.json()) as { data?: Row[] };
      return json.data ?? [];
    };

    // Previous period of equal length, ending just before the current one starts
    const prevRange: [number, number] = [sinceMs - data.days * 86_400_000, sinceMs - 1];
    const totalsOf = (rows: Row[]) => ({
      pageviews: Number(rows[0]?.pageviews ?? 0),
      visitors: Number(rows[0]?.visitors ?? 0),
    });

    try {
      // Grouping by `environment` (production only, by default) yields one row = range totals with unique visitors
      const [total, daily, pages, referrers, countries, devices, previous] = await Promise.all([
        query("environment", 1),
        query("day"),
        query("requestPath", 10),
        query("referrerHostname", 8),
        query("country", 8),
        query("deviceType", 4),
        // Comparison is optional: it may fall outside the plan's reporting window
        query("environment", 1, prevRange).then(totalsOf, () => null),
      ]);
      return {
        status: "ok",
        days: data.days,
        totals: totalsOf(total),
        previous,
        daily: fillDays(daily, sinceMs, data.days),
        pages: toItems(pages, "requestPath"),
        referrers: toItems(referrers, "referrerHostname"),
        countries: toItems(countries, "country"),
        devices: toItems(devices, "deviceType"),
      };
    } catch (e) {
      const code = (e as { status?: number }).status ?? 500;
      console.error("[site-analytics]", code);
      return { status: "error", code };
    }
  });
