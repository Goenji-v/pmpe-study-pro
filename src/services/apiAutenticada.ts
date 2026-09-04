import { supabase } from "../lib/supabase";

const chavePublicaSupabase =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

const ATRASOS_GERACAO_IA_MS = [1_500, 3_000];

export async function fetchApiAutenticada(
  url: string,
  init: RequestInit = {}
) {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("Sua sessão expirou. Entre novamente para usar a inteligência artificial.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (chavePublicaSupabase) {
    headers.set("X-Supabase-Anon-Key", chavePublicaSupabase);
  }

  const executar = () => fetch(url, {
    ...init,
    headers,
  });

  if (!ehRotaGeracaoQuestoes(url)) {
    return executar();
  }

  for (let tentativa = 0; tentativa <= ATRASOS_GERACAO_IA_MS.length; tentativa += 1) {
    const resposta = await executar();
    const falha = await classificarFalhaTemporariaIa(resposta);

    if (falha === "limite") {
      return respostaAmigavelIa(
        "O limite de uso da IA foi atingido no momento. Aguarde a renovação do limite e tente novamente.",
        429
      );
    }

    if (falha !== "alta_demanda") {
      return resposta;
    }

    if (tentativa < ATRASOS_GERACAO_IA_MS.length) {
      await aguardar(ATRASOS_GERACAO_IA_MS[tentativa]);
      continue;
    }

    return respostaAmigavelIa(
      "A IA está com alta demanda agora. O Study Pro tentou novamente automaticamente, mas o serviço ainda não respondeu. Aguarde alguns minutos e tente de novo.",
      503
    );
  }

  return respostaAmigavelIa(
    "A IA está temporariamente indisponível. Tente novamente em alguns minutos.",
    503
  );
}

function ehRotaGeracaoQuestoes(url: string) {
  try {
    return new URL(url, window.location.origin).pathname.endsWith("/api/gerar");
  } catch {
    return url.includes("/api/gerar");
  }
}

async function classificarFalhaTemporariaIa(
  resposta: Response
): Promise<"alta_demanda" | "limite" | null> {
  if (resposta.status === 503) return "alta_demanda";
  if (resposta.status === 429) return "limite";
  if (resposta.ok) return null;

  try {
    const dados = await resposta.clone().json() as Record<string, unknown>;
    const mensagem = typeof dados.erro === "string" ? dados.erro : "";
    const codigo = extrairCodigoProvedor(mensagem);

    if (codigo === 503 || /high demand|temporarily unavailable|\bUNAVAILABLE\b/i.test(mensagem)) {
      return "alta_demanda";
    }

    if (codigo === 429 || /quota|rate limit|too many requests|limite de uso/i.test(mensagem)) {
      return "limite";
    }
  } catch {
    return null;
  }

  return null;
}

function extrairCodigoProvedor(mensagem: string) {
  if (!mensagem) return null;

  try {
    const valor = JSON.parse(mensagem) as {
      code?: unknown;
      error?: { code?: unknown };
    };
    const codigo = Number(valor.error?.code ?? valor.code);
    if (Number.isInteger(codigo) && codigo >= 100 && codigo <= 599) {
      return codigo;
    }
  } catch {
    const encontrado = mensagem.match(/"code"\s*:\s*(\d{3})/i);
    if (encontrado) return Number(encontrado[1]);
  }

  return null;
}

function respostaAmigavelIa(mensagem: string, status: number) {
  return new Response(
    JSON.stringify({
      sucesso: false,
      erro: mensagem,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}

function aguardar(milissegundos: number) {
  return new Promise<void>((resolver) => {
    window.setTimeout(resolver, milissegundos);
  });
}
