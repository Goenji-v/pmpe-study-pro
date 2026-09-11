import { supabase } from "../lib/supabase";

export type TipoItemTrilhaMentoria = "teoria" | "questoes" | "misto";
export type TipoTarefaMentoria = "teoria" | "questoes" | "revisao" | "simulado" | "reforco" | "misto";
export type StatusTarefaMentoria = "pendente" | "em_andamento" | "concluido" | "pulado" | "atrasado" | "reagendado";

export type ItemTrilhaMentoria = {
  id: string;
  materia: string;
  assunto: string;
  ordem: number;
  minutosEstimados: number;
  questoesAlvo: number;
  prioridade: number;
  obrigatorio: boolean;
  tipo: TipoItemTrilhaMentoria;
  instrucoes: string | null;
  materialUrl: string | null;
  concluido?: boolean;
  concluidoEm?: string | null;
};

export type DisponibilidadeMentoria = {
  diaSemana: number;
  ativo: boolean;
  minutosDisponiveis: number;
};

export type PreferenciasCronogramaMentoria = {
  maxMateriasDia: number;
  questoesPorSessao: number;
  percentualTeoria: number;
  intervalosRevisao: number[];
  simuladoCadaDias: number | null;
  dataInicio: string;
  dataProva: string | null;
};

export type ReforcoMentoria = {
  id: string;
  itemId: string | null;
  materia: string;
  assunto: string;
  motivo: string | null;
  minutosExtra: number;
  questoesExtra: number;
  revisaoEmDias: number | null;
  prioridade: number;
  criadoEm: string;
};

export type TrilhaMentoria = {
  id: string;
  nome: string;
  parceiroId: string;
  turmaId: string;
  turmaNome?: string;
  ativa?: boolean;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  intervalosRevisao: number[];
  simuladoCadaDias: number | null;
  percentualTeoria: number;
  alunos?: number;
  itens: ItemTrilhaMentoria[];
  reforcos?: ReforcoMentoria[];
  disponibilidade?: DisponibilidadeMentoria[];
  preferencias?: PreferenciasCronogramaMentoria | null;
};

export type EntradaItemTrilhaMentoria = {
  id?: string;
  materia: string;
  assunto: string;
  minutosEstimados?: number;
  questoesAlvo?: number;
  prioridade?: number;
  obrigatorio?: boolean;
  tipo?: TipoItemTrilhaMentoria;
  instrucoes?: string | null;
  materialUrl?: string | null;
};

export type EntradaTrilhaMentoria = {
  parceiroId: string;
  turmaId: string;
  nome: string;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  intervalosRevisao?: number[];
  simuladoCadaDias?: number | null;
  percentualTeoria?: number;
  itens: EntradaItemTrilhaMentoria[];
};

export type TarefaMentoria = {
  id: string;
  data: string;
  ordem: number;
  tipo: TipoTarefaMentoria;
  minutosPlanejados: number;
  questoesPlanejadas: number;
  status: StatusTarefaMentoria;
  origem: "automatico" | "mentor" | "recalculo";
  itemId: string | null;
  reforcoId: string | null;
  materia: string;
  assunto: string;
  metadados: Record<string, unknown>;
};

export type PainelCronogramaAlunoMentor = {
  userId: string;
  parceiroId: string;
  turmaId: string;
  trilha: { id: string; nome: string };
  disponibilidade: DisponibilidadeMentoria[];
  preferencias: PreferenciasCronogramaMentoria | null;
  progresso: { concluidos: number; total: number };
  tarefas: TarefaMentoria[];
  reforcosPendentes: ReforcoMentoria[];
};

export async function carregarMinhaTrilhaMentoria(): Promise<TrilhaMentoria | null> {
  const { data, error } = await supabase.rpc("minha_trilha_mentoria");
  if (error) {
    if (error.code === "PGRST202" || error.message.includes("minha_trilha_mentoria")) return null;
    throw new Error(`Não foi possível carregar a trilha da mentoria: ${error.message}`);
  }
  if (!data || typeof data !== "object") return null;
  return normalizarTrilha(data);
}

export async function listarTrilhasMentoriaDoParceiro(): Promise<TrilhaMentoria[]> {
  const { data, error } = await supabase.rpc("listar_trilhas_meu_parceiro");
  if (error) {
    if (error.code === "PGRST202" || error.message.includes("listar_trilhas_meu_parceiro")) return [];
    throw new Error(`Não foi possível carregar as trilhas: ${error.message}`);
  }
  return lista(data).map(normalizarTrilha);
}

