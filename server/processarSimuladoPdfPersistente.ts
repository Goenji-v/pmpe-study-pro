import { randomUUID } from "node:crypto";
import type { GoogleGenAI } from "@google/genai";

import {
  ErroJsonInvalidoIA,
  parsearJsonDaIA,
} from "./jsonIa.ts";
import { parametrosExtracaoGemini } from "./modelosGemini.ts";
import {
  atualizarJobGeracaoIA,
  reivindicarJobGeracaoIA,
  type ContextoSupabaseJob,
  type JobGeracaoIA,
} from "./geracaoPersistente.ts";
import { executarComFallbackGemini } from "./retryGemini.ts";
import { executarPipelineQuestaoAPorQuestao } from "./simuladoPdfPipeline.ts";

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
  etapaPipeline?: "extraida" | "resolvida";
  confiancaLeitura?: number;
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


export function questaoSimuladoPdfProntaParaCorrecao(
  questao: QuestaoSimuladoPdfProcessada | undefined
) {
  if (!questao) return false;
  if (questao.etapaPipeline === "extraida") return false;
  if (questao.status === "anulada") return true;

  return (
    questao.status === "valida" &&
    Boolean(questao.gabarito?.trim()) &&
    Number(questao.confianca) >= 50
  );
}

export function resultadoSimuladoPdfPrecisaRetomar(
  valor: unknown,
  totalQuestoes: number
) {
  if (!valor || typeof valor !== "object") return true;

  const raiz = valor as { questoes?: unknown };
  if (!Array.isArray(raiz.questoes)) return true;

  const porNumero = new Map<number, QuestaoSimuladoPdfProcessada>();

  for (const item of raiz.questoes) {
    if (!item || typeof item !== "object") continue;

    const questao = item as QuestaoSimuladoPdfProcessada;
    const numero = Number(questao.numero);

    if (
      Number.isInteger(numero) &&
      numero >= 1 &&
      numero <= totalQuestoes
    ) {
      porNumero.set(numero, questao);
    }
  }

  return Array.from(
    { length: totalQuestoes },
    (_, indice) => indice + 1
  ).some(
    (numero) =>
      !questaoSimuladoPdfProntaParaCorrecao(
        porNumero.get(numero)
      )
  );
}

export function questaoSimuladoPdfTemExtracaoConfiavel(
  questao: QuestaoSimuladoPdfProcessada | undefined
) {
  if (!questao) return false;
  if (questaoSimuladoPdfProntaParaCorrecao(questao)) return true;

  return (
    Boolean(questao.enunciado?.trim()) &&
    questao.enunciado !== "Questão não extraída integralmente." &&
    questao.enunciado !== "Questão não extraída com segurança do PDF." &&
    Array.isArray(questao.alternativas) &&
    questao.alternativas.length >= 2 &&
    Number(questao.confiancaLeitura ?? 0) >= 50
  );
}

function escolherMelhorQuestao(
  atual: QuestaoSimuladoPdfProcessada | undefined,
  candidata: QuestaoSimuladoPdfProcessada
) {
  if (!atual) return candidata;

  const atualPronta =
    questaoSimuladoPdfProntaParaCorrecao(atual);
  const candidataPronta =
    questaoSimuladoPdfProntaParaCorrecao(candidata);

  if (candidataPronta && !atualPronta) return candidata;
  if (atualPronta && !candidataPronta) return atual;

  return candidata.confianca >= atual.confianca
    ? candidata
    : atual;
}

export function numerosPendentes(
  porNumero: Map<number, QuestaoSimuladoPdfProcessada>,
  totalQuestoes: number
) {
  return Array.from(
    { length: totalQuestoes },
    (_, indice) => indice + 1
  ).filter(
    (numero) =>
      !questaoSimuladoPdfProntaParaCorrecao(
        porNumero.get(numero)
      )
  );
}

export function agruparNumeros(
  numeros: number[],
  tamanho = 5
) {
  const grupos: number[][] = [];

  for (let indice = 0; indice < numeros.length; indice += tamanho) {
    grupos.push(numeros.slice(indice, indice + tamanho));
  }

  return grupos;
}


