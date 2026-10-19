/** Supported store currencies: code → [short price label, full Arabic name]. */
export const CURRENCIES: Record<string, [string, string]> = {
  EGP: ["ج.م", "جنيه مصري"],
  SAR: ["ر.س", "ريال سعودي"],
};

export function formatPrice(value: number, currency = "EGP") {
  const n = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value);
  const label = CURRENCIES[currency]?.[0] ?? currency;
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

export const availabilityLabel: Record<string, string> = {
  in_stock: "متوفر",
  made_to_order: "حسب الطلب",
  unavailable: "غير متوفر",
};
