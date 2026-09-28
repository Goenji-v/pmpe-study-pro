import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";
import {
  enviarPdfSimulado,
  removerPdfSimulado,
} from "./simuladoService";

export type QuestaoSimuladoPdfAnalisada = {
  numero: number;
  materia: string;
  assunto: string;
  subassunto?: string;
  dificuldade: "Fácil" | "Média" | "Difícil";
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  gabarito: string;
  comentario: string;
  fonteGabarito: "comentado" | "ia";
  confianca: number;
};

export type AnaliseSimuladoPdf = {
  totalQuestoes: number;
  questoes: QuestaoSimuladoPdfAnalisada[];
  alertas: string[];
};

export type EstadoRemotoSimuladoPdf = {
  requestId: string;
  cadernoStoragePath: string;
  comentadoStoragePath?: string | null;
};

type JobApi = {
  requestId: string;
  status: "fila" | "processando" | "concluida" | "erro" | "cancelada";
  etapa: string;
  progresso: number;
  erro?: string | null;
  resultado?: AnaliseSimuladoPdf | null;
};

type RespostaJob = {
  sucesso?: boolean;
  job?: JobApi | null;
  erro?: string;
};

export async function analisarSimuladoPdf(params: {
  processoId: string;
  nome: string;
  prova: File;
  comentado?: File | null;
  totalInformado: number;
  remoto?: EstadoRemotoSimuladoPdf | null;
  onProgresso?: (
    progresso: number,
    descricao: string,
    remoto: EstadoRemotoSimuladoPdf
  ) => void;
}): Promise<{
  analise: AnaliseSimuladoPdf;
  remoto: EstadoRemotoSimuladoPdf;
}> {
  let remoto = params.remoto ?? null;

  if (!remoto) {
    params.onProgresso?.(2, "Enviando o caderno para análise segura.", {
      requestId: criarRequestId(params.processoId),
      cadernoStoragePath: "",
      comentadoStoragePath: null,
    });

    const [cadernoEnviado, comentadoEnviado] = await Promise.all([
      enviarPdfSimulado(params.prova, params.processoId, "caderno"),
      params.comentado
        ? enviarPdfSimulado(params.comentado, params.processoId, "comentado")
        : Promise.resolve(null),
    ]);

    remoto = {
      requestId: criarRequestId(params.processoId),
      cadernoStoragePath: cadernoEnviado.storagePath,
      comentadoStoragePath: comentadoEnviado?.storagePath ?? null,
    };

    params.onProgresso?.(6, "PDF enviado. Preparando a leitura das questões.", remoto);

    await criarJob({
      requestId: remoto.requestId,
      nome: params.nome,
      totalQuestoes: params.totalInformado,
      cadernoPath: remoto.cadernoStoragePath,
      cadernoNome: params.prova.name,
      comentadoPath: remoto.comentadoStoragePath,
      comentadoNome: params.comentado?.name ?? null,
    });
  }

  return acompanharJob(remoto, params.onProgresso);
}

export async function retomarAnaliseSimuladoPdf(params: {
  remoto: EstadoRemotoSimuladoPdf;
  onProgresso?: (
    progresso: number,
    descricao: string,
    remoto: EstadoRemotoSimuladoPdf
  ) => void;
}) {
  return acompanharJob(params.remoto, params.onProgresso);
}

export async function cancelarAnaliseSimuladoPdf(
  remoto?: EstadoRemotoSimuladoPdf | null
) {
  if (!remoto) return;

  await fetchApiAutenticada(
    criarUrlApi("/api/simulado-pdf/jobs/" + encodeURIComponent(remoto.requestId)),
    { method: "DELETE" }
  ).catch(() => null);

  await Promise.all([
    removerPdfSimulado(remoto.cadernoStoragePath),
    removerPdfSimulado(remoto.comentadoStoragePath ?? undefined),
  ]);
}

async function criarJob(params: {
  requestId: string;
  nome: string;
  totalQuestoes: number;
  cadernoPath: string;
  cadernoNome: string;
  comentadoPath?: string | null;
  comentadoNome?: string | null;
}) {
  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/simulado-pdf/jobs"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  const dados = (await resposta.json()) as RespostaJob;

  if (!resposta.ok || !dados.sucesso || !dados.job) {
    throw new Error(
      dados.erro || "Não foi possível iniciar a análise persistente do PDF."
    );
  }

  return dados.job;
}

async function acompanharJob(
  remoto: EstadoRemotoSimuladoPdf,
  onProgresso?: (
    progresso: number,
    descricao: string,
    remoto: EstadoRemotoSimuladoPdf
  ) => void
): Promise<{
  analise: AnaliseSimuladoPdf;
  remoto: EstadoRemotoSimuladoPdf;
}> {
  for (;;) {
    const resposta = await fetchApiAutenticada(
      criarUrlApi(
        "/api/simulado-pdf/jobs/" + encodeURIComponent(remoto.requestId)
      )
    );

    const dados = (await resposta.json()) as RespostaJob;

    if (!dados.sucesso || !dados.job) {
      throw new Error(
        dados.erro || "Não foi possível consultar a análise do PDF."
      );
    }

    const job = dados.job;
    onProgresso?.(
      Math.max(0, Math.min(100, Math.round(job.progresso || 0))),
      descricaoEtapa(job),
      remoto
    );

    if (job.status === "concluida" && job.resultado) {
      return {
        analise: job.resultado,
        remoto,
      };
    }

    if (job.status === "erro") {
      throw new Error(job.erro || "A análise do PDF falhou.");
    }

    if (job.status === "cancelada") {
      throw new Error("A análise do PDF foi cancelada.");
    }

    await esperar(1200);
  }
}

function descricaoEtapa(job: JobApi) {
  if (job.status === "fila") return "Análise na fila.";
  if (job.etapa === "baixando") return "Preparando os PDFs para a IA.";
  if (job.etapa === "validando") return "Conferindo gabarito e diagnóstico.";
  if (job.etapa === "concluida") return "Análise pronta.";
  return "Processando questões em segundo plano.";
}

function criarRequestId(processoId: string) {
  return "simulado-pdf:" + processoId.replace(/[^a-zA-Z0-9_-]/g, "");
}

function esperar(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
