import { randomUUID } from "node:crypto";
import type { GoogleGenAI } from "@google/genai";

import { analisarSimuladoPdfComIA, type AnaliseSimuladoPdf } from "./simuladoPdfAnalise.ts";
import type { ContextoSupabaseJob } from "./geracaoPersistente.ts";

export type StatusJobSimuladoPdf =
  | "fila"
  | "processando"
  | "concluida"
  | "erro"
  | "cancelada";

export type EtapaJobSimuladoPdf =
  | "fila"
  | "baixando"
  | "analisando"
  | "validando"
  | "concluida"
  | "erro"
  | "cancelada";

export type JobSimuladoPdf = {
  id: string;
  user_id: string;
  request_id: string;
  status: StatusJobSimuladoPdf;
  etapa: EtapaJobSimuladoPdf;
  progresso: number;
  nome: string;
  total_questoes: number;
  caderno_path: string;
  caderno_nome: string;
  comentado_path: string | null;
  comentado_nome: string | null;
  resultado: AnaliseSimuladoPdf | null;
  erro: string | null;
  criada_em: string;
  iniciada_em: string | null;
  atualizada_em: string;
  concluida_em: string | null;
  execucao_id: string | null;
  lease_ate: string | null;
};

type Dependencias = {
  ai: GoogleGenAI;
  modelo: string;
  modeloFallback: string;
};

const jobsAgendados = new Set<string>();
const filasPorUsuario = new Map<string, Promise<void>>();
const LEASE_MS = 6 * 60 * 1000;

export async function criarOuBuscarJobSimuladoPdf(
  contexto: ContextoSupabaseJob,
  entrada: {
    requestId: string;
    nome: string;
    totalQuestoes: number;
    cadernoPath: string;
    cadernoNome: string;
    comentadoPath?: string | null;
    comentadoNome?: string | null;
  }
) {
  const existente = await buscarJobSimuladoPdf(contexto, entrada.requestId);
  if (existente) return existente;

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/simulado_pdf_jobs`,
    {
      method: "POST",
      headers: cabecalhos(contexto, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        user_id: contexto.userId,
        request_id: entrada.requestId,
        nome: entrada.nome.slice(0, 180),
        total_questoes: Math.max(1, Math.min(200, Math.round(entrada.totalQuestoes))),
        caderno_path: entrada.cadernoPath,
        caderno_nome: entrada.cadernoNome,
        comentado_path: entrada.comentadoPath || null,
        comentado_nome: entrada.comentadoNome || null,
        status: "fila",
        etapa: "fila",
        progresso: 0,
      }),
    }
  );

  if (resposta.ok) {
    const itens = (await resposta.json()) as JobSimuladoPdf[];
    if (itens[0]) return itens[0];
  }

  if (resposta.status === 409) {
    const concorrente = await buscarJobSimuladoPdf(contexto, entrada.requestId);
    if (concorrente) return concorrente;
  }

  throw new Error(await mensagemSupabase(resposta, "Não foi possível iniciar a análise do simulado."));
}

export async function buscarJobSimuladoPdf(
  contexto: ContextoSupabaseJob,
  requestId: string
) {
  const parametros = new URLSearchParams({
    select: "*",
    user_id: `eq.${contexto.userId}`,
    request_id: `eq.${requestId}`,
    limit: "1",
  });

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/simulado_pdf_jobs?${parametros.toString()}`,
    { headers: cabecalhos(contexto) }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível consultar a análise."));
  }

  const itens = (await resposta.json()) as JobSimuladoPdf[];
  return itens[0] ?? null;
}

