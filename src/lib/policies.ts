import type { Database } from "@/integrations/supabase/types";

export type PolicyPage = Database["public"]["Tables"]["policy_pages"]["Row"];
export type PolicyRevision = Database["public"]["Tables"]["policy_revisions"]["Row"];
export type PolicyStatus = Database["public"]["Enums"]["policy_status"];
export type PolicyLanguage = "ar" | "en";
export type PolicyKind = "privacy" | "terms" | "returns" | "shipping" | "cookies";

export const POLICY_LANGUAGES: { value: PolicyLanguage; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

export const POLICY_STATUSES: { value: PolicyStatus; label: string }[] = [
  { value: "draft", label: "مسودة" },
  { value: "published", label: "منشورة" },
  { value: "archived", label: "مؤرشفة" },
];

export const POLICY_KINDS: { value: PolicyKind; label: string }[] = [
  { value: "privacy", label: "الخصوصية" },
  { value: "terms", label: "الشروط والأحكام" },
  { value: "returns", label: "الاستبدال والاسترجاع" },
  { value: "shipping", label: "الشحن والتوصيل" },
  { value: "cookies", label: "ملفات الارتباط" },
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Paths owned by other routes; a policy with one of these slugs would never be reachable. */
const RESERVED_SLUGS = new Set([
  "policies",
  "shop",
  "custom",
  "checkout",
  "admin",
  "product",
  "en",
]);

export function isValidPolicySlug(value: string) {
  return (
    value.length >= 2 && value.length <= 80 && SLUG_RE.test(value) && !RESERVED_SLUGS.has(value)
  );
}

/** Turns arbitrary input into a URL-safe slug (Latin letters/digits). */
export function normalizePolicySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function policyPath(slug: string, language: PolicyLanguage) {
  return language === "en" ? `/en/${slug}` : `/${slug}`;
}

export function otherPolicyLanguage(language: PolicyLanguage): PolicyLanguage {
  return language === "en" ? "ar" : "en";
}

const SHORT_LABELS: Record<PolicyKind, Record<PolicyLanguage, string>> = {
  privacy: { ar: "الخصوصية", en: "Privacy" },
  terms: { ar: "الشروط والأحكام", en: "Terms" },
  returns: { ar: "الاستبدال والاسترجاع", en: "Returns" },
  shipping: { ar: "الشحن والتوصيل", en: "Shipping" },
  cookies: { ar: "ملفات الارتباط", en: "Cookies" },
};

/** Compact tab label: known kinds get a short name, custom pages keep their title. */
export function policyTabLabel(page: Pick<PolicyPage, "kind" | "title">, language: PolicyLanguage) {
  const kind = page.kind as PolicyKind | null;
  return (kind && SHORT_LABELS[kind]?.[language]) || page.title;
}

/**
 * Gives every `<h2>` in (already sanitized) policy HTML a stable id, and returns the list of
 * sections for the in-page contents.
 */
export function withSectionAnchors(html: string) {
  const sections: { id: string; title: string }[] = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
    const id = `section-${sections.length + 1}`;
    const title = inner
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
    sections.push({ id, title });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, sections: sections.filter((s) => s.title) };
}

export function policyStatusLabel(status: PolicyStatus) {
  return POLICY_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function policyKindLabel(kind: string | null) {
  return POLICY_KINDS.find((k) => k.value === kind)?.label ?? "صفحة قانونية";
}

export function policyLanguageLabel(language: string) {
  return language === "en" ? "English" : "العربية";
}

export function formatPolicyDate(date: string, language: PolicyLanguage) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

/** Today as a `yyyy-mm-dd` string for date inputs and new drafts. */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
