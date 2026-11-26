import type { CorsOptions } from "cors";
import { frontendStaging, isStaging } from "./backendEnvironment.ts";

export function origemPermitida(origem: string | undefined, env = process.env) {
  if (!origem) return true;
  if (isStaging(env)) return origem === frontendStaging;
  if (origem === frontendStaging) return false;
  const local = !env.RENDER && env.NODE_ENV !== "production";
  if (local && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origem)) return true;
  return origem === "https://pmpe-study-pro-two.vercel.app" ||
    (env.FRONTEND_URL || "").split(",").some(item => item.trim() === origem);
}

export const corsOptions: CorsOptions = {
  credentials: false,
  origin(origem, callback) {
    if (origemPermitida(origem)) callback(null, true);
    else callback(new Error("Origem não autorizada pelo CORS."));
  },
};
