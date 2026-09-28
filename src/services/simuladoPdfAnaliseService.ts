import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";
import { analisarProvaPdf } from "./importacaoProvaService";

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

  if (resposta.ok && dados.sucesso && dados.analise) {
    return dados.analise;
  }

  if (
    (resposta.status === 404 || resposta.status === 405) &&
    params.comentado
  ) {
    return analisarComRotaExistente(params.prova, params.comentado);
  }

  if (resposta.status === 404 || resposta.status === 405) {
    return criarAnaliseDeDemonstracao(params.totalInformado, [
      "Nesta prévia isolada, a correção real por IA sem PDF comentado ainda não está ligada ao backend oficial. O leitor, cronômetro, respostas e anotações podem ser testados normalmente.",
    ]);
  }

  throw new Error(dados.erro || "Não foi possível analisar o simulado em PDF.");
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


async function analisarComRotaExistente(
  prova: File,
  comentado: File
): Promise<AnaliseSimuladoPdf> {
  const resultado = await analisarProvaPdf({
    prova,
    gabarito: comentado,
    metadados: {
      concursoAlvo: "PMPE",
      editalAlvo: "Study Pro",
      concursoOrigem: "Simulado de domingo",
      cargoOrigem: "Aluno",
      anoOrigem: new Date().getFullYear(),
      banca: "Não informada",
      fonteNome: prova.name,
    },
    mapaEdital: [],
  });

  return {
    totalQuestoes: resultado.totalEsperadas,
    alertas: resultado.alertas,
    questoes: resultado.questoes.map((questao) => ({
      numero: questao.numeroOriginal,
      materia: questao.materia || "Não classificada",
      assunto: questao.assunto || "Não classificado",
      subassunto: questao.subassunto || undefined,
      dificuldade:
        questao.dificuldade === "facil"
          ? "Fácil"
          : questao.dificuldade === "dificil"
            ? "Difícil"
            : "Média",
      enunciado: questao.enunciado,
      alternativas: questao.alternativas.map((alternativa) => ({
        id: alternativa.id,
        texto: alternativa.texto,
      })),
      gabarito:
        questao.statusSugerido === "anulada"
          ? ""
          : questao.respostaCorretaId,
      comentario:
        questao.explicacao ||
        questao.motivoStatus ||
        "Questão analisada a partir do PDF comentado.",
      fonteGabarito: "comentado",
      confianca:
        questao.statusSugerido === "anulada"
          ? 0
          : questao.confiancaClassificacao === "alta"
            ? 95
            : questao.confiancaClassificacao === "media"
              ? 75
              : 45,
    })),
  };
}

function criarAnaliseDeDemonstracao(
  total: number,
  alertas: string[]
): AnaliseSimuladoPdf {
  const quantidade = Math.max(1, Math.min(200, Math.round(total)));

  return {
    totalQuestoes: quantidade,
    alertas,
    questoes: Array.from({ length: quantidade }, (_, indice) => ({
      numero: indice + 1,
      materia: "Prévia",
      assunto: "Correção aguardando backend",
      dificuldade: "Média" as const,
      enunciado:
        "A questão permanece disponível no PDF. Esta prévia não usa um gabarito inventado.",
      alternativas: [],
      gabarito: "",
      comentario:
        "Sem gabarito nesta prévia. A questão é anulada no diagnóstico para não gerar nota incorreta.",
      fonteGabarito: "ia" as const,
      confianca: 0,
    })),
  };
}
