import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { getRouter } from "./router";

import "./styles.css";

// Static servers and S3 object URLs can request the entry point as
// `/index.html`. Strip it before the router is created so the app renders
// instead of its 404 route.
if (typeof window !== "undefined" && window.location.protocol !== "file:") {
  const { pathname, search, hash } = window.location;
  if (pathname.endsWith("/index.html")) {
    window.history.replaceState(null, "", pathname.slice(0, -"index.html".length) + search + hash);
  }
}

const router = getRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
