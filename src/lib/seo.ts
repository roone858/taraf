import type { Json } from "@/integrations/supabase/types";
import type { Category, Product, Settings } from "@/lib/data";
import { effectivePrice } from "@/lib/format";
import { priceRange } from "@/lib/sizes";

/**
 * SEO for the storefront. Everything here works with zero admin input: page titles, descriptions,
 * share images and structured data are built from product / category / store data. Values set in
 * Admin → تحسين الظهور (store_settings.seo, products.seo_*, categories.seo_*) override them.
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export type SeoSettings = {
  /** Public origin, e.g. https://taraf.sa — used for canonical URLs, share images and the sitemap. */
  siteUrl: string;
  /** `{title}` is replaced by the page title, `{store}` by the store name. */
  titleTemplate: string;
  homeTitle: string;
  homeDescription: string;
  shareImage: string;
  googleVerification: string;
};

export const DEFAULT_SEO: SeoSettings = {
  siteUrl: "",
  titleTemplate: "{title} | {store}",
  homeTitle: "",
  homeDescription: "",
  shareImage: "",
  googleVerification: "",
};

const FALLBACK_STORE = "TARAF FURNITURE";
const FALLBACK_IMAGE = "/images/hero.jpg";

export function parseSeo(raw: Json | undefined | null): SeoSettings {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const str = (k: keyof SeoSettings) => {
    const v = (o as Record<string, unknown>)[k];
    return typeof v === "string" ? v.trim() : DEFAULT_SEO[k];
  };
  return {
    siteUrl: normalizeOrigin(str("siteUrl")),
    titleTemplate: str("titleTemplate") || DEFAULT_SEO.titleTemplate,
    homeTitle: str("homeTitle"),
    homeDescription: str("homeDescription"),
    shareImage: str("shareImage"),
    googleVerification: extractVerification(str("googleVerification")),
  };
}

/** "taraf.sa/" → "https://taraf.sa"; anything unparsable → "". */
export function normalizeOrigin(value: string | undefined | null): string {
  const v = value?.trim();
  if (!v) return "";
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin;
  } catch {
    return "";
  }
}

/** Accepts the bare token or the whole `<meta name="google-site-verification" content="…">` tag. */
export function extractVerification(value: string): string {
  const m = value.match(/content=["']([^"']+)["']/i);
  return (m?.[1] ?? value).trim();
}

