import { describe, it, expect } from "vitest";
import { buildWhatsappUrl, computeTotals, normalizeWhatsappNumber, buildOrderMessage, buildInvoiceMessage } from "@/lib/whatsapp";

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
  it("includes the order number when one is given", () => {
    const customer = { name: "أحمد", phone: "010", city: "القاهرة", address: "x" };
    const lines = [{ name: "كرسي", quantity: 1, unitPrice: 5 }];
    expect(buildOrderMessage(customer, lines, 0, "SAR", "TRF-1024")).toContain("رقم الطلب: TRF-1024");
    expect(buildOrderMessage(customer, lines, 0)).not.toContain("رقم الطلب");
  });
  it("builds a text invoice with number, items and totals", () => {
    const msg = buildInvoiceMessage({
      storeName: "TARAF FURNITURE",
      orderNumber: "TRF-1007",
      createdAt: "2026-10-19T10:00:00Z",
      customerName: "سارة",
      statusLabel: "مؤكد",
      currency: "SAR",
      items: [{ product_name: "كرسي ملكي", variant: "ذهبي", quantity: 2, unit_price: 100, line_total: 200 }],
      subtotal: 200,
      deliveryFee: 50,
      total: 250,
    });
    expect(msg).toContain("مرحباً سارة");
    expect(msg).toContain("رقم الفاتورة: TRF-1007");
    expect(msg).toContain("1. كرسي ملكي (ذهبي)");
    expect(msg).toMatch(/الإجمالي: .*ر\.س/);
  });
});
