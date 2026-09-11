import { useEffect, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { sincronizarMeuProgressoMentoria } from "../../services/mentoriaService";

export default function MentoriaProgressoBridge() {
  const { materias, sessoes } = useApp();

  const conteudos = useMemo(
    () =>
      materias.flatMap((materia) =>
        materia.assuntos.map((assunto) => ({
          materia: materia.nome,
          assunto: assunto.nome,
          concluido: assunto.concluido,
          concluidoEm: assunto.concluidoEm ?? null,
        }))
      ),
    [materias]
  );

  const sessoesRecentes = useMemo(
    () =>
      sessoes.slice(-120).map((sessao) => ({
        materia: sessao.materia,
        assunto: sessao.assunto,
        data: sessao.data,
        finalizadaEm: sessao.finalizadaEm ?? null,
      })),
    [sessoes]
  );

  const assinatura = useMemo(
    () =>
      JSON.stringify({
        concluidos: conteudos
          .filter((item) => item.concluido)
          .map((item) => [item.materia, item.assunto, item.concluidoEm]),
        sessoes: sessoesRecentes.map((item) => [
          item.materia,
          item.assunto,
          item.finalizadaEm || item.data,
        ]),
      }),
    [conteudos, sessoesRecentes]
  );

  useEffect(() => {
    void sincronizarMeuProgressoMentoria(conteudos, sessoesRecentes).catch((erro) => {
      console.warn("Não foi possível sincronizar o progresso da mentoria.", erro);
    });
  }, [assinatura]);

  return null;
}