export async function cancelarJobSimuladoPdf(
  contexto: ContextoSupabaseJob,
  requestId: string
) {
  const job = await buscarJobSimuladoPdf(contexto, requestId);
  if (!job) return null;

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/simulado_pdf_jobs?id=eq.${encodeURIComponent(job.id)}&user_id=eq.${encodeURIComponent(contexto.userId)}`,
    {
      method: "PATCH",
      headers: cabecalhos(contexto, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        status: "cancelada",
        etapa: "cancelada",
        erro: null,
        concluida_em: new Date().toISOString(),
        lease_ate: null,
        atualizada_em: new Date().toISOString(),
      }),
    }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível cancelar a análise."));
  }

  const itens = (await resposta.json()) as JobSimuladoPdf[];
  return itens[0] ?? null;
}

export function agendarJobSimuladoPdf(
  job: JobSimuladoPdf,
  contexto: ContextoSupabaseJob,
  dependencias: Dependencias
) {
  if (
    job.status === "concluida" ||
    job.status === "erro" ||
    job.status === "cancelada" ||
    jobsAgendados.has(job.id)
  ) {
    return;
  }

  jobsAgendados.add(job.id);
  const anterior = filasPorUsuario.get(contexto.userId) ?? Promise.resolve();

  const proxima = anterior
    .catch(() => {})
    .then(() => processarJob(job, contexto, dependencias))
    .catch((erro) => {
      console.error("[simulado-pdf-job] falha não tratada", {
        jobId: job.id,
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

async function processarJob(
  job: JobSimuladoPdf,
  contexto: ContextoSupabaseJob,
  dependencias: Dependencias
) {
  const execucaoId = randomUUID();
  const assumido = await reivindicarJob(contexto, job, execucaoId);
  if (!assumido) return;

  try {
    await atualizarOuCancelar(
      contexto,
      job.id,
      execucaoId,
      "baixando",
      8,
      null
    );

    const [caderno, comentado] = await Promise.all([
      baixarPdf(contexto, assumido.caderno_path, assumido.caderno_nome),
      assumido.comentado_path
        ? baixarPdf(
            contexto,
            assumido.comentado_path,
            assumido.comentado_nome || "comentado.pdf"
          )
        : Promise.resolve(null),
    ]);

    await atualizarOuCancelar(
      contexto,
      job.id,
      execucaoId,
      "analisando",
      18,
      null
    );

    const analise = await analisarSimuladoPdfComIA({
      ai: dependencias.ai,
      modelo: dependencias.modelo,
      modeloFallback: dependencias.modeloFallback,
      entrada: {
        prova: caderno,
        comentado,
        totalInformado: assumido.total_questoes,
      },
      aoProgresso: async (progresso) => {
        await atualizarOuCancelar(
          contexto,
          job.id,
          execucaoId,
          progresso >= 94 ? "validando" : "analisando",
          progresso,
          null
        );
      },
    });

    await atualizarOuCancelar(
      contexto,
      job.id,
      execucaoId,
      "validando",
      97,
      null
    );

    const atualizado = await atualizarJob(
      contexto,
      job.id,
      {
        status: "concluida",
        etapa: "concluida",
        progresso: 100,
        resultado: analise,
        erro: null,
        concluida_em: new Date().toISOString(),
        lease_ate: null,
      },
      execucaoId
    );

    if (!atualizado) {
      throw new Error("A análise foi cancelada antes de ser concluída.");
    }
  } catch (erro) {
    const atual = await buscarJobPorId(contexto, job.id).catch(() => null);

    if (atual?.status === "cancelada") return;

    const mensagem =
      erro instanceof Error ? erro.message : "Erro desconhecido ao analisar o PDF.";

    await atualizarJob(
      contexto,
      job.id,
      {
        status: "erro",
        etapa: "erro",
        progresso: Math.max(1, atual?.progresso ?? 1),
        erro: mensagem.slice(0, 1200),
        concluida_em: new Date().toISOString(),
        lease_ate: null,
      },
      execucaoId
    ).catch(() => {});
  }
}

async function reivindicarJob(
  contexto: ContextoSupabaseJob,
  job: JobSimuladoPdf,
  execucaoId: string
) {
  if (
    job.status === "concluida" ||
    job.status === "erro" ||
    job.status === "cancelada"
  ) {
    return null;
  }

  const agora = new Date();
  const leaseAte = new Date(agora.getTime() + LEASE_MS).toISOString();
  const filtroPosse =
    job.status === "fila"
      ? "&status=eq.fila"
      : `&status=eq.processando&or=(lease_ate.is.null,lease_ate.lt.${encodeURIComponent(agora.toISOString())})`;

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/simulado_pdf_jobs?id=eq.${encodeURIComponent(job.id)}&user_id=eq.${encodeURIComponent(contexto.userId)}${filtroPosse}`,
    {
      method: "PATCH",
      headers: cabecalhos(contexto, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        status: "processando",
        etapa: "baixando",
        progresso: Math.max(1, job.progresso || 1),
        execucao_id: execucaoId,
        lease_ate: leaseAte,
        iniciada_em: job.iniciada_em || agora.toISOString(),
        atualizada_em: agora.toISOString(),
        erro: null,
      }),
    }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível assumir a análise."));
  }

  const itens = (await resposta.json()) as JobSimuladoPdf[];
  return itens[0] ?? null;
}

