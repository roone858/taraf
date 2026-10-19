import { describe, it, expect } from "vitest";
import { orderErrorMessage } from "@/lib/orders";

describe("order error messages", () => {
  it("translates known codes from place_order", () => {
    expect(orderErrorMessage("rate_limited")).toContain("عدة طلبات");
    expect(orderErrorMessage("invalid_phone")).toBe("رقم الهاتف غير صحيح");
  });
  it("includes the product name carried after the colon", () => {
    expect(orderErrorMessage("insufficient_stock:كرسي ملكي")).toContain("«كرسي ملكي»");
    expect(orderErrorMessage("product_unavailable:")).toBe("أحد المنتجات لم يعد متاحاً");
  });
  it("falls back to a generic message for unknown or missing errors", () => {
    expect(orderErrorMessage("something else")).toBe("تعذر إتمام العملية. حاول مرة أخرى.");
    expect(orderErrorMessage(undefined)).toBe("تعذر إتمام العملية. حاول مرة أخرى.");
  });
});
