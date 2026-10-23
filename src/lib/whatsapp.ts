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
  /** Customer-facing invoice page, see invoiceUrl(). */
  invoiceUrl?: string,
) {
  const t = computeTotals(lines, deliveryFee);
  // Plain-text label: the riyal sign may not render on the recipient's phone
  const f = (n: number) => formatPrice(n, currency, { plain: true });
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
    ...(invoiceUrl ? ["", `الفاتورة: ${invoiceUrl}`] : []),
  ].join("\n");
}

export function buildWhatsappUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export type InvoiceMessageInput = {
  storeName: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  statusLabel: string;
  currency: string;
  items: {
    product_name: string;
    variant: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  amountPaid?: number | undefined;
  /** Customer-facing invoice page, see invoiceUrl(). */
  invoiceUrl?: string | undefined;
};

/** Plain-text invoice for sending to the customer over WhatsApp (wa.me links can't carry file attachments). */
export function buildInvoiceMessage(o: InvoiceMessageInput) {
  const f = (n: number) => formatPrice(Number(n), o.currency, { plain: true });
  const date = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(o.createdAt));
  const items = o.items
    .map(
      (i, idx) =>
        `${idx + 1}. ${i.product_name}${i.variant ? ` (${i.variant})` : ""}\n   ${i.quantity} × ${f(i.unit_price)} = ${f(i.line_total)}`,
    )
    .join("\n");
  const paid = Number(o.amountPaid ?? 0);
  const remaining = Math.max(0, Number(o.total) - paid);
  return [
    `مرحباً ${o.customerName}،`,
    `فاتورة طلبك من ${o.storeName}`,
    "",
    `رقم الفاتورة: ${o.orderNumber}`,
    `التاريخ: ${date}`,
    `حالة الطلب: ${o.statusLabel}`,
    "",
    "المنتجات:",
    items,
    "",
    `المجموع الفرعي: ${f(o.subtotal)}`,
    `رسوم التوصيل: ${f(o.deliveryFee)}`,
    `الإجمالي: ${f(o.total)}`,
    ...(paid > 0
      ? [
          `المبلغ المدفوع: ${f(paid)}`,
          remaining > 0 ? `المتبقي: ${f(remaining)}` : "تم سداد الفاتورة بالكامل",
        ]
      : []),
    ...(o.invoiceUrl ? ["", `عرض الفاتورة وطباعتها: ${o.invoiceUrl}`] : []),
    "",
    `شكراً لثقتكم في ${o.storeName}`,
  ].join("\n");
}

/** Public invoice page for an order's invoice_token (absolute, for sharing over WhatsApp). */
export function invoiceUrl(token: string | null | undefined) {
  if (!token || typeof window === "undefined") return undefined;
  return `${window.location.origin}/invoice/${token}`;
}
