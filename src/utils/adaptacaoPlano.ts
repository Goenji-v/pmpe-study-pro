import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
} from "../types";

export type DiagnosticoMateriaSemanal = {
  materia: string;
  questoes: number;
  percentualAcertos?: number;
  minutos: number;
  sessoes: number;
  revisoesAtrasadas: number;
  diasSemEstudar?: number;
  prioridade: number;
  confianca: number;
  motivos: string[];
};

export type DiagnosticoSemanalPlano = {
  inicio: string;
  fim: string;
  janelaDias: number;
  materiaPrioritaria?: string;
  prioridade: number;
  confianca: number;
  motivos: string[];
  materias: DiagnosticoMateriaSemanal[];
  possuiDados: boolean;
};

const JANELA_DIAS = 14;
const DIA_MS = 86_400_000;

export function calcularDiagnosticoSemanalPlano(params: {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  materiasDisponiveis?: string[];
  agora?: Date;
}): DiagnosticoSemanalPlano {
  const agora = params.agora ?? new Date();
  const fim = fimDoDia(agora);
  const inicio = new Date(fim.getTime() - (JANELA_DIAS - 1) * DIA_MS);

  const nomes = new Map<string, string>();
  for (const nome of params.materiasDisponiveis ?? []) {
    if (nome && !ehMateriaOperacional(nome)) nomes.set(normalizar(nome), nome);
  }
  for (const item of params.questoes) {
    if (item.materia && !ehMateriaOperacional(item.materia)) nomes.set(normalizar(item.materia), item.materia);
  }
  for (const item of params.sessoes) {
    if (item.materia && !ehMateriaOperacional(item.materia)) nomes.set(normalizar(item.materia), item.materia);
  }
  for (const item of params.revisoes) {
    if (item.materia && !ehMateriaOperacional(item.materia)) nomes.set(normalizar(item.materia), item.materia);
  }

  const materias = Array.from(nomes.values())
    .map((materia) => analisarMateria(materia, params.questoes, params.sessoes, params.revisoes, inicio, fim, agora))
    .filter((item) => temEvidencia(item))
    .sort((a, b) => b.prioridade - a.prioridade || b.confianca - a.confianca);

  const primeira = materias[0];

  return {
    inicio: dataISO(inicio),
    fim: dataISO(fim),
    janelaDias: JANELA_DIAS,
    materiaPrioritaria: primeira?.materia,
    prioridade: primeira?.prioridade ?? 0,
    confianca: primeira?.confianca ?? 0,
    motivos: primeira?.motivos ?? [],
    materias,
    possuiDados: materias.length > 0,
  };
}

export function adaptarMissaoFlexivel<T extends {
  materia: string;
  assunto: string;
  tipo: string;
}>(
  missao: T,
  diagnostico: DiagnosticoSemanalPlano
): T & { adaptada?: boolean; motivoAdaptacao?: string } {
  const flexivel =
    missao.tipo === "livre" ||
    normalizar(missao.materia) === "materia com maior dificuldade";

  if (!flexivel || !diagnostico.materiaPrioritaria) return missao;

  const dados = diagnostico.materias.find(
    (item) => normalizar(item.materia) === normalizar(diagnostico.materiaPrioritaria as string)
  );

  const detalhe = dados?.percentualAcertos !== undefined
    ? `${dados.percentualAcertos}% de acertos em ${dados.questoes} questões`
    : dados?.revisoesAtrasadas
      ? `${dados.revisoesAtrasadas} revisão${dados.revisoesAtrasadas === 1 ? "" : "ões"} atrasada${dados.revisoesAtrasadas === 1 ? "" : "s"}`
      : "prioridade calculada pelo desempenho recente";

  return {
    ...missao,
    materia: diagnostico.materiaPrioritaria,
    assunto: `Reforço direcionado · ${detalhe}`,
    adaptada: true,
    motivoAdaptacao: diagnostico.motivos[0] ?? "Pior desempenho recente.",
  };
}

