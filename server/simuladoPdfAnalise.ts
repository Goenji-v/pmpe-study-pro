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
  aoProgresso?: (progresso: number, descricao: string) => Promise<void> | void;
}): Promise<AnaliseSimuladoPdf> {
  const { ai, modelo, modeloFallback, entrada, aoProgresso } = params;

  validarPdf(entrada.prova, "caderno");
  if (entrada.comentado) validarPdf(entrada.comentado, "comentado");

  const total = Math.max(1, Math.min(200, Math.round(entrada.totalInformado)));
  const blocos = criarBlocos(total, 10);
  const porNumero = new Map<number, QuestaoSimuladoPdfAnalisada>();
  const alertas: string[] = [];

  await aoProgresso?.(24, "A IA começou a ler e classificar as questões.");

  for (let indice = 0; indice < blocos.length; indice += 1) {
    const bloco = blocos[indice];
    const resultado = await analisarBloco({
      ai,
      modelo,
      modeloFallback,
      entrada,
      total,
      inicio: bloco.inicio,
      fim: bloco.fim,
    });

    resultado.questoes.forEach((questao) => {
      porNumero.set(questao.numero, questao);
    });
    alertas.push(...resultado.alertas);

    const progresso = Math.min(
      90,
      24 + Math.round(((indice + 1) / blocos.length) * 66)
    );
    await aoProgresso?.(
      progresso,
      `Questões ${bloco.inicio} a ${bloco.fim} analisadas.`
    );
  }

  const questoes: QuestaoSimuladoPdfAnalisada[] = [];

  for (let numero = 1; numero <= total; numero += 1) {
    const encontrada = porNumero.get(numero);

    if (encontrada) {
      questoes.push(encontrada);
      continue;
    }

    questoes.push(criarQuestaoIncompleta(numero, Boolean(entrada.comentado)));
    alertas.push(`Questão ${numero}: extração incompleta.`);
  }

  await aoProgresso?.(94, "Conferindo consistência do gabarito e do diagnóstico.");

  return {
    totalQuestoes: total,
    questoes,
    alertas: Array.from(new Set(alertas)).slice(0, 80),
  };
}

async function analisarBloco(params: {
  ai: GoogleGenAI;
  modelo: string;
  modeloFallback: string;
  entrada: EntradaSimuladoPdf;
  total: number;
  inicio: number;
  fim: number;
}) {
  const { ai, modelo, modeloFallback, entrada, total, inicio, fim } = params;

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
    text: montarPrompt({
      total,
      inicio,
      fim,
      temComentado: Boolean(entrada.comentado),
    }),
  });

  const resposta = await executarComFallbackGemini(
    async (modeloAtual) =>
      ai.models.generateContent({
        model: modeloAtual,
        contents: [{ role: "user", parts }],
        config: {
          ...parametrosExtracaoGemini(modeloAtual),
          responseMimeType: "application/json",
          maxOutputTokens: 24576,
        },
      }),
    {
      rotulo: `análise das questões ${inicio} a ${fim} do simulado em PDF`,
      modelos: [modelo, modeloFallback],
      tentativasPorModelo: [2, 1],
    }
  );

  if (!resposta.text) {
    throw new Error(
      `A IA não retornou a análise das questões ${inicio} a ${fim}.`
    );
  }

  return normalizarResposta({
    texto: resposta.text,
    totalEsperado: total,
    inicio,
    fim,
    temComentado: Boolean(entrada.comentado),
  });
}

