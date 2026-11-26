import { createContext, useContext } from "react";
import type { EscopoFsrs } from "../../services/inteligenciaRevisao/checkpoint";
import type { FilaFsrs, PropostaFsrs } from "../../services/inteligenciaRevisao/sincronizacao";

export type Status = "aguardando" | "offline" | "online" | "erro";
type DadosFsrs = {
  escopo: EscopoFsrs; fila: FilaFsrs; status: Status;
  publicar: (proposta: PropostaFsrs) => Promise<"ok" | "conflito">;
};
export const ContextoFsrs = createContext<DadosFsrs | undefined>(undefined);
export function useFsrsCompartilhado() { return useContext(ContextoFsrs); }
