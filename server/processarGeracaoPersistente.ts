import { randomUUID } from "node:crypto";
import type { GoogleGenAI } from "@google/genai";

import {
  parsearJsonDaIA,
} from "./jsonIa.ts";
import {
  executarComFallbackGemini,
} from "./retryGemini.ts";
import {
  montarPromptGeracaoQuestoesIA,
} from "./promptQuestoesIA.ts";
import {
  atualizarJobGeracaoIA,
  reivindicarJobGeracaoIA,
  type ContextoSupabaseJob,
  type JobGeracaoIA,
} from "./geracaoPersistente.ts";
import {
  montarPromptRevisaoQuestoesIA,
  validarLoteRevisado,
} from "../src/services/revisaoQuestoesIAUtils.ts";

type DependenciasGeracaoPersistente = {
  ai: GoogleGenAI;
  modelo: string;
  modeloFallback: string;
};

type PayloadGeracaoPersistente = {
  assunto: string;
  quantidade: number;
  banca: string;
  enunciadosEvitar: string[];
};

const filasPorUsuario = new Map<string, Promise<void>>();
const jobsAgendados = new Set<string>();
const LEASE_MS = 5 * 60 * 1000;

export function agendarJobGeracaoIA(
  job: JobGeracaoIA,
  contexto: ContextoSupabaseJob,
  dependencias: DependenciasGeracaoPersistente
) {
  if (
    job.status === "concluida" ||
    job.status === "erro" ||
    jobsAgendados.has(job.id)
  ) {
    return;
  }

  jobsAgendados.add(job.id);

  const anterior =
    filasPorUsuario.get(contexto.userId) ??
    Promise.resolve();

  const proxima = anterior
    .catch(() => {
      // Uma falha anterior não pode travar a fila do usuário.
    })
    .then(async () => {
      await processarJobGeracaoIA(job, contexto, dependencias);
    })
    .catch((erro) => {
      console.error("[geracao-ia-job] falha não tratada", {
        jobId: job.id,
        requestId: job.request_id,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    })
    .finally(() => {
      jobsAgendados.delete(job.id);

      if (filasPorUsuario.get(contexto.userId) === proxima) {
        filasPorUsuario.delete(contexto.userId);
      }
    });

  filasPorUsuario.set(contexto.userId, proxima);
}

export function jobEstaAgendado(id: string) {
  return jobsAgendados.has(id);
}

async function processarJobGeracaoIA(
  job: JobGeracaoIA,
  contexto: ContextoSupabaseJob,
  dependencias: DependenciasGeracaoPersistente
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
  const modelos = [
    dependencias.modelo,
    dependencias.modeloFallback,
  ];

  const atualizar = async (
    etapa: "gerando" | "revisando" | "corrigindo" | "salvando",
    progresso: number,
    descricao: string
  ) => {
    await atualizarJobGeracaoIA(
      contexto,
      job.id,
      {
        status: "processando",
        etapa,
        progresso,
        descricao,
        lease_ate: new Date(Date.now() + LEASE_MS).toISOString(),
      },
      execucaoId
    );
  };

  try {
    await atualizar(
      "gerando",
      20,
      "A IA está criando as questões."
    );

    const promptGeracao = montarPromptGeracaoQuestoesIA({
      assunto: payload.assunto,
      quantidade: payload.quantidade,
      banca: payload.banca,
      enunciadosEvitar: payload.enunciadosEvitar,
    });

    const loteInicial = await gerarLote(
      dependencias.ai,
      modelos,
      promptGeracao,
      "a geração das questões"
    );

    if (loteInicial.length !== payload.quantidade) {
      throw new Error(
        `A IA gerou ${loteInicial.length} questão(ões), mas eram esperadas ${payload.quantidade}.`
      );
    }

    const promptRevisaoBase = montarPromptRevisaoQuestoesIA({
      contextoOriginal: payload.assunto,
      banca: payload.banca,
      questoes: loteInicial,
    });

    let motivoReprovacao = "";

    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      const corrigindo = tentativa > 1;

      await atualizar(
        corrigindo ? "corrigindo" : "revisando",
        corrigindo ? 75 : 55,
        corrigindo
          ? "A primeira revisão foi rejeitada; a IA está corrigindo o lote."
          : "Uma checagem automática adicional está revisando gabaritos, consistência e fontes."
      );

      const promptRevisao = motivoReprovacao
        ? [
            promptRevisaoBase,
            "",
            "A revisão anterior foi rejeitada pelo validador local.",
            `Motivo objetivo da rejeição: ${motivoReprovacao}`,
            "Corrija especificamente essa falha, revise novamente TODAS as questões e devolva o lote completo em JSON válido.",
          ].join("\n")
        : promptRevisaoBase;

      const loteRevisado = await gerarLote(
        dependencias.ai,
        modelos,
        promptRevisao,
        "a revisão de qualidade das questões"
      );

      try {
        validarLoteRevisado(
          loteRevisado,
          payload.quantidade,
          payload.assunto
        );

        await atualizar(
          "salvando",
          92,
          "O lote aprovado está sendo salvo."
        );

        await atualizarJobGeracaoIA(
          contexto,
          job.id,
          {
            status: "concluida",
            etapa: "concluida",
            progresso: 100,
            descricao: "Questões prontas após checagens automáticas. Se algo parecer inconsistente, sinalize para revisão.",
            resultado: {
              questoes: loteRevisado,
            },
            erro: null,
            concluida_em: new Date().toISOString(),
            lease_ate: null,
          },
          execucaoId
        );

        return;
      } catch (erroValidacao) {
        motivoReprovacao =
          erroValidacao instanceof Error
            ? erroValidacao.message.slice(0, 500)
            : "A revisão não passou na validação editorial.";

        if (tentativa >= 2) {
          throw erroValidacao;
        }
      }
    }
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Erro desconhecido ao gerar questões.";

    await atualizarJobGeracaoIA(
      contexto,
      job.id,
      {
        status: "erro",
        etapa: "erro",
        progresso: 0,
        erro: mensagem.slice(0, 1200),
        descricao: "A geração precisa de atenção.",
        concluida_em: new Date().toISOString(),
        lease_ate: null,
      },
      execucaoId
    ).catch((erroAtualizacao) => {
      console.error("[geracao-ia-job] não foi possível registrar o erro", {
        jobId: job.id,
        erro:
          erroAtualizacao instanceof Error
            ? erroAtualizacao.message
            : String(erroAtualizacao),
      });
    });
  }
}

async function gerarLote(
  ai: GoogleGenAI,
  modelos: string[],
  prompt: string,
  rotulo: string
) {
  return executarComFallbackGemini(
    async (modeloAtual) => {
      const resposta = await ai.models.generateContent({
        model: modeloAtual,
        contents: prompt,
      });

      if (!resposta.text) {
        throw new Error("O Gemini não retornou texto.");
      }

      const parsed = parsearJsonDaIA(
        resposta.text,
        rotulo
      );

      if (!Array.isArray(parsed)) {
        throw new Error("A IA não retornou uma lista de questões.");
      }

      return parsed as unknown[];
    },
    {
      rotulo,
      modelos,
      tentativasPorModelo: [2, 1],
    }
  );
}

function validarPayload(
  valor: Record<string, unknown>
): PayloadGeracaoPersistente {
  const assunto =
    typeof valor.assunto === "string"
      ? valor.assunto.trim()
      : "";
  const banca =
    typeof valor.banca === "string"
      ? valor.banca.trim()
      : "AOCP";
  const quantidade = Math.max(
    1,
    Math.min(60, Number(valor.quantidade) || 5)
  );
  const enunciadosEvitar = Array.isArray(valor.enunciadosEvitar)
    ? valor.enunciadosEvitar
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 120)
    : [];

  if (!assunto) {
    throw new Error("O assunto da geração está vazio.");
  }

  return {
    assunto,
    quantidade,
    banca,
    enunciadosEvitar,
  };
}
