import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { normalizeOrigin, parseSeo } from "@/lib/seo";

/** /robots.txt — dynamic so the Sitemap line always carries the configured site URL. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { data } = await supabase
          .from("store_settings")
          .select("seo")
          .eq("id", 1)
          .maybeSingle();
        const origin =
          parseSeo(data?.seo).siteUrl ||
          normalizeOrigin(
            process.env["SITE_URL"] || process.env["VERCEL_PROJECT_PRODUCTION_URL"],
          ) ||
          new URL(request.url).origin;
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /checkout",
          // Search results and filter combinations are endless; the listing itself stays crawlable
          "Disallow: /shop?q=",
          "Disallow: /shop?*&q=",
          "",
          `Sitemap: ${origin}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
