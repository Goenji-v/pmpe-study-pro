import type { CorsOptions } from "cors";

const origensPermitidas = new Set(
  [
    "https://pmpe-study-pro-two.vercel.app",
    "https://pmpe-study-pro-git-preview-simulado-pdf-f-84a165-pmpe-study-pro.vercel.app",
    ...(process.env.FRONTEND_URL || "")
      .split(",")
      .map((origem) => origem.trim())
      .filter(Boolean),
  ]
);

export const corsOptions: CorsOptions = {
  origin(origem, callback) {
    if (!origem) {
      callback(null, true);
      return;
    }

    const origemLocal =
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origem);

    if (
      origemLocal ||
      origensPermitidas.has(origem)
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error("Origem não autorizada pelo CORS.")
    );
  },
};
