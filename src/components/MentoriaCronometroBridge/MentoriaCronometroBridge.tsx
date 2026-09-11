import { useEffect, useRef } from "react";
import { useCronometro } from "../../context/CronometroContext";
import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import { atualizarStatusTarefaMentoria } from "../../services/mentoriaService";

export const CHAVE_TAREFA_MENTORIA_ATIVA = "mentoria:tarefa-ativa";

type TarefaAtiva = {
  id: string;
  materia: string;
  assunto: string;
  iniciadaEm: string;
};

export function registrarTarefaMentoriaAtiva(tarefa: TarefaAtiva) {
  sessionStorage.setItem(CHAVE_TAREFA_MENTORIA_ATIVA, JSON.stringify(tarefa));
}

export function limparTarefaMentoriaAtiva() {
  sessionStorage.removeItem(CHAVE_TAREFA_MENTORIA_ATIVA);
}

function lerTarefaAtiva(): TarefaAtiva | null {
  const salvo = sessionStorage.getItem(CHAVE_TAREFA_MENTORIA_ATIVA);
  if (!salvo) return null;
  try {
    const valor = JSON.parse(salvo) as Partial<TarefaAtiva>;
    if (!valor.id) return null;
    return {
      id: valor.id,
      materia: valor.materia ?? "",
      assunto: valor.assunto ?? "",
      iniciadaEm: valor.iniciadaEm ?? new Date().toISOString(),
    };
  } catch {
    limparTarefaMentoriaAtiva();
    return null;
  }
}

export default function MentoriaCronometroBridge() {
  const { cronometroAtivo } = useCronometro();
  const estavaAtivo = useRef(cronometroAtivo);

  useEffect(() => {
    function aoFinalizarSessao() {
      const tarefa = lerTarefaAtiva();
      if (!tarefa) return;
      // Remove antes do await: evita dupla conclusão caso mais de um evento seja emitido.
      limparTarefaMentoriaAtiva();
      void atualizarStatusTarefaMentoria(tarefa.id, "concluido")
        .then(() => window.dispatchEvent(new Event("pmpe-mentoria-cronograma-atualizado")))
        .catch((erro) => console.error("Falha ao concluir tarefa da mentoria:", erro));
    }

    window.addEventListener("pmpe-sessoes-atualizadas", aoFinalizarSessao);
    return () => window.removeEventListener("pmpe-sessoes-atualizadas", aoFinalizarSessao);
  }, []);

  useEffect(() => {
    // Se o cronômetro foi cancelado, não conclui a tarefa. O próximo recálculo
    // poderá reagendar o item que permaneceu em andamento.
    if (estavaAtivo.current && !cronometroAtivo) {
      const tarefa = lerTarefaAtiva();
      if (tarefa) limparTarefaMentoriaAtiva();
    }
    estavaAtivo.current = cronometroAtivo;
  }, [cronometroAtivo]);

  return null;
}
