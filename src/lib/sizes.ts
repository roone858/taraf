import type { Json } from "@/integrations/supabase/types";
import { effectivePrice } from "./format";

/** One size option of a product. `price: null` means the product's own (effective) price applies. */
export type SizeOption = { label: string; price: number | null };

type PricedProduct = { price: number; sale_price: number | null; sizes: Json };

/** Parses the `sizes` jsonb column defensively (ignores malformed entries). */
export function productSizes(p: { sizes: Json }): SizeOption[] {
  if (!Array.isArray(p.sizes)) return [];
  return p.sizes.flatMap((s) => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return [];
    const rawLabel = s["label"];
    const rawPrice = s["price"];
    const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
    if (!label) return [];
    const price = typeof rawPrice === "number" && rawPrice > 0 ? rawPrice : null;
    return [{ label, price }];
  });
}

/** Unit price for a product in a given size — mirrors place_order() in the database. */
export function unitPrice(p: PricedProduct, size: string | undefined) {
  const base = effectivePrice(p);
  const opt = size ? productSizes(p).find((s) => s.label === size) : undefined;
  return opt?.price ?? base;
}

/** Lowest and highest price across a product's sizes (both = base price when it has none). */
export function priceRange(p: PricedProduct) {
  const prices = productSizes(p).map((s) => s.price ?? effectivePrice(p));
  if (prices.length === 0) {
    const b = effectivePrice(p);
    return { min: b, max: b };
  }
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Keeps admin input sane: trims labels, drops empties and duplicates, blanks invalid prices. */
export function cleanSizes(sizes: SizeOption[]): SizeOption[] {
  const seen = new Set<string>();
  return sizes.flatMap((s) => {
    const label = s.label.trim().slice(0, 60);
    if (!label || seen.has(label)) return [];
    seen.add(label);
    const price = s.price != null && Number.isFinite(s.price) && s.price > 0 ? s.price : null;
    return [{ label, price }];
  });
}
