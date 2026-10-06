import type { RegistroQuestao } from "../types/index";

/**
 * Fonte única do desempenho por matéria no Dashboard.
 *
 * Antes existiam duas contas diferentes (cards e "Visão rápida"), o que
 * gerava números contraditórios para a mesma matéria. Agora:
 *  - nomes equivalentes ("Português" e "Língua Portuguesa") viram uma matéria só;
 *  - "melhor" e "pior" matéria só consideram matérias com amostra mínima;
 *  - quem consome decide quantas matérias mostrar, mas o cálculo é um só.
 */

/** Abaixo disso o percentual oscila demais para apontar melhor/pior matéria. */
export const MINIMO_QUESTOES_DIAGNOSTICO = 10;

export type DesempenhoMateria = {
  materia: string;
  certas: number;
  erradas: number;
  total: number;
  percentual: number;
};

/**
 * Equivalências EXATAS (após remover acentos/caixa). Não usa busca por trecho
 * de propósito: "Direito Penal Militar" não deve cair em "Direito Penal".
 * O primeiro item de cada grupo é só a chave do grupo.
 */
const GRUPOS_EQUIVALENTES: string[][] = [
  ["portugues", "lingua portuguesa"],
  [
    "rlm",
    "raciocinio logico",
    "raciocinio logico e matematica",
    "raciocinio logico matematico",
    "raciocinio logico-matematico",
  ],
  ["constitucional", "direito constitucional"],
  [
    "legislacao extravagante",
    "leis extravagantes",
    "legislacao especial",
    "leis especiais",
  ],
  ["informatica", "nocoes de informatica"],
  ["administrativo", "direito administrativo"],
  ["penal", "direito penal"],
  ["processual penal", "direito processual penal", "processo penal"],
];

const CHAVE_POR_NOME = new Map<string, string>(
  GRUPOS_EQUIVALENTES.flatMap((grupo) =>
    grupo.map((nome) => [nome, grupo[0]] as [string, string])
  )
);

function semAcentoEmMinusculas(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave estável para agrupar nomes de matéria equivalentes. */
export function chaveDaMateria(nome: unknown): string {
  const limpo = semAcentoEmMinusculas(String(nome ?? ""));
  if (!limpo) return "";
  return CHAVE_POR_NOME.get(limpo) ?? limpo;
}

function numeroSeguro(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

type Acumulador = {
  certas: number;
  erradas: number;
  /** Total por grafia original, para exibir o nome que a pessoa mais usa. */
  nomes: Map<string, number>;
};

/**
 * Desempenho de TODAS as matérias, da mais estudada para a menos estudada.
 * O percentual considera apenas questões respondidas (certas + erradas).
 */
export function calcularDesempenhoPorMateria(
  questoes: RegistroQuestao[]
): DesempenhoMateria[] {
  const grupos = new Map<string, Acumulador>();

  for (const registro of questoes) {
    const nomeOriginal = String(registro?.materia ?? "").trim().replace(/\s+/g, " ");
    const chave = chaveDaMateria(nomeOriginal);
    if (!chave) continue;

    const certas = numeroSeguro(registro.certas);
    const erradas = numeroSeguro(registro.erradas);

    const atual = grupos.get(chave) ?? { certas: 0, erradas: 0, nomes: new Map() };
    atual.certas += certas;
    atual.erradas += erradas;
    atual.nomes.set(nomeOriginal, (atual.nomes.get(nomeOriginal) ?? 0) + certas + erradas);
    grupos.set(chave, atual);
  }

  return [...grupos.values()]
    .map((grupo) => {
      const total = grupo.certas + grupo.erradas;
      const [materia] = [...grupo.nomes.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")
      )[0];

      return {
        materia,
        certas: grupo.certas,
        erradas: grupo.erradas,
        total,
        percentual: total === 0 ? 0 : Math.round((grupo.certas / total) * 100),
      };
    })
    .filter((item) => item.total > 0)
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.percentual - a.percentual ||
        a.materia.localeCompare(b.materia, "pt-BR")
    );
}

/** Matérias com amostra suficiente para entrar em diagnóstico. */
export function materiasComAmostraSuficiente(
  materias: DesempenhoMateria[],
  minimo: number = MINIMO_QUESTOES_DIAGNOSTICO
): DesempenhoMateria[] {
  return materias.filter((item) => item.total >= minimo);
}

/**
 * Melhor e pior matéria entre as que têm amostra mínima.
 * Com apenas uma matéria elegível não há comparação: só `melhor` é preenchida.
 */
export function destacarMelhorEPior(
  materias: DesempenhoMateria[],
  minimo: number = MINIMO_QUESTOES_DIAGNOSTICO
): { melhor: DesempenhoMateria | null; pior: DesempenhoMateria | null } {
  const elegiveis = materiasComAmostraSuficiente(materias, minimo)
    .slice()
    .sort(
      (a, b) =>
        b.percentual - a.percentual ||
        b.total - a.total ||
        a.materia.localeCompare(b.materia, "pt-BR")
    );

  if (elegiveis.length === 0) return { melhor: null, pior: null };

  const melhor = elegiveis[0];
  const pior = elegiveis.length > 1 ? elegiveis[elegiveis.length - 1] : null;
  return { melhor, pior };
}

/**
 * Pontos de atenção: matérias com amostra mínima abaixo da média geral,
 * da pior para a menos pior.
 */
export function selecionarPontosDeAtencao(
  materias: DesempenhoMateria[],
  aproveitamentoGeral: number,
  limite = 2,
  minimo: number = MINIMO_QUESTOES_DIAGNOSTICO
): DesempenhoMateria[] {
  return materiasComAmostraSuficiente(materias, minimo)
    .filter((item) => item.percentual < aproveitamentoGeral)
    .sort((a, b) => a.percentual - b.percentual || b.total - a.total)
    .slice(0, limite);
}

/**
 * Matérias para os cards: as mais estudadas, mas garantindo que as matérias
 * citadas no diagnóstico (melhor e pior) apareçam; senão a tela se contradiz.
 * Para abrir espaço, saem as menos estudadas que não são obrigatórias.
 */
export function selecionarMateriasParaCards(
  materias: DesempenhoMateria[],
  limite = 6,
  garantir: Array<DesempenhoMateria | null | undefined> = []
): DesempenhoMateria[] {
  const obrigatorias = garantir.filter(
    (item, indice, lista): item is DesempenhoMateria =>
      Boolean(item) && lista.findIndex((outro) => outro?.materia === item?.materia) === indice
  );
  const ehObrigatoria = (item: DesempenhoMateria) =>
    obrigatorias.some((outra) => outra.materia === item.materia);

  const selecionadas = materias.slice(0, limite);

  for (const falta of obrigatorias) {
    if (selecionadas.some((item) => item.materia === falta.materia)) continue;
    const indiceRemovivel = selecionadas.findLastIndex((item) => !ehObrigatoria(item));
    if (indiceRemovivel === -1) break;
    selecionadas.splice(indiceRemovivel, 1, falta);
  }

  // Mantém a ordem original (mais estudadas primeiro).
  return selecionadas.sort((a, b) => materias.indexOf(a) - materias.indexOf(b));
}
