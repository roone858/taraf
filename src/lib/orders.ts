import { supabase } from "@/integrations/supabase/client";
import { invoiceUrl } from "@/lib/whatsapp";
import type { Database } from "@/integrations/supabase/types";

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Workflow order, as shown in the admin. */
export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_production",
  "delivered",
  "cancelled",
];

export const orderStatusLabel: Record<OrderStatus, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  in_production: "قيد التصنيع",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

/** Statuses at which the order's stock has been deducted. */
export const STOCK_HOLDING: OrderStatus[] = ["confirmed", "in_production", "delivered"];

/**
 * Translates error codes raised by place_order / set_order_status
 * ("code" or "code:detail") into Arabic messages.
 */
export function orderErrorMessage(message: string | undefined): string {
  const raw = message ?? "";
  const i = raw.indexOf(":");
  const code = i === -1 ? raw : raw.slice(0, i);
  const detail = i === -1 ? "" : raw.slice(i + 1).trim();
  switch (code) {
    case "invalid_phone":
      return "رقم الهاتف غير صحيح";
    case "invalid_customer":
      return "يرجى استكمال بيانات التوصيل";
    case "invalid_items":
      return "محتوى السلة غير صالح. حدّث الصفحة وحاول مرة أخرى.";
    case "rate_limited":
      return "تم استلام عدة طلبات من هذا الرقم مؤخراً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.";
    case "product_unavailable":
      return detail ? `«${detail}» لم يعد متاحاً` : "أحد المنتجات لم يعد متاحاً";
    case "insufficient_stock":
      return detail ? `الكمية المتوفرة من «${detail}» غير كافية` : "المخزون غير كافٍ لأحد المنتجات";
    case "size_required":
      return detail ? `اختر مقاس «${detail}» قبل إرسال الطلب` : "اختر المقاس قبل إرسال الطلب";
    case "size_unavailable":
      return detail
        ? `المقاس المختار من «${detail}» لم يعد متاحاً`
        : "أحد المقاسات المختارة لم يعد متاحاً";
    case "invalid_fee":
      return "رسوم التوصيل غير صحيحة";
    case "invalid_paid":
      return "المبلغ المدفوع غير صحيح أو أكبر من الإجمالي";
    case "invalid_status":
      return "حالة الطلب غير صحيحة";
    case "forbidden":
      return "ليست لديك صلاحية لهذا الإجراء";
    case "not_found":
      return "الطلب غير موجود";
    default:
      return "تعذر إتمام العملية. حاول مرة أخرى.";
  }
}

/**
 * Invoice link for an order the visitor just placed (needs its number and the phone it was placed
 * with). Undefined if it can't be fetched — the order itself is already recorded.
 */
export async function fetchInvoiceUrl(orderNumber: string, phone: string) {
  const { data } = await supabase.rpc("order_invoice_token", {
    _order_number: orderNumber,
    _phone: phone.trim(),
  });
  return invoiceUrl(data);
}