async function atualizarOuCancelar(
  contexto: ContextoSupabaseJob,
  id: string,
  execucaoId: string,
  etapa: EtapaJobSimuladoPdf,
  progresso: number,
  erro: string | null
) {
  const atualizado = await atualizarJob(
    contexto,
    id,
    {
      status: "processando",
      etapa,
      progresso: Math.max(0, Math.min(100, Math.round(progresso))),
      erro,
      lease_ate: new Date(Date.now() + LEASE_MS).toISOString(),
    },
    execucaoId
  );

  if (!atualizado) {
    throw new Error("A análise foi cancelada.");
  }

  return atualizado;
}

async function atualizarJob(
  contexto: ContextoSupabaseJob,
  id: string,
  atualizacao: Partial<JobSimuladoPdf>,
  execucaoId?: string
) {
  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/simulado_pdf_jobs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(contexto.userId)}${execucaoId ? `&execucao_id=eq.${encodeURIComponent(execucaoId)}` : ""}`,
    {
      method: "PATCH",
      headers: cabecalhos(contexto, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        ...atualizacao,
        atualizada_em: new Date().toISOString(),
      }),
    }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível atualizar a análise."));
  }

  const itens = (await resposta.json()) as JobSimuladoPdf[];
  return itens[0] ?? null;
}

async function buscarJobPorId(
  contexto: ContextoSupabaseJob,
  id: string
) {
  const parametros = new URLSearchParams({
    select: "*",
    id: `eq.${id}`,
    user_id: `eq.${contexto.userId}`,
    limit: "1",
  });

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/simulado_pdf_jobs?${parametros.toString()}`,
    { headers: cabecalhos(contexto) }
  );

  if (!resposta.ok) return null;
  const itens = (await resposta.json()) as JobSimuladoPdf[];
  return itens[0] ?? null;
}

async function baixarPdf(
  contexto: ContextoSupabaseJob,
  path: string,
  nome: string
) {
  validarPathDoUsuario(path, contexto.userId);

  const pathCodificado = path
    .split("/")
    .map((parte) => encodeURIComponent(parte))
    .join("/");

  const resposta = await fetch(
    `${contexto.supabaseUrl}/storage/v1/object/authenticated/materiais/${pathCodificado}`,
    {
      headers: {
        apikey: contexto.anonKey,
        Authorization: contexto.authorization,
      },
    }
  );

  if (!resposta.ok) {
    throw new Error(`Não foi possível recuperar ${nome} para análise.`);
  }

  const buffer = Buffer.from(await resposta.arrayBuffer());

  if (buffer.length <= 0 || buffer.length > 50 * 1024 * 1024) {
    throw new Error(`O PDF ${nome} está vazio ou ultrapassa 50 MB.`);
  }

  return {
    nome,
    base64: buffer.toString("base64"),
  };
}

function validarPathDoUsuario(path: string, userId: string) {
  const normalizado = path.trim();

  if (
    !normalizado.startsWith(userId + "/simulados/") ||
    normalizado.includes("..") ||
    normalizado.includes("\\")
  ) {
    throw new Error("O caminho do PDF não pertence ao usuário atual.");
  }
}

function cabecalhos(
  contexto: ContextoSupabaseJob,
  extras: Record<string, string> = {}
) {
  return {
    apikey: contexto.anonKey,
    Authorization: contexto.authorization,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extras,
  };
}

async function mensagemSupabase(
  resposta: Response,
  fallback: string
) {
  try {
    const dados = (await resposta.json()) as {
      message?: string;
      error_description?: string;
    };

    return dados.message || dados.error_description || fallback;
  } catch {
    return fallback;
  }
}
