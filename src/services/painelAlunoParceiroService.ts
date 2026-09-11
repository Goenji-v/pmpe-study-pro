import { supabase } from "../lib/supabase";

export type PainelAlunoParceiro = {
  aluno: {
    id: string;
    nome: string;
    email: string;
    concurso: string;
    turma: string;
    status: string;
    inicioEm: string | null;
    expiraEm: string | null;
  };
  tempo: {
    hoje: number;
    semana: number;
    mes: number;
    total: number;
    diasEstudados: number;
    sequencia: number;
  };
  questoes: {
    total: number;
    certas: number;
    erradas: number;
    percentual: number;
  };
  revisoes: {
    total: number;
    concluidas: number;
    pendentes: number;
    atrasadas: number;
  };
  materias: Array<{
    materia: string;
    minutos: number;
    sessoes: number;
    dias: number;
    ultimaAtividade: string | null;
  }>;
  atividades: Array<{
    tipo: string;
    data: string;
    titulo: string;
    detalhe: string;
    minutos: number;
  }>;
  simulados: Array<{
    id: string;
    nome: string;
    finalizadaEm: string | null;
    minutos: number;
    certas: number;
    erradas: number;
    emBranco: number;
    percentual: number;
    alertas: number;
  }>;
};

export async function carregarPainelAlunoParceiro(userId: string): Promise<PainelAlunoParceiro> {
  const { data, error } = await supabase.rpc("painel_aluno_meu_parceiro", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Não foi possível carregar o painel do aluno: ${error.message}`);
  }

  return normalizarPainel(data);
}

function normalizarPainel(data: unknown): PainelAlunoParceiro {
  const raiz = objeto(data);
  const aluno = objeto(raiz.aluno);
  const tempo = objeto(raiz.tempo);
  const questoes = objeto(raiz.questoes);
  const revisoes = objeto(raiz.revisoes);

  return {
    aluno: {
      id: texto(aluno.id),
      nome: texto(aluno.nome) || "Aluno",
      email: texto(aluno.email),
      concurso: texto(aluno.concurso),
      turma: texto(aluno.turma) || "Sem turma",
      status: texto(aluno.status),
      inicioEm: texto(aluno.inicio_em) || null,
      expiraEm: texto(aluno.expira_em) || null,
    },
    tempo: {
      hoje: numero(tempo.hoje),
      semana: numero(tempo.semana),
      mes: numero(tempo.mes),
      total: numero(tempo.total),
      diasEstudados: numero(tempo.dias_estudados),
      sequencia: numero(tempo.sequencia),
    },
    questoes: {
      total: numero(questoes.total),
      certas: numero(questoes.certas),
      erradas: numero(questoes.erradas),
      percentual: numero(questoes.percentual),
    },
    revisoes: {
      total: numero(revisoes.total),
      concluidas: numero(revisoes.concluidas),
      pendentes: numero(revisoes.pendentes),
      atrasadas: numero(revisoes.atrasadas),
    },
    materias: lista(raiz.materias).map((item) => ({
      materia: texto(item.materia) || "Não informada",
      minutos: numero(item.minutos),
      sessoes: numero(item.sessoes),
      dias: numero(item.dias),
      ultimaAtividade: texto(item.ultima_atividade) || null,
    })),
    atividades: lista(raiz.atividades).map((item) => ({
      tipo: texto(item.tipo),
      data: texto(item.data),
      titulo: texto(item.titulo) || "Atividade",
      detalhe: texto(item.detalhe),
      minutos: numero(item.minutos),
    })),
    simulados: lista(raiz.simulados).map((item) => ({
      id: texto(item.id),
      nome: texto(item.nome) || "Simulado",
      finalizadaEm: texto(item.finalizada_em) || null,
      minutos: numero(item.minutos),
      certas: numero(item.certas),
      erradas: numero(item.erradas),
      emBranco: numero(item.em_branco),
      percentual: numero(item.percentual),
      alertas: numero(item.alertas),
    })),
  };
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}
