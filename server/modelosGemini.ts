export const MODELO_GEMINI_PADRAO = "gemini-3.1-flash-lite";
export const MODELO_GEMINI_RESERVA = "gemini-3.6-flash";

function resolverModelo(valor: string | undefined, padrao: string) {
  const modelo = valor?.trim().replace(/^models\//, "") || padrao;
  // Configurações antigas do Render podem sobreviver à atualização do blueprint.
  // O 2.5 Flash passou a retornar 404 para esta integração; migre também o override.
  return modelo === "gemini-2.5-flash" ? MODELO_GEMINI_RESERVA : modelo;
}

export function resolverModelosGemini(ambiente: Record<string, string | undefined>) {
  return {
    modelo: resolverModelo(ambiente.GEMINI_MODEL, MODELO_GEMINI_PADRAO),
    modeloFallback: resolverModelo(ambiente.GEMINI_FALLBACK_MODEL, MODELO_GEMINI_RESERVA),
  };
}

export function parametrosExtracaoGemini(modelo: string): { temperature?: number } {
  // Gemini 3.6/3.7 não aceitam parâmetros de amostragem. Preserve o ajuste apenas
  // no modelo primário que já o suporta; novos modelos usam seus padrões.
  return modelo === MODELO_GEMINI_PADRAO ? { temperature: 0 } : {};
}
