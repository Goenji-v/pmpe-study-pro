import { supabase } from "../lib/supabase";

export type ItemTrilhaMentoria = {
  id: string;
  materia: string;
  assunto: string;
  ordem: number;
  concluido: boolean;
  concluidoEm: string | null;
};

export type ReforcoMentoria = {
  id: string;
  itemId: string | null;
  materia: string;
  assunto: string;
  motivo: string | null;
  criadoEm: string;
  status: "pendente" | "concluido" | "cancelado";
  userId?: string;
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
  reforcos: ReforcoMentoria[];
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
    id?: string;
    materia: string;
    assunto: string;
  }>;
};

export type ProgressoMentoriaAluno = {
  userId: string;
  itemId: string;
  concluidoEm: string;
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

type EvidenciaConteudo = {
  materia: string;
  assunto: string;
  concluido: boolean;
  concluidoEm?: string | null;
};

type EvidenciaSessao = {
  materia: string;
  assunto: string;
  data: string;
  finalizadaEm?: string | null;
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

export async function listarProgressoMentoria(trilhaId: string): Promise<ProgressoMentoriaAluno[]> {
  const { data: itens, error: erroItens } = await supabase
    .from("trilha_mentoria_itens")
    .select("id")
    .eq("trilha_id", trilhaId)
    .eq("ativo", true);

  if (erroItens) throw new Error(`Não foi possível localizar os assuntos da trilha: ${erroItens.message}`);
  const ids = ((itens ?? []) as Array<{ id: string }>).map((item) => item.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("progresso_trilha_mentoria")
    .select("item_id, user_id, concluido_em")
    .in("item_id", ids);

  if (error) throw new Error(`Não foi possível carregar o progresso dos alunos: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    userId: texto(item.user_id),
    itemId: texto(item.item_id),
    concluidoEm: texto(item.concluido_em),
  }));
}

export async function listarReforcosMentoria(trilhaId: string): Promise<ReforcoMentoria[]> {
  const { data, error } = await supabase
    .from("reforcos_mentoria")
    .select("id, item_id, user_id, materia, assunto, motivo, status, criado_em")
    .eq("trilha_id", trilhaId)
    .order("criado_em", { ascending: false });

  if (error) throw new Error(`Não foi possível carregar os reforços: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    id: texto(item.id),
    itemId: texto(item.item_id) || null,
    userId: texto(item.user_id),
    materia: texto(item.materia),
    assunto: texto(item.assunto),
    motivo: texto(item.motivo) || null,
    criadoEm: texto(item.criado_em),
    status: (texto(item.status) || "pendente") as ReforcoMentoria["status"],
  }));
}

export async function criarReforcoMentoria(entrada: {
  parceiroId: string;
  turmaId: string;
  trilhaId: string;
  userId: string;
  item: ItemTrilhaMentoria;
  motivo?: string;
}): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Faça login para solicitar reforço.");

  const { error } = await supabase.from("reforcos_mentoria").insert({
    parceiro_id: entrada.parceiroId,
    turma_id: entrada.turmaId,
    trilha_id: entrada.trilhaId,
    item_id: entrada.item.id,
    user_id: entrada.userId,
    materia: entrada.item.materia,
    assunto: entrada.item.assunto,
    motivo: entrada.motivo?.trim() || "Reforço solicitado pelo mentor.",
    criado_por: data.user.id,
  });

  if (error) throw new Error(`Não foi possível criar o reforço: ${error.message}`);
}

export async function cancelarReforcoMentoria(id: string): Promise<void> {
  const { error } = await supabase
    .from("reforcos_mentoria")
    .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente");

  if (error) throw new Error(`Não foi possível cancelar o reforço: ${error.message}`);
}

