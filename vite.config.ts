import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const commitCompleto = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const commit = commitCompleto?.slice(0, 8);
const referencia = process.env.VERCEL_GIT_COMMIT_REF;
const versaoApp = commit
  ? `${referencia || "deploy"}@${commit}`
  : "local";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "study-pro-version-file",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(
            {
              version: versaoApp,
              commit: commitCompleto || null,
              ref: referencia || null,
            },
            null,
            2
          ),
        });
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(versaoApp),
    __SENTRY_RELEASE__: JSON.stringify(commitCompleto || "local"),
  },
  build: {
    sourcemap: true,
  },
});
