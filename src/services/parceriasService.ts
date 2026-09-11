import { supabase } from "../lib/supabase";

export type PapelComercial = "proprietario" | "gestor" | "professor" | "aluno" | "legado";
export type StatusLicenca = "ativa" | "pendente" | "suspensa" | "cancelada" | "expirada" | "legado";

export type ContextoComercial = {
  papel: PapelComercial;
  parceiroId: string | null;
  parceiroNome: string | null;
  turmaId: string | null;
  turmaNome: string | null;
  status: StatusLicenca;
  inicioEm: string | null;
  expiraEm: string | null;
  motivoBloqueio: string | null;
  acessoPermitido: boolean;
};

export type ResumoParceiro = {
  parceiroId: string;
  parceiroNome: string;
  alunosAtivos: number;
  alunosPendentes: number;
  alunosBloqueados: number;
  valorMensal: number;
};

export type AlunoParceiro = {
  licencaId: string;
  userId: string;
  nome: string;
  turmaId: string | null;
  turma: string;
  status: StatusLicenca;
  inicioEm: string;
  expiraEm: string | null;
  email: string;
  minutos: number;
  questoes: number;
  acertos: number;
  nivel: number;
  ultimaAtividade: string | null;
};

export type ConvitePublico = { conviteId: string; parceiroNome: string; turmaNome: string; titulo: string | null; exigeAprovacao: boolean; duracaoMeses: number; expiraEm: string | null };
export type TurmaParceiro = { id: string; nome: string; codigo: string | null; ativa: boolean };
export type ConviteParceiro = { id: string; turmaId: string; turmaNome: string; titulo: string | null; ativo: boolean; usos: number; maxUsos: number | null; expiraEm: string | null; exigeAprovacao: boolean };
export type SolicitacaoParceiro = { id: string; userId: string; nome: string; email: string; turmaNome: string; status: "pendente" | "aprovada" | "recusada" | "cancelada"; solicitadoEm: string };
export type EventoAuditoria = { id: number; evento: string; criadoEm: string; usuarioNome: string; detalhes: Record<string, unknown> };
export type FaturamentoParceiro = { competencia: string; alunosAtivos: number; valorTotal: number };
export type GestaoParceiro = { turmas: TurmaParceiro[]; convites: ConviteParceiro[]; solicitacoes: SolicitacaoParceiro[]; auditoria: EventoAuditoria[]; faturamento: FaturamentoParceiro[] };

const CONTEXTO_LEGADO: ContextoComercial = {
  papel: "legado",
  parceiroId: null,
  parceiroNome: null,
  turmaId: null,
  turmaNome: null,
  status: "legado",
  inicioEm: null,
  expiraEm: null,
  motivoBloqueio: null,
  acessoPermitido: true,
};

export async function carregarContextoComercial(): Promise<ContextoComercial> {
  const { data, error } = await supabase.rpc("meu_contexto_comercial");
  if (error?.code === "PGRST202" || error?.message?.includes("meu_contexto_comercial")) {
    return CONTEXTO_LEGADO;
  }
  if (error) throw new Error(`Não foi possível verificar seu acesso: ${error.message}`);
  return normalizarContexto(data);
}

export async function carregarResumoParceiro(): Promise<ResumoParceiro> {
  const { data, error } = await supabase.rpc("resumo_meu_parceiro");
  if (error) throw new Error(`Não foi possível carregar o resumo do parceiro: ${error.message}`);
  const valor = (data ?? {}) as Record<string, unknown>;
  return {
    parceiroId: texto(valor.parceiro_id),
    parceiroNome: texto(valor.parceiro_nome),
    alunosAtivos: numero(valor.alunos_ativos),
    alunosPendentes: numero(valor.alunos_pendentes),
    alunosBloqueados: numero(valor.alunos_bloqueados),
    valorMensal: numero(valor.valor_mensal),
  };
}