function montarPrompt(params: {
  total: number;
  inicio: number;
  fim: number;
  temComentado: boolean;
}) {
  const { total, inicio, fim, temComentado } = params;
  const quantidade = fim - inicio + 1;

  return [
    "Você é o analisador de simulados do Study Pro.",
    "",
    `Analise SOMENTE as questões de número ${inicio} a ${fim} do PDF da prova.`,
    `O aluno informou que o simulado inteiro possui ${total} questões.`,
    `Retorne exatamente ${quantidade} itens quando essas questões existirem no documento.`,
    temComentado
      ? "Há também um PDF comentado/gabarito. Cruze os dois documentos por número da questão e use o comentado como fonte principal do gabarito quando houver correspondência clara."
      : "Não há PDF comentado. Resolva cada questão e gere um gabarito de referência da IA. Seja conservador na confiança quando houver ambiguidade.",
    "",
    "Não invente questão ausente. Se estiver ilegível, retorne o número esperado com gabarito vazio e confiança baixa.",
    "Preserve as alternativas reais do PDF. Não troque a ordem das letras.",
    "",
    "Para cada questão identifique:",
    "- número;",
    "- matéria;",
    "- assunto;",
    "- subassunto quando possível;",
    "- dificuldade Fácil, Média ou Difícil;",
    "- enunciado;",
    "- alternativas existentes;",
    "- gabarito;",
    "- comentário objetivo explicando a correta;",
    "- fonteGabarito: comentado ou ia;",
    "- confianca de 0 a 100.",
    "",
    "Retorne SOMENTE JSON válido, sem markdown:",
    "{",
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

function normalizarResposta(params: {
  texto: string;
  totalEsperado: number;
  inicio: number;
  fim: number;
  temComentado: boolean;
}) {
  const { texto, totalEsperado, inicio, fim, temComentado } = params;
  const limpo = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let bruto: unknown;

  try {
    bruto = JSON.parse(limpo);
  } catch {
    throw new Error(
      `A IA retornou as questões ${inicio} a ${fim} em formato inválido.`
    );
  }

  const raiz = objeto(bruto);
  const questoesBrutas = Array.isArray(raiz.questoes) ? raiz.questoes : [];
  const porNumero = new Map<number, QuestaoSimuladoPdfAnalisada>();

  for (const item of questoesBrutas) {
    const q = objeto(item);
    const numero = Math.round(Number(q.numero));

    if (
      !Number.isInteger(numero) ||
      numero < inicio ||
      numero > fim ||
      numero > totalEsperado
    ) {
      continue;
    }

    const alternativas = Array.isArray(q.alternativas)
      ? q.alternativas.flatMap((alternativa) => {
          const a = objeto(alternativa);
          const id = textoSeguro(a.id).toUpperCase().slice(0, 3);
          const textoAlternativa = textoSeguro(a.texto);
          return id && textoAlternativa
            ? [{ id, texto: textoAlternativa }]
            : [];
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
      gabarito: normalizarGabarito(q.gabarito),
      comentario: textoSeguro(
        q.comentario,
        "A questão precisa de revisão manual antes de usar a correção automática."
      ),
      fonteGabarito,
      confianca: Math.max(
        0,
        Math.min(100, Math.round(Number(q.confianca) || 0))
      ),
    });
  }

  const questoes: QuestaoSimuladoPdfAnalisada[] = [];
  const alertas = Array.isArray(raiz.alertas)
    ? raiz.alertas
        .map((item) => textoSeguro(item))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  for (let numero = inicio; numero <= fim; numero += 1) {
    const encontrada = porNumero.get(numero);
    if (encontrada) {
      questoes.push(encontrada);
    } else {
      questoes.push(criarQuestaoIncompleta(numero, temComentado));
      alertas.push(`Questão ${numero}: extração incompleta.`);
    }
  }

  return {
    questoes,
    alertas,
  };
}

function criarBlocos(total: number, tamanho: number) {
  const blocos: Array<{ inicio: number; fim: number }> = [];

  for (let inicio = 1; inicio <= total; inicio += tamanho) {
    blocos.push({
      inicio,
      fim: Math.min(total, inicio + tamanho - 1),
    });
  }

  return blocos;
}

function criarQuestaoIncompleta(
  numero: number,
  temComentado: boolean
): QuestaoSimuladoPdfAnalisada {
  return {
    numero,
    materia: "Não classificada",
    assunto: "Revisão manual",
    dificuldade: "Média",
    enunciado: "Questão não extraída com segurança do PDF.",
    alternativas: [],
    gabarito: "",
    comentario:
      "A IA não conseguiu extrair esta questão com segurança; ela não será usada para reduzir a nota até revisão manual.",
    fonteGabarito: temComentado ? "comentado" : "ia",
    confianca: 0,
  };
}

function normalizarGabarito(valor: unknown) {
  const resposta = textoSeguro(valor).toUpperCase().trim();
  return /^[A-Z]{1,3}$/.test(resposta) ? resposta : "";
}

function validarPdf(
  arquivo: { nome: string; base64: string },
  rotulo: string
) {
  if (!arquivo.base64 || arquivo.base64.length > 70_000_000) {
    throw new Error(
      `O PDF ${rotulo} está vazio ou é grande demais para a análise em segundo plano.`
    );
  }
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function textoSeguro(valor: unknown, padrao = "") {
  return typeof valor === "string" && valor.trim() ? valor.trim() : padrao;
}
