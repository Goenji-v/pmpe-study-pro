/* O bridge expõe helpers de sessão usados pela página do cronograma. */
/* oxlint-disable react/only-export-components */
import { useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { useCronometro } from "../../context/CronometroContext";
import {
  lerAulaMentoriaAtiva,
  limparAulaMentoriaAtiva,
} from "../../services/aulaMentoriaAtiva";
import { marcarAulaMentoria } from "../../services/cursoParceiroService";
import { atualizarStatusTarefaMentoria } from "../../services/mentoriaCronogramaService";
import {
  lerTarefaMentoriaAtiva,
  limparTarefaMentoriaAtiva,
} from "../../services/tarefaMentoriaAtiva";
import { criarPrimeiraRevisao } from "../../utils/revisoes";

export {
  limparTarefaMentoriaAtiva,
  registrarTarefaMentoriaAtiva,
} from "../../services/tarefaMentoriaAtiva";

export default function MentoriaCronometroBridge() {
  const { cronometroAtivo, sessaoAtiva } = useCronometro();
  const { configuracoes, setRevisoes } = useApp();
  const estavaAtivo = useRef(cronometroAtivo);
  const sessaoAtual = useRef(sessaoAtiva);

  useEffect(() => {
    sessaoAtual.current = sessaoAtiva;
  }, [sessaoAtiva]);

  useEffect(() => {
    function aoFinalizarSessao() {
      const tarefa = lerTarefaMentoriaAtiva();
      if (tarefa) {
        limparTarefaMentoriaAtiva();
        void atualizarStatusTarefaMentoria(tarefa.id, "concluido")
          .then(() => window.dispatchEvent(new Event("pmpe-mentoria-cronograma-atualizado")))
          .catch((erro) => console.error("Falha ao concluir tarefa da mentoria:", erro));
      }

      const aula = lerAulaMentoriaAtiva();
      if (!aula) return;

      const sessao = sessaoAtual.current;
      const corresponde =
        mesmoTexto(sessao.materia, aula.disciplina) &&
        mesmoTexto(sessao.modulo ?? "", aula.modulo) &&
        mesmoTexto(sessao.assunto, aula.titulo);

      // A referência é de uso único. Se outra sessão tiver substituído o
      // cronômetro, ela nunca pode concluir silenciosamente a aula anterior.
      limparAulaMentoriaAtiva();
      if (!corresponde) return;

      void marcarAulaMentoria(aula.aulaId, true)
        .then(() => {
          setRevisoes((atuais) => {
            const materiaId = aula.disciplinaId || `parceiro:${aula.cursoId}`;
            const jaExiste = atuais.some(
              (revisao) =>
                !revisao.concluida &&
                revisao.materiaId === materiaId &&
                revisao.assuntoId === aula.aulaId
            );

            if (jaExiste) return atuais;

            const revisao = criarPrimeiraRevisao({
              materiaId,
              moduloId: aula.moduloId || undefined,
              assuntoId: aula.aulaId,
              materia: aula.disciplina,
              modulo: aula.modulo || undefined,
              assunto: aula.titulo,
              revisoesExistentes: atuais,
              limiteDiario: configuracoes.metaRevisoesDiaria,
            });

            return [revisao, ...atuais];
          });

          window.dispatchEvent(new Event("pmpe-curso-mentoria-atualizado"));
          window.dispatchEvent(new Event("pmpe-revisoes-atualizadas"));
        })
        .catch((erro) => console.error("Falha ao concluir aula da mentoria:", erro));
    }

    window.addEventListener("pmpe-sessoes-atualizadas", aoFinalizarSessao);
    return () => window.removeEventListener("pmpe-sessoes-atualizadas", aoFinalizarSessao);
  }, [configuracoes.metaRevisoesDiaria, setRevisoes]);

  useEffect(() => {
    if (estavaAtivo.current && !cronometroAtivo) {
      const tarefa = lerTarefaMentoriaAtiva();
      if (tarefa) limparTarefaMentoriaAtiva();

      const aula = lerAulaMentoriaAtiva();
      if (aula) limparAulaMentoriaAtiva();
    }
    estavaAtivo.current = cronometroAtivo;
  }, [cronometroAtivo]);

  return null;
}

function mesmoTexto(a: string, b: string) {
  return normalizar(a) === normalizar(b);
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
