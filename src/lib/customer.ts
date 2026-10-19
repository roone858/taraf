import { z } from "zod";

/** Delivery details for an order; the same rules place_order() enforces server-side. */
export const customerSchema = z.object({
  name: z.string().trim().min(3, "يرجى إدخال الاسم بالكامل").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/, "رقم الهاتف غير صحيح"),
  city: z.string().trim().min(2, "يرجى إدخال المدينة أو المحافظة").max(60),
  address: z.string().trim().min(8, "يرجى إدخال عنوان تفصيلي").max(300),
  notes: z.string().max(500).optional(),
});
export type CustomerForm = z.infer<typeof customerSchema>;

const KEY = "taraf-customer-v1";

/** Last-used delivery details on this device (never sent anywhere except with an order). */
export function loadCustomer(): Partial<CustomerForm> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<CustomerForm>) : {};
  } catch {
    return {};
  }
}

export function saveCustomer(c: CustomerForm) {
  try {
    const { notes: _notes, ...rest } = c;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Storage unavailable (private mode) — prefill is a convenience only
  }
}
