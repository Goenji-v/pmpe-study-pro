import { supabase } from "../lib/supabase";

export type MotivoDenunciaQuestao =
  | "desatualizada"
  | "gabarito_incorreto"
  | "multiplos_gabaritos"
  | "sem_coerencia"
  | "repetida"
  | "outro";

export type ComentarioQuestao = {
  id: string;
  questaoId: string;
  userId: string;
  autorNome: string;
  conteudo: string;
  status: "visivel" | "oculto";
  criadoEm: string;
  atualizadoEm: string;
  meu: boolean;
};

export type DenunciaQuestaoAdmin = {
  id: string;
  questaoId: string | null;
  denuncianteId: string;
  motivo: MotivoDenunciaQuestao;
  detalhes: string | null;
  status: "pendente" | "improcedente" | "corrigida" | "excluida";
  snapshot: SnapshotQuestaoDenunciada;
  criadaEm: string;
};

export type SnapshotQuestaoDenunciada = {
  id?: string;
  materia?: string;
  modulo?: string | null;
  assunto?: string;
  banca?: string;
  enunciado?: string;
  alternativas?: Array<{ id: string; texto: string }>;
  resposta_correta_id?: string;
  explicacao?: string | null;
  origem?: string;
};

export type CorrecaoQuestaoDenunciada = {
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  respostaCorretaId: string;
  explicacao?: string;
};

type LinhaComentario = {
  id: string;
  questao_id: string;
  user_id: string;
  autor_nome: string;
  conteudo: string;
  status: "visivel" | "oculto";
  created_at: string;
  updated_at: string;
};

type LinhaDenuncia = {
  id: string;
  questao_id: string | null;
  denunciante_id: string;
  motivo: MotivoDenunciaQuestao;
  detalhes: string | null;
  status: DenunciaQuestaoAdmin["status"];
  questao_snapshot: SnapshotQuestaoDenunciada | null;
  created_at: string;
};

export async function questaoDisponivelParaComunidade(questaoId: string) {
  if (!ehUuid(questaoId)) return false;

  const { data, error } = await supabase
    .from("questoes_catalogo")
    .select("id")
    .eq("id", questaoId)
    .eq("status", "ativa")
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

export async function denunciarQuestao(
  questaoId: string,
  motivo: MotivoDenunciaQuestao,
  detalhes?: string
) {
  if (!ehUuid(questaoId)) {
    throw new Error("Esta questão não pertence ao banco compartilhado.");
  }

  const { data, error } = await supabase
    .from("questao_denuncias")
    .insert({
      questao_id: questaoId,
      motivo,
      detalhes: detalhes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      error.message.includes("retirada")
        ? "Esta questão já foi retirada para análise."
        : `Não foi possível enviar a denúncia: ${error.message}`
    );
  }

  return String(data.id);
}

export async function listarComentariosQuestao(
  questaoId: string
): Promise<ComentarioQuestao[]> {
  if (!ehUuid(questaoId)) return [];

  const [{ data, error }, { data: authData }] = await Promise.all([
    supabase
      .from("questao_comentarios")
      .select("id,questao_id,user_id,autor_nome,conteudo,status,created_at,updated_at")
      .eq("questao_id", questaoId)
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (error) {
    throw new Error(`Não foi possível carregar os comentários: ${error.message}`);
  }

  const meuId = authData.user?.id;
  return ((data ?? []) as LinhaComentario[]).map((linha) => ({
    id: linha.id,
    questaoId: linha.questao_id,
    userId: linha.user_id,
    autorNome: linha.autor_nome,
    conteudo: linha.conteudo,
    status: linha.status,
    criadoEm: linha.created_at,
    atualizadoEm: linha.updated_at,
    meu: linha.user_id === meuId,
  }));
}

export async function salvarMeuComentarioQuestao(
  questaoId: string,
  conteudo: string
) {
  const texto = conteudo.trim();
  if (texto.length < 3) {
    throw new Error("O comentário precisa ter pelo menos 3 caracteres.");
  }
  if (texto.length > 2000) {
    throw new Error("O comentário pode ter no máximo 2.000 caracteres.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Entre na sua conta para comentar.");
  }

  const { error } = await supabase
    .from("questao_comentarios")
    .upsert(
      {
        questao_id: questaoId,
        user_id: authData.user.id,
        conteudo: texto,
        status: "visivel",
      },
      { onConflict: "questao_id,user_id" }
    );

  if (error) {
    throw new Error(`Não foi possível salvar o comentário: ${error.message}`);
  }
}

export async function excluirMeuComentarioQuestao(comentarioId: string) {
  const { error } = await supabase
    .from("questao_comentarios")
    .delete()
    .eq("id", comentarioId);

  if (error) {
    throw new Error(`Não foi possível excluir o comentário: ${error.message}`);
  }
}

export async function listarDenunciasPendentes(): Promise<DenunciaQuestaoAdmin[]> {
  const { data, error } = await supabase
    .from("questao_denuncias")
    .select("id,questao_id,denunciante_id,motivo,detalhes,status,questao_snapshot,created_at")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(`Não foi possível carregar as denúncias: ${error.message}`);
  }

  return ((data ?? []) as LinhaDenuncia[]).map((linha) => ({
    id: linha.id,
    questaoId: linha.questao_id,
    denuncianteId: linha.denunciante_id,
    motivo: linha.motivo,
    detalhes: linha.detalhes,
    status: linha.status,
    snapshot: linha.questao_snapshot ?? {},
    criadaEm: linha.created_at,
  }));
}

export async function corrigirQuestaoDenunciada(
  questaoId: string,
  correcao: CorrecaoQuestaoDenunciada
) {
  const alternativas = correcao.alternativas
    .map((item) => ({ id: item.id.toUpperCase(), texto: item.texto.trim() }))
    .filter((item) => item.texto);

  if (!correcao.enunciado.trim()) throw new Error("Informe o enunciado.");
  if (alternativas.length !== 5) throw new Error("Preencha as cinco alternativas.");
  if (!alternativas.some((item) => item.id === correcao.respostaCorretaId)) {
    throw new Error("Selecione um gabarito válido.");
  }

  const { error } = await supabase
    .from("questoes_catalogo")
    .update({
      enunciado: correcao.enunciado.trim(),
      alternativas,
      resposta_correta_id: correcao.respostaCorretaId,
      explicacao: correcao.explicacao?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questaoId);

  if (error) {
    throw new Error(`Não foi possível corrigir a questão: ${error.message}`);
  }
}

export async function moderarDenunciaQuestao(
  denunciaId: string,
  acao: "restaurar" | "corrigir" | "excluir",
  respostaAdmin?: string
) {
  const { error } = await supabase.rpc("moderar_denuncia_questao", {
    p_denuncia_id: denunciaId,
    p_acao: acao,
    p_resposta_admin: respostaAdmin?.trim() || null,
  });

  if (error) {
    throw new Error(`Não foi possível concluir a moderação: ${error.message}`);
  }
}

function ehUuid(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}