export async function salvarTrilhaMentoria(entrada: EntradaTrilhaMentoria): Promise<TrilhaMentoria> {
  validarEntrada(entrada);
  const itens = entrada.itens
    .filter((item) => item.materia.trim() && item.assunto.trim())
    .map((item) => ({
      id: item.id || null,
      materia: item.materia.trim(),
      assunto: item.assunto.trim(),
      minutos_estimados: item.minutosEstimados ?? 60,
      questoes_alvo: item.questoesAlvo ?? entrada.questoesPorSessao,
      prioridade: item.prioridade ?? 50,
      obrigatorio: item.obrigatorio ?? true,
      tipo: item.tipo ?? "misto",
      instrucoes: item.instrucoes?.trim() || null,
      material_url: item.materialUrl?.trim() || null,
    }));

  const { error } = await supabase.rpc("salvar_trilha_mentoria", {
    p_turma_id: entrada.turmaId,
    p_nome: entrada.nome.trim(),
    p_minutos_padrao: entrada.minutosPadrao,
    p_materias_por_dia: entrada.materiasPorDia,
    p_questoes_por_sessao: entrada.questoesPorSessao,
    p_revisoes_por_dia: entrada.revisoesPorDia,
    p_intervalos_revisao: entrada.intervalosRevisao ?? [1, 7, 30],
    p_simulado_cada_dias: entrada.simuladoCadaDias ?? null,
    p_percentual_teoria: entrada.percentualTeoria ?? 67,
    p_itens: itens,
  });
  if (error) throw new Error(`Não foi possível salvar a trilha: ${error.message}`);

  const trilhas = await listarTrilhasMentoriaDoParceiro();
  const salva = trilhas.find((item) => item.turmaId === entrada.turmaId);
  if (!salva) throw new Error("A trilha foi salva, mas não pôde ser recarregada.");
  return salva;
}

export async function listarMinhasTarefasMentoria(inicio: string, fim: string): Promise<TarefaMentoria[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para carregar o cronograma da mentoria.");
  const { data, error } = await supabase
    .from("cronograma_mentoria_tarefas")
    .select("id,data,ordem,tipo,minutos_planejados,questoes_planejadas,status,origem,item_id,reforco_id,metadados")
    .eq("user_id", auth.user.id)
    .gte("data", inicio)
    .lte("data", fim)
    .neq("status", "reagendado")
    .order("data", { ascending: true })
    .order("ordem", { ascending: true });
  if (error) throw new Error(`Não foi possível carregar as tarefas da mentoria: ${error.message}`);
  return lista(data).map(normalizarTarefa);
}

export async function recalcularMeuCronogramaMentoria(inicio: string, dias: number, motivo = "recalculo_aluno") {
  const { data, error } = await supabase.rpc("recalcular_meu_cronograma_mentoria", {
    p_inicio: inicio,
    p_dias: dias,
    p_motivo: motivo,
  });
  if (error) throw new Error(`Não foi possível recalcular seu cronograma: ${error.message}`);
  return objeto(data);
}

export async function atualizarStatusTarefaMentoria(
  tarefaId: string,
  status: "em_andamento" | "concluido" | "pulado"
) {
  const { data, error } = await supabase.rpc("atualizar_status_tarefa_mentoria", {
    p_tarefa_id: tarefaId,
    p_status: status,
  });
  if (error) throw new Error(`Não foi possível atualizar a tarefa da mentoria: ${error.message}`);
  return objeto(data);
}

export async function salvarDisponibilidadeMentoria(disponibilidade: DisponibilidadeMentoria[]) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para salvar sua disponibilidade.");
  const linhas = disponibilidade.map((item) => ({
    user_id: auth.user!.id,
    dia_semana: item.diaSemana,
    ativo: item.ativo,
    minutos_disponiveis: item.ativo ? Math.max(5, Math.min(720, item.minutosDisponiveis)) : 0,
  }));
  const { error } = await supabase.from("disponibilidade_estudo_aluno").upsert(linhas, { onConflict: "user_id,dia_semana" });
  if (error) throw new Error(`Não foi possível salvar sua disponibilidade: ${error.message}`);
}