export function calcularProgressoRetomadaSimuladoPdf(
  valor: unknown,
  totalQuestoes: number
) {
  const resultado = obterResultadoParcial(
    valor,
    totalQuestoes
  );

  if (!resultado || totalQuestoes <= 0) return 1;

  const prontas = resultado.questoes.filter(
    (questao) =>
      questaoSimuladoPdfProntaParaCorrecao(
        questao
      )
  ).length;

  if (prontas === 0) return 1;

  return Math.min(
    90,
    15 +
      Math.round(
        (prontas / totalQuestoes) * 75
      )
  );
}

export async function executarAnaliseSimuladoComSubdivisao<T>(
  numeros: number[],
  executar: (numerosAtual: number[]) => Promise<T[]>,
  aoFalharQuestao?: (dados: {
    numero: number;
    erro: Error;
  }) => void
): Promise<T[]> {
  if (numeros.length === 0) return [];

  try {
    return await executar(numeros);
  } catch (erro) {
    if (!(erro instanceof ErroJsonInvalidoIA)) {
      throw erro;
    }

    if (numeros.length === 1) {
      aoFalharQuestao?.({
        numero: numeros[0],
        erro,
      });
      return [];
    }

    const meio = Math.ceil(numeros.length / 2);
    const primeiraParte = numeros.slice(0, meio);
    const segundaParte = numeros.slice(meio);

    const primeira = await executarAnaliseSimuladoComSubdivisao(
      primeiraParte,
      executar,
      aoFalharQuestao
    );
    const segunda = await executarAnaliseSimuladoComSubdivisao(
      segundaParte,
      executar,
      aoFalharQuestao
    );

    return [...primeira, ...segunda];
  }
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
  let ultimoProgresso = calcularProgressoRetomadaSimuladoPdf(
    job.resultado,
    payload.totalInformado
  );

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

    const resultadoAnterior = obterResultadoParcial(
      job.resultado,
      payload.totalInformado
    );

    const pipeline = await executarPipelineQuestaoAPorQuestao({
      totalQuestoes: payload.totalInformado,
      estadoAnterior: resultadoAnterior?.questoes ?? [],
      temExtracao: questaoSimuladoPdfTemExtracaoConfiavel,
      estaPronta: questaoSimuladoPdfProntaParaCorrecao,
      extrair: (numeros) =>
        extrairQuestoesBasicasComRecuperacao(
          dependencias.ai,
          modelos,
          payload,
          numeros
        ),
      resolver: (questao) =>
        resolverQuestaoExtraida(
          dependencias.ai,
          modelos,
          questao,
          gabaritoComentado.get(questao.numero),
          Boolean(payload.comentado)
        ),
      salvar: async ({
        fase,
        progresso,
        descricao,
        itens,
      }) => {
        await atualizar(
          fase === "extraindo" ? "gerando" : "corrigindo",
          progresso,
          descricao,
          {
            totalQuestoes: payload.totalInformado,
            questoes: itens,
            alertas: Array.from(new Set([
              ...alertas,
              ...(resultadoAnterior?.alertas ?? []),
            ])).slice(0, 30),
          }
        );
      },
    });

    const porNumero = new Map(
      pipeline.itens.map(
        (questao) => [questao.numero, questao] as const
      )
    );

    if (pipeline.pendentes.length > 0) {
      for (const numero of pipeline.pendentes) {
        alertas.push(
          `Questão ${numero}: ainda pendente após a etapa individual.`
        );
      }

      throw new Error(
        `A análise ficou incompleta: ${pipeline.pendentes.length} questão(ões) ainda precisam ser recuperadas. O que já ficou pronto foi salvo.`
      );
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

async function extrairQuestoesBasicasComRecuperacao(
  ai: GoogleGenAI,
  modelos: string[],
  payload: PayloadSimuladoPdf,
  numeros: number[]
) {
  return executarAnaliseSimuladoComSubdivisao(
    numeros,
    (numerosAtual) =>
      extrairQuestoesBasicas(
        ai,
        modelos,
        payload,
        numerosAtual
      )
  );
}

async function extrairQuestoesBasicas(
  ai: GoogleGenAI,
  modelos: string[],
  payload: PayloadSimuladoPdf,
  numeros: number[]
): Promise<QuestaoSimuladoPdfProcessada[]> {
  const resposta = await gerarJsonComPdfs(
    ai,
    modelos,
    [
      "Você é o extrator literal de questões do Study Pro.",
      `Extraia SOMENTE as questões: ${numeros.join(", ")}.`,
      "Não resolva, não classifique matéria e não explique.",
      "Preserve o enunciado e as alternativas como aparecem no PDF.",
      "Se uma questão não estiver legível, omita essa questão em vez de inventar.",
      "Retorne SOMENTE JSON válido:",
      '{"questoes":[{"numero":1,"enunciado":"...","alternativas":[{"id":"A","texto":"..."}],"confiancaLeitura":95}]}',
    ].join("\n"),
    [payload.prova],
    16384,
    `extração das questões ${numeros.join(",")}`
  );

  const raiz = objetoSeguro(resposta);
  const itens = Array.isArray(raiz.questoes)
    ? raiz.questoes
    : [];

  return itens.flatMap((valor) => {
    const item = objetoSeguro(valor);
    const numero = Math.round(
      numeroSeguro(item.numero)
    );

    if (!numeros.includes(numero)) return [];

    const enunciado = textoSeguro(
      item.enunciado
    );
    const alternativas = Array.isArray(
      item.alternativas
    )
      ? item.alternativas.flatMap(
          (valorAlternativa) => {
            const alternativa =
              objetoSeguro(valorAlternativa);
            const id = textoSeguro(
              alternativa.id
            ).toUpperCase().slice(0, 3);
            const texto = textoSeguro(
              alternativa.texto
            );

            return id && texto
              ? [{ id, texto }]
              : [];
          }
        )
      : [];
    const confiancaLeitura =
      limitarPercentual(
        item.confiancaLeitura,
        enunciado && alternativas.length >= 2
          ? 75
          : 0
      );

    if (
      !enunciado ||
      alternativas.length < 2 ||
      confiancaLeitura < 50
    ) {
      return [];
    }

    return [{
      numero,
      materia: "Não classificada",
      assunto: "Aguardando análise",
      dificuldade: "Média",
      enunciado,
      alternativas,
      gabarito: "",
      comentario:
        "Questão extraída; aguardando resolução.",
      fonteGabarito: payload.comentado
        ? "comentado"
        : "ia",
      confianca: 0,
      status: "revisar",
      etapaPipeline: "extraida",
      confiancaLeitura,
    } satisfies QuestaoSimuladoPdfProcessada];
  });
}

async function resolverQuestaoExtraida(
  ai: GoogleGenAI,
  modelos: string[],
  questao: QuestaoSimuladoPdfProcessada,
  gabaritoConhecido: ItemGabarito | undefined,
  temComentado: boolean
): Promise<QuestaoSimuladoPdfProcessada> {
  const prompt = [
    "Você está na etapa de RESOLUÇÃO E CLASSIFICAÇÃO de uma única questão já extraída.",
    "Não há PDF nesta etapa. Use somente o texto fornecido.",
    "Não altere o enunciado nem as alternativas.",
    `Número: ${questao.numero}`,
    `Enunciado: ${questao.enunciado}`,
    `Alternativas: ${JSON.stringify(questao.alternativas)}`,
    gabaritoConhecido
      ? `Gabarito externo confirmado: ${JSON.stringify(gabaritoConhecido)}`
      : "Não existe gabarito externo confirmado; resolva a questão com cuidado.",
    "",
    "Retorne matéria, módulo, assunto, subassunto, dificuldade, gabarito, comentário, norma, dispositivo, confiança e status.",
    "Se houver gabarito externo confirmado, ele prevalece.",
    "Se houver dúvida real sem fonte confirmada, use status revisar e confiança abaixo de 50.",
    "Retorne somente JSON válido:",
    '{"materia":"Português","modulo":"Gramática","assunto":"Crase","subassunto":"Crase obrigatória","dificuldade":"Média","gabarito":"A","comentario":"...","norma":"","dispositivo":"","confianca":85,"status":"valida"}',
  ].join("\n");

  let ultimoErro: unknown;

  for (
    let tentativaJson = 1;
    tentativaJson <= 2;
    tentativaJson += 1
  ) {
    try {
      const resposta = await gerarJsonTexto(
        ai,
        modelos,
        prompt,
        4096,
        `resolução da questão ${questao.numero}`
      );

      const item = objetoSeguro(resposta);
      const status =
        gabaritoConhecido?.anulada === true ||
        item.status === "anulada"
          ? "anulada"
          : item.status === "revisar"
            ? "revisar"
            : "valida";
      const dificuldade =
        item.dificuldade === "Fácil" ||
        item.dificuldade === "Difícil"
          ? item.dificuldade
          : "Média";
      const idsAlternativas = new Set(
        questao.alternativas.map(
          (alternativa) => alternativa.id
        )
      );
      const gabaritoGerado =
        textoSeguro(item.gabarito)
          .toUpperCase()
          .slice(0, 3);
      const gabarito =
        status === "anulada"
          ? ""
          : gabaritoConhecido?.resposta ||
            (idsAlternativas.has(gabaritoGerado)
              ? gabaritoGerado
              : "");
      const confiancaResolucao =
        gabaritoConhecido
          ? Math.max(
              limitarPercentual(
                item.confianca,
                70
              ),
              gabaritoConhecido.confianca
            )
          : limitarPercentual(
              item.confianca,
              60
            );
      const confianca = Math.min(
        Number(
          questao.confiancaLeitura ?? 100
        ),
        confiancaResolucao
      );

      const resolvida: QuestaoSimuladoPdfProcessada = {
        ...questao,
        materia: textoSeguro(
          item.materia,
          "Não classificada"
        ),
        modulo:
          textoSeguro(item.modulo) ||
          undefined,
        assunto: textoSeguro(
          item.assunto,
          "Não classificado"
        ),
        subassunto:
          textoSeguro(item.subassunto) ||
          undefined,
        dificuldade,
        gabarito,
        comentario: textoSeguro(
          item.comentario,
          "Revise o conteúdo central cobrado nesta questão."
        ),
        norma:
          textoSeguro(item.norma) ||
          undefined,
        dispositivo:
          textoSeguro(item.dispositivo) ||
          undefined,
        fonteGabarito: gabaritoConhecido
          ? "comentado"
          : "ia",
        confianca,
        status:
          status === "valida" &&
          (!gabarito || confianca < 50)
            ? "revisar"
            : status,
        etapaPipeline: "resolvida",
      };

      return aplicarGabaritoComentado(
        resolvida,
        gabaritoConhecido,
        temComentado
      );
    } catch (erro) {
      ultimoErro = erro;

      if (
        !(erro instanceof ErroJsonInvalidoIA) ||
        tentativaJson === 2
      ) {
        throw erro;
      }
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error(
        `Não foi possível resolver a questão ${questao.numero}.`
      );
}

export async function analisarBlocoComRecuperacao(
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

  const leituraInicial = await executarAnaliseSimuladoComSubdivisao(
    numeros,
    (numerosAtual) =>
      analisarBloco(
        ai,
        modelos,
        payload,
        {
          inicio: Math.min(...numerosAtual),
          fim: Math.max(...numerosAtual),
          numerosEspecificos: numerosAtual,
        },
        gabaritoComentado
      ),
    ({ numero, erro }) => {
      console.warn(
        "[simulado-pdf-job] questão isolada ficou pendente após JSON inválido",
        {
          numero,
          erro: erro.message,
        }
      );
    }
  );

  const porNumero = new Map(
    leituraInicial.map(
      (questao) => [questao.numero, questao] as const
    )
  );
  const pendentes = numeros.filter(
    (numero) =>
      !questaoSimuladoPdfProntaParaCorrecao(
        porNumero.get(numero)
      )
  );

  for (const numero of pendentes) {
    try {
      const recuperada =
        await recuperarQuestaoSimuladoPdfEmDuasEtapas(
          ai,
          modelos,
          payload,
          numero,
          gabaritoComentado.get(numero)
        );

      if (recuperada) {
        porNumero.set(
          numero,
          escolherMelhorQuestao(
            porNumero.get(numero),
            recuperada
          )
        );
      }
    } catch (erro) {
      if (erro instanceof ErroJsonInvalidoIA) {
        console.warn(
          "[simulado-pdf-job] recuperação em duas etapas manteve questão pendente",
          {
            numero,
            erro: erro.message,
          }
        );
        continue;
      }

      throw erro;
    }
  }

  return Array.from(porNumero.values()).sort(
    (a, b) => a.numero - b.numero
  );
}

type QuestaoExtraidaPdf = {
  numero: number;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  confiancaLeitura: number;
};

async function recuperarQuestaoSimuladoPdfEmDuasEtapas(
  ai: GoogleGenAI,
  modelos: string[],
  payload: PayloadSimuladoPdf,
  numero: number,
  gabaritoConhecido?: ItemGabarito
): Promise<QuestaoSimuladoPdfProcessada | null> {
  const leitura = await gerarJsonComPdfs(
    ai,
    modelos,
    [
      "Você está apenas EXTRAINDO uma questão de um PDF de concurso.",
      `Leia SOMENTE a questão ${numero}.`,
      "Não resolva, não classifique matéria e não explique.",
      "Copie o enunciado e as alternativas exatamente como aparecem.",
      "Se algum trecho não estiver legível, não invente.",
      "Retorne somente JSON válido:",
      '{"questao":{"numero":1,"enunciado":"...","alternativas":[{"id":"A","texto":"..."}],"confiancaLeitura":90}}',
    ].join("\n"),
    [payload.prova],
    8192,
    `extração isolada da questão ${numero}`
  );

  const raizLeitura = objetoSeguro(leitura);
  const brutoQuestao =
    raizLeitura.questao ??
    (Array.isArray(raizLeitura.questoes)
      ? raizLeitura.questoes[0]
      : null);
  const itemLeitura = objetoSeguro(brutoQuestao);
  const numeroLido = Math.round(
    numeroSeguro(itemLeitura.numero)
  );
  const enunciado = textoSeguro(
    itemLeitura.enunciado
  );
  const alternativas = Array.isArray(
    itemLeitura.alternativas
  )
    ? itemLeitura.alternativas.flatMap(
        (valorAlternativa) => {
          const alternativa = objetoSeguro(
            valorAlternativa
          );
          const id = textoSeguro(
            alternativa.id
          ).toUpperCase().slice(0, 3);
          const texto = textoSeguro(
            alternativa.texto
          );

          return id && texto
            ? [{ id, texto }]
            : [];
        }
      )
    : [];

  const extraida: QuestaoExtraidaPdf = {
    numero:
      numeroLido === numero
        ? numeroLido
        : numero,
    enunciado,
    alternativas,
    confiancaLeitura: limitarPercentual(
      itemLeitura.confiancaLeitura,
      enunciado && alternativas.length >= 2
        ? 75
        : 35
    ),
  };

  if (
    !extraida.enunciado ||
    extraida.alternativas.length < 2
  ) {
    return null;
  }

  const resposta = await gerarJsonTexto(
    ai,
    modelos,
    [
      "Você está na etapa de RESOLUÇÃO E CLASSIFICAÇÃO de uma questão já extraída.",
      "Não há PDF nesta etapa. Use somente o texto abaixo.",
      `Número: ${numero}`,
      `Enunciado: ${extraida.enunciado}`,
      `Alternativas: ${JSON.stringify(extraida.alternativas)}`,
      gabaritoConhecido
        ? `Gabarito externo confirmado: ${JSON.stringify(gabaritoConhecido)}`
        : "Não existe gabarito externo confirmado; resolva a questão com cuidado.",
      "",
      "Retorne matéria, módulo, assunto, subassunto, dificuldade, gabarito, comentário, norma, dispositivo, confiança e status.",
      "Se houver gabarito externo confirmado, ele prevalece.",
      "Se houver dúvida real sem fonte confirmada, use status revisar e confiança abaixo de 50.",
      "Retorne somente JSON válido:",
      '{"materia":"Português","modulo":"Gramática","assunto":"Crase","subassunto":"Crase obrigatória","dificuldade":"Média","gabarito":"A","comentario":"...","norma":"","dispositivo":"","confianca":85,"status":"valida"}',
    ].join("\n"),
    8192,
    `resolução isolada da questão ${numero}`
  );

  const item = objetoSeguro(resposta);
  const status =
    gabaritoConhecido?.anulada === true ||
    item.status === "anulada"
      ? "anulada"
      : item.status === "revisar"
        ? "revisar"
        : "valida";
  const dificuldade =
    item.dificuldade === "Fácil" ||
    item.dificuldade === "Difícil"
      ? item.dificuldade
      : "Média";
  const gabarito =
    status === "anulada"
      ? ""
      : gabaritoConhecido?.resposta ||
        textoSeguro(item.gabarito)
          .toUpperCase()
          .slice(0, 3);
  const fonteGabarito =
    gabaritoConhecido
      ? "comentado"
      : "ia";
  const confiancaResolucao =
    gabaritoConhecido
      ? Math.max(
          limitarPercentual(
            item.confianca,
            70
          ),
          gabaritoConhecido.confianca
        )
      : limitarPercentual(
          item.confianca,
          60
        );
  const confianca = Math.min(
    extraida.confiancaLeitura,
    confiancaResolucao
  );

  return {
    numero,
    materia: textoSeguro(
      item.materia,
      "Não classificada"
    ),
    modulo:
      textoSeguro(item.modulo) ||
      undefined,
    assunto: textoSeguro(
      item.assunto,
      "Não classificado"
    ),
    subassunto:
      textoSeguro(item.subassunto) ||
      undefined,
    dificuldade,
    enunciado: extraida.enunciado,
    alternativas: extraida.alternativas,
    gabarito,
    comentario: textoSeguro(
      item.comentario,
      "Revise o conteúdo central cobrado nesta questão."
    ),
    norma:
      textoSeguro(item.norma) ||
      undefined,
    dispositivo:
      textoSeguro(item.dispositivo) ||
      undefined,
    fonteGabarito,
    confianca,
    status:
      status === "valida" &&
      (!gabarito || confianca < 50)
        ? "revisar"
        : status,
  };
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

async function gerarJsonTexto(
  ai: GoogleGenAI,
  modelos: string[],
  prompt: string,
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
            parts: [{ text: prompt }],
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
        console.warn(
          "[simulado-pdf-job] nova tentativa textual do Gemini",
          {
            rotulo,
            modelo,
            tentativaAtual,
            proximaTentativa,
            status,
            esperaMs,
          }
        );
      },
      aoTrocarModelo: ({
        modeloAnterior,
        modeloSeguinte,
        status,
      }) => {
        console.warn(
          "[simulado-pdf-job] trocando modelo na etapa textual",
          {
            rotulo,
            modeloAnterior,
            modeloSeguinte,
            status,
          }
        );
      },
    }
  );

  if (!resposta.text) {
    throw new Error(
      `A IA não retornou a leitura de ${rotulo}.`
    );
  }

  return parsearJsonDaIA(
    resposta.text,
    rotulo
  );
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

export async function executarBlocosSimuladoPdfPersistentes(args: {
  totalQuestoes: number;
  resultadoAnterior?: unknown;
  alertasIniciais?: string[];
  analisar: (intervalo: {
    inicio: number;
    fim: number;
    numerosEspecificos?: number[];
  }) => Promise<QuestaoSimuladoPdfProcessada[]>;
  salvar: (estado: {
    concluidos: number;
    totalBlocos: number;
    progresso: number;
    descricao: string;
    resultado: ResultadoSimuladoPdfProcessado;
  }) => Promise<void>;
}) {
  const intervalos = criarIntervalos(args.totalQuestoes);
  const resultadoAnterior = obterResultadoParcial(
    args.resultadoAnterior,
    args.totalQuestoes
  );
  const porNumero = new Map<number, QuestaoSimuladoPdfProcessada>(
    (resultadoAnterior?.questoes ?? []).map(
      (questao) => [questao.numero, questao] as const
    )
  );
  const alertas = [
    ...(args.alertasIniciais ?? []),
    ...(resultadoAnterior?.alertas ?? []),
  ];

  const intervaloCompleto = (intervalo: { inicio: number; fim: number }) =>
    Array.from(
      { length: intervalo.fim - intervalo.inicio + 1 },
      (_, indice) => intervalo.inicio + indice
    ).every(
      (numero) =>
        questaoSimuladoPdfProntaParaCorrecao(
          porNumero.get(numero)
        )
    );

  const contarConcluidos = () =>
    intervalos.filter(intervaloCompleto).length;

  const contarProntas = () =>
    Array.from(porNumero.values()).filter(
      (questao) =>
        questaoSimuladoPdfProntaParaCorrecao(
          questao
        )
    ).length;

  const progressoPorQuestoes = () => {
    const prontas = contarProntas();
    if (prontas === 0) return 1;

    return Math.min(
      90,
      15 +
        Math.round(
          (prontas / args.totalQuestoes) * 75
        )
    );
  };

  const intervalosPendentes = intervalos.filter(
    (intervalo) => !intervaloCompleto(intervalo)
  );
  let concluidos = contarConcluidos();

  const resultadoAtual = (): ResultadoSimuladoPdfProcessado => ({
    totalQuestoes: args.totalQuestoes,
    questoes: Array.from(porNumero.values()).sort(
      (a, b) => a.numero - b.numero
    ),
    alertas: Array.from(new Set(alertas)).slice(0, 30),
  });

  const salvarCheckpoint = async (
    descricao: string
  ) => {
    concluidos = contarConcluidos();
    await args.salvar({
      concluidos,
      totalBlocos: intervalos.length,
      progresso: progressoPorQuestoes(),
      descricao,
      resultado: resultadoAtual(),
    });
  };

  if (contarProntas() > 0) {
    await salvarCheckpoint(
      `Retomando análise: ${contarProntas()}/${args.totalQuestoes} questões já estavam prontas.`
    );
  }

  for (const intervalo of intervalosPendentes) {
    const questoesDoBloco = await args.analisar(intervalo);

    for (const questao of questoesDoBloco) {
      porNumero.set(
        questao.numero,
        escolherMelhorQuestao(
          porNumero.get(questao.numero),
          questao
        )
      );

      await salvarCheckpoint(
        `Questão ${questao.numero} salva · ${contarProntas()}/${args.totalQuestoes} questões prontas.`
      );
    }

    const pendentesDoBloco = Array.from(
      { length: intervalo.fim - intervalo.inicio + 1 },
      (_, indice) => intervalo.inicio + indice
    ).filter(
      (numero) =>
        !questaoSimuladoPdfProntaParaCorrecao(
          porNumero.get(numero)
        )
    );

    if (pendentesDoBloco.length > 0) {
      const recuperadas = await args.analisar({
        inicio: Math.min(...pendentesDoBloco),
        fim: Math.max(...pendentesDoBloco),
        numerosEspecificos: pendentesDoBloco,
      });

      for (const questao of recuperadas) {
        porNumero.set(
          questao.numero,
          escolherMelhorQuestao(
            porNumero.get(questao.numero),
            questao
          )
        );

        await salvarCheckpoint(
          `Questão ${questao.numero} recuperada · ${contarProntas()}/${args.totalQuestoes} questões prontas.`
        );
      }
    }

    const blocoCompleto = intervaloCompleto(intervalo);

    await salvarCheckpoint(
      blocoCompleto
        ? `Questões ${intervalo.inicio}–${intervalo.fim} processadas e persistidas.`
        : `Questões ${intervalo.inicio}–${intervalo.fim} ainda têm pendências; o que ficou pronto já foi salvo.`
    );
  }

  return {
    porNumero,
    alertas: Array.from(new Set(alertas)).slice(0, 30),
    concluidos,
    totalBlocos: intervalos.length,
  };
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
