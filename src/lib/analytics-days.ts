const DAY = 86_400_000;
export const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** UTC midnight of the first day of a range ending today. */
export function rangeStart(now: number, days: number) {
  return new Date(ymd(new Date(now))).getTime() - (days - 1) * DAY;
}

/** The Web Analytics API omits days without traffic; return one zero-filled entry per day. */
export function fillDays(
  rows: { timestamp?: unknown; pageviews?: unknown; visitors?: unknown }[],
  sinceMs: number,
  days: number,
) {
  const byDate = new Map(rows.map((r) => [String(r.timestamp ?? "").slice(0, 10), r]));
  return Array.from({ length: days }, (_, i) => {
    const date = ymd(new Date(sinceMs + i * DAY));
    const r = byDate.get(date);
    return { date, pageviews: Number(r?.pageviews ?? 0), visitors: Number(r?.visitors ?? 0) };
  });
}