export async function sincronizarMeuProgressoMentoria(
  conteudos: EvidenciaConteudo[],
  sessoes: EvidenciaSessao[]
): Promise<void> {
  const trilha = await carregarMinhaTrilhaMentoria();
  if (!trilha || trilha.itens.length === 0) return;

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;

  const concluidos = new Map(
    conteudos
      .filter((item) => item.concluido)
      .map((item) => [chaveConteudo(item.materia, item.assunto), item])
  );

  const desejados = trilha.itens.filter((item) =>
    concluidos.has(chaveConteudo(item.materia, item.assunto))
  );

  const idsTrilha = trilha.itens.map((item) => item.id);
  const { data: atuais, error: erroAtuais } = await supabase
    .from("progresso_trilha_mentoria")
    .select("item_id")
    .eq("user_id", userId)
    .in("item_id", idsTrilha);

  if (erroAtuais) throw new Error(`Não foi possível sincronizar seu progresso: ${erroAtuais.message}`);

  const atuaisSet = new Set(((atuais ?? []) as Array<{ item_id: string }>).map((item) => item.item_id));
  const desejadosSet = new Set(desejados.map((item) => item.id));

  const novos = desejados
    .filter((item) => !atuaisSet.has(item.id))
    .map((item) => {
      const evidencia = concluidos.get(chaveConteudo(item.materia, item.assunto));
      return {
        item_id: item.id,
        user_id: userId,
        origem: "conteudo",
        concluido_em: evidencia?.concluidoEm || new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
    });

  if (novos.length > 0) {
    const { error } = await supabase.from("progresso_trilha_mentoria").upsert(novos);
    if (error) throw new Error(`Não foi possível registrar seu progresso: ${error.message}`);
  }

  const remover = Array.from(atuaisSet).filter((id) => !desejadosSet.has(id));
  if (remover.length > 0) {
    const { error } = await supabase
      .from("progresso_trilha_mentoria")
      .delete()
      .eq("user_id", userId)
      .in("item_id", remover);
    if (error) throw new Error(`Não foi possível atualizar seu progresso: ${error.message}`);
  }

  if (trilha.reforcos.length === 0 || sessoes.length === 0) return;

  const reforcosConcluidos = trilha.reforcos.filter((reforco) => {
    const criadoEm = Date.parse(reforco.criadoEm);
    return sessoes.some((sessao) => {
      const dataSessao = Date.parse(sessao.finalizadaEm || sessao.data);
      return (
        Number.isFinite(dataSessao) &&
        dataSessao > criadoEm &&
        chaveConteudo(sessao.materia, sessao.assunto) === chaveConteudo(reforco.materia, reforco.assunto)
      );
    });
  });

  if (reforcosConcluidos.length > 0) {
    const { error } = await supabase
      .from("reforcos_mentoria")
      .update({
        status: "concluido",
        concluido_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "pendente")
      .in("id", reforcosConcluidos.map((item) => item.id));

    if (error) throw new Error(`Não foi possível concluir o reforço: ${error.message}`);
  }
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

  if (erroExistentes) throw new Error(`Não foi possível verificar a trilha atual: ${erroExistentes.message}`);

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

  const { data: itensAtuais, error: erroItensAtuais } = await supabase
    .from("trilha_mentoria_itens")
    .select("id, trilha_id, materia, assunto, ordem, ativo")
    .eq("trilha_id", trilhaId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (erroItensAtuais) throw new Error(`Não foi possível preparar a trilha: ${erroItensAtuais.message}`);

  const atuais = (itensAtuais ?? []) as LinhaItem[];
  const atuaisPorId = new Map(atuais.map((item) => [item.id, item]));

  for (const item of atuais) {
    const { error } = await supabase
      .from("trilha_mentoria_itens")
      .update({ ordem: 100000 + item.ordem })
      .eq("id", item.id);
    if (error) throw new Error(`Não foi possível reordenar a trilha: ${error.message}`);
  }

  const idsPreservados = new Set<string>();
  const itensValidos = entrada.itens.filter((item) => item.materia.trim() && item.assunto.trim());

  for (let indice = 0; indice < itensValidos.length; indice += 1) {
    const item = itensValidos[indice];
    const atual = item.id ? atuaisPorId.get(item.id) : undefined;
    const mesmaIdentidade =
      atual &&
      chaveConteudo(atual.materia, atual.assunto) === chaveConteudo(item.materia, item.assunto);

    if (atual && mesmaIdentidade) {
      idsPreservados.add(atual.id);
      const { error } = await supabase
        .from("trilha_mentoria_itens")
        .update({
          materia: item.materia.trim(),
          assunto: item.assunto.trim(),
          ordem: indice + 1,
          ativo: true,
        })
        .eq("id", atual.id);
      if (error) throw new Error(`Não foi possível atualizar um assunto da trilha: ${error.message}`);
      continue;
    }

    const { error } = await supabase.from("trilha_mentoria_itens").insert({
      trilha_id: trilhaId,
      materia: item.materia.trim(),
      assunto: item.assunto.trim(),
      ordem: indice + 1,
      ativo: true,
    });
    if (error) throw new Error(`Não foi possível adicionar um assunto à trilha: ${error.message}`);
  }

  const removerIds = atuais.filter((item) => !idsPreservados.has(item.id)).map((item) => item.id);
  if (removerIds.length > 0) {
    const { error } = await supabase.from("trilha_mentoria_itens").delete().in("id", removerIds);
    if (error) throw new Error(`Não foi possível remover assuntos antigos da trilha: ${error.message}`);
  }

  const { data: itensSalvos, error: erroSalvarItens } = await supabase
    .from("trilha_mentoria_itens")
    .select("id, trilha_id, materia, assunto, ordem, ativo")
    .eq("trilha_id", trilhaId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (erroSalvarItens) throw new Error(`A trilha foi salva, mas não pôde ser recarregada: ${erroSalvarItens.message}`);

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
    reforcos: [],
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
    reforcos: [],
  };
}

function normalizarTrilha(valor: Record<string, unknown>): TrilhaMentoria {
  const itens = Array.isArray(valor.itens) ? valor.itens : [];
  const reforcos = Array.isArray(valor.reforcos) ? valor.reforcos : [];

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
        concluido: item.concluido === true,
        concluidoEm: texto(item.concluido_em) || null,
      }))
      .sort((a, b) => a.ordem - b.ordem),
    reforcos: reforcos
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: texto(item.id),
        itemId: texto(item.item_id) || null,
        materia: texto(item.materia),
        assunto: texto(item.assunto),
        motivo: texto(item.motivo) || null,
        criadoEm: texto(item.criado_em),
        status: "pendente" as const,
      })),
  };
}

function normalizarItem(item: LinhaItem): ItemTrilhaMentoria {
  return {
    id: item.id,
    materia: item.materia,
    assunto: item.assunto,
    ordem: Number(item.ordem),
    concluido: false,
    concluidoEm: null,
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

function chaveConteudo(materia: string, assunto: string) {
  return `${normalizar(materia)}::${normalizar(assunto)}`;
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown, padrao: number) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}