export async function salvarPreferenciasMentoria(preferencias: PreferenciasCronogramaMentoria) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para salvar suas preferências.");
  const { error } = await supabase.from("preferencias_cronograma_aluno").upsert({
    user_id: auth.user.id,
    max_materias_dia: preferencias.maxMateriasDia,
    questoes_por_sessao: preferencias.questoesPorSessao,
    percentual_teoria: preferencias.percentualTeoria,
    intervalos_revisao: preferencias.intervalosRevisao,
    simulado_cada_dias: preferencias.simuladoCadaDias,
    data_inicio: preferencias.dataInicio,
    data_prova: preferencias.dataProva,
  }, { onConflict: "user_id" });
  if (error) throw new Error(`Não foi possível salvar as preferências: ${error.message}`);
}

export async function carregarPainelCronogramaAlunoMentor(userId: string): Promise<PainelCronogramaAlunoMentor | null> {
  const { data, error } = await supabase.rpc("painel_cronograma_aluno_meu_parceiro", { p_user_id: userId });
  if (error) throw new Error(`Não foi possível carregar o cronograma do aluno: ${error.message}`);
  if (!data || typeof data !== "object") return null;
  const valor = objeto(data);
  return {
    userId: texto(valor.user_id),
    parceiroId: texto(valor.parceiro_id),
    turmaId: texto(valor.turma_id),
    trilha: { id: texto(objeto(valor.trilha).id), nome: texto(objeto(valor.trilha).nome) },
    disponibilidade: lista(valor.disponibilidade).map(normalizarDisponibilidade),
    preferencias: valor.preferencias ? normalizarPreferencias(valor.preferencias) : null,
    progresso: {
      concluidos: numero(objeto(valor.progresso).concluidos),
      total: numero(objeto(valor.progresso).total),
    },
    tarefas: lista(valor.tarefas).map(normalizarTarefa),
    reforcosPendentes: lista(valor.reforcos_pendentes).map(normalizarReforco),
  };
}

export async function criarReforcoMentoria(input: {
  userId: string;
  itemId: string;
  motivo?: string;
  minutos?: number;
  questoes?: number;
  revisaoDias?: number | null;
}) {
  const { data, error } = await supabase.rpc("criar_reforco_mentoria", {
    p_user_id: input.userId,
    p_item_id: input.itemId,
    p_motivo: input.motivo ?? null,
    p_minutos: input.minutos ?? 30,
    p_questoes: input.questoes ?? 10,
    p_revisao_dias: input.revisaoDias ?? 7,
  });
  if (error) throw new Error(`Não foi possível criar o reforço: ${error.message}`);
  return texto(data);
}

export async function recalcularCronogramaAlunoMentor(userId: string, inicio: string, dias = 30, motivo = "ajuste_mentor") {
  const { data, error } = await supabase.rpc("recalcular_cronograma_aluno_mentor", {
    p_user_id: userId,
    p_inicio: inicio,
    p_dias: dias,
    p_motivo: motivo,
  });
  if (error) throw new Error(`Não foi possível recalcular o cronograma do aluno: ${error.message}`);
  return objeto(data);
}

function normalizarTrilha(valorBruto: unknown): TrilhaMentoria {
  const valor = objeto(valorBruto);
  return {
    id: texto(valor.id),
    nome: texto(valor.nome) || "Trilha da mentoria",
    parceiroId: texto(valor.parceiro_id),
    turmaId: texto(valor.turma_id),
    turmaNome: texto(valor.turma_nome) || undefined,
    ativa: valor.ativa === undefined ? undefined : valor.ativa !== false,
    minutosPadrao: numero(valor.minutos_padrao) || 60,
    materiasPorDia: numero(valor.materias_por_dia) || 1,
    questoesPorSessao: numero(valor.questoes_por_sessao) || 20,
    revisoesPorDia: numero(valor.revisoes_por_dia) || 10,
    intervalosRevisao: numeros(valor.intervalos_revisao, [1, 7, 30]),
    simuladoCadaDias: valor.simulado_cada_dias == null ? null : numero(valor.simulado_cada_dias),
    percentualTeoria: numero(valor.percentual_teoria) || 67,
    alunos: valor.alunos == null ? undefined : numero(valor.alunos),
    itens: lista(valor.itens).map(normalizarItem).sort((a, b) => a.ordem - b.ordem),
    reforcos: lista(valor.reforcos).map(normalizarReforco),
    disponibilidade: lista(valor.disponibilidade).map(normalizarDisponibilidade),
    preferencias: valor.preferencias ? normalizarPreferencias(valor.preferencias) : null,
  };
}

