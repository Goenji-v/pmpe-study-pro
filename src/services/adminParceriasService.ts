import { supabase } from "../lib/supabase";

export type PapelParceiroAdmin = "proprietario" | "gestor" | "professor";

export type TurmaParceiroAdmin = {
  id: string;
  nome: string;
  codigo: string | null;
  iniciaEm: string | null;
  encerraEm: string | null;
  ativa: boolean;
};

export type UsuarioParceiroAdmin = {
  userId: string;
  nome: string;
  email: string;
  papel: PapelParceiroAdmin;
  ativo: boolean;
};

export type ParceriaAdmin = {
  id: string;
  nome: string;
  slug: string;
  status: "ativo" | "suspenso" | "encerrado";
  valorAlunoCentavos: number;
  turmas: TurmaParceiroAdmin[];
  usuarios: UsuarioParceiroAdmin[];
};

type Registro = Record<string, unknown>;

export async function listarParceriasAdmin(): Promise<ParceriaAdmin[]> {
  const { data, error } = await supabase.rpc("admin_listar_parcerias");
  if (error) throw new Error(`Não foi possível carregar as parcerias: ${error.message}`);

  return lista(data).map((parceria) => ({
    id: texto(parceria.id),
    nome: texto(parceria.nome),
    slug: texto(parceria.slug),
    status: statusParceria(parceria.status),
    valorAlunoCentavos: numero(parceria.valor_aluno_centavos),
    turmas: lista(parceria.turmas).map((turma) => ({
      id: texto(turma.id),
      nome: texto(turma.nome),
      codigo: texto(turma.codigo) || null,
      iniciaEm: texto(turma.inicia_em) || null,
      encerraEm: texto(turma.encerra_em) || null,
      ativa: turma.ativa !== false,
    })),
    usuarios: lista(parceria.usuarios).map((usuario) => ({
      userId: texto(usuario.user_id),
      nome: texto(usuario.nome) || "Usuário",
      email: texto(usuario.email),
      papel: papel(usuario.papel),
      ativo: usuario.ativo !== false,
    })),
  }));
}

export async function criarParceriaAdmin(entrada: {
  nome: string;
  slug: string;
  valorAlunoCentavos: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("admin_criar_parceria", {
    p_nome: entrada.nome,
    p_slug: entrada.slug,
    p_valor_aluno_centavos: entrada.valorAlunoCentavos,
  });
  if (error) throw new Error(`Não foi possível criar a parceria: ${error.message}`);
  return typeof data === "string" ? data : "";
}

export async function criarTurmaParceiroAdmin(entrada: {
  parceiroId: string;
  nome: string;
  codigo?: string;
  iniciaEm?: string;
  encerraEm?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("admin_criar_turma_parceiro", {
    p_parceiro_id: entrada.parceiroId,
    p_nome: entrada.nome,
    p_codigo: entrada.codigo?.trim() || null,
    p_inicia_em: entrada.iniciaEm || null,
    p_encerra_em: entrada.encerraEm || null,
  });
  if (error) throw new Error(`Não foi possível criar a turma: ${error.message}`);
  return typeof data === "string" ? data : "";
}

export async function definirUsuarioParceiroAdmin(entrada: {
  parceiroId: string;
  email: string;
  papel: PapelParceiroAdmin;
  ativo: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("admin_definir_usuario_parceiro", {
    p_parceiro_id: entrada.parceiroId,
    p_email: entrada.email,
    p_papel: entrada.papel,
    p_ativo: entrada.ativo,
  });
  if (error) throw new Error(`Não foi possível atualizar o responsável: ${error.message}`);
}

export async function atualizarTurmaParceiroAdmin(entrada: {
  turmaId: string;
  nome: string;
  ativa: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("admin_atualizar_turma_parceiro", {
    p_turma_id: entrada.turmaId,
    p_nome: entrada.nome,
    p_ativa: entrada.ativa,
  });
  if (error) throw new Error(`Não foi possível atualizar a turma: ${error.message}`);
}

function lista(valor: unknown): Registro[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is Registro => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function papel(valor: unknown): PapelParceiroAdmin {
  return valor === "proprietario" || valor === "gestor" ? valor : "professor";
}

function statusParceria(valor: unknown): ParceriaAdmin["status"] {
  return valor === "suspenso" || valor === "encerrado" ? valor : "ativo";
}
