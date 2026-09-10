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
  turma: string;
  status: StatusLicenca;
  inicioEm: string;
  expiraEm: string | null;
};

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
  // Compatibilidade durante o deploy em duas etapas: o frontend novo continua
  // funcionando até a migration ser aplicada.
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
  const { data, error } = await supabase.rpc("listar_alunos_meu_parceiro");
  if (error) throw new Error(`Não foi possível carregar os alunos: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    licencaId: texto(item.licenca_id),
    userId: texto(item.user_id),
    nome: texto(item.nome) || "Aluno",
    turma: texto(item.turma) || "Sem turma",
    status: texto(item.status) as StatusLicenca,
    inicioEm: texto(item.inicio_em),
    expiraEm: texto(item.expira_em) || null,
  }));
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
