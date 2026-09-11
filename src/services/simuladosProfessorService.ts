import { supabase } from "../lib/supabase";

export type QuestaoProfessor = {
  materia: string;
  assunto: string;
  dificuldade: "facil" | "media" | "dificil";
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  respostaCorretaId: string;
  explicacao?: string;
};

export type SimuladoProfessor = {
  id: string;
  nome: string;
  descricao: string | null;
  concurso_alvo: string;
  banca: string;
  duracao_minutos: number;
  total_questoes: number;
  status: "rascunho" | "publicado" | "encerrado";
  parceiro_id: string;
  turma_id: string | null;
  abre_em: string | null;
  encerra_em: string | null;
  resultado_liberado_em: string | null;
  exigir_tela_cheia: boolean;
  registrar_integridade: boolean;
  bonificacoes: Array<{ posicao: number; premio: string }>;
  criado_em: string;
  turmas: string[];
};

export type PainelSimuladoProfessor = {
  totalTentativas: number;
  oficiaisConcluidas: number;
  treinosConcluidos: number;
  mediaPercentual: number;
  alertasIntegridade: number;
  ranking: Array<{
    usuarioId: string;
    nome: string;
    turma: string;
    certas: number;
    erradas: number;
    emBranco: number;
    percentual: number;
    minutos: number;
    finalizadaEm: string;
    alertas: number;
  }>;
};

export async function listarSimuladosProfessor(parceiroId: string): Promise<SimuladoProfessor[]> {
  const { data: simulados, error } = await supabase
    .from("simulados_oficiais")
    .select("id,nome,descricao,concurso_alvo,banca,duracao_minutos,total_questoes,status,parceiro_id,turma_id,abre_em,encerra_em,resultado_liberado_em,exigir_tela_cheia,registrar_integridade,bonificacoes,criado_em")
    .eq("parceiro_id", parceiroId)
    .order("criado_em", { ascending: false });

  if (error) throw new Error(`Não foi possível carregar os simulados: ${error.message}`);
  const ids = (simulados ?? []).map((item) => item.id);

  const porSimulado = new Map<string, string[]>();
  if (ids.length) {
    const { data: vinculos, error: vinculosError } = await supabase
      .from("simulados_oficiais_turmas")
      .select("simulado_id,turma_id")
      .in("simulado_id", ids);
    if (vinculosError) throw new Error(`Não foi possível carregar as turmas: ${vinculosError.message}`);
    for (const item of vinculos ?? []) {
      const lista = porSimulado.get(item.simulado_id) ?? [];
      lista.push(item.turma_id);
      porSimulado.set(item.simulado_id, lista);
    }
  }

  return (simulados ?? []).map((item) => ({
    ...(item as Omit<SimuladoProfessor, "turmas" | "bonificacoes">),
    bonificacoes: normalizarBonificacoes(item.bonificacoes),
    turmas: porSimulado.get(item.id) ?? (item.turma_id ? [item.turma_id] : []),
  }));
}

export async function criarSimuladoProfessor(args: {
  nome: string;
  descricao?: string;
  concurso: string;
  banca: string;
  duracaoMinutos: number;
  abreEm?: string | null;
  encerraEm?: string | null;
  resultadoLiberadoEm?: string | null;
  turmas: string[];
  questoes: QuestaoProfessor[];
  bonificacoes?: Array<{ posicao: number; premio: string }>;
  exigirTelaCheia: boolean;
  registrarIntegridade: boolean;
}) {
  const { data, error } = await supabase.rpc("criar_simulado_meu_parceiro", {
    p_nome: args.nome,
    p_descricao: args.descricao || null,
    p_concurso: args.concurso,
    p_banca: args.banca,
    p_duracao_minutos: Math.max(1, Math.round(args.duracaoMinutos)),
    p_abre_em: args.abreEm || null,
    p_encerra_em: args.encerraEm || null,
    p_resultado_liberado_em: args.resultadoLiberadoEm || null,
    p_turmas: args.turmas,
    p_questoes: args.questoes,
    p_bonificacoes: args.bonificacoes ?? [],
    p_exigir_tela_cheia: args.exigirTelaCheia,
    p_registrar_integridade: args.registrarIntegridade,
  });
  if (error || !data) throw new Error(error?.message || "Não foi possível criar o simulado.");
  return String(data);
}

