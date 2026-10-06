export type StatusJobGeracaoIA =
  | "fila"
  | "processando"
  | "concluida"
  | "erro";

export type EtapaJobGeracaoIA =
  | "fila"
  | "gerando"
  | "revisando"
  | "corrigindo"
  | "salvando"
  | "concluida"
  | "erro";

export type JobGeracaoIA = {
  id: string;
  user_id: string;
  request_id: string;
  status: StatusJobGeracaoIA;
  etapa: EtapaJobGeracaoIA;
  progresso: number;
  titulo: string;
  descricao: string;
  payload: Record<string, unknown>;
  resultado: unknown;
  erro: string | null;
  criada_em: string;
  iniciada_em: string | null;
  atualizada_em: string;
  concluida_em: string | null;
  execucao_id: string | null;
  lease_ate: string | null;
};

export type ContextoSupabaseJob = {
  supabaseUrl: string;
  userId: string;
  authorization: string;
  anonKey: string;
};

type CriarJobEntrada = {
  requestId: string;
  titulo: string;
  descricao: string;
  payload: Record<string, unknown>;
};

export async function criarOuBuscarJobGeracaoIA(
  contexto: ContextoSupabaseJob,
  entrada: CriarJobEntrada
) {
  const existente = await buscarJobGeracaoIAPorRequestId(
    contexto,
    entrada.requestId
  );
  if (existente) return existente;

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs`,
    {
      method: "POST",
      headers: cabecalhos(contexto, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        user_id: contexto.userId,
        request_id: entrada.requestId,
        status: "fila",
        etapa: "fila",
        progresso: 0,
        titulo: entrada.titulo.slice(0, 180),
        descricao: entrada.descricao.slice(0, 400),
        payload: entrada.payload,
      }),
    }
  );

  if (resposta.ok) {
    const itens = (await resposta.json()) as JobGeracaoIA[];
    if (itens[0]) return itens[0];
  }

  if (resposta.status === 409) {
    const concorrente = await buscarJobGeracaoIAPorRequestId(
      contexto,
      entrada.requestId
    );
    if (concorrente) return concorrente;
  }

  throw new Error(await mensagemSupabase(resposta, "Não foi possível criar a geração."));
}

export async function buscarJobGeracaoIAPorRequestId(
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
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs?${parametros.toString()}`,
    {
      headers: cabecalhos(contexto),
    }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível consultar a geração."));
  }

  const itens = (await resposta.json()) as JobGeracaoIA[];
  return itens[0] ?? null;
}

export async function listarJobsGeracaoIAPorPrefixo(
  contexto: ContextoSupabaseJob,
  prefixo = "",
  limite = 50
) {
  const parametros = new URLSearchParams({
    select: "*",
    user_id: `eq.${contexto.userId}`,
    order: prefixo ? "criada_em.asc" : "criada_em.desc",
    limit: String(Math.max(1, Math.min(100, limite))),
  });

  if (prefixo) {
    parametros.set("request_id", `like.${prefixo}%`);
  }

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs?${parametros.toString()}`,
    {
      headers: cabecalhos(contexto),
    }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível listar as gerações."));
  }

  return (await resposta.json()) as JobGeracaoIA[];
}

export async function reivindicarJobGeracaoIA(
  contexto: ContextoSupabaseJob,
  job: JobGeracaoIA,
  execucaoId: string,
  leaseMs = 5 * 60 * 1000
) {
  if (job.status === "concluida" || job.status === "erro") {
    return null;
  }

  const agora = new Date();
  const leaseAte = new Date(agora.getTime() + leaseMs).toISOString();
  const filtrosBase =
    `id=eq.${encodeURIComponent(job.id)}&user_id=eq.${encodeURIComponent(contexto.userId)}`;

  const filtroPosse =
    job.status === "fila"
      ? "&status=eq.fila"
      : `&status=eq.processando&or=(lease_ate.is.null,lease_ate.lt.${encodeURIComponent(agora.toISOString())})`;

  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs?${filtrosBase}${filtroPosse}`,
    {
      method: "PATCH",
      headers: cabecalhos(contexto, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        status: "processando",
        execucao_id: execucaoId,
        lease_ate: leaseAte,
        iniciada_em: job.iniciada_em || agora.toISOString(),
        atualizada_em: agora.toISOString(),
        erro: null,
      }),
    }
  );

  if (!resposta.ok) {
    throw new Error(await mensagemSupabase(resposta, "Não foi possível assumir a geração."));
  }

  const itens = (await resposta.json()) as JobGeracaoIA[];
  return itens[0] ?? null;
}

export async function atualizarJobGeracaoIA(
  contexto: ContextoSupabaseJob,
  id: string,
  atualizacao: Partial<
    Pick<
      JobGeracaoIA,
      | "status"
      | "etapa"
      | "progresso"
      | "resultado"
      | "erro"
      | "iniciada_em"
      | "concluida_em"
      | "descricao"
      | "execucao_id"
      | "lease_ate"
      | "payload"
    >
  >,
  execucaoIdAtual?: string
) {
  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(contexto.userId)}${execucaoIdAtual ? `&execucao_id=eq.${encodeURIComponent(execucaoIdAtual)}` : ""}`,
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
    throw new Error(await mensagemSupabase(resposta, "Não foi possível atualizar a geração."));
  }

  const itens = (await resposta.json()) as JobGeracaoIA[];
  return itens[0] ?? null;
}

/**
 * Disparado quando esta execução já não é a dona do job (o lease expirou e outra
 * execução assumiu, ou o job foi excluído). Quem recebe deve PARAR: continuar
 * gastaria chamadas do Gemini e poderia marcar como "concluída" uma geração
 * que nunca foi salva.
 */
export class ErroPosseJobPerdida extends Error {
  jobId: string;

  constructor(jobId: string) {
    super(`A execução perdeu a posse do job ${jobId}.`);
    this.name = "ErroPosseJobPerdida";
    this.jobId = jobId;
  }
}

/**
 * Igual a atualizarJobGeracaoIA, mas exige que a atualização tenha atingido uma
 * linha. Sem isso, o PATCH filtrado por execucao_id devolve lista vazia e o
 * chamador acreditava que tinha salvo.
 */
export async function atualizarJobGeracaoIAComPosse(
  contexto: ContextoSupabaseJob,
  id: string,
  atualizacao: Parameters<typeof atualizarJobGeracaoIA>[2],
  execucaoId: string
) {
  const atualizado = await atualizarJobGeracaoIA(
    contexto,
    id,
    atualizacao,
    execucaoId
  );

  if (!atualizado) throw new ErroPosseJobPerdida(id);
  return atualizado;
}

export async function excluirJobGeracaoIA(
  contexto: ContextoSupabaseJob,
  id: string
) {
  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(contexto.userId)}`,
    {
      method: "DELETE",
      headers: cabecalhos(contexto, {
        Prefer: "return=minimal",
      }),
    }
  );

  if (!resposta.ok) {
    throw new Error(
      await mensagemSupabase(resposta, "Não foi possível excluir a geração.")
    );
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
    const dados = await resposta.json() as {
      message?: string;
      error_description?: string;
    };
    return dados.message || dados.error_description || fallback;
  } catch {
    return fallback;
  }
}
