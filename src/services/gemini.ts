import type {
  QuestaoIA,
} from "../types/index";

import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";

export type DificuldadeIA =
  | "Fácil"
  | "Média"
  | "Difícil"
  | "Mista";

export type ConteudoGeracaoIA = {
  materia: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
};

export type EtapaJobGeracaoIA =
  | "fila"
  | "gerando"
  | "revisando"
  | "corrigindo"
  | "salvando"
  | "concluida"
  | "erro";

export type JobGeracaoIAPublico = {
  id: string;
  requestId: string;
  status: "fila" | "processando" | "concluida" | "erro";
  etapa: EtapaJobGeracaoIA;
  progresso: number;
  titulo: string;
  descricao: string;
  erro?: string | null;
  resultado?: {
    questoes?: unknown[];
  } | null;
  criadaEm?: string;
  iniciadaEm?: string | null;
  atualizadaEm?: string;
  concluidaEm?: string | null;
};

export type ParametrosGeracaoIA = {
  origem: "assunto" | "semana";
  materia?: string;
  modulo?: string;
  moduloId?: string;
  assunto?: string;
  semana?: number;
  conteudosSemana?: ConteudoGeracaoIA[];
  banca: string;
  dificuldade: DificuldadeIA;
  quantidade: number;
  enunciadosEvitar?: string[];
  /** Mantém a mesma geração recuperável sem disparar nova cobrança. */
  requestId?: string;
  /** Recoloca na fila um job que terminou em erro quando o usuário pediu retomada. */
  retomarErro?: boolean;
  /** Informa a etapa real persistida no servidor. */
  onEtapa?: (
    etapa: "gerando" | "revisando" | "corrigindo" | "salvando"
  ) => void;
};

type RespostaJob = {
  sucesso: boolean;
  job?: JobGeracaoIAPublico;
  erro?: string;
};

type RespostaListaJobs = {
  sucesso: boolean;
  jobs?: JobGeracaoIAPublico[];
  erro?: string;
};

const API_JOBS_URL = criarUrlApi("/api/geracoes");
const INTERVALO_CONSULTA_MS = 1_500;
const LIMITE_ESPERA_MS = 15 * 60 * 1000;
const LETRAS = ["A", "B", "C", "D", "E"] as const;

export async function gerarQuestoesIA(
  parametros: ParametrosGeracaoIA
): Promise<{ sucesso: true; questoes: QuestaoIA[] }> {
  const job = await iniciarGeracaoQuestoesIA(parametros);
  return aguardarGeracaoQuestoesIA(job, parametros);
}

export async function iniciarGeracaoQuestoesIA(
  parametros: ParametrosGeracaoIA
) {
  const assuntoCompleto = montarContextoGeracao(parametros);
  const requestId =
    parametros.requestId?.trim() ||
    crypto.randomUUID();

  const titulo =
    parametros.origem === "semana"
      ? `Simulado da Semana ${parametros.semana ?? 1}`
      : parametros.materia || "Questões por assunto";

  const descricao =
    parametros.origem === "semana"
      ? `Semana ${parametros.semana ?? 1} · ${parametros.dificuldade} · ${parametros.banca}`
      : `${parametros.assunto || "Assunto"} · ${parametros.dificuldade} · ${parametros.banca}`;

  return iniciarOuRetomarJobGeracaoIA({
    requestId,
    assunto: assuntoCompleto,
    quantidade: parametros.quantidade,
    banca: parametros.banca,
    enunciadosEvitar: parametros.enunciadosEvitar ?? [],
    titulo,
    descricao,
    retomar: parametros.retomarErro === true,
  });
}

export async function aguardarGeracaoQuestoesIA(
  jobInicial: JobGeracaoIAPublico,
  parametros: ParametrosGeracaoIA
): Promise<{ sucesso: true; questoes: QuestaoIA[] }> {
  const job = await aguardarJobGeracaoIA(
    jobInicial,
    parametros.onEtapa
  );

  const questoesBrutas =
    job.resultado &&
    Array.isArray(job.resultado.questoes)
      ? job.resultado.questoes
      : [];

  if (questoesBrutas.length !== parametros.quantidade) {
    throw new Error(
      `A geração concluída retornou ${questoesBrutas.length} questão(ões), mas eram esperadas ${parametros.quantidade}.`
    );
  }

  const questoes = normalizarQuestoes(
    questoesBrutas,
    parametros
  );

  return {
    sucesso: true,
    questoes,
  };
}

