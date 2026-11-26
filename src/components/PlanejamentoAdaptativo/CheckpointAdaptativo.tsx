import { useEffect, useState } from "react";
import { prepararCheckpoint, type EscopoFsrs } from "../../services/inteligenciaRevisao/checkpoint";
import { transporteFsrsLocal } from "../../services/inteligenciaRevisao/checkpointLocal";
import type { EntradaPlano, PlanoAdaptativo } from "../../services/inteligenciaRevisao/plano";

export default function CheckpointAdaptativo({ escopo, entrada, plano }: {
  escopo: EscopoFsrs; entrada?: EntradaPlano; plano?: PlanoAdaptativo;
}) {
  const [base, definirBase] = useState<number>();
  const [estado, definirEstado] = useState<"pronto" | "gravando" | "conflito" | "erro">("pronto");
  useEffect(() => {
    let ativo = true;
    transporteFsrsLocal.ler(escopo).then(registro => {
      if (ativo) definirBase(registro?.revisao ?? 0);
    }, () => { if (ativo) definirEstado("erro"); });
    return () => { ativo = false; };
  }, [escopo]);

  async function salvar() {
    if (!entrada || !plano || base === undefined || estado === "gravando" || estado === "conflito") return;
    definirEstado("gravando");
    try {
      const resultado = await transporteFsrsLocal.confirmar(prepararCheckpoint(escopo, entrada, plano), base);
      if (resultado.status === "conflito") {
        definirEstado("conflito");
        return;
      }
      definirBase(resultado.registro.revisao);
      definirEstado("pronto");
    } catch {
      definirEstado("erro");
    }
  }

  return <div>
    {estado === "conflito" ? <p role="alert">Outra aba salvou uma versão diferente. Recarregue para conferir o histórico antes de salvar novamente.</p> : <>
      <button type="button" disabled={!entrada || !plano || base === undefined || estado === "gravando"} onClick={() => void salvar()}>Salvar checkpoint local</button>
      {base !== undefined && base > 0 && <p role="status">Checkpoint local · revisão {base}</p>}
      {estado === "erro" && <p role="alert">O checkpoint local está indisponível. As sessões oficiais continuam acessíveis.</p>}
    </>}
  </div>;
}
