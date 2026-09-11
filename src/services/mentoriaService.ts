import { supabase } from "../lib/supabase";

export type ItemTrilhaMentoria = {
  id: string;
  materia: string;
  assunto: string;
  ordem: number;
};

export type TrilhaMentoria = {
  id: string;
  nome: string;
  parceiroId: string;
  turmaId: string;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  itens: ItemTrilhaMentoria[];
};

export type EntradaTrilhaMentoria = {
  parceiroId: string;
  turmaId: string;
  nome: string;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  itens: Array<{
    materia: string;
    assunto: string;
  }>;
};

type LinhaTrilha = {
  id: string;
  parceiro_id: string;
  turma_id: string;
  nome: string;
  ativa: boolean;
  minutos_padrao: number;
  materias_por_dia: number;
  questoes_por_sessao: number;
  revisoes_por_dia: number;
};

type LinhaItem = {
  id: string;
  trilha_id: string;
  materia: string;
  assunto: string;
  ordem: number;
  ativo: boolean;
};

export async function carregarMinhaTrilhaMentoria(): Promise<TrilhaMentoria | null> {
  const { data, error } = await supabase.rpc("minha_trilha_mentoria");

  if (error) {
    if (error.code === "PGRST202" || error.message.includes("minha_trilha_mentoria")) {
      return null;
    }
    throw new Error(`Não foi possível carregar a trilha da mentoria: ${error.message}`);
  }

  if (!data || typeof data !== "object") return null;
  return normalizarTrilha(data as Record<string, unknown>);
}

