import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format";

describe("formatPrice", () => {
  it("uses the Saudi riyal sign (U+20C1) on the site", () => {
    expect(formatPrice(1250, "SAR")).toBe("1,250 ⃁");
  });

  it("uses the text label for plain text that leaves the site", () => {
    expect(formatPrice(1250, "SAR", { plain: true })).toBe("1,250 ر.س");
  });

  it("keeps other currencies and unknown codes as before", () => {
    expect(formatPrice(99, "EGP")).toBe("99 ج.م");
    expect(formatPrice(5, "USD")).toBe("5 USD");
  });
});
