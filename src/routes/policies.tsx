import { createFileRoute } from "@tanstack/react-router";
import { publishedPoliciesQuery, policyQuery } from "@/lib/data";
import { pageHead } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { htmlToText } from "@/lib/sanitize";
import { PolicyPageView } from "@/components/PolicyPage";

/**
 * /policies — entry point to the tabbed policies page, opened on the first published policy.
 * Its canonical URL is that policy's own address, so the content is indexed once.
 */
export const Route = createFileRoute("/policies")({
  loader: async ({ context }) => {
    const [{ s, seo, store }, others] = await Promise.all([
      loadSeo(context.queryClient),
      context.queryClient.ensureQueryData(publishedPoliciesQuery("ar")).catch(() => []),
    ]);
    const page = others?.[0] ?? null;
    const counterpart = page
      ? await context.queryClient.ensureQueryData(policyQuery(page.slug, "en")).catch(() => null)
      : null;
    return { s, seo, store, page, others: others ?? [], counterpart };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { seo, store, page } = loaderData;
    return pageHead({
      seo,
      store,
      title: "السياسات والشروط",
      description: page
        ? page.seo_description || htmlToText(page.content)
        : `سياسات ${store}: الخصوصية، الشروط والأحكام، الاستبدال والاسترجاع، والشحن والتوصيل.`,
      path: page ? `/${page.slug}` : "/policies",
      noindex: !page,
    });
  },
  component: PoliciesHub,
});

function PoliciesHub() {
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
