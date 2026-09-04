import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LETRAS = ["A", "B", "C", "D", "E"] as const;

type Questao = {
  id?: string;
  materia?: string;
  modulo?: string;
  moduloId?: string;
  assunto?: string;
  banca?: string;
  dificuldade?: "Fácil" | "Média" | "Difícil";
  enunciado?: string;
  alternativas?: Record<string, string>;
  respostaCorreta?: string;
  explicacao?: string;
  fonteNome?: string;
  norma?: string;
  dispositivo?: string;
};

type Contexto = {
  concursoAlvo?: string;
  editalAlvo?: string;
  materiaId?: string;
  assuntoId?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });

  try {
    if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization") ?? "";

    if (!url || !anon || !service || !authorization.startsWith("Bearer ")) {
      return json({ erro: "Configuração de segurança indisponível." }, 503);
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ erro: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => null) as
      | { questoes?: Questao[]; contexto?: Contexto }
      | null;
    const questoes = Array.isArray(body?.questoes) ? body!.questoes!.slice(0, 60) : [];
    const contexto = body?.contexto ?? {};
    if (questoes.length === 0) return json({ erro: "Nenhuma questão válida foi enviada." }, 400);

    const concursoAlvo = texto(contexto.concursoAlvo) || "PMPE";
    const editalAlvo = texto(contexto.editalAlvo) || concursoAlvo;
    const preparadas = [];

    for (let indice = 0; indice < questoes.length; indice += 1) {
      const q = questoes[indice];
      validarQuestao(q, indice + 1);
      const alternativas = LETRAS.map((id) => ({ id, texto: texto(q.alternativas?.[id]) }));
      const fingerprint = await fingerprintQuestao(q);

      preparadas.push({
        id: uuid(q.id) ? q.id : crypto.randomUUID(),
        concurso_alvo: concursoAlvo,
        edital_alvo: editalAlvo,
        banca: texto(q.banca),
        banca_chave: normalizar(texto(q.banca)),
        materia_id: texto(contexto.materiaId) || null,
        materia: texto(q.materia),
        materia_chave: normalizar(texto(q.materia)),
        modulo_id: texto(q.moduloId) || null,
        modulo: texto(q.modulo) || null,
        assunto_id: texto(contexto.assuntoId) || null,
        assunto: texto(q.assunto),
        assunto_chave: normalizar(texto(q.assunto)),
        dificuldade:
          q.dificuldade === "Fácil"
            ? "facil"
            : q.dificuldade === "Difícil"
              ? "dificil"
              : "media",
        enunciado: texto(q.enunciado),
        alternativas,
        resposta_correta_id: q.respostaCorreta,
        explicacao: texto(q.explicacao),
        status: "pendente",
        compatibilidade_edital: "direta",
        confianca_classificacao: "media",
        motivo_status: "Aguardando curadoria humana após geração e revisão automáticas.",
        fonte_nome: texto(q.fonteNome),
        norma: texto(q.norma) || null,
        dispositivo: texto(q.dispositivo) || null,
        origem: "ia",
        criado_por: userData.user.id,
        fingerprint,
      });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { error: insertError } = await admin
      .from("questoes_catalogo")
      .upsert(preparadas, { onConflict: "fingerprint", ignoreDuplicates: true });
    if (insertError) throw new Error(`Falha ao publicar catálogo: ${insertError.message}`);

    const fingerprints = preparadas.map((item) => item.fingerprint);
    const { data, error: readError } = await admin
      .from("questoes_catalogo")
      .select("id,materia_id,materia,modulo_id,modulo,assunto_id,assunto,banca,dificuldade,enunciado,alternativas,resposta_correta_id,explicacao,fonte_nome,norma,dispositivo,status,fingerprint")
      .eq("origem", "ia")
      .in("fingerprint", fingerprints);
    if (readError) throw new Error(`Falha ao recarregar catálogo: ${readError.message}`);

    return json({ sucesso: true, questoes: data ?? [] }, 200);
  } catch (error) {
    return json(
      { erro: error instanceof Error ? error.message : "Falha ao publicar questões." },
      400
    );
  }
});

function validarQuestao(q: Questao, numero: number) {
  const alternativas = LETRAS.map((letra) => texto(q.alternativas?.[letra]));
  if (!texto(q.materia) || !texto(q.assunto) || !texto(q.banca) || !texto(q.enunciado) || !texto(q.explicacao) || !texto(q.fonteNome)) {
    throw new Error(`Questão ${numero}: campos obrigatórios ausentes.`);
  }
  if (!LETRAS.includes(q.respostaCorreta as (typeof LETRAS)[number])) {
    throw new Error(`Questão ${numero}: gabarito inválido.`);
  }
  if (
    /(constitucional|direitos humanos|leis?\s|lei |direito)/i.test(texto(q.materia)) &&
    (!texto(q.norma) || !texto(q.dispositivo))
  ) {
    throw new Error(`Questão ${numero}: norma ou dispositivo jurídico ausente.`);
  }
  if (alternativas.some((item) => !item) || new Set(alternativas.map(normalizar)).size !== 5) {
    throw new Error(`Questão ${numero}: alternativas inválidas ou duplicadas.`);
  }
}

async function fingerprintQuestao(q: Questao) {
  const partes = [
    texto(q.materia),
    texto(q.assunto),
    texto(q.banca),
    texto(q.enunciado),
    ...LETRAS.map((letra) => `${letra}:${texto(q.alternativas?.[letra])}`),
    texto(q.respostaCorreta),
  ].map(normalizar).join("::");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(partes));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim().slice(0, 20000) : "";
}
function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function uuid(valor: unknown) {
  return typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(valor: unknown, status: number) {
  return new Response(JSON.stringify(valor), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}
