import type { GoogleGenAI } from "@google/genai";
import { executarComFallbackGemini } from "./retryGemini.ts";
import { parametrosExtracaoGemini } from "./modelosGemini.ts";

export type EntradaSimuladoPdf = {
  prova: {
    nome: string;
    base64: string;
  };
  comentado?: {
    nome: string;
    base64: string;
  } | null;
  totalInformado: number;
};

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

export async function analisarSimuladoPdfComIA(params: {
  ai: GoogleGenAI;
  modelo: string;
  modeloFallback: string;
  entrada: EntradaSimuladoPdf;
}): Promise<AnaliseSimuladoPdf> {
  const { ai, modelo, modeloFallback, entrada } = params;

  validarPdf(entrada.prova, "caderno");
  if (entrada.comentado) validarPdf(entrada.comentado, "comentado");

  const total = Math.max(1, Math.min(200, Math.round(entrada.totalInformado)));
  const parts: Array<
    | { inlineData: { mimeType: string; data: string } }
    | { text: string }
  > = [
    {
      inlineData: {
        mimeType: "application/pdf",
        data: entrada.prova.base64,
      },
    },
  ];

  if (entrada.comentado) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: entrada.comentado.base64,
      },
    });
  }

  parts.push({
    text: montarPrompt(total, Boolean(entrada.comentado)),
  });

  const resposta = await executarComFallbackGemini(
    async (modeloAtual) =>
      ai.models.generateContent({
        model: modeloAtual,
        contents: [{ role: "user", parts }],
        config: {
          ...parametrosExtracaoGemini(modeloAtual),
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
        },
      }),
    {
      rotulo: "análise do simulado em PDF",
      modelos: [modelo, modeloFallback],
      tentativasPorModelo: [2, 1],
    }
  );

  if (!resposta.text) {
    throw new Error("A IA não retornou a análise do simulado.");
  }

  return normalizarResposta(resposta.text, total, Boolean(entrada.comentado));
}

function montarPrompt(total: number, temComentado: boolean) {
  return [
    "Você é o analisador de simulados do Study Pro.",
    "",
    "Analise o PDF da prova questão por questão.",
    temComentado
      ? "Há também um PDF comentado/gabarito. Cruze os dois documentos por número da questão e use o comentado como fonte principal do gabarito quando houver correspondência clara."
      : "Não há PDF comentado. Resolva cada questão e gere um gabarito de referência da IA. Seja conservador na confiança quando houver ambiguidade.",
    "",
    `O aluno informou que o simulado possui ${total} questões.`,
    "Sua saída deve conter exatamente essas questões quando elas existirem no PDF.",
    "Não invente questão que não esteja no documento.",
    "Se uma questão estiver ilegível ou ausente, ainda retorne o número esperado com enunciado curto indicando a limitação, gabarito vazio e confiança baixa.",
    "",
    "Para cada questão identifique:",
    "- número;",
    "- matéria;",
    "- assunto;",
    "- subassunto quando possível;",
    "- dificuldade Fácil, Média ou Difícil;",
    "- enunciado;",
    "- alternativas existentes, preservando as letras reais (A, B, C, D, E etc.);",
    "- gabarito;",
    "- comentário objetivo explicando a resposta;",
    "- fonteGabarito: comentado ou ia;",
    "- confianca de 0 a 100.",
    "",
    "Classifique a dificuldade considerando quantidade de etapas, detalhe exigido, pegadinhas, proximidade das alternativas e nível de concurso.",
    "O comentário deve ser curto e didático. Não use markdown.",
    "",
    "Retorne SOMENTE JSON válido:",
    "{",
    '  "totalQuestoes": 60,',
    '  "questoes": [',
    "    {",
    '      "numero": 1,',
    '      "materia": "Português",',
    '      "assunto": "Crase",',
    '      "subassunto": "Crase obrigatória",',
    '      "dificuldade": "Média",',
    '      "enunciado": "...",',
    '      "alternativas": [{"id":"A","texto":"..."},{"id":"B","texto":"..."}],',
    '      "gabarito": "B",',
    '      "comentario": "...",',
    `      "fonteGabarito": "${temComentado ? "comentado" : "ia"}",`,
    '      "confianca": 95',
    "    }",
    "  ],",
    '  "alertas": []',
    "}",
  ].join("\n");
}

