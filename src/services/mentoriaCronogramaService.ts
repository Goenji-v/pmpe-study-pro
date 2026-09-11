import { supabase } from "../lib/supabase";

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

export type ItemCronogramaMentoria = {
  id: string;
  materia: string;
  assunto: string;
  ordem: number;
  concluido: boolean;
  minutosEstimados: number;
  questoesAlvo: number;
  prioridade: number;
  tipo: "teoria" | "questoes" | "misto";
  instrucoes: string | null;
  materialUrl: string | null;
};

export type TrilhaCronogramaMentoria = {
  id: string;
  nome: string;
  parceiroId: string;
  turmaId: string;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  intervalosRevisao: number[];
  simuladoCadaDias: number | null;
  percentualTeoria: number;
  itens: ItemCronogramaMentoria[];
  disponibilidade: DisponibilidadeMentoria[];
  preferencias: PreferenciasCronogramaMentoria;
};

export type TipoTarefaMentoria =
  | "teoria"
  | "questoes"
  | "misto"
  | "revisao"
  | "reforco"
  | "simulado";

export type StatusTarefaMentoria =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "pulado"
  | "atrasado"
  | "reagendado";

export type TarefaMentoria = {
  id: string;
  data: string;
  ordem: number;
  tipo: TipoTarefaMentoria;
  minutosPlanejados: number;
  questoesPlanejadas: number;
  status: StatusTarefaMentoria;
  origem: string;
  itemId: string | null;
  reforcoId: string | null;
  materia: string;
  assunto: string;
  metadados: Record<string, unknown>;
};

type Registro = Record<string, unknown>;

export async function carregarTrilhaCronogramaMentoria(): Promise<TrilhaCronogramaMentoria | null> {
  const { data, error } = await supabase.rpc("minha_trilha_mentoria");

  if (error) {
    if (error.code === "PGRST202" || error.message.includes("minha_trilha_mentoria")) return null;
    throw new Error(`Não foi possível carregar a mentoria: ${error.message}`);
  }
  if (!data || typeof data !== "object") return null;

  const valor = data as Registro;
  const minutosPadrao = numero(valor.minutos_padrao, 60);
  const materiasPorDia = numero(valor.materias_por_dia, 1);
  const questoesPorSessao = numero(valor.questoes_por_sessao, 20);
  const intervalosRevisao = numeros(valor.intervalos_revisao, [1, 7, 30]);
  const percentualTeoria = numero(valor.percentual_teoria, 67);
  const simuladoCadaDias = numeroNulo(valor.simulado_cada_dias);
  const preferenciasBrutas = registro(valor.preferencias);

  const disponibilidade = lista(valor.disponibilidade).map((item) => ({
    diaSemana: numero(item.dia_semana, 0),
    ativo: item.ativo !== false,
    minutosDisponiveis: numero(item.minutos_disponiveis, minutosPadrao),
  }));

  return {
    id: texto(valor.id),
    nome: texto(valor.nome) || "Trilha da mentoria",
    parceiroId: texto(valor.parceiro_id),
    turmaId: texto(valor.turma_id),
    minutosPadrao,
    materiasPorDia,
    questoesPorSessao,
    revisoesPorDia: numero(valor.revisoes_por_dia, 10),
    intervalosRevisao,
    simuladoCadaDias,
    percentualTeoria,
    itens: lista(valor.itens).map((item) => ({
      id: texto(item.id),
      materia: texto(item.materia),
      assunto: texto(item.assunto),
      ordem: numero(item.ordem, 1),
      concluido: item.concluido === true,
      minutosEstimados: numero(item.minutos_estimados, minutosPadrao),
      questoesAlvo: numero(item.questoes_alvo, questoesPorSessao),
      prioridade: numero(item.prioridade, 50),
      tipo: tipoItem(item.tipo),
      instrucoes: texto(item.instrucoes) || null,
      materialUrl: texto(item.material_url) || null,
    })),
    disponibilidade,
    preferencias: {
      maxMateriasDia: numero(preferenciasBrutas.max_materias_dia, materiasPorDia),
      questoesPorSessao: numero(preferenciasBrutas.questoes_por_sessao, questoesPorSessao),
      percentualTeoria: numero(preferenciasBrutas.percentual_teoria, percentualTeoria),
      intervalosRevisao: numeros(preferenciasBrutas.intervalos_revisao, intervalosRevisao),
      simuladoCadaDias: numeroNulo(preferenciasBrutas.simulado_cada_dias) ?? simuladoCadaDias,
      dataInicio: texto(preferenciasBrutas.data_inicio) || dataLocalIso(),
      dataProva: texto(preferenciasBrutas.data_prova) || null,
    },
  };
}

