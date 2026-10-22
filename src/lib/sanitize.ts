/**
 * Allow-list HTML sanitizer for admin-authored policy content.
 *
 * The editor only produces a small set of formatting tags, so everything else is stripped. It runs
 * both before saving and again before rendering, and works in the browser and during SSR (no DOM
 * dependency). Attributes other than a validated `href` on links are always removed, which blocks
 * event handlers, inline styles and `javascript:` URLs.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "blockquote",
  "a",
  "hr",
  "span",
  "div",
]);

const VOID_TAGS = new Set(["br", "hr"]);
const DANGEROUS_TAGS =
  "script|style|iframe|object|embed|form|input|textarea|select|button|svg|math|meta|link|base|template|noscript";

const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/))/i;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const raw = decodeEntities((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
  if (!raw || !SAFE_HREF.test(raw)) return null;
  return raw;
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";

  // Remove whole dangerous elements first (including their text content)
  let html = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(new RegExp(`<(${DANGEROUS_TAGS})\\b[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<(${DANGEROUS_TAGS})\\b[^>]*\\/?>`, "gi"), "");

  html = html.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (_match, closing: string, name: string, attrs: string) => {
      const tag = name.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      if (VOID_TAGS.has(tag)) return `<${tag}>`;
      if (tag === "a") {
        const href = safeHref(attrs);
        // Drop the opening tag but keep its text; the stray closing tag is harmless
        if (!href) return "";
        return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return `<${tag}>`;
    },
  );

  return html.trim();
}

/** Plain text extracted from sanitized HTML, used for SEO descriptions and previews. */
export function htmlToText(input: string | null | undefined): string {
  const withSpaces = sanitizeHtml(input)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|h[2-4]|li|blockquote|div)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withSpaces).replace(/\s+/g, " ").trim();
}

export function isSafeHref(href: string) {
  return SAFE_HREF.test(href.trim());
}
