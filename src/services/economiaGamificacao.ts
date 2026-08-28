import type {
  ConfiguracoesApp,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";
import { calcularMetricasConsolidadas, resumirSimulado } from "../utils/metricasConsolidadas";

export type CompraEconomia = {
  id: string;
  itemId: string;
  preco: number;
  compradoEm: string;
};

export type EstadoEconomia = {
  moedas: number;
  recompensasRecebidas: string[];
  ultimoLoginResgatado?: string;
  sequenciaLoginAtual?: number;
  inventario?: string[];
  compras?: CompraEconomia[];
  tituloEquipado?: string;
  molduraEquipada?: string;
  temaEquipado?: string;
  atualizadoEm?: string;
};

export type ConfiguracoesComEconomia = ConfiguracoesApp & {
  economia?: EstadoEconomia;
};

export type RecompensaMoedas = {
  id: string;
  moedas: number;
  titulo: string;
  detalhe?: string;
  categoria:
    | "missao"
    | "revisao"
    | "simulado"
    | "questoes"
    | "meta"
    | "sequencia"
    | "nivel"
    | "redacao"
    | "login";
};

export type RecompensaLogin = RecompensaMoedas & {
  sequencia: number;
  diaCiclo: number;
};

type EntradaEconomia = {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
  simulados: Simulado[];
  missoesConcluidas: string[];
  configuracoes: ConfiguracoesApp;
  nivelAtual: number;
};

const RECOMPENSA_LOGIN = [3, 3, 4, 4, 5, 5, 20] as const;

export function obterEstadoEconomia(
  configuracoes: ConfiguracoesApp
): EstadoEconomia {
  const economia = (configuracoes as ConfiguracoesComEconomia).economia;

  return {
    moedas: Math.max(0, Math.floor(Number(economia?.moedas) || 0)),
    recompensasRecebidas: Array.isArray(economia?.recompensasRecebidas)
      ? [...new Set(economia.recompensasRecebidas.filter(Boolean))]
      : [],
    ultimoLoginResgatado: economia?.ultimoLoginResgatado,
    sequenciaLoginAtual: Math.max(0, Math.floor(Number(economia?.sequenciaLoginAtual) || 0)),
    inventario: Array.isArray(economia?.inventario)
      ? [...new Set(economia.inventario.filter(Boolean))]
      : [],
    compras: Array.isArray(economia?.compras)
      ? economia.compras.filter(
          (compra): compra is CompraEconomia =>
            Boolean(compra?.id && compra?.itemId && compra?.compradoEm) &&
            Number.isFinite(Number(compra?.preco))
        )
      : [],
    tituloEquipado: economia?.tituloEquipado,
    molduraEquipada: economia?.molduraEquipada,
    temaEquipado: economia?.temaEquipado,
    atualizadoEm: economia?.atualizadoEm,
  };
}

export function listarRecompensasConquistadas(
  entrada: EntradaEconomia
): RecompensaMoedas[] {
  const recompensas: RecompensaMoedas[] = [];

  [...new Set(entrada.missoesConcluidas)].forEach((missaoId) => {
    recompensas.push({
      id: `missao:${missaoId}`,
      moedas: 6,
      titulo: "Missão concluída",
      detalhe: "Consistência no plano de estudos.",
      categoria: "missao",
    });
  });

  entrada.revisoes
    .filter((revisao) => revisao.concluida)
    .forEach((revisao) => {
      recompensas.push({
        id: `revisao:${revisao.id}`,
        moedas: 3,
        titulo: "Revisão concluída",
        detalhe: `${revisao.materia} — ${revisao.assunto}`,
        categoria: "revisao",
      });
    });

  entrada.simulados.forEach((simulado) => {
    const aproveitamento = resumirSimulado(simulado).aproveitamento;
    recompensas.push({
      id: `simulado:${simulado.id}`,
      moedas: 12,
      titulo: "Simulado finalizado",
      detalhe: simulado.nome,
      categoria: "simulado",
    });

    if (aproveitamento >= 80) {
      recompensas.push({
        id: `simulado-bonus80:${simulado.id}`,
        moedas: 5,
        titulo: "Bônus de desempenho",
        detalhe: `${Math.round(aproveitamento)}% no simulado.`,
        categoria: "simulado",
      });
    }
  });

  entrada.sessoes
    .filter((sessao) => sessao.tipo === "redacao")
    .forEach((sessao) => {
      recompensas.push({
        id: `redacao:${sessao.id}`,
        moedas: 8,
        titulo: "Treino de redação",
        detalhe: sessao.assunto,
        categoria: "redacao",
      });
    });

  const dias = listarDiasComAtividade(entrada);
  const metaMinutos = Math.max(30, Math.floor(Number(entrada.configuracoes.metaMinutosDiaria) || 0));
  const metaQuestoes = Math.max(10, Math.floor(Number(entrada.configuracoes.metaQuestoesDiaria) || 0));

  dias.forEach(({ data, minutos, questoes }) => {
    if (questoes >= 20) {
      recompensas.push({
        id: `questoes:20:${data}`,
        moedas: 4,
        titulo: "20 questões no dia",
        categoria: "questoes",
      });
    }
    if (questoes >= 30) {
      recompensas.push({
        id: `questoes:30:${data}`,
        moedas: 2,
        titulo: "30 questões no dia",
        detalhe: "Bônus incremental.",
        categoria: "questoes",
      });
    }
    if (questoes >= 50) {
      recompensas.push({
        id: `questoes:50:${data}`,
        moedas: 2,
        titulo: "50 questões no dia",
        detalhe: "Bônus incremental.",
        categoria: "questoes",
      });
    }
    if (questoes >= 100) {
      recompensas.push({
        id: `questoes:100:${data}`,
        moedas: 4,
        titulo: "100 questões no dia",
        detalhe: "Bônus incremental.",
        categoria: "questoes",
      });
    }

    if (minutos >= metaMinutos) {
      recompensas.push({
        id: `meta-tempo:${data}`,
        moedas: 8,
        titulo: "Meta diária de tempo",
        detalhe: `${metaMinutos} min ou mais. O bônus é o mesmo mesmo estudando além da meta.`,
        categoria: "meta",
      });
    }

    if (questoes >= metaQuestoes) {
      recompensas.push({
        id: `meta-questoes:${data}`,
        moedas: 6,
        titulo: "Meta diária de questões",
        detalhe: `${metaQuestoes} questões ou mais.`,
        categoria: "meta",
      });
    }
  });

  listarRecompensasSequencia(dias).forEach((recompensa) =>
    recompensas.push(recompensa)
  );

  for (let nivel = 2; nivel <= Math.max(1, entrada.nivelAtual); nivel += 1) {
    recompensas.push({
      id: `nivel:${nivel}`,
      moedas: 15,
      titulo: `Nível ${nivel} alcançado`,
      detalhe: "Bônus único por avanço de nível.",
      categoria: "nivel",
    });
  }

  return deduplicarRecompensas(recompensas);
}

export function aplicarRecompensasPendentes(
  estado: EstadoEconomia,
  recompensas: RecompensaMoedas[],
  agora = new Date()
) {
  const recebidas = new Set(estado.recompensasRecebidas);
  const novas = recompensas.filter((recompensa) => !recebidas.has(recompensa.id));

  if (novas.length === 0) {
    return { estado, novas: [] as RecompensaMoedas[], totalMoedas: 0 };
  }

  novas.forEach((recompensa) => recebidas.add(recompensa.id));
  const totalMoedas = novas.reduce((total, recompensa) => total + recompensa.moedas, 0);

  return {
    novas,
    totalMoedas,
    estado: {
      ...estado,
      moedas: estado.moedas + totalMoedas,
      recompensasRecebidas: [...recebidas],
      atualizadoEm: agora.toISOString(),
    },
  };
}

export function obterRecompensaLogin(
  estado: EstadoEconomia,
  hoje = chaveDataLocal(new Date())
): RecompensaLogin | null {
  const id = `login:${hoje}`;
  if (estado.recompensasRecebidas.includes(id)) return null;

  const ontem = deslocarData(hoje, -1);
  const manteveSequencia = estado.ultimoLoginResgatado === ontem;
  const sequencia = manteveSequencia ? (estado.sequenciaLoginAtual ?? 0) + 1 : 1;
  const diaCiclo = ((sequencia - 1) % 7) + 1;
  const moedas = RECOMPENSA_LOGIN[diaCiclo - 1];

  return {
    id,
    moedas,
    titulo: diaCiclo === 7 ? "Bônus de 7 dias" : "Login diário",
    detalhe:
      diaCiclo === 7
        ? "Você completou 7 dias consecutivos de login."
        : `Dia ${diaCiclo} de 7 da sequência de login.`,
    categoria: "login",
    sequencia,
    diaCiclo,
  };
}

export function resgatarRecompensaLogin(
  estado: EstadoEconomia,
  hoje = chaveDataLocal(new Date()),
  agora = new Date()
) {
  const recompensa = obterRecompensaLogin(estado, hoje);
  if (!recompensa) return { estado, recompensa: null as RecompensaLogin | null };

  return {
    recompensa,
    estado: {
      ...estado,
      moedas: estado.moedas + recompensa.moedas,
      recompensasRecebidas: [...new Set([...estado.recompensasRecebidas, recompensa.id])],
      ultimoLoginResgatado: hoje,
      sequenciaLoginAtual: recompensa.sequencia,
      atualizadoEm: agora.toISOString(),
    },
  };
}

export function chaveDataLocal(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function listarDiasComAtividade(entrada: EntradaEconomia) {
  const chaves = new Set<string>();

  entrada.sessoes.forEach((item) => adicionarData(chaves, item.data));
  entrada.questoes.forEach((item) => adicionarData(chaves, item.data));
  entrada.simulados.forEach((item) => adicionarData(chaves, item.data));
  entrada.revisoes.forEach((item) => {
    if (item.concluida && item.dataConclusao) adicionarData(chaves, item.dataConclusao);
  });

  return [...chaves]
    .sort()
    .map((data) => {
      const inicio = inicioDoDia(data);
      const fim = new Date(inicio);
      fim.setHours(23, 59, 59, 999);
      const metricas = calcularMetricasConsolidadas({
        sessoes: entrada.sessoes,
        questoes: entrada.questoes,
        revisoes: entrada.revisoes,
        simulados: entrada.simulados,
        inicio,
        fim,
      });

      return {
        data,
        minutos: metricas.minutos,
        questoes: metricas.questoes,
        houveAtividade:
          metricas.minutos > 0 ||
          metricas.questoes > 0 ||
          metricas.revisoesConcluidas > 0 ||
          metricas.simulados > 0,
      };
    })
    .filter((item) => item.houveAtividade);
}

function listarRecompensasSequencia(
  dias: Array<{ data: string; houveAtividade: boolean }>
): RecompensaMoedas[] {
  if (dias.length === 0) return [];

  const recompensas: RecompensaMoedas[] = [];
  let sequencia = 0;
  let anterior: string | null = null;

  dias.forEach((dia) => {
    sequencia = anterior && deslocarData(anterior, 1) === dia.data ? sequencia + 1 : 1;
    anterior = dia.data;

    const premio = premioDaSequencia(sequencia);
    if (!premio) return;

    recompensas.push({
      id: `sequencia:${sequencia}:${dia.data}`,
      moedas: premio,
      titulo: `${sequencia} dias de sequência`,
      detalhe: "Bônus por manter constância real de estudo.",
      categoria: "sequencia",
    });
  });

  return recompensas;
}

function premioDaSequencia(dias: number) {
  if (dias === 7) return 12;
  if (dias === 14) return 20;
  if (dias === 30) return 50;
  if (dias === 60) return 75;
  if (dias >= 90 && dias % 30 === 0) return 100;
  return 0;
}

function deduplicarRecompensas(recompensas: RecompensaMoedas[]) {
  const mapa = new Map<string, RecompensaMoedas>();
  recompensas.forEach((recompensa) => mapa.set(recompensa.id, recompensa));
  return [...mapa.values()];
}

function adicionarData(destino: Set<string>, valor: string) {
  const data = new Date(valor);
  if (!Number.isNaN(data.getTime())) destino.add(chaveDataLocal(data));
}

function inicioDoDia(chave: string) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

function deslocarData(chave: string, dias: number) {
  const data = inicioDoDia(chave);
  data.setDate(data.getDate() + dias);
  return chaveDataLocal(data);
}