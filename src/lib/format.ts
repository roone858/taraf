/**
 * Supported store currencies: code → [symbol shown on the site, plain-text label, full Arabic name].
 * The riyal sign (U+20C1) renders on the site via the bundled "Saudi Riyal" font; plain text that
 * leaves the site (WhatsApp messages) uses the text label, since recipients' phones may lack the glyph.
 */
export const CURRENCIES: Record<string, [symbol: string, text: string, name: string]> = {
  EGP: ["ج.م", "ج.م", "جنيه مصري"],
  SAR: ["⃁", "ر.س", "ريال سعودي"],
};

export function formatPrice(value: number, currency = "EGP", opts: { plain?: boolean } = {}) {
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  const c = CURRENCIES[currency];
  const label = c ? (opts.plain ? c[1] : c[0]) : currency;
  return `${n} ${label}`;
}

export function effectivePrice(p: { price: number; sale_price: number | null }) {
  return p.sale_price != null && p.sale_price < p.price ? Number(p.sale_price) : Number(p.price);
}

export function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** In-stock products at or below this quantity are flagged as low stock in the admin. */
export const LOW_STOCK = 3;

export const availabilityLabel: Record<string, string> = {
  in_stock: "متوفر",
  made_to_order: "حسب الطلب",
  unavailable: "غير متوفر",
};
