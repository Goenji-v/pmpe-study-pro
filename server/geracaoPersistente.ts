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
  prefixo: string,
  limite = 30
) {
  const parametros = new URLSearchParams({
    select: "*",
    user_id: `eq.${contexto.userId}`,
    request_id: `like.${prefixo}%`,
    order: "criada_em.asc",
    limit: String(Math.max(1, Math.min(100, limite))),
  });

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
    >
  >
) {
  const resposta = await fetch(
    `${contexto.supabaseUrl}/rest/v1/geracoes_ia_jobs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(contexto.userId)}`,
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
