import { useEffect, useRef } from "react";
import { useCronometro } from "../../context/CronometroContext";
import { atualizarStatusTarefaMentoria } from "../../services/mentoriaCronogramaService";
import {
  lerTarefaMentoriaAtiva,
  limparTarefaMentoriaAtiva,
} from "../../services/tarefaMentoriaAtiva";

export default function MentoriaCronometroBridge() {
  const { cronometroAtivo } = useCronometro();
  const estavaAtivo = useRef(cronometroAtivo);

  useEffect(() => {
    function aoFinalizarSessao() {
      const tarefa = lerTarefaMentoriaAtiva();
      if (!tarefa) return;

      limparTarefaMentoriaAtiva();
      void atualizarStatusTarefaMentoria(tarefa.id, "concluido")
        .then(() => window.dispatchEvent(new Event("pmpe-mentoria-cronograma-atualizado")))
        .catch((erro) => console.error("Falha ao concluir tarefa da mentoria:", erro));
    }

    window.addEventListener("pmpe-sessoes-atualizadas", aoFinalizarSessao);
    return () => window.removeEventListener("pmpe-sessoes-atualizadas", aoFinalizarSessao);
  }, []);

  useEffect(() => {
    if (estavaAtivo.current && !cronometroAtivo) {
      const tarefa = lerTarefaMentoriaAtiva();
      if (tarefa) limparTarefaMentoriaAtiva();
    }
    estavaAtivo.current = cronometroAtivo;
  }, [cronometroAtivo]);

  return null;
}
