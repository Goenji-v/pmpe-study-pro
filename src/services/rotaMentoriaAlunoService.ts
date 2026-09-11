import { supabase } from "../lib/supabase";
import type { ItemTrilhaMentoria, ReforcoMentoria, TrilhaMentoria } from "./mentoriaService";

export type ItemRotaMentoriaAluno = ItemTrilhaMentoria & {
  ativo: boolean;
  personalizada: boolean;
};

export type EstadoMentoriaAluno = {
  rota: ItemRotaMentoriaAluno[];
  progresso: Map<string, string>;
  reforcos: ReforcoMentoria[];
  personalizada: boolean;
};

type LinhaRota = {
  item_id: string;
  ordem: number;
  ativo: boolean;
};

export async function carregarEstadoMentoriaAluno(
  trilha: TrilhaMentoria,
  userId: string
): Promise<EstadoMentoriaAluno> {
  const ids = trilha.itens.map((item) => item.id);

  const [rotaResposta, progressoResposta, reforcosResposta] = await Promise.all([
    supabase
      .from("trilha_mentoria_rotas_aluno")
      .select("item_id, ordem, ativo")
      .eq("trilha_id", trilha.id)
      .eq("user_id", userId),
    ids.length
      ? supabase
          .from("progresso_trilha_mentoria")
          .select("item_id, concluido_em")
          .eq("user_id", userId)
          .in("item_id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("reforcos_mentoria")
      .select("id, item_id, materia, assunto, motivo, criado_em, status, user_id")
      .eq("trilha_id", trilha.id)
      .eq("user_id", userId)
      .order("criado_em", { ascending: false }),
  ]);

  if (rotaResposta.error) {
    throw new Error(`Não foi possível carregar a rota individual: ${rotaResposta.error.message}`);
  }
  if (progressoResposta.error) {
    throw new Error(`Não foi possível carregar o progresso do aluno: ${progressoResposta.error.message}`);
  }
  if (reforcosResposta.error) {
    throw new Error(`Não foi possível carregar os reforços do aluno: ${reforcosResposta.error.message}`);
  }

  const ajustes = new Map(
    ((rotaResposta.data ?? []) as LinhaRota[]).map((item) => [item.item_id, item])
  );
  const progresso = new Map(
    ((progressoResposta.data ?? []) as Array<{ item_id: string; concluido_em: string }>).map(
      (item) => [item.item_id, item.concluido_em]
    )
  );

  const rota = trilha.itens
    .map((item) => {
      const ajuste = ajustes.get(item.id);
      const concluidoEm = progresso.get(item.id) || null;
      return {
        ...item,
        ordem: ajuste?.ordem ?? item.ordem,
        ativo: ajuste?.ativo ?? true,
        personalizada: !!ajuste,
        concluido: !!concluidoEm,
        concluidoEm,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.materia.localeCompare(b.materia, "pt-BR"));

  const reforcos = ((reforcosResposta.data ?? []) as Record<string, unknown>[]).map((item) => ({
    id: texto(item.id),
    itemId: texto(item.item_id) || null,
    userId: texto(item.user_id),
    materia: texto(item.materia),
    assunto: texto(item.assunto),
    motivo: texto(item.motivo) || null,
    criadoEm: texto(item.criado_em),
    status: (texto(item.status) || "pendente") as ReforcoMentoria["status"],
  }));

  return {
    rota,
    progresso,
    reforcos,
    personalizada: ajustes.size > 0,
  };
}

export async function salvarRotaMentoriaAluno(entrada: {
  trilha: TrilhaMentoria;
  userId: string;
  parceiroId: string;
  turmaId: string;
  itens: ItemRotaMentoriaAluno[];
}): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Faça login para alterar a rota do aluno.");

  const idsPermitidos = new Set(entrada.trilha.itens.map((item) => item.id));
  const itens = entrada.itens.filter((item) => idsPermitidos.has(item.id));
  if (itens.length !== entrada.trilha.itens.length) {
    throw new Error("A rota contém itens que não pertencem à trilha atual.");
  }

  const linhas = itens.map((item, indice) => ({
    trilha_id: entrada.trilha.id,
    item_id: item.id,
    user_id: entrada.userId,
    parceiro_id: entrada.parceiroId,
    turma_id: entrada.turmaId,
    ordem: indice + 1,
    ativo: item.ativo,
    criado_por: data.user.id,
    atualizado_em: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("trilha_mentoria_rotas_aluno")
    .upsert(linhas, { onConflict: "user_id,item_id" });

  if (error) throw new Error(`Não foi possível salvar a rota individual: ${error.message}`);
}

export async function restaurarRotaMentoriaAluno(
  trilhaId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("trilha_mentoria_rotas_aluno")
    .delete()
    .eq("trilha_id", trilhaId)
    .eq("user_id", userId);

  if (error) throw new Error(`Não foi possível restaurar a rota da turma: ${error.message}`);
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}
