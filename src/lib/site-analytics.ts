import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      daily: { date: string; pageviews: number; visitors: number }[];
      pages: TopItem[];
      referrers: TopItem[];
      countries: TopItem[];
      devices: TopItem[];
    };

const API = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const ymd = (d: Date) => d.toISOString().slice(0, 10);
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

    const until = new Date();
    const since = new Date(until.getTime() - (data.days - 1) * 86_400_000);

    const query = async (by: string, limit?: number): Promise<Row[]> => {
      const params = new URLSearchParams({ projectId, by, since: ymd(since), until: ymd(until) });
      if (limit) params.set("limit", String(limit));
      if (teamId) params.set("teamId", teamId);
      const res = await fetch(`${API}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw Object.assign(new Error(`vercel ${res.status}`), { status: res.status });
      const json = (await res.json()) as { data?: Row[] };
      return json.data ?? [];
    };

    try {
      // Grouping by `environment` (production only, by default) yields one row = range totals with unique visitors
      const [total, daily, pages, referrers, countries, devices] = await Promise.all([
        query("environment", 1),
        query("day"),
        query("requestPath", 8),
        query("referrerHostname", 6),
        query("country", 6),
        query("deviceType", 4),
      ]);
      return {
        status: "ok",
        days: data.days,
        totals: {
          pageviews: Number(total[0]?.pageviews ?? 0),
          visitors: Number(total[0]?.visitors ?? 0),
        },
        daily: daily.map((r) => ({
          date: String(r.timestamp ?? "").slice(0, 10),
          pageviews: Number(r.pageviews ?? 0),
          visitors: Number(r.visitors ?? 0),
        })),
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
