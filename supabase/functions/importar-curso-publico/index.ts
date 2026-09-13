import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) return resposta({ error: "Sessão não autenticada." }, 401);

    const autorizado = await podeGerenciarCurso(authorization);
    if (!autorizado) return resposta({ error: "Sua conta não tem acesso à gestão de cursos de parceiro." }, 403);

    const corpo = await req.json().catch(() => ({}));
    const urlTexto = typeof corpo?.url === "string" ? corpo.url.trim() : "";
    const inicial = validarUrlPublica(urlTexto);
    const { html, urlFinal } = await buscarHtmlSeguro(inicial);
    const rascunho = extrairEstrutura(html, urlFinal);
    return resposta({ rascunho });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível ler a página do curso.";
    return resposta({ error: mensagem }, 400);
  }
});

async function podeGerenciarCurso(authorization: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) return false;
  const retorno = await fetch(`${supabaseUrl}/rest/v1/rpc/painel_cursos_meu_parceiro`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!retorno.ok) return false;
  const dados = await retorno.json().catch(() => null);
  return !!dados?.parceiro_id;
}

function validarUrlPublica(valor: string) {
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error("Informe um endereço HTTPS válido."); }
  if (url.protocol !== "https:") throw new Error("Por segurança, a importação automática aceita somente endereços HTTPS.");
  if (hostBloqueado(url.hostname)) throw new Error("Esse endereço não pode ser acessado pelo importador.");
  return url;
}

function hostBloqueado(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h)) return true;
  const partes = h.split(".").map(Number);
  if (partes.length === 4 && partes.every(Number.isFinite)) {
    if (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31) return true;
    if (partes[0] === 100 && partes[1] >= 64 && partes[1] <= 127) return true;
  }
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  return false;
}

async function buscarHtmlSeguro(inicial: URL) {
  let atual = inicial;
  for (let salto = 0; salto < 5; salto += 1) {
    if (hostBloqueado(atual.hostname)) throw new Error("O endereço redirecionou para uma rede não permitida.");
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 12000);
    let retorno: Response;
    try {
      retorno = await fetch(atual, {
        redirect: "manual",
        signal: controlador.signal,
        headers: {
          "User-Agent": "StudyPro-CourseImporter/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(retorno.status)) {
      const local = retorno.headers.get("location");
      if (!local) throw new Error("A página redirecionou sem informar o destino.");
      atual = validarUrlPublica(new URL(local, atual).href);
      continue;
    }

    if (!retorno.ok) throw new Error(`A plataforma respondeu com erro ${retorno.status}. Se exigir login, use o script de captura.`);
    const tipo = (retorno.headers.get("content-type") || "").toLowerCase();
    if (tipo && !tipo.includes("text/html") && !tipo.includes("application/xhtml")) {
      throw new Error("O endereço não parece ser uma página HTML de curso.");
    }
    const tamanho = Number(retorno.headers.get("content-length") || 0);
    if (tamanho > 2_500_000) throw new Error("A página é grande demais para a importação automática. Use o script de captura.");
    const texto = await retorno.text();
    return { html: texto.slice(0, 2_500_000), urlFinal: atual };
  }
  throw new Error("A página redirecionou muitas vezes.");
}

function extrairEstrutura(htmlOriginal: string, origem: URL) {
  const html = htmlOriginal
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");
  const tituloDocumento = limparTexto((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""));
  const nome = limparTexto((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "")) || tituloDocumento || origem.hostname;
  const resultado: { nome: string; descricao: string; disciplinas: Array<{ titulo: string; descricao: string; modulos: Array<{ titulo: string; descricao: string; aulas: Array<{ titulo: string; descricao: string; tipo: string; url: string; duracaoMinutos: null }> }> }> } = {
    nome: nome.slice(0, 160), descricao: "", disciplinas: [],
  };
  let disciplina: (typeof resultado.disciplinas)[number] | null = null;
  let modulo: (typeof resultado.disciplinas)[number]["modulos"][number] | null = null;
  const vistos = new Set<string>();
  const ignorar = /^(início|inicio|home|perfil|conta|sair|logout|suporte|ajuda|configurações|configuracoes|voltar|próximo|proximo|anterior|entrar|login)$/i;

  const novaDisciplina = (titulo: string) => {
    disciplina = { titulo: (limparTexto(titulo) || `Disciplina ${resultado.disciplinas.length + 1}`).slice(0, 160), descricao: "", modulos: [] };
    resultado.disciplinas.push(disciplina);
    modulo = null;
  };
  const novoModulo = (titulo: string) => {
    if (!disciplina) novaDisciplina("Conteúdo importado");
    modulo = { titulo: (limparTexto(titulo) || `Módulo ${disciplina!.modulos.length + 1}`).slice(0, 160), descricao: "", aulas: [] };
    disciplina!.modulos.push(modulo);
  };
  const adicionarAula = (titulo: string, href: string) => {
    const nomeAula = limparTexto(titulo);
    if (nomeAula.length < 2 || ignorar.test(nomeAula)) return;
    let destino: URL;
    try { destino = new URL(href, origem); } catch { return; }
    if (destino.protocol !== "https:" || hostBloqueado(destino.hostname)) return;
    const chave = destino.href.split("#")[0];
    if (vistos.has(chave)) return;
    if (!disciplina) novaDisciplina("Conteúdo importado");
    if (!modulo) novoModulo("Módulo 1");
    vistos.add(chave);
    const caminho = destino.pathname.toLowerCase();
    const tipo = /\.(pdf|docx?|pptx?|xlsx?)(\?|$)/i.test(caminho) ? "material" : "video";
    modulo!.aulas.push({ titulo: nomeAula.slice(0, 200), descricao: "", tipo, url: destino.href, duracaoMinutos: null });
  };

  const padrao = /<(h2|h3|h4|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let item: RegExpExecArray | null;
  while ((item = padrao.exec(html)) && vistos.size < 500) {
    const tag = item[1].toLowerCase();
    if (tag === "h2") novaDisciplina(item[3]);
    else if (tag === "h3" || tag === "h4") novoModulo(item[3]);
    else {
      const href = item[2].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      adicionarAula(item[3], href);
    }
  }

  resultado.disciplinas = resultado.disciplinas
    .map((d) => ({ ...d, modulos: d.modulos.filter((m) => m.aulas.length > 0) }))
    .filter((d) => d.modulos.length > 0);
  if (!resultado.disciplinas.length) {
    throw new Error("Não encontrei uma grade aproveitável nessa página. Se o curso exige login ou carrega por aplicativo, use o script de captura.");
  }
  return resultado;
}

function limparTexto(valor: string) {
  return decodificarEntidades(valor.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodificarEntidades(valor: string) {
  const mapa: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " ",
  };
  return valor
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => mapa[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: cors });
}