export async function listarTrilhasMentoriaDoParceiro(): Promise<TrilhaMentoria[]> {
  const { data: trilhas, error } = await supabase
    .from("trilhas_mentoria")
    .select("id, parceiro_id, turma_id, nome, ativa, minutos_padrao, materias_por_dia, questoes_por_sessao, revisoes_por_dia")
    .eq("ativa", true)
    .order("criado_em", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Não foi possível carregar as trilhas: ${error.message}`);
  }

  const linhas = (trilhas ?? []) as LinhaTrilha[];
  if (linhas.length === 0) return [];

  const ids = linhas.map((item) => item.id);
  const { data: itens, error: erroItens } = await supabase
    .from("trilha_mentoria_itens")
    .select("id, trilha_id, materia, assunto, ordem, ativo")
    .in("trilha_id", ids)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (erroItens) {
    throw new Error(`Não foi possível carregar os assuntos das trilhas: ${erroItens.message}`);
  }

  const linhasItens = (itens ?? []) as LinhaItem[];
  return linhas.map((linha) => normalizarLinha(linha, linhasItens));
}

export async function salvarTrilhaMentoria(entrada: EntradaTrilhaMentoria): Promise<TrilhaMentoria> {
  validarEntrada(entrada);

  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) throw new Error("Faça login para configurar a trilha.");

  const { data: existentes, error: erroExistentes } = await supabase
    .from("trilhas_mentoria")
    .select("id")
    .eq("turma_id", entrada.turmaId)
    .eq("ativa", true)
    .limit(1);

  if (erroExistentes) {
    throw new Error(`Não foi possível verificar a trilha atual: ${erroExistentes.message}`);
  }

  const idExistente = ((existentes ?? [])[0] as { id?: string } | undefined)?.id;
  let trilhaId = idExistente ?? "";

  if (idExistente) {
    const { error } = await supabase
      .from("trilhas_mentoria")
      .update({
        nome: entrada.nome.trim(),
        minutos_padrao: entrada.minutosPadrao,
        materias_por_dia: entrada.materiasPorDia,
        questoes_por_sessao: entrada.questoesPorSessao,
        revisoes_por_dia: entrada.revisoesPorDia,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", idExistente);

    if (error) throw new Error(`Não foi possível atualizar a trilha: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("trilhas_mentoria")
      .insert({
        parceiro_id: entrada.parceiroId,
        turma_id: entrada.turmaId,
        nome: entrada.nome.trim(),
        minutos_padrao: entrada.minutosPadrao,
        materias_por_dia: entrada.materiasPorDia,
        questoes_por_sessao: entrada.questoesPorSessao,
        revisoes_por_dia: entrada.revisoesPorDia,
        criado_por: usuario.user.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Não foi possível criar a trilha: ${error.message}`);
    trilhaId = String(data.id);
  }

  const { error: erroLimpeza } = await supabase
    .from("trilha_mentoria_itens")
    .delete()
    .eq("trilha_id", trilhaId);

  if (erroLimpeza) {
    throw new Error(`Não foi possível atualizar os assuntos da trilha: ${erroLimpeza.message}`);
  }

  const itens = entrada.itens
    .map((item, indice) => ({
      trilha_id: trilhaId,
      materia: item.materia.trim(),
      assunto: item.assunto.trim(),
      ordem: indice + 1,
      ativo: true,
    }))
    .filter((item) => item.materia && item.assunto);

  const { data: itensSalvos, error: erroSalvarItens } = await supabase
    .from("trilha_mentoria_itens")
    .insert(itens)
    .select("id, trilha_id, materia, assunto, ordem, ativo")
    .order("ordem", { ascending: true });

  if (erroSalvarItens) {
    throw new Error(`A trilha foi salva, mas os assuntos falharam: ${erroSalvarItens.message}`);
  }

  return {
    id: trilhaId,
    nome: entrada.nome.trim(),
    parceiroId: entrada.parceiroId,
    turmaId: entrada.turmaId,
    minutosPadrao: entrada.minutosPadrao,
    materiasPorDia: entrada.materiasPorDia,
    questoesPorSessao: entrada.questoesPorSessao,
    revisoesPorDia: entrada.revisoesPorDia,
    itens: ((itensSalvos ?? []) as LinhaItem[]).map(normalizarItem),
  };
}

function normalizarLinha(linha: LinhaTrilha, itens: LinhaItem[]): TrilhaMentoria {
  return {
    id: linha.id,
    nome: linha.nome,
    parceiroId: linha.parceiro_id,
    turmaId: linha.turma_id,
    minutosPadrao: Number(linha.minutos_padrao) || 60,
    materiasPorDia: Number(linha.materias_por_dia) || 1,
    questoesPorSessao: Number(linha.questoes_por_sessao) || 20,
    revisoesPorDia: Number(linha.revisoes_por_dia) || 10,
    itens: itens.filter((item) => item.trilha_id === linha.id && item.ativo).map(normalizarItem),
  };
}

function normalizarTrilha(valor: Record<string, unknown>): TrilhaMentoria {
  const itens = Array.isArray(valor.itens) ? valor.itens : [];
  return {
    id: texto(valor.id),
    nome: texto(valor.nome) || "Trilha da mentoria",
    parceiroId: texto(valor.parceiro_id),
    turmaId: texto(valor.turma_id),
    minutosPadrao: numero(valor.minutos_padrao, 60),
    materiasPorDia: numero(valor.materias_por_dia, 1),
    questoesPorSessao: numero(valor.questoes_por_sessao, 20),
    revisoesPorDia: numero(valor.revisoes_por_dia, 10),
    itens: itens
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: texto(item.id),
        materia: texto(item.materia),
        assunto: texto(item.assunto),
        ordem: numero(item.ordem, 1),
      }))
      .sort((a, b) => a.ordem - b.ordem),
  };
}

function normalizarItem(item: LinhaItem): ItemTrilhaMentoria {
  return {
    id: item.id,
    materia: item.materia,
    assunto: item.assunto,
    ordem: Number(item.ordem),
  };
}

function validarEntrada(entrada: EntradaTrilhaMentoria) {
  if (!entrada.parceiroId || !entrada.turmaId) throw new Error("Selecione uma turma.");
  if (entrada.nome.trim().length < 2) throw new Error("Informe um nome para a trilha.");
  if (entrada.minutosPadrao < 20 || entrada.minutosPadrao > 600) throw new Error("O tempo padrão deve ficar entre 20 e 600 minutos.");
  if (entrada.materiasPorDia < 1 || entrada.materiasPorDia > 4) throw new Error("Use de 1 a 4 matérias por dia.");
  if (entrada.questoesPorSessao < 0 || entrada.questoesPorSessao > 100) throw new Error("A meta de questões deve ficar entre 0 e 100.");
  if (entrada.revisoesPorDia < 0 || entrada.revisoesPorDia > 50) throw new Error("A meta de revisões deve ficar entre 0 e 50.");
  if (entrada.itens.filter((item) => item.materia.trim() && item.assunto.trim()).length === 0) throw new Error("Adicione pelo menos um assunto à trilha.");
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown, padrao: number) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}
