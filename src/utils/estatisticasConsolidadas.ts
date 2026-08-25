import type {
  Materia,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";
import { calcularMetricasConsolidadas } from "./metricasConsolidadas";

export type LinhaDesempenho = {
  chave: string;
  materia: string;
  modulo?: string;
  assunto?: string;
  minutos: number;
  aulas: number;
  questoes: number;
  certas: number;
  erradas: number;
  aproveitamento: number;
  revisoes: number;
};

export type EvolucaoMensal = {
  chave: string;
  mes: string;
  minutos: number;
  horas: number;
  questoes: number;
  certas: number;
  erradas: number;
  aproveitamento: number;
  revisoes: number;
  simulados: number;
  redacoes: number;
};

const normalizar = (texto = "") =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const percentual = (certas: number, erradas: number) =>
  certas + erradas === 0
    ? 0
    : Math.round((certas / (certas + erradas)) * 100);

const baseMateria = (materia: string): LinhaDesempenho => ({
  chave: normalizar(materia),
  materia,
  minutos: 0,
  aulas: 0,
  questoes: 0,
  certas: 0,
  erradas: 0,
  aproveitamento: 0,
  revisoes: 0,
});

export function consolidarPorMateria(params: {
  materias: Materia[];
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
}): LinhaDesempenho[] {
  const mapa = new Map<string, LinhaDesempenho>();
  const obter = (nome: string) => {
    const chave = normalizar(nome);
    if (!mapa.has(chave)) mapa.set(chave, baseMateria(nome));
    return mapa.get(chave)!;
  };

  params.materias.forEach((materia) => {
    const linha = obter(materia.nome);
    const assuntos = materia.modulos?.length
      ? materia.modulos.flatMap((modulo) => modulo.assuntos)
      : materia.assuntos;
    linha.aulas += assuntos.reduce(
      (total, assunto) =>
        total +
        (assunto.aulas?.filter((aula) => aula.concluida).length ??
          (assunto.concluido ? 1 : 0)),
      0
    );
  });

  params.sessoes.forEach((sessao) => {
    obter(sessao.materia).minutos += Number(sessao.minutos) || 0;
  });

  params.questoes.forEach((registro) => {
    const linha = obter(registro.materia);
    linha.certas += Number(registro.certas) || 0;
    linha.erradas += Number(registro.erradas) || 0;
  });

  params.revisoes
    .filter((item) => item.concluida)
    .forEach((item) => {
      obter(item.materia).revisoes += 1;
    });

  return Array.from(mapa.values())
    .map((linha) => ({
      ...linha,
      questoes: linha.certas + linha.erradas,
      aproveitamento: percentual(linha.certas, linha.erradas),
    }))
    .filter(
      (linha) =>
        linha.minutos + linha.aulas + linha.questoes + linha.revisoes > 0
    )
    .sort((a, b) => b.minutos - a.minutos || b.questoes - a.questoes);
}

export function consolidarPorAssunto(params: {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
}): LinhaDesempenho[] {
  const mapa = new Map<string, LinhaDesempenho>();
  const obter = (
    materia: string,
    modulo: string | undefined,
    assunto: string
  ) => {
    const chave = `${normalizar(materia)}::${normalizar(modulo)}::${normalizar(assunto)}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        ...baseMateria(materia),
        chave,
        modulo: modulo || "Geral",
        assunto,
      });
    }
    return mapa.get(chave)!;
  };

  params.sessoes.forEach((sessao) => {
    obter(sessao.materia, sessao.modulo, sessao.assunto).minutos +=
      Number(sessao.minutos) || 0;
  });

  params.questoes.forEach((registro) => {
    const linha = obter(registro.materia, registro.modulo, registro.assunto);
    linha.certas += Number(registro.certas) || 0;
    linha.erradas += Number(registro.erradas) || 0;
  });

  params.revisoes
    .filter((item) => item.concluida)
    .forEach((item) => {
      obter(item.materia, item.modulo, item.assunto).revisoes += 1;
    });

  return Array.from(mapa.values())
    .map((linha) => ({
      ...linha,
      questoes: linha.certas + linha.erradas,
      aproveitamento: percentual(linha.certas, linha.erradas),
    }))
    .sort((a, b) => b.questoes - a.questoes || b.minutos - a.minutos);
}

export function consolidarEvolucaoMensal(params: {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
  simulados: Simulado[];
}): EvolucaoMensal[] {
  const chaves = new Set<string>();

  params.sessoes.forEach((item) => adicionarMes(chaves, item.data));
  params.questoes.forEach((item) => adicionarMes(chaves, item.data));
  params.revisoes
    .filter((item) => item.concluida)
    .forEach((item) => adicionarMes(chaves, item.dataConclusao || item.dataPrevista));
  params.simulados.forEach((item) => adicionarMes(chaves, item.data));

  return Array.from(chaves)
    .sort()
    .map((chave) => {
      const [ano, mes] = chave.split("-").map(Number);
      const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
      const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
      const metricas = calcularMetricasConsolidadas({
        sessoes: params.sessoes,
        questoes: params.questoes,
        revisoes: params.revisoes,
        simulados: params.simulados,
        inicio,
        fim,
      });
      const redacoes = params.sessoes.filter(
        (sessao) =>
          sessao.tipo === "redacao" &&
          estaNoPeriodo(sessao.data, inicio, fim)
      ).length;

      return {
        chave,
        mes: new Date(`${chave}-02T12:00:00`).toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
        minutos: metricas.minutos,
        horas: Number((metricas.minutos / 60).toFixed(1)),
        questoes: metricas.questoes,
        certas: metricas.certas,
        erradas: metricas.erradas + metricas.emBranco,
        aproveitamento: metricas.aproveitamento,
        revisoes: metricas.revisoesConcluidas,
        simulados: metricas.simulados,
        redacoes,
      };
    });
}

function adicionarMes(destino: Set<string>, valor?: string) {
  if (!valor) return;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return;
  destino.add(
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
  );
}

function estaNoPeriodo(valor: string, inicio: Date, fim: Date) {
  const data = new Date(valor);
  return (
    !Number.isNaN(data.getTime()) &&
    data.getTime() >= inicio.getTime() &&
    data.getTime() <= fim.getTime()
  );
}
