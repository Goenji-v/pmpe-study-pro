import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";

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

export async function analisarSimuladoPdf(params: {
  prova: File;
  comentado?: File | null;
  totalInformado: number;
}): Promise<AnaliseSimuladoPdf> {
  const [provaBase64, comentadoBase64] = await Promise.all([
    arquivoParaBase64(params.prova),
    params.comentado ? arquivoParaBase64(params.comentado) : Promise.resolve(null),
  ]);

  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/simulado-pdf/analisar"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
        totalInformado: params.totalInformado,
      }),
    }
  );

  const dados = (await resposta.json()) as {
    sucesso?: boolean;
    analise?: AnaliseSimuladoPdf;
    erro?: string;
  };

  if (!resposta.ok || !dados.sucesso || !dados.analise) {
    throw new Error(dados.erro || "Não foi possível analisar o simulado em PDF.");
  }

  return dados.analise;
}

function arquivoParaBase64(arquivo: File) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onerror = () => reject(new Error(`Não foi possível ler ${arquivo.name}.`));
    leitor.onload = () => {
      const resultado = String(leitor.result || "");
      const separador = resultado.indexOf(",");
      if (separador < 0) {
        reject(new Error(`O arquivo ${arquivo.name} não pôde ser convertido para análise.`));
        return;
      }
      resolve(resultado.slice(separador + 1));
    };

    leitor.readAsDataURL(arquivo);
  });
}
