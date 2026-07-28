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

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:3001`;

export async function gerarCronogramaIA(
  dados: DadosCronogramaIA
): Promise<CronogramaGeradoIA> {
  const resposta =
    await fetch(
      `${API_BASE_URL}/api/cronograma`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
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

  const salvo =
    await salvarCronograma(
      corpo.cronograma,
      dados.tempoDisponivelMinutos
    );

  return salvo;
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