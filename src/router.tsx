import { QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// A bundle opened directly from disk (file://) has an opaque origin that
// browser-history routes cannot use. Hash history keeps client routing
// working in that case; normal HTTP/S3 hosting still uses clean URLs.
const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    history: isFileProtocol ? createHashHistory() : undefined,
  });

  return router;
};
