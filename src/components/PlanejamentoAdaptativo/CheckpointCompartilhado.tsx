import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { prepararCheckpoint } from "../../services/inteligenciaRevisao/checkpoint";
import type { EntradaPlano, PlanoAdaptativo } from "../../services/inteligenciaRevisao/plano";
import { useFsrsCompartilhado } from "./contextoFsrsCompartilhado";

export default function CheckpointCompartilhado({ entrada, plano }: { entrada?: EntradaPlano; plano?: PlanoAdaptativo }) {
  const sync = useFsrsCompartilhado();
  const { obterRevisaoConfirmadaFsrs } = useApp();
  const [mensagem, setMensagem] = useState("");
  const [gravando, setGravando] = useState(false);
  if (!sync) return null;
  const atual = sync.fila.confirmado;

  async function salvar() {
    if (!sync || !entrada || !plano || !atual || gravando || sync.fila.pendentes.length) return;
    const revisaoLegado = obterRevisaoConfirmadaFsrs();
    if (revisaoLegado === undefined || revisaoLegado !== atual.revisaoLegado) {
      setMensagem("Aguarde a sincronização do histórico oficial e confira a agenda novamente.");
      return;
    }
    setGravando(true);
    try {
      const resultado = await sync.publicar({ revisao: atual.revisao, revisaoEventos: atual.revisaoEventos,
        checkpoint: prepararCheckpoint(sync.escopo, entrada, plano, revisaoLegado) });
      setMensagem(resultado === "ok" ? "Checkpoint compartilhado confirmado." :
        "O diário ou a agenda avançou em outro dispositivo. Confira o histórico e a proposta atual antes de salvar.");
    } catch {
      setMensagem("O checkpoint ficou sem confirmação. Confira a revisão compartilhada ao reconectar.");
    } finally {
      setGravando(false);
    }
  }

  return <div className="plano-sync-conteudo">
    <p role="status">Diário compartilhado · {sync.status} · {sync.fila.pendentes.length} pendente(s)
      {atual && ` · revisão ${atual.revisao}`}</p>
    <button type="button" disabled={!entrada || !plano || !atual || sync.status !== "online" || !!sync.fila.pendentes.length || gravando}
      onClick={() => void salvar()}>Confirmar checkpoint compartilhado</button>
    {atual?.checkpoint && <details>
      <summary>Agenda compartilhada de {atual.checkpoint.calculadoPara.split("-").reverse().join("/")}</summary>
      <p>{atual.checkpoint.avaliados.length} avaliações · {atual.checkpoint.agendamentos.filter(a => a.agendada).length} revisões agendadas</p>
    </details>}
    {mensagem && <p role="status">{mensagem}</p>}
  </div>;
}
