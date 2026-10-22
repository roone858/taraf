import { createFileRoute } from "@tanstack/react-router";
import { publishedPoliciesQuery, policyQuery } from "@/lib/data";
import { pageHead } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { htmlToText } from "@/lib/sanitize";
import { PolicyPageView } from "@/components/PolicyPage";

/**
 * Public policy page (Arabic, default language): /privacy-policy, /terms-and-conditions, etc.
 * Slugs are managed in Admin → Policies. Only published rows are exposed; anything else renders a
 * legal-specific not-found page with noindex.
 */
export const Route = createFileRoute("/$slug")({
  loader: async ({ context, params }) => {
    const [{ s, seo, store }, page, others, counterpart] = await Promise.all([
      loadSeo(context.queryClient),
      context.queryClient.ensureQueryData(policyQuery(params.slug, "ar")).catch(() => null),
      context.queryClient.ensureQueryData(publishedPoliciesQuery("ar")).catch(() => []),
      context.queryClient.ensureQueryData(policyQuery(params.slug, "en")).catch(() => null),
    ]);
    return { s, seo, store, page, others: others ?? [], counterpart };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { seo, store, page } = loaderData;
    if (!page) {
      return pageHead({
        seo,
        store,
        title: "الصفحة غير موجودة",
        description: "هذه الصفحة القانونية غير متاحة أو لم تُنشر بعد.",
        noindex: true,
      });
    }
    return pageHead({
      seo,
      store,
      title: page.seo_title || page.title,
      description: page.seo_description || htmlToText(page.content),
      path: `/${page.slug}`,
    });
  },
  component: ArabicPolicyRoute,
});

function ArabicPolicyRoute() {
  const { page, others, counterpart, s } = Route.useLoaderData();
  return (
    <PolicyPageView
      page={page}
      others={others}
      counterpart={counterpart}
      language="ar"
      whatsappNumber={s?.whatsapp_number ?? null}
    />
  );
}
