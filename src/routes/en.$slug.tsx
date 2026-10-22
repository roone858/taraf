import { createFileRoute } from "@tanstack/react-router";
import { publishedPoliciesQuery, policyQuery } from "@/lib/data";
import { pageHead } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { htmlToText } from "@/lib/sanitize";
import { PolicyPageView } from "@/components/PolicyPage";

/** Public English policy page: /en/privacy-policy, /en/terms-and-conditions, etc. */
export const Route = createFileRoute("/en/$slug")({
  loader: async ({ context, params }) => {
    const [{ s, seo, store }, page, others, counterpart] = await Promise.all([
      loadSeo(context.queryClient),
      context.queryClient.ensureQueryData(policyQuery(params.slug, "en")).catch(() => null),
      context.queryClient.ensureQueryData(publishedPoliciesQuery("en")).catch(() => []),
      context.queryClient.ensureQueryData(policyQuery(params.slug, "ar")).catch(() => null),
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
        title: "Page not found",
        description: "This legal page is unavailable or has not been published yet.",
        noindex: true,
      });
    }
    return pageHead({
      seo,
      store,
      title: page.seo_title || page.title,
      description: page.seo_description || htmlToText(page.content),
      path: `/en/${page.slug}`,
    });
  },
  component: EnglishPolicyRoute,
});

function EnglishPolicyRoute() {
  const { page, others, counterpart, s } = Route.useLoaderData();
  return (
    <PolicyPageView
      page={page}
      others={others}
      counterpart={counterpart}
      language="en"
      whatsappNumber={s?.whatsapp_number ?? null}
    />
  );
}
