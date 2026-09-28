import type { Materia, Revisao } from "../types";
import { localizarReferenciaCanonica } from "../services/conteudos/sincronizacaoCanonica";
import type { AnaliseSimuladoStudyPro } from "./analiseSimuladoStudyPro";

export type ResultadoAdicionarRevisoesSimulado = {
  revisoes: Revisao[];
  criadas: number;
  atualizadas: number;
  jaExistiam: number;
  semReferencia: number;
};

export function adicionarErrosSimuladoARevisao(params: {
  revisoes: Revisao[];
  materias: Materia[];
  analise: AnaliseSimuladoStudyPro;
  agora?: Date;
  criarId?: () => string;
}): ResultadoAdicionarRevisoesSimulado {
  let revisoes = [...params.revisoes];
  let criadas = 0;
  let atualizadas = 0;
  let jaExistiam = 0;
  let semReferencia = 0;
  const agora = params.agora ?? new Date();

  for (const plano of params.analise.planoRevisao) {
    const assunto = params.analise.assuntos.find(
      (item) => item.chave === plano.chave
    );
    if (!assunto) continue;

    const referencia = localizarReferenciaCanonica(params.materias, {
      materia: assunto.materia,
      materiaId: assunto.materiaId,
      modulo: assunto.modulo,
      moduloId: assunto.moduloId,
      assunto: assunto.assunto,
      assuntoId: assunto.assuntoId,
    });

    if (!referencia) {
      semReferencia += 1;
      continue;
    }

    const indice = revisoes.findIndex(
      (revisao) =>
        !revisao.concluida &&
        mesmaReferencia(revisao, {
          materiaId: referencia.materia.id,
          assuntoId: referencia.assunto.id,
          materia: referencia.materia.nome,
          assunto: referencia.assunto.nome,
        })
    );

    const certasSeguras = Math.max(
      0,
      assunto.acertos - assunto.acertosPorChute
    );
    const errosCognitivos =
      assunto.erros + assunto.naoRespondidas + assunto.acertosPorChute;
    const dataPrevista = dataEmDias(agora, 1).toISOString();

    if (indice >= 0) {
      const existente = revisoes[indice];
      const dataExistente = Date.parse(existente.dataPrevista);
      const deveAntecipar =
        !Number.isFinite(dataExistente) ||
        Date.parse(dataPrevista) < dataExistente;

      const atualizada: Revisao = {
        ...existente,
        materiaId: referencia.materia.id,
        moduloId: referencia.modulo.id,
        assuntoId: referencia.assunto.id,
        materia: referencia.materia.nome,
        modulo: referencia.modulo.nome,
        assunto: referencia.assunto.nome,
        certas: certasSeguras,
        erradas: errosCognitivos,
        dataPrevista: deveAntecipar ? dataPrevista : existente.dataPrevista,
      };

      const mudou = JSON.stringify(atualizada) !== JSON.stringify(existente);
      if (mudou) {
        revisoes = revisoes.map((item, itemIndice) =>
          itemIndice === indice ? atualizada : item
        );
        atualizadas += 1;
      } else {
        jaExistiam += 1;
      }
      continue;
    }

    const nova: Revisao = {
      id: params.criarId?.() ?? crypto.randomUUID(),
      materiaId: referencia.materia.id,
      moduloId: referencia.modulo.id,
      assuntoId: referencia.assunto.id,
      materia: referencia.materia.nome,
      modulo: referencia.modulo.nome,
      assunto: referencia.assunto.nome,
      etapa: 1,
      dataCriacao: agora.toISOString(),
      dataPrevista,
      concluida: false,
      certas: certasSeguras,
      erradas: errosCognitivos,
    };

    revisoes = [nova, ...revisoes];
    criadas += 1;
  }

  return {
    revisoes,
    criadas,
    atualizadas,
    jaExistiam,
    semReferencia,
  };
}

function mesmaReferencia(
  revisao: Revisao,
  referencia: {
    materiaId: string;
    assuntoId: string;
    materia: string;
    assunto: string;
  }
) {
  if (
    revisao.materiaId === referencia.materiaId &&
    revisao.assuntoId === referencia.assuntoId
  ) {
    return true;
  }

  return (
    normalizar(revisao.materia) === normalizar(referencia.materia) &&
    normalizar(revisao.assunto) === normalizar(referencia.assunto)
  );
}

function dataEmDias(base: Date, dias: number) {
  const data = new Date(base);
  data.setDate(data.getDate() + dias);
  data.setHours(12, 0, 0, 0);
  return data;
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
