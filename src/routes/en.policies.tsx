import { createFileRoute } from "@tanstack/react-router";
import { publishedPoliciesQuery, policyQuery } from "@/lib/data";
import { pageHead } from "@/lib/seo";
import { loadSeo } from "@/lib/seo-loader";
import { htmlToText } from "@/lib/sanitize";
import { PolicyPageView } from "@/components/PolicyPage";

/** /en/policies — English entry point to the tabbed policies page (see /policies). */
export const Route = createFileRoute("/en/policies")({
  loader: async ({ context }) => {
    const [{ s, seo, store }, others] = await Promise.all([
      loadSeo(context.queryClient),
      context.queryClient.ensureQueryData(publishedPoliciesQuery("en")).catch(() => []),
    ]);
    const page = others?.[0] ?? null;
    const counterpart = page
      ? await context.queryClient.ensureQueryData(policyQuery(page.slug, "ar")).catch(() => null)
      : null;
    return { s, seo, store, page, others: others ?? [], counterpart };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { seo, store, page } = loaderData;
    return pageHead({
      seo,
      store,
      title: "Policies",
      description: page
        ? page.seo_description || htmlToText(page.content)
        : `${store} policies: privacy, terms, returns and delivery.`,
      path: page ? `/en/${page.slug}` : "/en/policies",
      noindex: !page,
    });
  },
  component: PoliciesHubEn,
});

function PoliciesHubEn() {
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
