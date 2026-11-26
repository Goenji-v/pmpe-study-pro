import { validatePreview } from "./scripts/previewEnvironment.ts";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const commitCompleto = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const commit = commitCompleto?.slice(0, 8);
const referencia = process.env.VERCEL_GIT_COMMIT_REF;
const versaoApp = commit
  ? `${referencia || "deploy"}@${commit}`
  : "local";

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const preview = mode === "preview" || env.VERCEL_ENV === "preview" ||
    env.VERCEL_GIT_COMMIT_REF === "preview/fsrs-revisoes-20261123" ||
    (env.VERCEL === "1" && env.VERCEL_ENV !== "production");
  if (command === "build" && preview) validatePreview(env);
  return {
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
};
});
