import { supabase } from "../lib/supabase";

export type TipoAcompanhamentoParceiro = "observacao" | "plano_acao" | "orientacao";
export type StatusAcompanhamentoParceiro = "aberto" | "concluido";

export type AcompanhamentoParceiro = {
  id: string;
  tipo: TipoAcompanhamentoParceiro;
  texto: string;
  status: StatusAcompanhamentoParceiro;
  enviadoAoAluno: boolean;
  criadoEm: string;
  criadoPorNome: string;
  concluidoEm: string | null;
};

export async function listarAcompanhamentosParceiro(userId: string): Promise<AcompanhamentoParceiro[]> {
  const { data, error } = await supabase.rpc("listar_acompanhamentos_aluno_parceiro", {
    p_user_id: userId,
  });

  if (error) throw new Error(`Não foi possível carregar o acompanhamento: ${error.message}`);

  return lista(data).map((item) => ({
    id: texto(item.id),
    tipo: texto(item.tipo) as TipoAcompanhamentoParceiro,
    texto: texto(item.texto),
    status: texto(item.status) as StatusAcompanhamentoParceiro,
    enviadoAoAluno: item.enviado_ao_aluno === true,
    criadoEm: texto(item.criado_em),
    criadoPorNome: texto(item.criado_por_nome) || "Equipe da mentoria",
    concluidoEm: texto(item.concluido_em) || null,
  }));
}

export async function criarAcompanhamentoParceiro(entrada: {
  userId: string;
  tipo: TipoAcompanhamentoParceiro;
  texto: string;
  enviarAoAluno?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("criar_acompanhamento_aluno_parceiro", {
    p_user_id: entrada.userId,
    p_tipo: entrada.tipo,
    p_texto: entrada.texto,
    p_enviar_aluno: entrada.enviarAoAluno === true,
  });

  if (error) throw new Error(`Não foi possível registrar o acompanhamento: ${error.message}`);
}

export async function concluirAcompanhamentoParceiro(id: string): Promise<void> {
  const { error } = await supabase.rpc("concluir_acompanhamento_aluno_parceiro", {
    p_acompanhamento_id: id,
  });

  if (error) throw new Error(`Não foi possível concluir o acompanhamento: ${error.message}`);
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}