export async function listarJobsGeracaoIA(
  prefixo: string
) {
  const resposta = await fetchApiAutenticada(
    `${API_JOBS_URL}?prefixo=${encodeURIComponent(prefixo)}`
  );
  const dados = (await lerJsonSeguro(resposta)) as RespostaListaJobs;

  if (!resposta.ok || !dados.sucesso) {
    throw new Error(
      dados.erro ||
      "Não foi possível consultar as gerações."
    );
  }

  return Array.isArray(dados.jobs)
    ? dados.jobs
    : [];
}

async function iniciarOuRetomarJobGeracaoIA(entrada: {
  requestId: string;
  assunto: string;
  quantidade: number;
  banca: string;
  enunciadosEvitar: string[];
  titulo: string;
  descricao: string;
  retomar: boolean;
}) {
  const resposta = await fetchApiAutenticada(
    API_JOBS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entrada),
    }
  );

  const dados = (await lerJsonSeguro(resposta)) as RespostaJob;

  if (!dados.job) {
    throw new Error(
      dados.erro ||
      "Não foi possível iniciar a geração."
    );
  }

  if (dados.job.status === "erro") {
    throw new Error(
      dados.job.erro ||
      "A geração terminou com erro."
    );
  }

  return dados.job;
}

async function consultarJobGeracaoIA(
  requestId: string
) {
  const resposta = await fetchApiAutenticada(
    `${API_JOBS_URL}/${encodeURIComponent(requestId)}`
  );
  const dados = (await lerJsonSeguro(resposta)) as RespostaJob;

  if (!dados.job) {
    throw new Error(
      dados.erro ||
      "Não foi possível consultar a geração."
    );
  }

  return dados.job;
}

async function aguardarJobGeracaoIA(
  inicial: JobGeracaoIAPublico,
  onEtapa?: ParametrosGeracaoIA["onEtapa"]
) {
  const inicio = Date.now();
  let job = inicial;
  let ultimaEtapa = "";

  while (true) {
    if (job.etapa !== ultimaEtapa) {
      ultimaEtapa = job.etapa;
      if (
        job.etapa === "gerando" ||
        job.etapa === "revisando" ||
        job.etapa === "corrigindo" ||
        job.etapa === "salvando"
      ) {
        onEtapa?.(job.etapa);
      }
    }

    if (job.status === "concluida") {
      return job;
    }

    if (job.status === "erro") {
      throw new Error(
        job.erro ||
        "A geração terminou com erro."
      );
    }

    if (Date.now() - inicio > LIMITE_ESPERA_MS) {
      throw new Error(
        "A geração continua no servidor. Você pode sair desta tela e acompanhar pela Central de Gerações."
      );
    }

    await aguardar(INTERVALO_CONSULTA_MS);
    job = await consultarJobGeracaoIA(job.requestId);
  }
}

async function lerJsonSeguro(
  resposta: Response
) {
  try {
    return await resposta.json() as unknown;
  } catch {
    return {
      sucesso: false,
      erro: "A API retornou uma resposta inválida.",
    };
  }
}

function aguardar(
  milissegundos: number
) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milissegundos);
  });
}

function montarContextoGeracao(
  parametros: ParametrosGeracaoIA
) {
  if (parametros.origem === "semana") {
    const conteudos = parametros.conteudosSemana ?? [];

    if (conteudos.length === 0) {
      throw new Error("A semana selecionada não possui conteúdos válidos.");
    }

    const lista = conteudos
      .map(
        (item, indice) =>
          `${indice + 1}. ${item.materia}${item.modulo ? ` → ${item.modulo}` : ""} → ${item.assunto}`
      )
      .join("\n");

    return [
      `Origem: Semana ${parametros.semana}`,
      "",
      "Gere as questões exclusivamente com base nos conteúdos abaixo.",
      "Distribua as questões de forma equilibrada entre matérias e assuntos.",
      "Não crie questões de conteúdos fora desta lista.",
      "",
      lista,
      "",
      `Dificuldade: ${parametros.dificuldade}`,
    ].join("\n");
  }

  return [
    `Matéria: ${parametros.materia}`,
    `Módulo: ${parametros.modulo || "Geral"}`,
    `Assunto: ${parametros.assunto}`,
    `Dificuldade: ${parametros.dificuldade}`,
  ].join("\n");
}

