import { describe, it, expect } from "vitest";
import { buildWhatsappUrl, computeTotals, normalizeWhatsappNumber, buildOrderMessage } from "@/lib/whatsapp";

describe("whatsapp checkout", () => {
  it("strips plus, spaces and hyphens from the store number", () => {
    expect(normalizeWhatsappNumber("+20 100-123-4567")).toBe("201001234567");
  });
  it("rejects missing numbers so checkout is disabled", () => {
    expect(normalizeWhatsappNumber("")).toBeNull();
  });
  it("adds the delivery fee to the subtotal", () => {
    const t = computeTotals([{ name: "a", quantity: 2, unitPrice: 1000 }], 250);
    expect(t).toEqual({ subtotal: 2000, deliveryFee: 250, total: 2250 });
  });
  it("builds an encoded wa.me link", () => {
    const msg = buildOrderMessage({ name: "أحمد", phone: "010", city: "القاهرة", address: "x" }, [{ name: "كرسي", quantity: 1, unitPrice: 5 }], 0);
    const url = buildWhatsappUrl("201001234567", msg);
    expect(url.startsWith("https://wa.me/201001234567?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe(msg);
  });
});