/** Collapses whitespace and cuts at a word boundary. */
export function clip(text: string | null | undefined, max = DESCRIPTION_MAX): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s،,.؛:-]+$/, "")}…`;
}

export function absUrl(siteUrl: string, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return siteUrl ? `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}` : undefined;
}

export function storeName(s: Settings | null | undefined) {
  return s?.store_name?.trim() || FALLBACK_STORE;
}

export function fullTitle(seo: SeoSettings, store: string, title: string) {
  if (!title || title === store) return store;
  return seo.titleTemplate.replace(/\{title\}/g, title).replace(/\{store\}/g, store);
}

type MetaTag = Record<string, string>;
type Head = {
  meta: MetaTag[];
  links: { rel: string; href: string }[];
  scripts: { type: string; children: string }[];
};

/** Title, description, canonical, Open Graph and Twitter tags for one page. */
export function pageHead(opts: {
  seo: SeoSettings;
  store: string;
  /** Page title before the template is applied; omit for the bare store name. */
  title?: string | undefined;
  /** Used as-is instead of applying the template. */
  rawTitle?: string | undefined;
  description?: string | undefined;
  image?: string | null | undefined;
  /** Path such as /product/x — made absolute with the site URL. */
  path?: string | undefined;
  type?: "website" | "product" | undefined;
  noindex?: boolean | undefined;
  extraMeta?: MetaTag[] | undefined;
  jsonLd?: object[] | undefined;
}): Head {
  const { seo, store } = opts;
  const title = opts.rawTitle || fullTitle(seo, store, opts.title ?? "");
  const description = clip(opts.description);
  const url = opts.path != null ? absUrl(seo.siteUrl, opts.path) : undefined;
  const image = absUrl(seo.siteUrl, opts.image || seo.shareImage || FALLBACK_IMAGE);

  const meta: MetaTag[] = [
    { title },
    { property: "og:title", content: title },
    { name: "twitter:title", content: title },
    { property: "og:type", content: opts.type ?? "website" },
  ];
  if (description) {
    meta.push(
      { name: "description", content: description },
      { property: "og:description", content: description },
      { name: "twitter:description", content: description },
    );
  }
  if (image)
    meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
  if (url) meta.push({ property: "og:url", content: url });
  if (opts.noindex) meta.push({ name: "robots", content: "noindex, follow" });
  if (opts.extraMeta) meta.push(...opts.extraMeta);

  return {
    meta,
    links: url && !opts.noindex ? [{ rel: "canonical", href: url }] : [],
    scripts: (opts.jsonLd ?? []).map((o) => ({
      type: "application/ld+json",
      // `<` escaped so text from the database can't close the script tag
      children: JSON.stringify(o).replace(/</g, "\\u003c"),
    })),
  };
}

/** robots: noindex for pages that must never appear in search (admin, checkout, invoices). */
export const NOINDEX = { meta: [{ name: "robots", content: "noindex, nofollow" }] };

// ── Structured data (schema.org) ───────────────────────────────────────────────────────────────

const AVAILABILITY: Record<string, string> = {
  in_stock: "https://schema.org/InStock",
  made_to_order: "https://schema.org/PreOrder",
  unavailable: "https://schema.org/OutOfStock",
};

type ProductWithCategory = Product & { categories?: Pick<Category, "name" | "slug"> | null };

export function productJsonLd(
  p: ProductWithCategory,
  s: Settings | null | undefined,
  seo: SeoSettings,
) {
  const url = absUrl(seo.siteUrl, `/product/${p.slug}`);
  const currency = s?.currency ?? "SAR";
  const out =
    p.availability === "unavailable" || (p.availability === "in_stock" && p.stock <= 0)
      ? AVAILABILITY["unavailable"]
      : (AVAILABILITY[p.availability] ?? AVAILABILITY["in_stock"]);
  const range = priceRange(p);
  const offers =
    range.min !== range.max
      ? {
          "@type": "AggregateOffer",
          priceCurrency: currency,
          lowPrice: range.min,
          highPrice: range.max,
          availability: out,
          url,
        }
      : {
          "@type": "Offer",
          priceCurrency: currency,
          price: effectivePrice(p),
          availability: out,
          itemCondition: "https://schema.org/NewCondition",
          url,
        };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: clip(p.seo_description || p.description, 500) || undefined,
    image: p.images.length ? p.images : undefined,
    sku: p.sku || undefined,
    category: p.categories?.name,
    material: p.materials || undefined,
    brand: { "@type": "Brand", name: storeName(s) },
    url,
    offers,
  };
}

export function breadcrumbJsonLd(seo: SeoSettings, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(seo.siteUrl, it.path),
    })),
  };
}

/** The store itself, plus the site-search action that lets Google show a search box. */
export function storeJsonLd(s: Settings | null | undefined, seo: SeoSettings) {
  const sameAs = [s?.instagram_url, s?.facebook_url, s?.snapchat_url, s?.twitter_url].filter(
    (x): x is string => !!x,
  );
  const store = {
    "@context": "https://schema.org",
    "@type": "FurnitureStore",
    name: storeName(s),
    url: seo.siteUrl || undefined,
    logo: absUrl(seo.siteUrl, "/assets/brand/emblem.png"),
    image: absUrl(seo.siteUrl, s?.hero_image_url || seo.shareImage || FALLBACK_IMAGE),
    telephone: s?.contact_phone || undefined,
    email: s?.contact_email || undefined,
    address: s?.address ? { "@type": "PostalAddress", streetAddress: s.address } : undefined,
    currenciesAccepted: s?.currency ?? undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  const site = seo.siteUrl
    ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: storeName(s),
        url: seo.siteUrl,
        inLanguage: "ar",
        potentialAction: {
          "@type": "SearchAction",
          target: `${seo.siteUrl}/shop?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      }
    : null;
  return site ? [store, site] : [store];
}

// ── Admin health check ─────────────────────────────────────────────────────────────────────────

export type SeoIssue = {
  kind: "product" | "category";
  id: string;
  name: string;
  problem: string;
  severity: "high" | "low";
};

export function seoIssues(
  products: Pick<
    Product,
    "id" | "name" | "description" | "images" | "seo_description" | "seo_title"
  >[],
  categories: Pick<Category, "id" | "name" | "description" | "image_url" | "seo_description">[],
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const names = new Map<string, number>();
  for (const p of products) names.set(p.name.trim(), (names.get(p.name.trim()) ?? 0) + 1);

  for (const p of products) {
    const desc = (p.seo_description || p.description || "").trim();
    const base = { kind: "product" as const, id: p.id, name: p.name };
    if (!p.images.length) issues.push({ ...base, problem: "بدون صور", severity: "high" });
    if (!desc) issues.push({ ...base, problem: "بدون وصف", severity: "high" });
    else if (desc.length < 50)
      issues.push({ ...base, problem: "الوصف قصير جداً", severity: "low" });
    if ((names.get(p.name.trim()) ?? 0) > 1)
      issues.push({ ...base, problem: "الاسم مكرر لمنتج آخر", severity: "low" });
    if (p.seo_title && p.seo_title.length > TITLE_MAX)
      issues.push({ ...base, problem: "عنوان الظهور أطول من 60 حرفاً", severity: "low" });
  }
  for (const c of categories) {
    const base = { kind: "category" as const, id: c.id, name: c.name };
    if (!(c.seo_description || c.description)?.trim())
      issues.push({ ...base, problem: "بدون وصف", severity: "high" });
    if (!c.image_url) issues.push({ ...base, problem: "بدون صورة", severity: "low" });
  }
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}