function analisarMateria(
  materia: string,
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[],
  revisoes: Revisao[],
  inicio: Date,
  fim: Date,
  agora: Date
): DiagnosticoMateriaSemanal {
  const chave = normalizar(materia);
  const questoesMateria = questoes.filter(
    (item) => normalizar(item.materia) === chave && dentroDaJanela(item.data, inicio, fim)
  );
  const sessoesMateria = sessoes.filter(
    (item) => normalizar(item.materia) === chave && dentroDaJanela(item.data, inicio, fim)
  );
  const revisoesDaMateria = revisoes.filter((item) => normalizar(item.materia) === chave);
  const hoje = inicioDoDia(agora).getTime();
  const revisoesAtrasadas = revisoesDaMateria.filter((item) => {
    const prevista = dataValida(item.dataPrevista);
    return !item.concluida && Boolean(prevista && prevista.getTime() < hoje);
  }).length;

  const certas = questoesMateria.reduce((total, item) => total + numero(item.certas), 0);
  const erradas = questoesMateria.reduce((total, item) => total + numero(item.erradas), 0);
  const totalQuestoes = certas + erradas;
  const percentualAcertos = totalQuestoes > 0
    ? Math.round((certas / totalQuestoes) * 100)
    : undefined;
  const minutos = sessoesMateria.reduce((total, item) => total + numero(item.minutos), 0) +
    questoesMateria.reduce((total, item) => total + numero(item.minutos), 0);

  const ultimaData = [...questoesMateria.map((item) => item.data), ...sessoesMateria.map((item) => item.data)]
    .map(dataValida)
    .filter((item): item is Date => Boolean(item))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const diasSemEstudar = ultimaData
    ? Math.max(0, Math.floor((inicioDoDia(agora).getTime() - inicioDoDia(ultimaData).getTime()) / DIA_MS))
    : undefined;

  const erroScore = percentualAcertos === undefined ? 35 : limitar(100 - percentualAcertos, 0, 100);
  const revisaoScore = limitar(revisoesAtrasadas * 28, 0, 100);
  const intervaloScore = diasSemEstudar === undefined ? 55 : limitar((diasSemEstudar / 7) * 100, 0, 100);
  const volumeScore = totalQuestoes >= 20 ? 0 : limitar(((20 - totalQuestoes) / 20) * 100, 0, 100);

  const prioridade = Math.round(
    erroScore * 0.5 +
    revisaoScore * 0.2 +
    intervaloScore * 0.2 +
    volumeScore * 0.1
  );

  const revisoesConcluidas = revisoesDaMateria.filter(
    (item) => item.concluida && dentroDaJanela(item.dataConclusao || item.dataPrevista, inicio, fim)
  ).length;
  const confianca = Math.round(limitar(
    Math.min(55, (totalQuestoes / 20) * 55) +
    Math.min(25, (sessoesMateria.length / 3) * 25) +
    Math.min(20, ((revisoesAtrasadas > 0 ? 1 : 0) + Math.min(2, revisoesConcluidas)) / 3 * 20),
    0,
    100
  ));

  const motivos: string[] = [];
  if (percentualAcertos !== undefined && percentualAcertos < 70) motivos.push(`Aproveitamento de ${percentualAcertos}% nos últimos ${JANELA_DIAS} dias.`);
  if (revisoesAtrasadas > 0) motivos.push(`${revisoesAtrasadas} revisão${revisoesAtrasadas === 1 ? "" : "ões"} atrasada${revisoesAtrasadas === 1 ? "" : "s"}.`);
  if (diasSemEstudar !== undefined && diasSemEstudar >= 5) motivos.push(`${diasSemEstudar} dias sem registro recente de estudo.`);
  if (totalQuestoes > 0 && totalQuestoes < 10) motivos.push(`Amostra ainda curta: ${totalQuestoes} questões registradas.`);
  if (motivos.length === 0 && totalQuestoes >= 5) motivos.push(`Maior pontuação de reforço entre as matérias com dados recentes (${prioridade}/100).`);

  return {
    materia,
    questoes: totalQuestoes,
    percentualAcertos,
    minutos,
    sessoes: sessoesMateria.length,
    revisoesAtrasadas,
    diasSemEstudar,
    prioridade,
    confianca,
    motivos,
  };
}

function temEvidencia(item: DiagnosticoMateriaSemanal) {
  return item.questoes > 0 || item.sessoes > 0 || item.revisoesAtrasadas > 0;
}

function ehMateriaOperacional(nome: string) {
  const valor = normalizar(nome);
  return valor === "redacao" || valor === "simulado" || valor === "revisao da semana" || valor === "materia com maior dificuldade";
}

function dentroDaJanela(valor: string | undefined, inicio: Date, fim: Date) {
  const data = dataValida(valor);
  if (!data) return false;
  const tempo = data.getTime();
  return tempo >= inicio.getTime() && tempo <= fim.getTime();
}

function dataValida(valor?: string) {
  if (!valor) return undefined;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? undefined : data;
}

function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function fimDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

function dataISO(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function numero(valor: unknown) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.max(minimo, Math.min(maximo, valor));
}