export async function listarAlunosDoParceiro(): Promise<AlunoParceiro[]> {
  let resposta = await supabase.rpc("listar_alunos_meu_parceiro_v3");

  if (resposta.error?.code === "PGRST202" || resposta.error?.message?.includes("listar_alunos_meu_parceiro_v3")) {
    resposta = await supabase.rpc("listar_alunos_meu_parceiro_v2");
  }

  const { data, error } = resposta;
  if (error) throw new Error(`Não foi possível carregar os alunos: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    licencaId: texto(item.licenca_id),
    userId: texto(item.user_id),
    nome: texto(item.nome) || "Aluno",
    turmaId: texto(item.turma_id) || null,
    turma: texto(item.turma) || "Sem turma",
    status: texto(item.status) as StatusLicenca,
    inicioEm: texto(item.inicio_em),
    expiraEm: texto(item.expira_em) || null,
    email: texto(item.email),
    minutos: numero(item.minutos),
    questoes: numero(item.questoes),
    acertos: numero(item.acertos),
    nivel: numero(item.nivel) || 1,
    ultimaAtividade: texto(item.ultima_atividade) || null,
  }));
}

export async function consultarConvite(codigo: string): Promise<ConvitePublico | null> {
  const { data, error } = await supabase.rpc("consultar_convite", { p_codigo: codigo });
  if (error) throw new Error(`Não foi possível consultar o convite: ${error.message}`);
  if (!data) return null;
  const item = data as Record<string, unknown>;
  return { conviteId: texto(item.convite_id), parceiroNome: texto(item.parceiro_nome), turmaNome: texto(item.turma_nome), titulo: texto(item.titulo) || null, exigeAprovacao: item.exige_aprovacao !== false, duracaoMeses: numero(item.duracao_meses), expiraEm: texto(item.expira_em) || null };
}

export async function solicitarEntrada(codigo: string) {
  const { data, error } = await supabase.rpc("solicitar_entrada_turma", { p_codigo: codigo });
  if (error) throw new Error(error.message);
  return data as { solicitacao_id: string; status: "pendente" | "aprovada" };
}

export async function carregarGestaoParceiro(): Promise<GestaoParceiro> {
  const { data, error } = await supabase.rpc("listar_gestao_meu_parceiro");
  if (error) throw new Error(`Não foi possível carregar a gestão: ${error.message}`);
  const valor = (data ?? {}) as Record<string, unknown>;
  return {
    turmas: lista(valor.turmas).map((x) => ({ id: texto(x.id), nome: texto(x.nome), codigo: texto(x.codigo) || null, ativa: x.ativa !== false })),
    convites: lista(valor.convites).map((x) => ({ id: texto(x.id), turmaId: texto(x.turma_id), turmaNome: texto(x.turma_nome), titulo: texto(x.titulo) || null, ativo: x.ativo !== false, usos: numero(x.usos), maxUsos: x.max_usos == null ? null : numero(x.max_usos), expiraEm: texto(x.expira_em) || null, exigeAprovacao: x.exige_aprovacao !== false })),
    solicitacoes: lista(valor.solicitacoes).map((x) => ({ id: texto(x.id), userId: texto(x.user_id), nome: texto(x.nome), email: texto(x.email), turmaNome: texto(x.turma_nome), status: texto(x.status) as SolicitacaoParceiro["status"], solicitadoEm: texto(x.solicitado_em) })),
    auditoria: lista(valor.auditoria).map((x) => ({ id: numero(x.id), evento: texto(x.evento), criadoEm: texto(x.criado_em), usuarioNome: texto(x.usuario_nome), detalhes: (x.detalhes ?? {}) as Record<string, unknown> })),
    faturamento: lista(valor.faturamento).map((x) => ({ competencia: texto(x.competencia), alunosAtivos: numero(x.alunos_ativos), valorTotal: numero(x.valor_total) })),
  };
}

export async function criarConvite(turmaId: string, validadeDias: number, maxUsos: number | null, duracaoMeses: number, titulo: string) {
  const { data, error } = await supabase.rpc("criar_convite_turma", { p_turma_id: turmaId, p_validade_dias: validadeDias, p_max_usos: maxUsos, p_duracao_meses: duracaoMeses, p_exige_aprovacao: true, p_titulo: titulo || null });
  if (error) throw new Error(`Não foi possível criar o convite: ${error.message}`);
  return texto(data);
}

export async function decidirSolicitacao(id: string, decisao: "aprovar" | "recusar", duracaoMeses = 12) {
  const { error } = await supabase.rpc("decidir_solicitacao", { p_solicitacao_id: id, p_decisao: decisao, p_duracao_meses: duracaoMeses });
  if (error) throw new Error(`Não foi possível responder à solicitação: ${error.message}`);
}

export async function alterarStatusLicenca(id: string, status: "ativa" | "suspensa" | "cancelada", motivo?: string) {
  const { error } = await supabase.rpc("alterar_status_licenca", { p_licenca_id: id, p_status: status, p_motivo: motivo || null, p_expira_em: null });
  if (error) throw new Error(`Não foi possível alterar a licença: ${error.message}`);
}

export function normalizarContexto(data: unknown): ContextoComercial {
  const valor = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    papel: (texto(valor.papel) || "legado") as PapelComercial,
    parceiroId: texto(valor.parceiro_id) || null,
    parceiroNome: texto(valor.parceiro_nome) || null,
    turmaId: texto(valor.turma_id) || null,
    turmaNome: texto(valor.turma_nome) || null,
    status: (texto(valor.status) || "legado") as StatusLicenca,
    inicioEm: texto(valor.inicio_em) || null,
    expiraEm: texto(valor.expira_em) || null,
    motivoBloqueio: texto(valor.motivo_bloqueio) || null,
    acessoPermitido: valor.acesso_permitido !== false,
  };
}

function texto(valor: unknown) { return typeof valor === "string" ? valor : ""; }
function numero(valor: unknown) { const n = Number(valor ?? 0); return Number.isFinite(n) ? n : 0; }
function lista(valor: unknown): Record<string, unknown>[] { return Array.isArray(valor) ? valor.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []; }
