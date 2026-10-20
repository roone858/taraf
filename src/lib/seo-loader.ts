import type { QueryClient } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/data";
import { normalizeOrigin, parseSeo, storeName } from "@/lib/seo";

/**
 * Store settings + SEO settings for a route loader. Never throws: a page still renders (with
 * generic tags) if the database is unreachable.
 */
export async function loadSeo(queryClient: QueryClient) {
  const s = await queryClient.ensureQueryData(settingsQuery).catch(() => null);
  const seo = parseSeo(s?.seo);
  if (!seo.siteUrl) seo.siteUrl = fallbackOrigin();
  return { s, seo, store: storeName(s) };
}

/** Used until a site URL is saved in Admin → تحسين الظهور. */
function fallbackOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  if (typeof process === "undefined") return "";
  return normalizeOrigin(
    process.env["SITE_URL"] ||
      process.env["VERCEL_PROJECT_PRODUCTION_URL"] ||
      process.env["VERCEL_URL"],
  );
}