function normalizarQuestoes(
  questoes: unknown[],
  parametros: ParametrosGeracaoIA
): QuestaoIA[] {
  const vistos = new Set<string>();

  return questoes.map((valor, indice) => {
    const questao = objetoSeguro(valor);
    const enunciado = textoObrigatorio(
      questao.enunciado,
      `Questão ${indice + 1}: enunciado ausente.`
    );
    const chaveEnunciado = normalizarTexto(enunciado);

    if (vistos.has(chaveEnunciado)) {
      throw new Error(`A IA repetiu o enunciado da questão ${indice + 1}.`);
    }
    vistos.add(chaveEnunciado);

    const alternativasBrutas = objetoSeguro(questao.alternativas);
    const alternativas = Object.fromEntries(
      LETRAS.map((letra) => [
        letra,
        textoObrigatorio(
          alternativasBrutas[letra],
          `Questão ${indice + 1}: alternativa ${letra} ausente.`
        ),
      ])
    ) as QuestaoIA["alternativas"];

    const alternativasNormalizadas = LETRAS.map((letra) =>
      normalizarTexto(alternativas[letra])
    );
    if (new Set(alternativasNormalizadas).size !== LETRAS.length) {
      throw new Error(`Questão ${indice + 1}: existem alternativas duplicadas.`);
    }

    const respostaCorreta = validarResposta(
      questao.respostaCorreta,
      indice + 1
    );

    const explicacao = textoObrigatorio(
      questao.explicacao,
      `Questão ${indice + 1}: explicação ausente.`
    );
    const auditoria = objetoSeguro(questao.auditoria);
    const fonteNome = textoObrigatorio(
      questao.fonteNome,
      `Questão ${indice + 1}: fonte verificável ausente.`
    );

    const dificuldade = normalizarDificuldade(
      questao.dificuldade,
      parametros.dificuldade
    );

    return {
      id: crypto.randomUUID(),
      materia:
        parametros.origem === "assunto"
          ? parametros.materia || "Conteúdo selecionado"
          : textoObrigatorio(
              questao.materia,
              `Questão ${indice + 1}: matéria ausente.`
            ),
      modulo:
        parametros.origem === "assunto"
          ? parametros.modulo || "Geral"
          : textoOpcional(questao.modulo),
      moduloId:
        parametros.origem === "assunto"
          ? parametros.moduloId
          : textoOpcional(questao.moduloId),
      assunto:
        parametros.origem === "assunto"
          ? parametros.assunto || "Assunto selecionado"
          : textoObrigatorio(
              questao.assunto,
              `Questão ${indice + 1}: assunto ausente.`
            ),
      banca: parametros.banca,
      dificuldade,
      enunciado,
      alternativas,
      respostaCorreta,
      explicacao,
      fonteNome,
      norma: textoOpcional(questao.norma),
      dispositivo: textoOpcional(questao.dispositivo),
      verificadaEm: textoOpcional(auditoria.dataReferencia),
    };
  });
}

function validarResposta(
  valor: unknown,
  numeroQuestao: number
): QuestaoIA["respostaCorreta"] {
  const resposta = String(valor ?? "").trim().toUpperCase();

  if (LETRAS.includes(resposta as (typeof LETRAS)[number])) {
    return resposta as QuestaoIA["respostaCorreta"];
  }

  throw new Error(
    `Questão ${numeroQuestao}: gabarito inválido. A questão foi rejeitada em vez de assumir uma alternativa.`
  );
}

function normalizarDificuldade(
  valor: unknown,
  padrao: DificuldadeIA
): QuestaoIA["dificuldade"] {
  if (valor === "Fácil" || valor === "Média" || valor === "Difícil") {
    return valor;
  }

  return padrao === "Fácil" || padrao === "Difícil"
    ? padrao
    : "Média";
}

function objetoSeguro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : {};
}

function textoObrigatorio(
  valor: unknown,
  erro: string
) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) throw new Error(erro);
  return texto;
}

function textoOpcional(valor: unknown) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto || undefined;
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
