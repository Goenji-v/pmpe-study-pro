import { API_BASE_URL } from "../config/api";
import {
  supabase,
} from "../lib/supabase";

export type PeriodoCronogramaIA =
  | "hoje"
  | "7-dias";

export type TipoTarefaCronogramaIA =
  | "teoria"
  | "questoes"
  | "revisao"
  | "simulado"
  | "redacao"
  | "misto";

export type TarefaCronogramaIA = {
  id: string;
  ordem: number;
  dia: number;
  titulo: string;
  materia: string;
  assunto: string;
  tipo: TipoTarefaCronogramaIA;
  duracaoMinutos: number;
  quantidadeQuestoes: number;
  justificativa: string;
  missaoId?: string;
};

export type CronogramaGeradoIA = {
  id?: string;
  titulo: string;
  periodo: PeriodoCronogramaIA;
  resumo: string;
  objetivoPrincipal: string;
  tempoTotalMinutos: number;
  tarefas: TarefaCronogramaIA[];
  geradoEm: string;
};

export type DadosCronogramaIA = {
  nomeUsuario: string;
  concurso: string;
  banca: string;
  periodo: PeriodoCronogramaIA;
  tempoDisponivelMinutos: number;

  perfilEstudo?: {
    diasPorSemana: number;
    materiaMaiorDificuldade: string;
    nivelAtual: "iniciante" | "intermediario" | "avancado";
    formatoPreferido: "teoria-questoes" | "teoria" | "questoes";
    domingoEstrategico: boolean;
    observacao: string;
    modo: "assistido";
    prioridadeAutomatica?: string;
  };

  metas: {
    minutosDia: number;
    questoesDia: number;
    revisoesDia: number;
  };

  questoes: Array<{
    materia: string;
    assunto: string;
    certas: number;
    erradas: number;
    minutos: number;
    data: string;
  }>;

  sessoes: Array<{
    materia: string;
    assunto: string;
    tipo: string;
    minutos: number;
    data: string;
  }>;

  revisoes: Array<{
    id: string;
    materia: string;
    assunto: string;
    etapa: number;
    dataPrevista: string;
    concluida: boolean;
  }>;

  simulados: Array<{
    nome: string;
    banca: string;
    certas: number;
    erradas: number;
    anuladas: number;
    minutos: number;
    data: string;
  }>;

  missoesPendentes: Array<{
    id: string;
    semana: number;
    dia: number;
    numero: number;
    materia: string;
    assunto: string;
    tipo: string;
  }>;
};

type RespostaSucesso = {
  sucesso: true;
  cronograma: CronogramaGeradoIA;
};

type RespostaErro = {
  sucesso: false;
  erro: string;
};

type LinhaCronograma = {
  id: string;
  titulo: string;
  periodo: PeriodoCronogramaIA;
  tempo_disponivel_minutos: number;
  dados: CronogramaGeradoIA;
  created_at: string;
};

const TIPOS_TAREFA = new Set<TipoTarefaCronogramaIA>([
  "teoria",
  "questoes",
  "revisao",
  "simulado",
  "redacao",
  "misto",
]);

export async function gerarCronogramaIA(
  dados: DadosCronogramaIA
): Promise<CronogramaGeradoIA> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;

  const resposta =
    await fetch(
      `${API_BASE_URL}/api/cronograma`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body: JSON.stringify(dados),
      }
    );

  let corpo:
    | RespostaSucesso
    | RespostaErro;

  try {
    corpo =
      await resposta.json();
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !resposta.ok ||
    !corpo.sucesso
  ) {
    throw new Error(
      "erro" in corpo
        ? corpo.erro
        : `Erro HTTP ${resposta.status}`
    );
  }

  const validado = validarCronogramaGerado(
    corpo.cronograma,
    dados
  );

  return salvarCronograma(
    validado,
    dados.tempoDisponivelMinutos
  );
}

