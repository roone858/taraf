import { formatPrice } from "./format";

export type CheckoutLine = {
  name: string;
  variant?: string | undefined;
  quantity: number;
  unitPrice: number;
};

export type CheckoutCustomer = {
  name: string;
  phone: string;
  city: string;
  address: string;
  notes?: string | undefined;
};

export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function computeTotals(lines: CheckoutLine[], deliveryFee: number) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

export function buildOrderMessage(
  customer: CheckoutCustomer,
  lines: CheckoutLine[],
  deliveryFee: number,
  currency = "EGP",
  orderNumber?: string,
) {
  const t = computeTotals(lines, deliveryFee);
  const f = (n: number) => formatPrice(n, currency);
  const items = lines
    .map(
      (l, i) =>
        `${i + 1}. ${l.name}${l.variant ? ` (${l.variant})` : ""}\n   الكمية: ${l.quantity} × ${f(l.unitPrice)} = ${f(l.unitPrice * l.quantity)}`,
    )
    .join("\n");
  return [
    "طلب جديد من موقع TARAF FURNITURE",
    ...(orderNumber ? [`رقم الطلب: ${orderNumber}`] : []),
    "",
    `الاسم: ${customer.name}`,
    `الهاتف: ${customer.phone}`,
    `المدينة: ${customer.city}`,
    `العنوان: ${customer.address}`,
    "",
    "المنتجات:",
    items,
    "",
    `المجموع الفرعي: ${f(t.subtotal)}`,
    `رسوم التوصيل: ${f(t.deliveryFee)}`,
    `الإجمالي التقديري: ${f(t.total)}`,
    ...(customer.notes?.trim() ? ["", `ملاحظات: ${customer.notes.trim()}`] : []),
  ].join("\n");
}

export function buildWhatsappUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
