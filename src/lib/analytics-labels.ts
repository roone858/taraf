/** Human-readable labels for Web Analytics dimensions (Arabic UI). */

const SOURCES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "إنستجرام"],
  [/(^|\.)facebook\.com$|^fb\.me$/, "فيسبوك"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "واتساب"],
  [/(^|\.)snapchat\.com$/, "سناب شات"],
  [/(^|\.)tiktok\.com$/, "تيك توك"],
  [/^(t\.co|x\.com|twitter\.com|mobile\.twitter\.com)$/, "X"],
  [/(^|\.)google\.[a-z.]+$/, "جوجل"],
  [/(^|\.)bing\.com$/, "بينج"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "يوتيوب"],
];

/** Referrer hostname → platform name; an empty referrer means the visitor typed the address or used a bookmark. */
export function sourceLabel(host: string) {
  if (!host || host === "—") return "دخول مباشر";
  const h = host.toLowerCase().replace(/^www\./, "");
  return SOURCES.find(([re]) => re.test(h))?.[1] ?? h;
}

/** ISO country code → flag emoji ("" for unknown). */
export function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const PAGES: Record<string, string> = {
  "/": "الصفحة الرئيسية",
  "/shop": "المتجر",
  "/checkout": "إتمام الطلب",
};

/** URL path → page name, resolving /product/<slug> to the product's name when known. */
export function pageLabel(path: string, productNames: Map<string, string>) {
  if (PAGES[path]) return PAGES[path];
  const safe = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const m = path.match(/^\/product\/([^/?#]+)/);
  if (m) {
    const slug = safe(m[1]!);
    return productNames.get(slug) ?? slug;
  }
  return safe(path);
}

/** Whole-percent change, or null when there is no baseline to compare against. */
export function percentChange(current: number, previous: number | null | undefined) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Merge rows that map to the same label (e.g. instagram.com + l.instagram.com). */
export function mergeByLabel<T extends { label: string; pageviews: number; visitors: number }>(
  items: T[],
  toLabel: (raw: string) => string,
) {
  const out = new Map<string, { label: string; pageviews: number; visitors: number }>();
  for (const it of items) {
    const label = it.label === "Others" ? "أخرى" : toLabel(it.label);
    const prev = out.get(label);
    out.set(label, {
      label,
      pageviews: (prev?.pageviews ?? 0) + it.pageviews,
      visitors: (prev?.visitors ?? 0) + it.visitors,
    });
  }
  // "Others" always last
  return [...out.values()].sort((a, b) =>
    a.label === "أخرى" ? 1 : b.label === "أخرى" ? -1 : b.visitors - a.visitors,
  );
}

/** Arabic count noun for people: ١ شخص واحد، ٢ شخصان، ٣–١٠ أشخاص، ١١+ شخصاً. */
export function peopleWord(n: number) {
  if (n === 1) return "شخص واحد";
  if (n === 2) return "شخصان";
  const mod = n % 100;
  return mod >= 3 && mod <= 10 ? "أشخاص" : "شخصاً";
}
