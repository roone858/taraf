import { buildInvoiceMessage, buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/whatsapp";
import { orderStatusLabel, type Order, type OrderItem } from "@/lib/orders";
import { WhatsappIcon } from "./BrandIcons";
import { Button } from "@/components/ui/button";

/** Opens a WhatsApp chat with the customer, pre-filled with the invoice as text. */
export function SendInvoiceWhatsapp({
  order,
  storeName,
  currency,
  className,
}: {
  order: Order & { order_items: OrderItem[] };
  storeName: string | undefined;
  currency: string | undefined;
  className?: string;
}) {
  const phone = normalizeWhatsappNumber(order.phone);
  if (!phone) return null;

  const message = buildInvoiceMessage({
    storeName: storeName || "TARAF FURNITURE",
    orderNumber: order.order_number,
    createdAt: order.created_at,
    customerName: order.customer_name,
    statusLabel: orderStatusLabel[order.status],
    currency: order.currency || currency || "EGP",
    items: order.order_items,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    total: Number(order.total),
  });

  return (
    <Button asChild variant="outline" className={className}>
      <a
        href={buildWhatsappUrl(phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        title={`إرسال الفاتورة إلى ${order.phone}`}
        className="gap-2"
      >
        <WhatsappIcon className="h-4 w-4" /> إرسال عبر واتساب
      </a>
    </Button>
  );
}