export async function listarMinhasTarefasMentoria(inicio: string, fim: string): Promise<TarefaMentoria[]> {
  const { data, error } = await supabase
    .from("cronograma_mentoria_tarefas")
    .select("id, data, ordem, tipo, minutos_planejados, questoes_planejadas, status, origem, item_id, reforco_id, metadados")
    .gte("data", inicio)
    .lte("data", fim)
    .neq("status", "reagendado")
    .order("data", { ascending: true })
    .order("ordem", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Não foi possível carregar as tarefas da mentoria: ${error.message}`);
  }

  return ((data ?? []) as Registro[]).map((item) => {
    const metadados = registro(item.metadados);
    const tipo = tipoTarefa(item.tipo);
    return {
      id: texto(item.id),
      data: texto(item.data),
      ordem: numero(item.ordem, 1),
      tipo,
      minutosPlanejados: numero(item.minutos_planejados, 0),
      questoesPlanejadas: numero(item.questoes_planejadas, 0),
      status: statusTarefa(item.status),
      origem: texto(item.origem) || "automatico",
      itemId: texto(item.item_id) || null,
      reforcoId: texto(item.reforco_id) || null,
      materia: texto(metadados.materia) || (tipo === "simulado" ? "Simulado" : "Mentoria"),
      assunto: texto(metadados.assunto) || texto(metadados.titulo) || rotuloTipo(tipo),
      metadados,
    };
  });
}

export async function salvarDisponibilidadeMentoria(dias: DisponibilidadeMentoria[]): Promise<void> {
  const userId = await usuarioAtual();
  const linhas = dias.map((dia) => ({
    user_id: userId,
    dia_semana: dia.diaSemana,
    ativo: dia.ativo,
    minutos_disponiveis: Math.max(5, Math.min(720, Math.round(dia.minutosDisponiveis))),
    atualizado_em: new Date().toISOString(),
  }));
  const { error } = await supabase.from("disponibilidade_estudo_aluno").upsert(linhas, { onConflict: "user_id,dia_semana" });
  if (error) throw new Error(`Não foi possível salvar sua disponibilidade: ${error.message}`);
}

export async function salvarPreferenciasMentoria(preferencias: PreferenciasCronogramaMentoria): Promise<void> {
  const userId = await usuarioAtual();
  const { error } = await supabase.from("preferencias_cronograma_aluno").upsert({
    user_id: userId,
    max_materias_dia: Math.max(1, Math.min(4, Math.round(preferencias.maxMateriasDia))),
    questoes_por_sessao: Math.max(0, Math.min(200, Math.round(preferencias.questoesPorSessao))),
    percentual_teoria: Math.max(0, Math.min(100, Math.round(preferencias.percentualTeoria))),
    intervalos_revisao: preferencias.intervalosRevisao,
    simulado_cada_dias: preferencias.simuladoCadaDias,
    data_inicio: preferencias.dataInicio,
    data_prova: preferencias.dataProva,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(`Não foi possível salvar suas preferências: ${error.message}`);
}

export async function recalcularMeuCronogramaMentoria(
  inicio = dataLocalIso(),
  dias = 30,
  motivo = "recalculo_manual"
): Promise<void> {
  const { error } = await supabase.rpc("recalcular_meu_cronograma_mentoria", {
    p_inicio: inicio,
    p_dias: dias,
    p_motivo: motivo,
  });
  if (error) throw new Error(`Não foi possível recalcular o cronograma: ${error.message}`);
}

export async function atualizarStatusTarefaMentoria(
  tarefaId: string,
  status: "em_andamento" | "concluido" | "pulado"
): Promise<void> {
  const { error } = await supabase.rpc("atualizar_status_tarefa_mentoria", {
    p_tarefa_id: tarefaId,
    p_status: status,
  });
  if (error) throw new Error(`Não foi possível atualizar a tarefa: ${error.message}`);
}

async function usuarioAtual() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Faça login para configurar seu cronograma.");
  return data.user.id;
}

function lista(valor: unknown): Registro[] {
  return Array.isArray(valor) ? valor.filter((item): item is Registro => !!item && typeof item === "object") : [];
}

function registro(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : {};
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown, padrao: number) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function numeroNulo(valor: unknown) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function numeros(valor: unknown, padrao: number[]) {
  if (!Array.isArray(valor)) return padrao;
  const resultado = valor.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 365);
  return resultado.length > 0 ? resultado : padrao;
}

function tipoItem(valor: unknown): ItemCronogramaMentoria["tipo"] {
  return valor === "teoria" || valor === "questoes" || valor === "misto" ? valor : "misto";
}

function tipoTarefa(valor: unknown): TipoTarefaMentoria {
  return valor === "teoria" || valor === "questoes" || valor === "misto" || valor === "revisao" || valor === "reforco" || valor === "simulado" ? valor : "misto";
}

function statusTarefa(valor: unknown): StatusTarefaMentoria {
  return valor === "em_andamento" || valor === "concluido" || valor === "pulado" || valor === "atrasado" || valor === "reagendado" ? valor : "pendente";
}

function rotuloTipo(tipo: TipoTarefaMentoria) {
  return tipo === "reforco" ? "Reforço" : tipo === "revisao" ? "Revisão" : tipo === "simulado" ? "Simulado" : tipo === "questoes" ? "Questões" : tipo === "teoria" ? "Teoria" : "Estudo misto";
}

export function dataLocalIso(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
