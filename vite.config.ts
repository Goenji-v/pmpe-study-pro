import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8);
const referencia = process.env.VERCEL_GIT_COMMIT_REF;
const versaoApp = commit
  ? `${referencia || "deploy"}@${commit}`
  : "local";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versaoApp),
  },
});
