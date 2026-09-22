export type CategoriaConsumoIA = "geral" | "importacao";

export type ResultadoConsumoIA = {
  permitido: boolean;
  usados: number;
  limite: number;
  retryAfterSegundos: number;
};

type EntradaConsumoIA = {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  categoria: CategoriaConsumoIA;
  janelaMs: number;
  limite: number;
  fetchImpl?: typeof fetch;
};

export async function consumirCotaIaPersistente(
  entrada: EntradaConsumoIA
): Promise<ResultadoConsumoIA> {
  const {
    supabaseUrl,
    serviceRoleKey,
    userId,
    categoria,
    janelaMs,
    limite,
    fetchImpl = fetch,
  } = entrada;

  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  }

  const janelaSegundos = Math.max(60, Math.round(janelaMs / 1000));
  const limiteSeguro = Math.max(1, Math.round(limite));

  const resposta = await fetchImpl(
    `${supabaseUrl}/rest/v1/rpc/consumir_cota_ia`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_categoria: categoria,
        p_janela_segundos: janelaSegundos,
        p_limite: limiteSeguro,
      }),
    }
  );

  if (!resposta.ok) {
    throw new Error(
      `Controle persistente de consumo indisponível (HTTP ${resposta.status}).`
    );
  }

  const dados = (await resposta.json()) as Array<{
    permitido?: boolean;
    usados?: number;
    limite?: number;
    retry_after_segundos?: number;
  }>;

  const item = dados[0];
  if (!item || typeof item.permitido !== "boolean") {
    throw new Error("Resposta inválida do controle persistente de consumo.");
  }

  return {
    permitido: item.permitido,
    usados: Number(item.usados) || 0,
    limite: Number(item.limite) || limiteSeguro,
    retryAfterSegundos: Math.max(1, Number(item.retry_after_segundos) || 1),
  };
}
