import type { Revisao } from "../types";
import { chaveDaMateria } from "./desempenhoMaterias";
import { concluirRevisaoNaLista } from "./revisoes";

export type BlocoRevisoesVisivel = {
  chave: string;
  titulo: string;
  revisoes: Revisao[];
};

/**
 * Reúne apenas tópicos explicitamente relacionados e que vencem no mesmo dia.
 * NÃO modifica IDs, etapas, datas, sessões, notas ou histórico da conta.
 * Cada registro continua independente para agendamento e auditoria.
 */
export function agruparRevisoesParaEstudo(revisoes: Revisao[]): BlocoRevisoesVisivel[] {
  const resultado: BlocoRevisoesVisivel[] = [];
  const posicoes = new Map<string, number>();

  for (const revisao of revisoes) {
    const familia = classificarFamiliaRevisao(revisao);
    // Exceções preservadas: revisão de simulado e revisão que já representa um bloco.
    // Datas diferentes devem continuar em dias diferentes — nenhuma antecipação.
    const data = dataCivil(revisao.dataPrevista);
    const chave = !revisao.concluida && !revisao.origemSimulado &&
      !revisao.escopoGrupo && familia && data
      ? chaveDaMateria(revisao.materia) + ":" + familia.codigo + ":" + data
      : "individual:" + revisao.id;

    const indice = posicoes.get(chave);
    if (indice !== undefined) {
      resultado[indice].revisoes.push(revisao);
      continue;
    }
    posicoes.set(chave, resultado.length);
    resultado.push({
      chave,
      titulo: familia?.titulo ?? revisao.assunto,
      revisoes: [revisao],
    });
  }

  return resultado;
}

/**
 * Conclui um bloco somente depois de confirmação explícita do estudante.
 * Reutiliza a lógica original por registro, preservando a etapa e o ciclo
 * próprio de cada assunto (inclusive os que já estão na etapa 5).
 */
export function concluirBlocoDeRevisoes(params: {
  revisoes: Revisao[];
  revisoesIds: string[];
  desempenho: NonNullable<Revisao["desempenho"]>;
  limiteDiario: number;
  agora: Date;
  proximosIds: Record<string, string>;
}): Revisao[] {
  const unicos = Array.from(new Set(params.revisoesIds));
  return unicos.reduce((lista, revisaoId) => {
    const proximaId = params.proximosIds[revisaoId];
    if (!proximaId) return lista;
    return concluirRevisaoNaLista({
      revisoes: lista,
      revisaoId,
      desempenho: params.desempenho,
      limiteDiario: params.limiteDiario,
      agora: params.agora,
      proximaId,
    });
  }, params.revisoes);
}

function dataCivil(valor: string): string | null {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return null;
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Regras conservadoras: compartilhar disciplina NÃO basta.
 * Ex.: Guerra dos Mascates e Confederação do Equador nunca formam um bloco;
 * Crase e regência também não são automaticamente equivalentes.
 */
function classificarFamiliaRevisao(revisao: Revisao): { codigo: string; titulo: string } | null {
  const materia = chaveDaMateria(revisao.materia);
  const nome = normalizar(revisao.assunto);

  if (materia === "rlm") {
    if (/\bconectiv|\btabelas? (da )?(verdade|logica)/.test(nome)) {
      return { codigo: "conectivos-tabelas", titulo: "Conectivos lógicos, tabelas-verdade e negação" };
    }
    return null;
  }

  if (materia === "portugues") {
    if (/\bacentuac|\bacento grafico|\boxiton|\bparoxiton|\bproparoxiton/.test(nome)) {
      return { codigo: "acentuacao", titulo: "Acentuação gráfica" };
    }
    if (/\bdigraf|\bencontro(s)? (consonantal|consonantais|vocalic|vocalicos)|\bmonossilab|\bsilab|\bfonem|\bditong|\btritong|\bhiato/.test(nome)) {
      return { codigo: "fonologia-silaba", titulo: "Fonologia: dígrafos, encontros e sílabas" };
    }
    if (/\bcrase/.test(nome)) return { codigo: "crase", titulo: "Crase" };
    if (/\bpontuac|\bvirgula|\bponto e virgula/.test(nome)) {
      return { codigo: "pontuacao", titulo: "Pontuação" };
    }
    return null;
  }

  if (materia === "informatica") {
    // Partes internas de um mesmo programa, nunca Windows + Excel.
    if (/\bwindows\b/.test(nome)) return { codigo: "windows", titulo: "Windows" };
    if (/\bexcel\b/.test(nome)) return { codigo: "excel", titulo: "Excel" };
    if (/\bword\b/.test(nome)) return { codigo: "word", titulo: "Word" };
    return null;
  }

  return null;
}
