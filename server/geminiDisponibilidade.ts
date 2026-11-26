import type { RequestHandler, Response } from "express";
import { geminiDesativadoNoStaging } from "./backendEnvironment.ts";

export function responderGeminiDesativado(res: Response) {
  res.status(503).json({
    sucesso: false,
    codigo: "GEMINI_DESATIVADO_STAGING",
    erro: "As funcionalidades de IA estão temporariamente indisponíveis neste ambiente.",
  });
}

export const bloquearGeminiDesativado: RequestHandler = (_req, res, next) => {
  if (geminiDesativadoNoStaging(process.env)) {
    responderGeminiDesativado(res);
    return;
  }
  next();
};
