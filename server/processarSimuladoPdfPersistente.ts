import { randomUUID } from "node:crypto";
import type { GoogleGenAI } from "@google/genai";

import { parsearJsonDaIA } from "./jsonIa.ts";
import { parametrosExtracaoGemini } from "./modelosGemini.ts";
import {
  atualizarJobGeracaoIA,
  reivindicarJobGeracaoIA,
  type ContextoSupabaseJob,
  type JobGeracaoIA,
} from "./geracaoPersistente.ts";
import { executarComFallbackGemini } from "./retryGemini.ts";

export type QuestaoSimuladoPdfProcessada = {
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

export type ResultadoSimuladoPdfProcessado = {
  totalQuestoes: number;
  questoes: QuestaoSimuladoPdfProcessada[];
  alertas: string[];
};

type Dependencias = {
  ai: GoogleGenAI;
  modelo: string;
  modeloFallback: string;
};

type ArquivoPayload = {
  nome: string;
  base64: string;
};

type PayloadSimuladoPdf = {
  tipo: "simulado_pdf";
  totalInformado: number;
  prova: ArquivoPayload;
  comentado?: ArquivoPayload | null;
};

type ItemGabarito = {
  numero: number;
  resposta: string;
  anulada: boolean;
  confianca: number;
};

const jobsAgendados = new Set<string>();
const LEASE_MS = 10 * 60 * 1000;
const TAMANHO_BLOCO = 10;
const MAX_BASE64 = 17_000_000;

export function ehJobSimuladoPdf(job: JobGeracaoIA) {
  return job.payload?.tipo === "simulado_pdf";
}

export function agendarJobAnaliseSimuladoPdf(
  job: JobGeracaoIA,
  contexto: ContextoSupabaseJob,
  dependencias: Dependencias
) {
  if (
    job.status === "concluida" ||
    job.status === "erro" ||
    jobsAgendados.has(job.id)
  ) {
    return;
  }

  jobsAgendados.add(job.id);

  void processar(job, contexto, dependencias)
    .catch((erro) => {
      console.error("[simulado-pdf-job] falha não tratada", {
        jobId: job.id,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    })
    .finally(() => {
      jobsAgendados.delete(job.id);
    });
}

async function processar(
  job: JobGeracaoIA,
  contexto: ContextoSupabaseJob,
  dependencias: Dependencias
) {
  const execucaoId = randomUUID();
  const assumido = await reivindicarJobGeracaoIA(
    contexto,
    job,
    execucaoId,
    LEASE_MS
  );

  if (!assumido) return;

  const payload = validarPayload(job.payload);
  const modelos = Array.from(
    new Set([
      dependencias.modelo,
      "gemini-3.5-flash-lite",
      dependencias.modeloFallback,
    ])
  );
  let ultimoProgresso = Math.max(1, Math.round(Number(job.progresso) || 1));

  const atualizar = async (
    etapa: "gerando" | "revisando" | "corrigindo" | "salvando",
    progresso: number,
    descricao: string,
    resultadoParcial?: ResultadoSimuladoPdfProcessado
  ) => {
    const progressoNormalizado = Math.max(
      ultimoProgresso,
      Math.max(0, Math.min(99, Math.round(progresso)))
    );
    ultimoProgresso = progressoNormalizado;

    await atualizarJobGeracaoIA(
      contexto,
      job.id,
      {
        status: "processando",
        etapa,
        progresso: progressoNormalizado,
        descricao,
        ...(resultadoParcial ? { resultado: resultadoParcial } : {}),
        lease_ate: new Date(Date.now() + LEASE_MS).toISOString(),
      },
      execucaoId
    );
  };

  try {
    await atualizar(
      "gerando",
      4,
      "Preparando o caderno e separando as questões."
    );

    let gabaritoComentado = new Map<number, ItemGabarito>();
    const alertas: string[] = [];

    if (payload.comentado) {
      await atualizar(
        "gerando",
        10,
        "Lendo o PDF comentado e conferindo o gabarito."
      );

      const extraido = await extrairGabaritoComentado(
        dependencias.ai,
        modelos,
        payload.comentado,
        payload.totalInformado
      );

      gabaritoComentado = new Map(
        extraido.map((item) => [item.numero, item] as const)
      );

      const faltantes = Array.from(
        { length: payload.totalInformado },
        (_, indice) => indice + 1
      ).filter((numero) => !gabaritoComentado.has(numero));

      if (faltantes.length > 0) {
        alertas.push(
          `O PDF comentado não confirmou ${faltantes.length} questão(ões). Nesses itens, a IA usou a prova como referência e reduziu a confiança.`
        );
      }
    }

    const intervalos = criarIntervalos(payload.totalInformado);
    const resultadoAnterior = obterResultadoParcial(
      job.resultado,
      payload.totalInformado
    );
    const porNumero = new Map<number, QuestaoSimuladoPdfProcessada>(
      (resultadoAnterior?.questoes ?? []).map(
        (questao) => [questao.numero, questao] as const
      )
    );

    for (const alerta of resultadoAnterior?.alertas ?? []) {
      alertas.push(alerta);
    }

    const intervaloCompleto = (intervalo: { inicio: number; fim: number }) =>
      Array.from(
        { length: intervalo.fim - intervalo.inicio + 1 },
        (_, indice) => intervalo.inicio + indice
      ).every((numero) => porNumero.has(numero));

    const intervalosPendentes = intervalos.filter(
      (intervalo) => !intervaloCompleto(intervalo)
    );
    let concluidos = intervalos.length - intervalosPendentes.length;

    if (concluidos > 0) {
      await atualizar(
        "gerando",
        15 + Math.round((concluidos / intervalos.length) * 75),
        `Retomando do bloco ${concluidos + 1}/${intervalos.length}; ${concluidos} bloco(s) já estavam salvos.`,
        {
          totalQuestoes: payload.totalInformado,
          questoes: Array.from(porNumero.values()).sort(
            (a, b) => a.numero - b.numero
          ),
          alertas: Array.from(new Set(alertas)).slice(0, 30),
        }
      );
    }

    // Processamento sequencial: evita duas requisições pesadas concorrentes
    // para o mesmo PDF e permite persistir cada bloco antes do próximo.
    for (const intervalo of intervalosPendentes) {
      const inicio = intervalo.inicio;
      const fim = intervalo.fim;

      const questoesDoBloco = await analisarBloco(
        dependencias.ai,
        modelos,
        payload,
        intervalo,
        gabaritoComentado
      );

      for (const questao of questoesDoBloco) {
        porNumero.set(questao.numero, questao);
      }

      concluidos += 1;

      const parcial: ResultadoSimuladoPdfProcessado = {
        totalQuestoes: payload.totalInformado,
        questoes: Array.from(porNumero.values()).sort(
          (a, b) => a.numero - b.numero
        ),
        alertas: Array.from(new Set(alertas)).slice(0, 30),
      };
      const progresso = 15 + Math.round((concluidos / intervalos.length) * 75);

      await atualizar(
        concluidos === intervalos.length ? "revisando" : "gerando",
        progresso,
        `Questões ${inicio}–${fim} processadas · ${concluidos}/${intervalos.length} blocos · progresso salvo.`,
        parcial
      );
    }

    const faltantes = Array.from(
      { length: payload.totalInformado },
      (_, indice) => indice + 1
    ).filter((numero) => !porNumero.has(numero));

    if (faltantes.length > 0) {
      await atualizar(
        "corrigindo",
        92,
        "Recuperando questões que não foram extraídas na primeira leitura."
      );

      const recuperadas = await analisarBloco(
        dependencias.ai,
        modelos,
        payload,
        {
          inicio: Math.min(...faltantes),
          fim: Math.max(...faltantes),
          numerosEspecificos: faltantes,
        },
        gabaritoComentado
      );

      for (const questao of recuperadas) {
        porNumero.set(questao.numero, questao);
      }
    }

    const aindaFaltantes = Array.from(
      { length: payload.totalInformado },
      (_, indice) => indice + 1
    ).filter((numero) => !porNumero.has(numero));

    for (const numero of aindaFaltantes) {
      porNumero.set(numero, {
        numero,
        materia: "Não classificada",
        assunto: "Revisão manual",
        dificuldade: "Média",
        enunciado: "Questão não extraída com segurança do PDF.",
        alternativas: [],
        gabarito: "",
        comentario:
          "O Study Pro não conseguiu ler esta questão com segurança. Ela não deve reduzir a nota até revisão manual.",
        fonteGabarito: payload.comentado ? "comentado" : "ia",
        confianca: 0,
        status: "revisar",
      });
      alertas.push(`Questão ${numero}: leitura incompleta.`);
    }

    const questoes = Array.from(porNumero.values())
      .sort((a, b) => a.numero - b.numero)
      .map((questao) =>
        aplicarGabaritoComentado(
          questao,
          gabaritoComentado.get(questao.numero),
          Boolean(payload.comentado)
        )
      );

    await atualizar(
      "salvando",
      97,
      "Conferindo o diagnóstico e preparando a correção."
    );

    const resultado: ResultadoSimuladoPdfProcessado = {
      totalQuestoes: payload.totalInformado,
      questoes,
      alertas: Array.from(new Set(alertas)).slice(0, 30),
    };

    await atualizarJobGeracaoIA(
      contexto,
      job.id,
      {
        status: "concluida",
        etapa: "concluida",
        progresso: 100,
        descricao: "Análise pronta para correção.",
        resultado,
        erro: null,
        concluida_em: new Date().toISOString(),
        lease_ate: null,
        payload: {
          tipo: "simulado_pdf",
          totalInformado: payload.totalInformado,
          provaNome: payload.prova.nome,
          comentadoNome: payload.comentado?.nome ?? null,
        },
      },
      execucaoId
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido ao analisar o simulado.";

    await atualizarJobGeracaoIA(
      contexto,
      job.id,
      {
        status: "erro",
        etapa: "erro",
        progresso: ultimoProgresso,
        erro: mensagem.slice(0, 1200),
        descricao: "A análise precisa ser retomada.",
        concluida_em: new Date().toISOString(),
        lease_ate: null,
        payload: {
          tipo: "simulado_pdf",
          totalInformado: payload.totalInformado,
          prova: payload.prova,
          comentado: payload.comentado ?? null,
        },
      },
      execucaoId
    ).catch((erroAtualizacao) => {
      console.error("[simulado-pdf-job] falha ao registrar erro", {
        jobId: job.id,
        erro:
          erroAtualizacao instanceof Error
            ? erroAtualizacao.message
            : String(erroAtualizacao),
      });
    });
  }
}

async function extrairGabaritoComentado(
  ai: GoogleGenAI,
  modelos: string[],
  arquivo: ArquivoPayload,
  totalEsperado: number
) {
  const resposta = await gerarJsonComPdfs(
    ai,
    modelos,
    [
      `O PDF anexado é um caderno comentado, resolução ou gabarito de um simulado com ${totalEsperado} questões.`,
      "Extraia o gabarito que o próprio documento apresenta.",
      "Não use conhecimento externo para trocar uma resposta existente no documento.",
      "Se a questão estiver anulada, marque anulada=true e resposta vazia.",
      "Se o documento não confirmar uma resposta, omita esse número.",
      "Retorne SOMENTE JSON válido:",
      '{"itens":[{"numero":1,"resposta":"A","anulada":false,"confianca":100}]}',
    ].join("\n"),
    [arquivo],
    16384,
    "gabarito do PDF comentado"
  );

  const raiz = objetoSeguro(resposta);
  const itens = Array.isArray(raiz.itens) ? raiz.itens : [];

  return itens.flatMap((valor) => {
    const item = objetoSeguro(valor);
    const numero = Math.round(numeroSeguro(item.numero));
    const anulada = item.anulada === true;
    const resposta = textoSeguro(item.resposta).toUpperCase().slice(0, 3);

    if (
      numero < 1 ||
      numero > totalEsperado ||
      (!anulada && !resposta)
    ) {
      return [];
    }

    return [
      {
        numero,
        resposta: anulada ? "" : resposta,
        anulada,
        confianca: limitarPercentual(item.confianca, 90),
      },
    ];
  });
}

async function analisarBloco(
  ai: GoogleGenAI,
  modelos: string[],
  payload: PayloadSimuladoPdf,
  intervalo: {
    inicio: number;
    fim: number;
    numerosEspecificos?: number[];
  },
  gabaritoComentado: Map<number, ItemGabarito>
) {
  const numeros =
    intervalo.numerosEspecificos ??
    Array.from(
      { length: intervalo.fim - intervalo.inicio + 1 },
      (_, indice) => intervalo.inicio + indice
    );

  const gabaritoConhecido = numeros.flatMap((numero) => {
    const item = gabaritoComentado.get(numero);
    return item ? [item] : [];
  });

  const prompt = [
    "Você é o analisador de simulados do Study Pro para concursos públicos brasileiros.",
    "",
    `Analise SOMENTE as questões: ${numeros.join(", ")}.`,
    "O primeiro PDF é o caderno da prova.",
    payload.comentado
      ? "O segundo PDF, quando anexado, é um material comentado/resolução e serve para conferir gabarito e explicação."
      : "Não existe PDF comentado; resolva cada questão com cuidado e gere um gabarito de referência da IA.",
    "",
    gabaritoConhecido.length > 0
      ? `Gabarito já extraído do comentado para alguns itens: ${JSON.stringify(gabaritoConhecido)}`
      : "Nenhum gabarito externo foi confirmado para este bloco.",
    "",
    "Para cada questão, retorne:",
    "- numero;",
    "- materia;",
    "- modulo, se identificável;",
    "- assunto;",
    "- subassunto, se identificável;",
    "- dificuldade: Fácil, Média ou Difícil;",
    "- enunciado fiel ao PDF;",
    "- alternativas com id e texto;",
    "- gabarito;",
    "- comentario curto, objetivo e didático;",
    "- norma e dispositivo, quando aplicável;",
    "- fonteGabarito: comentado ou ia;",
    "- confianca de 0 a 100;",
    "- status: valida, revisar ou anulada.",
    "",
    "Regras:",
    "- Não invente texto que não esteja legível.",
    "- Se houver gabarito confirmado do comentado, ele prevalece.",
    "- Se houver dúvida real sem fonte confirmada, use status revisar e confiança abaixo de 50.",
    "- Questão anulada: gabarito vazio e status anulada.",
    "- Preserve a letra real das alternativas.",
    "- Retorne SOMENTE JSON válido.",
    "",
    '{"questoes":[{"numero":1,"materia":"Português","modulo":"Gramática","assunto":"Crase","subassunto":"Crase obrigatória","dificuldade":"Média","enunciado":"...","alternativas":[{"id":"A","texto":"..."}],"gabarito":"A","comentario":"...","norma":"","dispositivo":"","fonteGabarito":"ia","confianca":85,"status":"valida"}]}',
  ].join("\n");

  const arquivos = payload.comentado
    ? [payload.prova, payload.comentado]
    : [payload.prova];

  const resposta = await gerarJsonComPdfs(
    ai,
    modelos,
    prompt,
    arquivos,
    32768,
    `questões ${numeros.join(",")}`
  );

  const raiz = objetoSeguro(resposta);
  const questoes = Array.isArray(raiz.questoes) ? raiz.questoes : [];

  return questoes.flatMap((valor) => {
    const item = objetoSeguro(valor);
    const numero = Math.round(numeroSeguro(item.numero));

    if (!numeros.includes(numero)) return [];

    const alternativas = Array.isArray(item.alternativas)
      ? item.alternativas.flatMap((valorAlternativa) => {
          const alternativa = objetoSeguro(valorAlternativa);
          const id = textoSeguro(alternativa.id).toUpperCase().slice(0, 3);
          const texto = textoSeguro(alternativa.texto);

          return id && texto ? [{ id, texto }] : [];
        })
      : [];

    const status =
      item.status === "anulada"
        ? "anulada"
        : item.status === "revisar"
          ? "revisar"
          : "valida";

    const dificuldade =
      item.dificuldade === "Fácil" || item.dificuldade === "Difícil"
        ? item.dificuldade
        : "Média";

    return [
      {
        numero,
        materia: textoSeguro(item.materia, "Não classificada"),
        modulo: textoSeguro(item.modulo) || undefined,
        assunto: textoSeguro(item.assunto, "Não classificado"),
        subassunto: textoSeguro(item.subassunto) || undefined,
        dificuldade,
        enunciado: textoSeguro(
          item.enunciado,
          "Questão não extraída integralmente."
        ),
        alternativas,
        gabarito:
          status === "anulada"
            ? ""
            : textoSeguro(item.gabarito).toUpperCase().slice(0, 3),
        comentario: textoSeguro(
          item.comentario,
          "Revise o conteúdo central cobrado nesta questão."
        ),
        norma: textoSeguro(item.norma) || undefined,
        dispositivo: textoSeguro(item.dispositivo) || undefined,
        fonteGabarito:
          item.fonteGabarito === "comentado" ? "comentado" : "ia",
        confianca: limitarPercentual(item.confianca, 60),
        status,
      } satisfies QuestaoSimuladoPdfProcessada,
    ];
  });
}

function aplicarGabaritoComentado(
  questao: QuestaoSimuladoPdfProcessada,
  gabarito: ItemGabarito | undefined,
  temComentado: boolean
) {
  if (!gabarito) {
    if (temComentado && questao.fonteGabarito !== "comentado") {
      return {
        ...questao,
        confianca: Math.min(questao.confianca, 65),
        status:
          questao.status === "anulada"
            ? "anulada"
            : questao.confianca < 50
              ? "revisar"
              : questao.status,
      } satisfies QuestaoSimuladoPdfProcessada;
    }

    return questao;
  }

  if (gabarito.anulada) {
    return {
      ...questao,
      gabarito: "",
      fonteGabarito: "comentado",
      confianca: Math.max(questao.confianca, gabarito.confianca),
      status: "anulada",
    } satisfies QuestaoSimuladoPdfProcessada;
  }

  return {
    ...questao,
    gabarito: gabarito.resposta,
    fonteGabarito: "comentado",
    confianca: Math.max(questao.confianca, gabarito.confianca),
    status: "valida",
  } satisfies QuestaoSimuladoPdfProcessada;
}

async function gerarJsonComPdfs(
  ai: GoogleGenAI,
  modelos: string[],
  prompt: string,
  arquivos: ArquivoPayload[],
  maxOutputTokens: number,
  rotulo: string
) {
  const resposta = await executarComFallbackGemini(
    (modeloAtual) =>
      ai.models.generateContent({
        model: modeloAtual,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...arquivos.map((arquivo) => ({
                inlineData: {
                  mimeType: "application/pdf",
                  data: arquivo.base64,
                },
              })),
            ],
          },
        ],
        config: {
          ...parametrosExtracaoGemini(modeloAtual),
          responseMimeType: "application/json",
          maxOutputTokens,
        },
      }),
    {
      rotulo,
      modelos,
      tentativasPorModelo: [3, 2, 2],
      atrasosMs: [4_000, 10_000, 20_000],
      trocarEmLimite: true,
      aoTentarNovamente: ({
        modelo,
        tentativaAtual,
        proximaTentativa,
        status,
        esperaMs,
      }) => {
        console.warn("[simulado-pdf-job] nova tentativa do Gemini", {
          rotulo,
          modelo,
          tentativaAtual,
          proximaTentativa,
          status,
          esperaMs,
        });
      },
      aoTrocarModelo: ({
        modeloAnterior,
        modeloSeguinte,
        status,
      }) => {
        console.warn("[simulado-pdf-job] trocando modelo do Gemini", {
          rotulo,
          modeloAnterior,
          modeloSeguinte,
          status,
        });
      },
    }
  );

  if (!resposta.text) {
    throw new Error(`A IA não retornou a leitura de ${rotulo}.`);
  }

  return parsearJsonDaIA(resposta.text, rotulo);
}

function obterResultadoParcial(
  valor: unknown,
  totalQuestoes: number
): ResultadoSimuladoPdfProcessado | null {
  if (!valor || typeof valor !== "object") return null;

  const raiz = valor as {
    questoes?: unknown;
    alertas?: unknown;
  };

  if (!Array.isArray(raiz.questoes)) return null;

  const questoes = raiz.questoes.filter(
    (item): item is QuestaoSimuladoPdfProcessada =>
      Boolean(
        item &&
          typeof item === "object" &&
          Number.isInteger(
            Number((item as { numero?: unknown }).numero)
          ) &&
          Number((item as { numero?: unknown }).numero) >= 1 &&
          Number((item as { numero?: unknown }).numero) <= totalQuestoes
      )
  );

  if (questoes.length === 0) return null;

  const alertas = Array.isArray(raiz.alertas)
    ? raiz.alertas
        .filter((item): item is string => typeof item === "string")
        .slice(0, 30)
    : [];

  return {
    totalQuestoes,
    questoes,
    alertas,
  };
}

function criarIntervalos(total: number) {
  const intervalos: Array<{ inicio: number; fim: number }> = [];

  for (let inicio = 1; inicio <= total; inicio += TAMANHO_BLOCO) {
    intervalos.push({
      inicio,
      fim: Math.min(total, inicio + TAMANHO_BLOCO - 1),
    });
  }

  return intervalos;
}

function validarPayload(valor: Record<string, unknown>): PayloadSimuladoPdf {
  const totalInformado = Math.round(numeroSeguro(valor.totalInformado));
  const prova = validarArquivoPayload(valor.prova, "caderno");
  const comentado = valor.comentado
    ? validarArquivoPayload(valor.comentado, "comentado")
    : null;

  if (valor.tipo !== "simulado_pdf") {
    throw new Error("Tipo de job incompatível com análise de simulado.");
  }

  if (totalInformado < 1 || totalInformado > 200) {
    throw new Error("A quantidade do simulado deve ficar entre 1 e 200 questões.");
  }

  return {
    tipo: "simulado_pdf",
    totalInformado,
    prova,
    comentado,
  };
}

function validarArquivoPayload(valor: unknown, rotulo: string): ArquivoPayload {
  const item = objetoSeguro(valor);
  const nome = textoSeguro(item.nome, `${rotulo}.pdf`);
  const base64 = textoSeguro(item.base64);

  if (!base64) {
    throw new Error(`O PDF ${rotulo} não está mais disponível para análise.`);
  }

  if (base64.length > MAX_BASE64) {
    throw new Error(`O PDF ${rotulo} ultrapassa o limite permitido.`);
  }

  return { nome, base64 };
}

function objetoSeguro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function textoSeguro(valor: unknown, padrao = "") {
  return typeof valor === "string" && valor.trim() ? valor.trim() : padrao;
}

function numeroSeguro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function limitarPercentual(valor: unknown, padrao: number) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return padrao;
  return Math.max(0, Math.min(100, Math.round(numero)));
}