function normalizarItem(valorBruto: unknown): ItemTrilhaMentoria {
  const valor = objeto(valorBruto);
  return {
    id: texto(valor.id),
    materia: texto(valor.materia),
    assunto: texto(valor.assunto),
    ordem: numero(valor.ordem) || 1,
    minutosEstimados: numero(valor.minutos_estimados) || 60,
    questoesAlvo: numero(valor.questoes_alvo),
    prioridade: numero(valor.prioridade) || 50,
    obrigatorio: valor.obrigatorio !== false,
    tipo: (texto(valor.tipo) || "misto") as TipoItemTrilhaMentoria,
    instrucoes: texto(valor.instrucoes) || null,
    materialUrl: texto(valor.material_url) || null,
    concluido: valor.concluido === true,
    concluidoEm: texto(valor.concluido_em) || null,
  };
}

function normalizarTarefa(valorBruto: unknown): TarefaMentoria {
  const valor = objeto(valorBruto);
  const metadados = objeto(valor.metadados);
  return {
    id: texto(valor.id),
    data: texto(valor.data),
    ordem: numero(valor.ordem),
    tipo: (texto(valor.tipo) || "misto") as TipoTarefaMentoria,
    minutosPlanejados: numero(valor.minutos_planejados),
    questoesPlanejadas: numero(valor.questoes_planejadas),
    status: (texto(valor.status) || "pendente") as StatusTarefaMentoria,
    origem: (texto(valor.origem) || "automatico") as TarefaMentoria["origem"],
    itemId: texto(valor.item_id) || null,
    reforcoId: texto(valor.reforco_id) || null,
    materia: texto(metadados.materia) || "Mentoria",
    assunto: texto(metadados.assunto) || texto(metadados.titulo) || "Atividade programada",
    metadados,
  };
}

function normalizarDisponibilidade(valorBruto: unknown): DisponibilidadeMentoria {
  const valor = objeto(valorBruto);
  return { diaSemana: numero(valor.dia_semana), ativo: valor.ativo !== false, minutosDisponiveis: numero(valor.minutos_disponiveis) };
}

function normalizarPreferencias(valorBruto: unknown): PreferenciasCronogramaMentoria {
  const valor = objeto(valorBruto);
  return {
    maxMateriasDia: numero(valor.max_materias_dia) || 1,
    questoesPorSessao: numero(valor.questoes_por_sessao) || 20,
    percentualTeoria: numero(valor.percentual_teoria) || 67,
    intervalosRevisao: numeros(valor.intervalos_revisao, [1, 7, 30]),
    simuladoCadaDias: valor.simulado_cada_dias == null ? null : numero(valor.simulado_cada_dias),
    dataInicio: texto(valor.data_inicio) || new Date().toISOString().slice(0, 10),
    dataProva: texto(valor.data_prova) || null,
  };
}

function normalizarReforco(valorBruto: unknown): ReforcoMentoria {
  const valor = objeto(valorBruto);
  return {
    id: texto(valor.id),
    itemId: texto(valor.item_id) || null,
    materia: texto(valor.materia),
    assunto: texto(valor.assunto),
    motivo: texto(valor.motivo) || null,
    minutosExtra: numero(valor.minutos_extra) || 30,
    questoesExtra: numero(valor.questoes_extra),
    revisaoEmDias: valor.revisao_em_dias == null ? null : numero(valor.revisao_em_dias),
    prioridade: numero(valor.prioridade) || 90,
    criadoEm: texto(valor.criado_em),
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

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
function lista(valor: unknown): unknown[] { return Array.isArray(valor) ? valor : []; }
function texto(valor: unknown): string { return typeof valor === "string" ? valor : ""; }
function numero(valor: unknown): number { const n = Number(valor ?? 0); return Number.isFinite(n) ? n : 0; }
function numeros(valor: unknown, fallback: number[]): number[] {
  if (!Array.isArray(valor)) return fallback;
  const resultado = valor.map(Number).filter((item) => Number.isFinite(item) && item > 0);
  return resultado.length ? resultado : fallback;
}