function normalizarResposta(
  texto: string,
  totalEsperado: number,
  temComentado: boolean
): AnaliseSimuladoPdf {
  const limpo = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let bruto: unknown;
  try {
    bruto = JSON.parse(limpo);
  } catch {
    throw new Error("A IA retornou a análise do simulado em formato inválido.");
  }

  const raiz = objeto(bruto);
  const questoesBrutas = Array.isArray(raiz.questoes) ? raiz.questoes : [];
  const porNumero = new Map<number, QuestaoSimuladoPdfAnalisada>();

  for (const item of questoesBrutas) {
    const q = objeto(item);
    const numero = Math.round(Number(q.numero));
    if (!Number.isInteger(numero) || numero < 1 || numero > totalEsperado) {
      continue;
    }

    const alternativas = Array.isArray(q.alternativas)
      ? q.alternativas.flatMap((alternativa) => {
          const a = objeto(alternativa);
          const id = textoSeguro(a.id).toUpperCase().slice(0, 3);
          const texto = textoSeguro(a.texto);
          return id && texto ? [{ id, texto }] : [];
        })
      : [];

    const dificuldade =
      q.dificuldade === "Fácil" || q.dificuldade === "Difícil"
        ? q.dificuldade
        : "Média";

    const fonteGabarito =
      temComentado && q.fonteGabarito === "comentado"
        ? "comentado"
        : "ia";

    porNumero.set(numero, {
      numero,
      materia: textoSeguro(q.materia, "Não classificada"),
      assunto: textoSeguro(q.assunto, "Não classificado"),
      subassunto: textoSeguro(q.subassunto) || undefined,
      dificuldade,
      enunciado: textoSeguro(
        q.enunciado,
        "Questão não extraída com segurança do PDF."
      ),
      alternativas,
      gabarito: textoSeguro(q.gabarito).toUpperCase().slice(0, 3),
      comentario: textoSeguro(
        q.comentario,
        "A questão precisa de revisão manual antes de usar a correção automática."
      ),
      fonteGabarito,
      confianca: Math.max(0, Math.min(100, Math.round(Number(q.confianca) || 0))),
    });
  }

  const questoes: QuestaoSimuladoPdfAnalisada[] = [];
  const alertas = Array.isArray(raiz.alertas)
    ? raiz.alertas.map((item) => textoSeguro(item)).filter(Boolean).slice(0, 20)
    : [];

  for (let numero = 1; numero <= totalEsperado; numero += 1) {
    const encontrada = porNumero.get(numero);
    if (encontrada) {
      questoes.push(encontrada);
      continue;
    }

    questoes.push({
      numero,
      materia: "Não classificada",
      assunto: "Revisão manual",
      dificuldade: "Média",
      enunciado: "Questão não extraída com segurança do PDF.",
      alternativas: [],
      gabarito: "",
      comentario:
        "A IA não conseguiu extrair esta questão com segurança; não use esta questão para reduzir a nota até revisão manual.",
      fonteGabarito: temComentado ? "comentado" : "ia",
      confianca: 0,
    });
    alertas.push(`Questão ${numero}: extração incompleta.`);
  }

  return {
    totalQuestoes: totalEsperado,
    questoes,
    alertas: Array.from(new Set(alertas)),
  };
}

function validarPdf(
  arquivo: { nome: string; base64: string },
  rotulo: string
) {
  if (!arquivo.base64 || arquivo.base64.length > 28_000_000) {
    throw new Error(
      `O PDF ${rotulo} está vazio ou é grande demais para a análise em segundo plano.`
    );
  }
}

function objeto(valor: unknown): Record<string, any> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, any>)
    : {};
}

function textoSeguro(valor: unknown, padrao = "") {
  return typeof valor === "string" && valor.trim() ? valor.trim() : padrao;
}
