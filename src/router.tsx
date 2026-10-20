import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Queries filled by route loaders during SSR are shipped to the browser, so the first render
    // there matches the server HTML (real content for search engines and link previews).
    // Sent as a JSON string: the cache only holds plain database rows
    dehydrate: () => ({ queryState: JSON.stringify(dehydrate(queryClient)) }),
    hydrate: (d) => hydrate(queryClient, JSON.parse(d.queryState) as DehydratedState),
  });

  return router;
};