export async function alterarStatusSimuladoProfessor(id: string, status: "rascunho" | "publicado" | "encerrado") {
  const payload: Record<string, unknown> = { status };
  if (status === "publicado") payload.publicado_em = new Date().toISOString();
  const { error } = await supabase.from("simulados_oficiais").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirSimuladoProfessor(id: string) {
  const { error } = await supabase.from("simulados_oficiais").delete().eq("id", id).eq("status", "rascunho");
  if (error) throw new Error(error.message);
}

export async function carregarPainelSimuladoProfessor(id: string): Promise<PainelSimuladoProfessor> {
  const { data, error } = await supabase.rpc("painel_simulado_meu_parceiro", { p_simulado_id: id });
  if (error) throw new Error(error.message);
  const valor = (data ?? {}) as Record<string, unknown>;
  return {
    totalTentativas: numero(valor.total_tentativas),
    oficiaisConcluidas: numero(valor.oficiais_concluidas),
    treinosConcluidos: numero(valor.treinos_concluidos),
    mediaPercentual: numero(valor.media_percentual),
    alertasIntegridade: numero(valor.alertas_integridade),
    ranking: lista(valor.ranking).map((item) => ({
      usuarioId: texto(item.usuario_id),
      nome: texto(item.nome) || "Aluno",
      turma: texto(item.turma) || "Sem turma",
      certas: numero(item.certas),
      erradas: numero(item.erradas),
      emBranco: numero(item.em_branco),
      percentual: numero(item.percentual),
      minutos: numero(item.minutos),
      finalizadaEm: texto(item.finalizada_em),
      alertas: numero(item.alertas),
    })),
  };
}

export async function finalizarTentativaComPolitica(
  tentativaId: string,
  respostas: Record<string, string>
): Promise<{
  resultadoLiberado: boolean;
  liberarEm?: string;
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  anuladas: number;
  percentual: number;
  porMateria: Array<{ materia: string; total: number; certas: number; erradas: number; emBranco: number; percentual: number }>;
  porAssunto: Array<{ materia: string; assunto: string; total: number; certas: number; erradas: number; emBranco: number; percentual: number }>;
  questoes: Array<{ numero: number; materia: string; assunto: string; respostaMarcada: string | null; respostaCorreta: string; anulada: boolean; correta: boolean | null; emBranco: boolean }>;
}> {
  const { data, error } = await supabase.rpc("finalizar_simulado_oficial", {
    p_tentativa_id: tentativaId,
    p_respostas: respostas,
    p_minutos_gastos: null,
  });
  if (error || !data) throw new Error(error?.message || "Não foi possível finalizar o simulado.");
  const valor = data as Record<string, unknown>;
  return {
    resultadoLiberado: valor.resultadoLiberado !== false,
    liberarEm: texto(valor.liberarEm) || undefined,
    total: numero(valor.total), certas: numero(valor.certas), erradas: numero(valor.erradas), emBranco: numero(valor.emBranco), anuladas: numero(valor.anuladas), percentual: numero(valor.percentual),
    porMateria: (Array.isArray(valor.porMateria) ? valor.porMateria : []) as never,
    porAssunto: (Array.isArray(valor.porAssunto) ? valor.porAssunto : []) as never,
    questoes: (Array.isArray(valor.questoes) ? valor.questoes : []) as never,
  };
}

export async function registrarEventoIntegridade(tentativaId: string, tipo: "aba_oculta" | "perda_foco" | "saiu_tela_cheia") {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
  const { error } = await supabase.from("simulado_integridade_eventos").insert({
    tentativa_id: tentativaId,
    usuario_id: userId,
    tipo,
  });
  if (error) console.warn("Não foi possível registrar evento de integridade", error.message);
}

function normalizarBonificacoes(valor: unknown): Array<{ posicao: number; premio: string }> {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => ({ posicao: numero(item.posicao) || index + 1, premio: texto(item.premio) }))
    .filter((item) => item.premio);
}
function texto(valor: unknown) { return typeof valor === "string" ? valor : ""; }
function numero(valor: unknown) { const n = Number(valor ?? 0); return Number.isFinite(n) ? n : 0; }
function lista(valor: unknown): Record<string, unknown>[] { return Array.isArray(valor) ? valor.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []; }
