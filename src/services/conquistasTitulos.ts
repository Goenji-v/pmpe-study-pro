import type {
  ConfiguracoesApp,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";
import type { EstadoEconomia } from "./economiaGamificacao";
import { calcularMetricasConsolidadas } from "../utils/metricasConsolidadas";

export type RaridadeConquista = "comum" | "raro" | "epico" | "lendario";

export type TituloConquista = {
  id: string;
  nome: string;
  icone: string;
  descricao: string;
  raridade: RaridadeConquista;
  desbloqueada: boolean;
  progresso: number;
  atual: string;
  temporaria: boolean;
  detalheValidade?: string;
};

type EntradaTitulos = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  missoesConcluidas: string[];
  configuracoes: ConfiguracoesApp;
  economia: EstadoEconomia;
  agora?: Date;
};

export const TITULO_DISCIPLINADO = "conquista:disciplinado";
export const TITULO_MESTRE_REVISAO = "conquista:mestre-revisao";
export const TITULO_MAQUINA_QUESTOES = "conquista:maquina-questoes";
export const TITULO_REDATOR = "conquista:redator";
export const TITULO_OPERACIONAL = "conquista:operacional";

export function calcularTitulosConquista(entrada: EntradaTitulos): TituloConquista[] {
  const agora = entrada.agora ?? new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
  const metricasMes = calcularMetricasConsolidadas({
    questoes: entrada.questoes,
    sessoes: entrada.sessoes,
    revisoes: entrada.revisoes,
    simulados: entrada.simulados,
    inicio: inicioMes,
    fim: fimMes,
  });

  const redacoesMes = entrada.sessoes.filter(
    (sessao) => sessao.tipo === "redacao" && estaNoPeriodo(sessao.data, inicioMes, fimMes)
  ).length;

  const disciplina = calcularDisciplina30Dias(entrada, agora);
  const missoes = new Set(entrada.missoesConcluidas).size;
  const simuladosTotal = entrada.simulados.length;
  const progressoOperacional = Math.min(
    percentual(missoes, 50),
    percentual(simuladosTotal, 10)
  );

  return [
    {
      id: TITULO_DISCIPLINADO,
      nome: "Disciplinado",
      icone: "💎",
      descricao:
        "Complete 30 dias consecutivos entrando no Study Pro e batendo, em cada dia, suas metas pessoais de tempo, questões e revisões.",
      raridade: "lendario",
      desbloqueada: disciplina.diasPerfeitos >= 30,
      progresso: percentual(disciplina.diasPerfeitos, 30),
      atual: `${disciplina.diasPerfeitos}/30 dias perfeitos`,
      temporaria: true,
      detalheValidade:
        "Título dinâmico: continua ativo enquanto a sequência móvel de 30 dias permanecer perfeita.",
    },
    {
      id: TITULO_MESTRE_REVISAO,
      nome: "Mestre da Revisão",
      icone: "🧠",
      descricao: "Conclua 100 revisões no mês atual.",
      raridade: "epico",
      desbloqueada: metricasMes.revisoesConcluidas >= 100,
      progresso: percentual(metricasMes.revisoesConcluidas, 100),
      atual: `${metricasMes.revisoesConcluidas}/100 revisões neste mês`,
      temporaria: true,
      detalheValidade: "Reinicia a cada mês. Se o novo mês não atingir 100 revisões, o título deixa de ficar disponível.",
    },
    {
      id: TITULO_MAQUINA_QUESTOES,
      nome: "Máquina de Questões",
      icone: "⚡",
      descricao: "Resolva 1.000 questões no mês atual.",
      raridade: "epico",
      desbloqueada: metricasMes.questoes >= 1000,
      progresso: percentual(metricasMes.questoes, 1000),
      atual: `${metricasMes.questoes}/1.000 questões neste mês`,
      temporaria: true,
      detalheValidade: "Reinicia a cada mês e precisa ser reconquistado.",
    },
    {
      id: TITULO_REDATOR,
      nome: "Redator",
      icone: "✍️",
      descricao: "Registre 12 treinos de redação no mês atual.",
      raridade: "raro",
      desbloqueada: redacoesMes >= 12,
      progresso: percentual(redacoesMes, 12),
      atual: `${redacoesMes}/12 redações neste mês`,
      temporaria: true,
      detalheValidade: "Reinicia a cada mês e precisa ser reconquistado.",
    },
    {
      id: TITULO_OPERACIONAL,
      nome: "Operacional",
      icone: "🛡️",
      descricao: "Conclua 50 missões do plano e finalize 10 simulados.",
      raridade: "epico",
      desbloqueada: missoes >= 50 && simuladosTotal >= 10,
      progresso: progressoOperacional,
      atual: `${missoes}/50 missões · ${simuladosTotal}/10 simulados`,
      temporaria: false,
      detalheValidade: "Conquista permanente depois de desbloqueada.",
    },
  ];
}

export function encontrarTituloConquista(
  titulos: TituloConquista[],
  id?: string | null
) {
  if (!id) return undefined;
  return titulos.find((titulo) => titulo.id === id);
}

export function obterTituloEquipadoValido(
  titulos: TituloConquista[],
  id?: string | null
) {
  const titulo = encontrarTituloConquista(titulos, id);
  return titulo?.desbloqueada ? titulo : undefined;
}

function calcularDisciplina30Dias(entrada: EntradaTitulos, agora: Date) {
  const metaMinutos = Math.max(1, Math.floor(Number(entrada.configuracoes.metaMinutosDiaria) || 0));
  const metaQuestoes = Math.max(1, Math.floor(Number(entrada.configuracoes.metaQuestoesDiaria) || 0));
  const metaRevisoes = Math.max(0, Math.floor(Number(entrada.configuracoes.metaRevisoesDiaria) || 0));
  const logins = new Set(entrada.economia.diasLogin ?? []);

  entrada.economia.recompensasRecebidas.forEach((id) => {
    if (id.startsWith("login:")) logins.add(id.slice("login:".length));
  });

  const hoje = inicioDoDia(agora);
  const chaves: string[] = [];
  for (let deslocamento = 30; deslocamento >= 0; deslocamento -= 1) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - deslocamento);
    chaves.push(chaveData(data));
  }

  const perfeitos = new Map<string, boolean>();
  chaves.forEach((chave) => {
    const inicio = inicioDaChave(chave);
    const fim = new Date(inicio);
    fim.setHours(23, 59, 59, 999);
    const metricas = calcularMetricasConsolidadas({
      questoes: entrada.questoes,
      sessoes: entrada.sessoes,
      revisoes: entrada.revisoes,
      simulados: entrada.simulados,
      inicio,
      fim,
    });

    perfeitos.set(
      chave,
      logins.has(chave) &&
        metricas.minutos >= metaMinutos &&
        metricas.questoes >= metaQuestoes &&
        metricas.revisoesConcluidas >= metaRevisoes
    );
  });

  let melhor = 0;
  let atual = 0;
  chaves.forEach((chave) => {
    if (perfeitos.get(chave)) {
      atual += 1;
      melhor = Math.max(melhor, atual);
    } else {
      atual = 0;
    }
  });

  return { diasPerfeitos: Math.min(30, melhor) };
}

function percentual(valor: number, meta: number) {
  if (meta <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((valor / meta) * 100)));
}

function estaNoPeriodo(valor: string, inicio: Date, fim: Date) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return false;
  return data.getTime() >= inicio.getTime() && data.getTime() <= fim.getTime();
}

function inicioDoDia(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);
}

function chaveData(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function inicioDaChave(chave: string) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}
