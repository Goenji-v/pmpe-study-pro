import { parsearJsonDaIA } from "./jsonIa.ts";
import { normalizarRespostaAnaliseEdital } from "./editalInteligente.ts";

export function interpretarRespostaAnaliseEdital(texto: string) {
  return normalizarRespostaAnaliseEdital(
    parsearJsonDaIA(texto, "o edital")
  );
}
