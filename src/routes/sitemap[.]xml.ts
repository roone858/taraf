import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizeOrigin, parseSeo } from "@/lib/seo";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : undefined);

/**
 * /sitemap.xml — built from the database on request, cached for an hour at the edge, so new
 * products appear without any manual step. Includes product images for Google Images.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [settings, products, categories, policies] = await Promise.all([
          supabase.from("store_settings").select("seo, updated_at").eq("id", 1).maybeSingle(),
          supabase
            .from("products")
            .select("slug, name, images, updated_at")
            .eq("is_published", true)
            .order("updated_at", { ascending: false })
            .limit(5000),
          supabase
            .from("categories")
            .select("slug, created_at")
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("policy_pages")
            .select("slug, language, updated_at")
            .eq("status", "published")
            .order("sort_order"),
        ]);
        if (products.error || categories.error || policies.error) {
          return new Response("Sitemap unavailable", {
            status: 503,
            headers: { "Retry-After": "300" },
          });
        }

        const origin =
          parseSeo(settings.data?.seo).siteUrl ||
          normalizeOrigin(
            process.env["SITE_URL"] || process.env["VERCEL_PROJECT_PRODUCTION_URL"],
          ) ||
          new URL(request.url).origin;
        const latest = products.data[0]?.updated_at;
        const url = (loc: string, lastmod?: string, extra = "") =>
          `  <url>\n    <loc>${esc(origin + loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}${extra}\n  </url>`;

        const entries = [
          url("/", day(settings.data?.updated_at ?? latest)),
          url("/shop", day(latest)),
          url("/custom", day(settings.data?.updated_at)),
          ...categories.data.map((c) =>
            url(`/shop?cat=${encodeURIComponent(c.slug)}`, day(latest)),
          ),
          ...policies.data.map((p) =>
            url(p.language === "en" ? `/en/${p.slug}` : `/${p.slug}`, day(p.updated_at)),
          ),
          ...products.data.map((p) =>
            url(
              `/product/${encodeURIComponent(p.slug)}`,
              day(p.updated_at),
              p.images
                .slice(0, 5)
                .map(
                  (img) =>
                    `\n    <image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(p.name)}</image:title></image:image>`,
                )
                .join(""),
            ),
          ),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
