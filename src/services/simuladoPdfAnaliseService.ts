import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";

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
  fonteGabarito: "comentado" | "prova" | "ia";
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
    | "gerando"
    | "revisando"
    | "corrigindo"
    | "salvando"
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

  const [provaBase64, comentadoBase64] = await Promise.all([
    arquivoParaBase64(params.prova),
    params.comentado
      ? arquivoParaBase64(params.comentado)
      : Promise.resolve(null),
  ]);

  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/simulados-pdf/jobs"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: params.requestId,
        titulo: params.titulo || "Análise de simulado PDF",
        totalInformado: params.totalInformado,
        retomar: params.retomar === true,
        prova: {
          nome: params.prova.name,
          base64: provaBase64,
        },
        comentado:
          params.comentado && comentadoBase64
            ? {
                nome: params.comentado.name,
                base64: comentadoBase64,
              }
            : null,
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
      "/api/simulados-pdf/jobs/" + encodeURIComponent(requestId)
    )
  );

  return lerJob(resposta);
}

export async function excluirAnaliseSimuladoPdf(requestId: string) {
  const resposta = await fetchApiAutenticada(
    criarUrlApi(
      "/api/simulados-pdf/jobs/" + encodeURIComponent(requestId)
    ),
    {
      method: "DELETE",
    }
  );

  if (!resposta.ok) {
    let mensagem = "Não foi possível excluir a análise em andamento.";
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

  if (arquivo.size > 12 * 1024 * 1024) {
    throw new Error(`O PDF de ${rotulo} ultrapassa o limite de 12 MB.`);
  }
}

function arquivoParaBase64(arquivo: File) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onerror = () =>
      reject(new Error(`Não foi possível ler ${arquivo.name}.`));

    leitor.onload = () => {
      const resultado = String(leitor.result || "");
      const separador = resultado.indexOf(",");

      if (separador < 0) {
        reject(
          new Error(
            `O arquivo ${arquivo.name} não pôde ser preparado para análise.`
          )
        );
        return;
      }

      resolve(resultado.slice(separador + 1));
    };

    leitor.readAsDataURL(arquivo);
  });
}
