import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type CustomRequest = Database["public"]["Tables"]["custom_requests"]["Row"];
export type CustomRequestStatus = Database["public"]["Enums"]["custom_request_status"];

/** Workflow order, as shown in the admin. */
export const CUSTOM_STATUSES: CustomRequestStatus[] = [
  "new",
  "contacted",
  "quoted",
  "in_production",
  "delivered",
  "closed",
];

export const customStatusLabel: Record<CustomRequestStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  quoted: "تم إرسال العرض",
  in_production: "قيد التصنيع",
  delivered: "تم التسليم",
  closed: "مغلق",
};

/** Private bucket for visitors' reference photos (anyone uploads into refs/, admins read). */
export const REFS_BUCKET = "custom-requests";
export const MAX_REFS = 5;
export const MAX_REF_BYTES = 8 * 1024 * 1024;
const REF_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** "١٢٠٫٥" → "120.5": phones with an Arabic keyboard type Eastern Arabic digits. */
export function toLatinDigits(v: string) {
  return v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".");
}

/** Centimetres as a number, or null when blank/invalid. */
export function cm(v: string | undefined) {
  const n = Number(toLatinDigits((v ?? "").trim()));
  return v?.trim() && Number.isFinite(n) && n > 0 && n <= 1000 ? n : null;
}

const dimension = z
  .string()
  .trim()
  .max(10)
  .refine((v) => !v || cm(v) != null, "أدخل رقماً بالسنتيمتر (حتى 1000)")
  .optional();

/** The same rules submit_custom_request() enforces server-side. */
export const customRequestSchema = z.object({
  name: z.string().trim().min(3, "يرجى إدخال الاسم بالكامل").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/, "رقم الهاتف غير صحيح"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "البريد الإلكتروني غير صحيح")
    .optional(),
  city: z.string().trim().min(2, "يرجى إدخال مدينة التوصيل").max(120),
  furniture_type: z.string().trim().min(2, "اختر نوع القطعة").max(80),
  description: z
    .string()
    .trim()
    .min(10, "صف القطعة في جملة أو جملتين على الأقل")
    .max(2000, "الوصف أطول من المسموح (2000 حرف)"),
  width: dimension,
  depth: dimension,
  height: dimension,
  budget: z.string().trim().max(80).optional(),
  materials: z.string().trim().max(300).optional(),
});
export type CustomRequestForm = z.infer<typeof customRequestSchema>;

/** "200 × 90 × 85 سم (عرض × عمق × ارتفاع)" from whichever of the three were filled. */
export function formatDimensions(f: Pick<CustomRequestForm, "width" | "depth" | "height">) {
  const parts = (
    [
      ["عرض", cm(f.width)],
      ["عمق", cm(f.depth)],
      ["ارتفاع", cm(f.height)],
    ] as const
  ).filter(([, v]) => v != null);
  if (!parts.length) return "";
  return `${parts.map(([, v]) => v).join(" × ")} سم (${parts.map(([k]) => k).join(" × ")})`;
}

export function validateReference(file: File): string | null {
  if (!REF_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name))
    return "الصيغ المدعومة: JPG، PNG، WEBP، HEIC";
  if (file.size > MAX_REF_BYTES) return "حجم الصورة أكبر من 8 ميجابايت";
  return null;
}

/** Uploads one reference photo and returns its storage path (refs/<uuid>.<ext>). */
export async function uploadReference(file: File) {
  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `refs/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(REFS_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

/** Translates error codes raised by submit_custom_request() into Arabic messages. */
export function customRequestErrorMessage(message: string | undefined): string {
  switch ((message ?? "").split(":")[0]) {
    case "invalid_phone":
      return "رقم الهاتف غير صحيح";
    case "invalid_email":
      return "البريد الإلكتروني غير صحيح";
    case "invalid_request":
      return "يرجى استكمال الحقول المطلوبة";
    case "invalid_images":
      return "تعذر إرفاق الصور. احذفها وأعد رفعها.";
    case "rate_limited":
      return "تم استلام عدة طلبات من هذا الرقم خلال الساعة الأخيرة. يرجى الانتظار قليلاً أو التواصل معنا عبر واتساب.";
    default:
      return "تعذر إرسال الطلب. تحقق من الاتصال وحاول مرة أخرى.";
  }
}

/** WhatsApp summary sent after the request is recorded (photos are attached in the chat). */
export function buildCustomRequestMessage(
  number: string,
  f: CustomRequestForm,
  photoCount: number,
) {
  const dims = formatDimensions(f);
  return [
    "طلب تفصيل جديد من موقع TARAF FURNITURE",
    `رقم الطلب: ${number}`,
    "",
    `الاسم: ${f.name}`,
    `الهاتف: ${f.phone}`,
    `مدينة التوصيل: ${f.city}`,
    "",
    `نوع القطعة: ${f.furniture_type}`,
    ...(dims ? [`المقاسات: ${dims}`] : []),
    ...(f.materials?.trim() ? [`الخامات المفضلة: ${f.materials.trim()}`] : []),
    ...(f.budget?.trim() ? [`الميزانية التقريبية: ${f.budget.trim()}`] : []),
    "",
    `الوصف: ${f.description.trim()}`,
    ...(photoCount ? ["", `أرفقت ${photoCount} صورة مرجعية مع الطلب.`] : []),
  ].join("\n");
}

/* ---------- Completed projects (store_settings.custom_projects) ---------- */

export type CustomProject = { image: string; title: string; note: string };

export function parseProjects(raw: Json | undefined | null): CustomProject[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return [];
    const o = x as Record<string, unknown>;
    const image = typeof o["image"] === "string" ? o["image"] : "";
    if (!image) return [];
    return [
      {
        image,
        title: typeof o["title"] === "string" ? o["title"] : "",
        note: typeof o["note"] === "string" ? o["note"] : "",
      },
    ];
  });
}
