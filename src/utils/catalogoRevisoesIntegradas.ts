import type { Revisao } from "../types";
import { chaveDaMateria } from "./desempenhoMaterias";

export type GrupoIntegradoId = "logica-proposicional" | "fonologia" | "seguranca-informacao";

export type SubassuntoIntegrado = {
  id: string;
  titulo: string;
};

export type GrupoIntegrado = {
  id: GrupoIntegradoId;
  titulo: string;
  materia: string;
  descricao: string;
  topicos: readonly SubassuntoIntegrado[];
};

/**
 * Catálogo V1 aprovado para teste, não é uma ontologia de todo o edital.
 * Cada tópico preserva sua identidade e pode ser reforçado separadamente.
 * Não é usado para alterar dados, agendamento, aulas ou a classificação
 * original dos registros no banco.
 */
export const GRUPOS_INTEGRADOS: readonly GrupoIntegrado[] = [
  {
    id: "logica-proposicional",
    titulo: "Lógica Proposicional",
    materia: "Raciocínio Lógico e Matemática",
    descricao: "Proposições, conectivos, tabelas-verdade, negações, equivalências e classificações lógicas.",
    topicos: [
      { id: "proposicoes", titulo: "Proposições lógicas" },
      { id: "conectivos", titulo: "Conectivos lógicos" },
      { id: "tabelas", titulo: "Tabelas-verdade" },
      { id: "negacoes", titulo: "Negação de proposições" },
      { id: "equivalencias", titulo: "Equivalências lógicas" },
      { id: "tautologias", titulo: "Tautologias, contradições e contingências" },
    ],
  },
  {
    id: "fonologia",
    titulo: "Fonologia e Sílaba",
    materia: "Língua Portuguesa",
    descricao: "Fonemas, dígrafos, encontros consonantais e vocálicos, e classificação silábica.",
    topicos: [
      { id: "fonemas", titulo: "Fonemas, letras e sons da fala" },
      { id: "digrafos", titulo: "Dígrafos" },
      { id: "encontros-consonantais", titulo: "Encontros consonantais" },
      { id: "encontros-vocalicos", titulo: "Encontros vocálicos" },
      { id: "silabas", titulo: "Sílabas e monossílabos" },
    ],
  },
  {
    id: "seguranca-informacao",
    titulo: "Segurança da Informação",
    materia: "Informática",
    descricao: "Estudo integrado das aulas de proteção e segurança, mantendo o PDF como material complementar.",
    topicos: [
      { id: "aulas-1-4", titulo: "Conceitos de proteção e segurança — aulas 1 a 4" },
      { id: "aulas-5-9", titulo: "Conceitos de proteção e segurança — aulas 5 a 9" },
      { id: "material-pdf", titulo: "Revisão do PDF de Segurança da Informação" },
    ],
  },
] as const;

export function normalizarTopicoIntegrado(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Requer a disciplina correta e padrões específicos, nunca apenas palavras vagas. */
export function identificarGrupoIntegrado(revisao: Pick<Revisao, "materia" | "assunto">): GrupoIntegrado | null {
  const materia = chaveDaMateria(revisao.materia);
  const assunto = normalizarTopicoIntegrado(revisao.assunto);
  let grupo: GrupoIntegradoId | null = null;

  if (materia === "rlm" &&
    (/\bconectiv|\btabelas? (da )?(verdade|logica)|\bnegac|\bequivalenc|\btautolog|\bcontradic|\bcontingenc|\bproposic/.test(assunto))) {
    grupo = "logica-proposicional";
  } else if (materia === "portugues" &&
    (/\bfonem|\bletras e sons|\bsom da fala|\bdigraf|\bencontro(s)? (consonantal|consonantais|vocalic|vocalicos)|\bsilab|\bmonossilab|\bditong|\btritong|\bhiato/.test(assunto))) {
    grupo = "fonologia";
  } else if (materia === "informatica" &&
    (/\bseguranca da informacao\b|\bconceitos? de protecao e seguranca\b|\bprotecao e seguranca\b/.test(assunto))) {
    grupo = "seguranca-informacao";
  }

  return GRUPOS_INTEGRADOS.find((item) => item.id === grupo) ?? null;
}

/**
 * Um título composto ativa somente os tópicos que menciona.
 * Não se presume que um registro estudou todas as partes da disciplina.
 */
export function idsTopicosReconhecidos(
  revisao: Pick<Revisao, "materia" | "assunto">
): string[] {
  const grupo = identificarGrupoIntegrado(revisao);
  if (!grupo) return [];
  const titulo = normalizarTopicoIntegrado(revisao.assunto);
  const ids: string[] = [];
  const incluir = (id: string, condicao: boolean) => { if (condicao) ids.push(id); };

  if (grupo.id === "logica-proposicional") {
    incluir("proposicoes", /\bproposic/.test(titulo));
    incluir("conectivos", /\bconectiv/.test(titulo));
    incluir("tabelas", /\btabelas? (da )?(verdade|logica)/.test(titulo));
    incluir("negacoes", /\bnegac/.test(titulo));
    incluir("equivalencias", /\bequivalenc/.test(titulo));
    incluir("tautologias", /\btautolog|\bcontradic|\bcontingenc/.test(titulo));
  } else if (grupo.id === "fonologia") {
    incluir("fonemas", /\bfonem|\bletras e sons|\bsom da fala/.test(titulo));
    incluir("digrafos", /\bdigraf/.test(titulo));
    incluir("encontros-consonantais", /\bencontro(s)? consonant/.test(titulo));
    incluir("encontros-vocalicos", /\bencontro(s)? vocalic|\bditong|\btritong|\bhiato/.test(titulo));
    incluir("silabas", /\bsilab|\bmonossilab/.test(titulo));
  } else if (grupo.id === "seguranca-informacao") {
    incluir("aulas-1-4", /\baulas? 1 a 4\b/.test(titulo));
    incluir("aulas-5-9", /\baulas? 5 a 9\b/.test(titulo));
    incluir("material-pdf", /\bpdf\b/.test(titulo));
  }

  return ids;
}

export function topicosPresentesNoBloco(
  revisoes: readonly Pick<Revisao, "materia" | "assunto">[]
): SubassuntoIntegrado[] {
  const grupo = revisoes.map(identificarGrupoIntegrado).find((atual) => atual !== null);
  if (!grupo) return [];
  const ids = new Set(revisoes.flatMap(idsTopicosReconhecidos));
  return grupo.topicos.filter((topico) => ids.has(topico.id));
}

export function revisoesDaFamilia(
  revisoes: readonly Revisao[],
  grupoId: GrupoIntegradoId
): Revisao[] {
  return revisoes.filter((revisao) => identificarGrupoIntegrado(revisao)?.id === grupoId);
}
