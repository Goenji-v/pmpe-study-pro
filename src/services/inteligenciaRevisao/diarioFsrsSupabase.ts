import { supabase } from "../../lib/supabase";
import type { DiarioCompartilhado, RespostaFsrs } from "./sincronizacao";

export const diarioFsrsSupabase: DiarioCompartilhado = {
  async trocar(escopo, lote, proposta) {
    const { data, error } = await supabase.rpc("sincronizar_fsrs_v1", {
      p_usuario: escopo.usuarioId, p_epoca: escopo.epoca, p_eventos: lote,
      p_revisao: proposta?.revisao ?? null, p_revisao_eventos: proposta?.revisaoEventos ?? null,
      p_checkpoint: proposta?.checkpoint ?? null,
    }).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error(`Sincronização FSRS recusada (${error.code || "rede"}).`);
    const resposta = data as RespostaFsrs | null;
    if (!resposta || !Array.isArray(resposta.eventos) ||
        ![resposta.revisao, resposta.revisaoEventos, resposta.revisaoLegado].every(n => Number.isSafeInteger(n) && n >= 0) ||
        !["ok", "conflito"].includes(resposta.resultado)) throw new Error("Resposta inválida da sincronização FSRS.");
    return resposta;
  },
};
