import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
} from "../types";

export type FiltroDesempenho = {
  inicio?: Date;
  fim?: Date;
  materia?: string;
  assunto?: string;
};

export type ClassificacaoDesempenho =
  | "forte"
  | "atencao"
  | "fraco"
  | "urgente"
  | "sem-dados";

export function normalizarFiltro(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function estaNoPeriodo(
  valor: string | undefined,
  inicio?: Date,
  fim?: Date
) {
  if (!valor) return false;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return false;
  if (inicio && data.getTime() < inicio.getTime()) return false;
  if (fim && data.getTime() > fim.getTime()) return false;
  return true;
}

function correspondeEscopo(
  item: { materia?: string; assunto?: string },
  filtro: FiltroDesempenho
) {
  const materia = normalizarFiltro(filtro.materia);
  const assunto = normalizarFiltro(filtro.assunto);

  if (materia && normalizarFiltro(item.materia) !== materia) return false;
  if (assunto && normalizarFiltro(item.assunto) !== assunto) return false;
  return true;
}

export function filtrarQuestoesDesempenho(
  registros: RegistroQuestao[],
  filtro: FiltroDesempenho
) {
  return registros.filter(
    (item) =>
      estaNoPeriodo(item.data, filtro.inicio, filtro.fim) &&
      correspondeEscopo(item, filtro)
  );
}

export function filtrarSessoesDesempenho(
  sessoes: SessaoEstudo[],
  filtro: FiltroDesempenho
) {
  return sessoes.filter(
    (item) =>
      estaNoPeriodo(item.data, filtro.inicio, filtro.fim) &&
      correspondeEscopo(item, filtro)
  );
}

export function filtrarRevisoesDesempenho(
  revisoes: Revisao[],
  filtro: FiltroDesempenho
) {
  return revisoes.filter(
    (item) =>
      estaNoPeriodo(
        item.dataConclusao || item.dataPrevista,
        filtro.inicio,
        filtro.fim
      ) && correspondeEscopo(item, filtro)
  );
}

export function resumirQuestoes(registros: RegistroQuestao[]) {
  const certas = registros.reduce(
    (total, item) => total + (Number(item.certas) || 0),
    0
  );
  const erradas = registros.reduce(
    (total, item) => total + (Number(item.erradas) || 0),
    0
  );
  const total = certas + erradas;
  const aproveitamento = total === 0 ? 0 : Math.round((certas / total) * 100);

  return {
    certas,
    erradas,
    total,
    aproveitamento,
  };
}

export function classificarDesempenho(
  aproveitamento: number,
  totalQuestoes: number
): ClassificacaoDesempenho {
  if (totalQuestoes <= 0) return "sem-dados";
  if (aproveitamento >= 80) return "forte";
  if (aproveitamento >= 60) return "atencao";
  if (aproveitamento >= 40) return "fraco";
  return "urgente";
}

export function rotuloClassificacao(
  classificacao: ClassificacaoDesempenho
) {
  switch (classificacao) {
    case "forte":
      return "Forte";
    case "atencao":
      return "Atenção";
    case "fraco":
      return "Fraco";
    case "urgente":
      return "Revisão urgente";
    default:
      return "Sem dados";
  }
}
