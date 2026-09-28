import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";
import {
  enviarPdfSimulado,
} from "./simuladoService";

export type QuestaoSimuladoPdfAnalisada = {
  numero: number;
  materia: string;
  modulo?: string;
  assunto: string;
  subassunto?: string;
  dificuldade: "Fácil" | "Média" | "Difícil";
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  gabarito: string;
  comentario: string;
  norma?: string;
  dispositivo?: string;
  fonteGabarito: "comentado" | "ia";
  confianca: number;
  status: "valida" | "revisar" | "anulada";
};

export type AnaliseSimuladoPdf = {
  totalQuestoes: number;
  questoes: QuestaoSimuladoPdfAnalisada[];
  alertas: string[];
};

export type JobAnaliseSimuladoPdf = {
  id: string;
  requestId: string;
  status: "fila" | "processando" | "concluida" | "erro";
  etapa:
    | "fila"
    | "baixando"
    | "analisando"
    | "validando"
    | "concluida"
    | "erro";
  progresso: number;
  titulo: string;
  descricao: string;
  erro: string | null;
  totalQuestoes: number;
  resultado: AnaliseSimuladoPdf | null;
  criadaEm: string;
  iniciadaEm: string | null;
  atualizadaEm: string;
  concluidaEm: string | null;
};

type RespostaJob =
  | {
      sucesso: true;
      job: JobAnaliseSimuladoPdf;
    }
  | {
      sucesso: false;
      erro: string;
    };

export async function iniciarAnaliseSimuladoPdf(params: {
  requestId: string;
  prova: File;
  comentado?: File | null;
  totalInformado: number;
  titulo?: string;
  retomar?: boolean;
}): Promise<JobAnaliseSimuladoPdf> {
  validarArquivoPdf(params.prova, "caderno");
  if (params.comentado) validarArquivoPdf(params.comentado, "comentado");

  if (params.retomar) {
    try {
      const atual = await consultarAnaliseSimuladoPdf(params.requestId);
      if (atual.status !== "erro") return atual;
    } catch {
      // Se o job remoto não existir mais, recriamos abaixo usando os PDFs
      // preservados no navegador.
    }
  }

  const processoId = extrairProcessoId(params.requestId);

  const [caderno, comentado] = await Promise.all([
    enviarPdfSimulado(params.prova, processoId, "caderno"),
    params.comentado
      ? enviarPdfSimulado(params.comentado, processoId, "comentado")
      : Promise.resolve(null),
  ]);

  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/simulado-pdf/jobs"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: params.requestId,
        nome: params.titulo || "Análise de simulado PDF",
        totalQuestoes: params.totalInformado,
        retomar: params.retomar === true,
        cadernoPath: caderno.storagePath,
        cadernoNome: params.prova.name,
        comentadoPath: comentado?.storagePath ?? null,
        comentadoNome: params.comentado?.name ?? null,
      }),
    }
  );

  return lerJob(resposta);
}

export async function consultarAnaliseSimuladoPdf(
  requestId: string
): Promise<JobAnaliseSimuladoPdf> {
  const resposta = await fetchApiAutenticada(
    criarUrlApi(
      "/api/simulado-pdf/jobs/" + encodeURIComponent(requestId)
    )
  );

  return lerJob(resposta);
}

export async function excluirAnaliseSimuladoPdf(requestId: string) {
  const resposta = await fetchApiAutenticada(
    criarUrlApi(
      "/api/simulado-pdf/jobs/" + encodeURIComponent(requestId)
    ),
    {
      method: "DELETE",
    }
  );

  if (!resposta.ok) {
    let mensagem = "Não foi possível cancelar a análise em andamento.";

    try {
      const dados = (await resposta.json()) as { erro?: string };
      if (dados.erro) mensagem = dados.erro;
    } catch {
      // Mantém a mensagem amigável.
    }

    throw new Error(mensagem);
  }
}

async function lerJob(resposta: Response) {
  let dados: RespostaJob;

  try {
    dados = (await resposta.json()) as RespostaJob;
  } catch {
    throw new Error(
      "O servidor retornou uma resposta inválida para a análise do simulado."
    );
  }

  if (!resposta.ok && resposta.status !== 202) {
    throw new Error(
      "erro" in dados
        ? dados.erro
        : "Não foi possível consultar a análise do simulado."
    );
  }

  if (!dados.sucesso || !dados.job) {
    throw new Error(
      "erro" in dados
        ? dados.erro
        : "A análise do simulado não retornou um estado válido."
    );
  }

  return {
    ...dados.job,
    progresso: Math.max(
      0,
      Math.min(100, Math.round(Number(dados.job.progresso) || 0))
    ),
  };
}

function validarArquivoPdf(arquivo: File, rotulo: string) {
  const ehPdf =
    arquivo.type === "application/pdf" ||
    arquivo.name.toLowerCase().endsWith(".pdf");

  if (!ehPdf) {
    throw new Error(`O arquivo de ${rotulo} precisa estar em PDF.`);
  }

  if (arquivo.size > 50 * 1024 * 1024) {
    throw new Error(`O PDF de ${rotulo} ultrapassa o limite de 50 MB.`);
  }
}

function extrairProcessoId(requestId: string) {
  const semPrefixo = requestId.replace(/^simulado-pdf:/, "");
  return semPrefixo || crypto.randomUUID();
}
