import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react" }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    {
      name: "cloudflare-stub",
      resolveId(id) {
        if (id.startsWith("cloudflare:")) {
          return "\0" + id;
        }
        return null;
      },
      load(id) {
        if (id.startsWith("\0cloudflare:")) {
          return "export default {};";
        }
        return null;
      },
    },
  ],
});