export async function listarCronogramasIA():
  Promise<CronogramaGeradoIA[]> {
  const usuario =
    await exigirUsuario();

  const {
    data,
    error,
  } = await supabase
    .from("cronogramas_ia")
    .select(
      "id, titulo, periodo, tempo_disponivel_minutos, dados, created_at"
    )
    .eq(
      "user_id",
      usuario.id
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(20);

  if (error) {
    throw new Error(
      `Não foi possível carregar os cronogramas: ${error.message}`
    );
  }

  return (
    (data ?? []) as LinhaCronograma[]
  ).map(
    (linha) => ({
      ...linha.dados,
      id: linha.id,
      titulo: linha.titulo,
      periodo: linha.periodo,
      geradoEm:
        linha.created_at,
    })
  );
}

export async function excluirCronogramaIA(
  id: string
): Promise<void> {
  const usuario =
    await exigirUsuario();

  const {
    error,
  } = await supabase
    .from("cronogramas_ia")
    .delete()
    .eq("id", id)
    .eq(
      "user_id",
      usuario.id
    );

  if (error) {
    throw new Error(
      `Não foi possível excluir o cronograma: ${error.message}`
    );
  }
}

function validarCronogramaGerado(
  cronograma: CronogramaGeradoIA,
  entrada: DadosCronogramaIA
): CronogramaGeradoIA {
  if (!cronograma || typeof cronograma !== "object") {
    throw new Error("A IA retornou um cronograma inválido.");
  }

  if (cronograma.periodo !== entrada.periodo) {
    throw new Error("A IA retornou um período diferente do solicitado.");
  }

  if (!Array.isArray(cronograma.tarefas) || cronograma.tarefas.length === 0) {
    throw new Error("A IA não retornou tarefas executáveis para o cronograma.");
  }

  const diasPermitidos = entrada.periodo === "7-dias" ? 7 : 1;
  const limiteDiario = Math.max(20, Math.min(600, Number(entrada.tempoDisponivelMinutos) || 0));
  const minutosPorDia = new Map<number, number>();

  const tarefas = cronograma.tarefas.map((tarefa, indice) => {
    const dia = inteiroSeguro(tarefa.dia);
    const duracaoMinutos = inteiroSeguro(tarefa.duracaoMinutos);
    const quantidadeQuestoes = Math.max(0, inteiroSeguro(tarefa.quantidadeQuestoes));

    if (dia < 1 || dia > diasPermitidos) {
      throw new Error(`A IA colocou a tarefa ${indice + 1} fora do período solicitado.`);
    }

    if (duracaoMinutos < 1 || duracaoMinutos > limiteDiario) {
      throw new Error(`A IA retornou duração inválida na tarefa ${indice + 1}.`);
    }

    if (!TIPOS_TAREFA.has(tarefa.tipo)) {
      throw new Error(`A IA retornou tipo inválido na tarefa ${indice + 1}.`);
    }

    const materia = textoObrigatorio(tarefa.materia, `matéria da tarefa ${indice + 1}`);
    const assunto = textoObrigatorio(tarefa.assunto, `assunto da tarefa ${indice + 1}`);
    const titulo = textoObrigatorio(tarefa.titulo, `título da tarefa ${indice + 1}`);
    const justificativa = textoObrigatorio(
      tarefa.justificativa,
      `justificativa da tarefa ${indice + 1}`
    );

    const totalDia = (minutosPorDia.get(dia) ?? 0) + duracaoMinutos;
    if (totalDia > limiteDiario) {
      throw new Error(
        `A IA excedeu o limite de ${limiteDiario} minutos no dia ${dia}. O plano não foi salvo.`
      );
    }
    minutosPorDia.set(dia, totalDia);

    return {
      ...tarefa,
      id: tarefa.id?.trim() || crypto.randomUUID(),
      ordem: Math.max(1, inteiroSeguro(tarefa.ordem) || indice + 1),
      dia,
      duracaoMinutos,
      quantidadeQuestoes,
      materia,
      assunto,
      titulo,
      justificativa,
    };
  });

  const tempoTotalMinutos = tarefas.reduce(
    (total, tarefa) => total + tarefa.duracaoMinutos,
    0
  );

  return {
    ...cronograma,
    titulo: textoObrigatorio(cronograma.titulo, "título do cronograma"),
    resumo: textoObrigatorio(cronograma.resumo, "resumo do cronograma"),
    objetivoPrincipal: textoObrigatorio(
      cronograma.objetivoPrincipal,
      "objetivo principal do cronograma"
    ),
    tarefas,
    tempoTotalMinutos,
    geradoEm:
      dataValida(cronograma.geradoEm)
        ? cronograma.geradoEm
        : new Date().toISOString(),
  };
}

async function salvarCronograma(
  cronograma: CronogramaGeradoIA,
  tempoDisponivelMinutos: number
): Promise<CronogramaGeradoIA> {
  const usuario =
    await exigirUsuario();

  const {
    data,
    error,
  } = await supabase
    .from("cronogramas_ia")
    .insert({
      user_id:
        usuario.id,
      titulo:
        cronograma.titulo,
      periodo:
        cronograma.periodo,
      tempo_disponivel_minutos:
        tempoDisponivelMinutos,
      dados:
        cronograma,
    })
    .select(
      "id, titulo, periodo, tempo_disponivel_minutos, dados, created_at"
    )
    .single();

  if (error) {
    throw new Error(
      `O cronograma foi gerado, mas não pôde ser salvo: ${error.message}`
    );
  }

  const linha =
    data as LinhaCronograma;

  return {
    ...linha.dados,
    id: linha.id,
    titulo: linha.titulo,
    periodo: linha.periodo,
    geradoEm:
      linha.created_at,
  };
}

async function exigirUsuario() {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  if (error) {
    throw new Error(
      `Não foi possível identificar o usuário: ${error.message}`
    );
  }

  if (!data.user) {
    throw new Error(
      "Faça login para usar o cronograma."
    );
  }

  return data.user;
}

function inteiroSeguro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero) : 0;
}

function textoObrigatorio(valor: unknown, campo: string) {
  const texto = String(valor ?? "").trim();
  if (!texto) {
    throw new Error(`A IA retornou ${campo} vazio.`);
  }
  return texto;
}

function dataValida(valor: unknown) {
  if (typeof valor !== "string" || !valor.trim()) return false;
  return !Number.isNaN(new Date(valor).getTime());
}
