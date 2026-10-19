import { describe, it, expect } from "vitest";
import { cleanSizes, priceRange, productSizes, unitPrice } from "@/lib/sizes";

const bed = {
  price: 50000,
  sale_price: 45000,
  sizes: [
    { label: "١٢٠×٢٠٠", price: null },
    { label: "١٦٠×٢٠٠", price: 52000 },
    { label: "", price: 1 },
    "bad",
  ],
};

describe("product sizes", () => {
  it("parses valid sizes and ignores malformed entries", () => {
    expect(productSizes(bed)).toEqual([
      { label: "١٢٠×٢٠٠", price: null },
      { label: "١٦٠×٢٠٠", price: 52000 },
    ]);
    expect(productSizes({ sizes: null })).toEqual([]);
  });

  it("prices a size like place_order does: own price, else the product's effective price", () => {
    expect(unitPrice(bed, "١٦٠×٢٠٠")).toBe(52000);
    expect(unitPrice(bed, "١٢٠×٢٠٠")).toBe(45000);
    expect(unitPrice(bed, undefined)).toBe(45000);
  });

  it("reports the price range across sizes", () => {
    expect(priceRange(bed)).toEqual({ min: 45000, max: 52000 });
    expect(priceRange({ price: 100, sale_price: null, sizes: [] })).toEqual({ min: 100, max: 100 });
  });

  it("cleans admin input", () => {
    expect(
      cleanSizes([
        { label: "  كبير ", price: 0 },
        { label: "كبير", price: 10 },
        { label: "", price: 5 },
        { label: "صغير", price: 300 },
      ]),
    ).toEqual([
      { label: "كبير", price: null },
      { label: "صغير", price: 300 },
    ]);
  });
});
