import type { RascunhoImportacaoCurso } from "./cursoParceiroService";

export type RelatorioImportacaoArquivo = {
  arquivosHtml: number;
  aulasImportadas: number;
  duplicadasIgnoradas: number;
  linksInvalidosIgnorados: number;
  avisos: string[];
};

export type ResultadoImportacaoArquivo = {
  rascunho: RascunhoImportacaoCurso;
  relatorio: RelatorioImportacaoArquivo;
};

const LIMITE_ARQUIVO = 20 * 1024 * 1024;
const LIMITE_HTML_EXPANDIDO = 12 * 1024 * 1024;
const LIMITE_ENTRADAS_HTML = 60;
const IGNORAR_TEXTO = /^(in[ií]cio|home|perfil|conta|sair|logout|suporte|ajuda|configura(c|ç)[oõ]es|voltar|pr[oó]ximo|anterior|menu|dashboard|painel)$/i;

type PaginaHtml = { nome: string; html: string };
type DisciplinaMutavel = { titulo: string; descricao: string; modulos: ModuloMutavel[] };
type ModuloMutavel = { titulo: string; descricao: string; aulas: AulaMutavel[] };
type AulaMutavel = {
  titulo: string;
  descricao: string;
  tipo: "video" | "material" | "link" | "texto";
  url: string;
  duracaoMinutos: number | null;
};

export async function importarCursoDeArquivo(arquivo: File): Promise<ResultadoImportacaoArquivo> {
  if (arquivo.size > LIMITE_ARQUIVO) {
    throw new Error("O arquivo é muito grande. Use um HTML/ZIP de até 20 MB.");
  }

  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".html") || nome.endsWith(".htm")) {
    return montarResultado([{ nome: arquivo.name, html: await arquivo.text() }]);
  }

  if (nome.endsWith(".zip")) {
    const paginas = await extrairHtmlDoZip(await arquivo.arrayBuffer());
    if (!paginas.length) throw new Error("O ZIP não contém nenhum arquivo .html ou .htm.");
    return montarResultado(paginas);
  }

  throw new Error("Selecione um arquivo .html, .htm ou .zip.");
}

function montarResultado(paginas: PaginaHtml[]): ResultadoImportacaoArquivo {
  const relatorio: RelatorioImportacaoArquivo = {
    arquivosHtml: paginas.length,
    aulasImportadas: 0,
    duplicadasIgnoradas: 0,
    linksInvalidosIgnorados: 0,
    avisos: [],
  };

  const disciplinas: DisciplinaMutavel[] = [];
  const urlsVistas = new Set<string>();
  let nomeCurso = "Curso importado";
  let descricaoCurso = "Importado de arquivo HTML/ZIP para revisão no Study Pro";

  paginas.forEach((pagina, indicePagina) => {
    const documento = new DOMParser().parseFromString(pagina.html, "text/html");
    if (!documento) return;

    if (indicePagina === 0) {
      nomeCurso = limpar(documento.querySelector("h1")?.textContent)
        || limpar(documento.querySelector("title")?.textContent)
        || nomeSemExtensao(pagina.nome)
        || nomeCurso;
      descricaoCurso = limpar(documento.querySelector('meta[name="description"]')?.getAttribute("content")) || descricaoCurso;
    }

    const baseUrl = obterBaseUrl(documento);
    const raiz = documento.querySelector("main") || documento.querySelector('[role="main"]') || documento.body;
    if (!raiz) return;

    let tituloDisciplina = "Conteúdo importado";
    let tituloModulo = nomeSemExtensao(pagina.nome) || "Módulo 1";
    const elementos = Array.from(raiz.querySelectorAll("h2,h3,h4,h5,a[href]"));

    for (const elemento of elementos) {
      const tag = elemento.tagName.toLowerCase();
      const textoElemento = limpar(elemento.textContent);

      if (tag === "h2" && textoElemento) {
        tituloDisciplina = textoElemento.slice(0, 180);
        tituloModulo = "Módulo 1";
        continue;
      }
      if ((tag === "h3" || tag === "h4" || tag === "h5") && textoElemento) {
        tituloModulo = textoElemento.slice(0, 180);
        continue;
      }
      if (tag !== "a") continue;

      const tituloAula = textoElemento
        || limpar(elemento.getAttribute("title"))
        || limpar(elemento.getAttribute("aria-label"));
      if (!tituloAula || tituloAula.length < 2 || IGNORAR_TEXTO.test(tituloAula)) continue;

      const href = limpar(elemento.getAttribute("href"));
      const url = resolverUrlHttps(href, baseUrl);
      if (!url) {
        if (href && !href.startsWith("#") && !/^(javascript:|mailto:|tel:)/i.test(href)) {
          relatorio.linksInvalidosIgnorados += 1;
        }
        continue;
      }
      if (urlsVistas.has(url)) {
        relatorio.duplicadasIgnoradas += 1;
        continue;
      }
      urlsVistas.add(url);

      const disciplina = obterOuCriarDisciplina(disciplinas, tituloDisciplina);
      const modulo = obterOuCriarModulo(disciplina, tituloModulo);
      modulo.aulas.push({
        titulo: tituloAula.slice(0, 200),
        descricao: "",
        tipo: inferirTipo(url, tituloAula),
        url,
        duracaoMinutos: null,
      });
      relatorio.aulasImportadas += 1;
    }
  });

  const disciplinasLimpas = disciplinas
    .map((disciplina) => ({
      ...disciplina,
      modulos: disciplina.modulos.filter((modulo) => modulo.aulas.length > 0),
    }))
    .filter((disciplina) => disciplina.modulos.length > 0);

  if (!disciplinasLimpas.length || relatorio.aulasImportadas === 0) {
    throw new Error("Não encontrei links de aulas utilizáveis nesse arquivo. Salve a página completa já com a grade do curso aberta ou use o JSON/script de captura.");
  }

  if (relatorio.linksInvalidosIgnorados > 0) {
    relatorio.avisos.push(`${relatorio.linksInvalidosIgnorados} link(s) relativo(s) ou inválido(s) foram ignorados por não ser possível convertê-los com segurança para HTTPS.`);
  }
  if (relatorio.duplicadasIgnoradas > 0) {
    relatorio.avisos.push(`${relatorio.duplicadasIgnoradas} link(s) duplicado(s) foram removidos automaticamente.`);
  }

  return {
    rascunho: {
      nome: nomeCurso.slice(0, 180),
      descricao: descricaoCurso.slice(0, 500),
      disciplinas: disciplinasLimpas,
    },
    relatorio,
  };
}

function obterOuCriarDisciplina(disciplinas: DisciplinaMutavel[], titulo: string) {
  const normalizado = chave(titulo || "Conteúdo importado");
  let disciplina = disciplinas.find((item) => chave(item.titulo) === normalizado);
  if (!disciplina) {
    disciplina = { titulo: titulo || "Conteúdo importado", descricao: "", modulos: [] };
    disciplinas.push(disciplina);
  }
  return disciplina;
}

function obterOuCriarModulo(disciplina: DisciplinaMutavel, titulo: string) {
  const normalizado = chave(titulo || "Módulo 1");
  let modulo = disciplina.modulos.find((item) => chave(item.titulo) === normalizado);
  if (!modulo) {
    modulo = { titulo: titulo || "Módulo 1", descricao: "", aulas: [] };
    disciplina.modulos.push(modulo);
  }
  return modulo;
}

function obterBaseUrl(documento: Document) {
  const candidatos = [
    documento.querySelector("base[href]")?.getAttribute("href"),
    documento.querySelector('link[rel="canonical"][href]')?.getAttribute("href"),
    documento.querySelector('meta[property="og:url"]')?.getAttribute("content"),
  ];
  for (const candidato of candidatos) {
    const valor = limpar(candidato);
    if (/^https:\/\//i.test(valor)) return valor;
  }
  return "";
}

function resolverUrlHttps(href: string, baseUrl: string) {
  if (!href || href.startsWith("#") || /^(javascript:|mailto:|tel:)/i.test(href)) return "";
  try {
    const url = baseUrl ? new URL(href, baseUrl) : new URL(href);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function inferirTipo(url: string, titulo: string): AulaMutavel["tipo"] {
  const alvo = `${url} ${titulo}`.toLowerCase();
  if (/\.(pdf|docx?|pptx?|xlsx?)(?:$|[?#])/.test(alvo) || /(apostila|material|pdf)/.test(alvo)) return "material";
  if (/(youtube\.com|youtu\.be|vimeo\.com|video|aula)/.test(alvo)) return "video";
  return "link";
}

async function extrairHtmlDoZip(buffer: ArrayBuffer): Promise<PaginaHtml[]> {
  const view = new DataView(buffer);
  const fimCentral = localizarAssinaturaReversa(view, 0x06054b50, Math.max(0, view.byteLength - 0x10000 - 22));
  if (fimCentral < 0) throw new Error("ZIP inválido ou incompatível.");

  const totalEntradas = view.getUint16(fimCentral + 10, true);
  const inicioCentral = view.getUint32(fimCentral + 16, true);
  const decoder = new TextDecoder("utf-8");
  const paginas: PaginaHtml[] = [];
  let totalExpandido = 0;
  let posicao = inicioCentral;

  for (let i = 0; i < totalEntradas && paginas.length < LIMITE_ENTRADAS_HTML; i += 1) {
    if (posicao + 46 > view.byteLength || view.getUint32(posicao, true) !== 0x02014b50) break;
    const metodo = view.getUint16(posicao + 10, true);
    const tamanhoComprimido = view.getUint32(posicao + 20, true);
    const tamanhoOriginal = view.getUint32(posicao + 24, true);
    const nomeLen = view.getUint16(posicao + 28, true);
    const extraLen = view.getUint16(posicao + 30, true);
    const comentarioLen = view.getUint16(posicao + 32, true);
    const offsetLocal = view.getUint32(posicao + 42, true);
    const nomeBytes = new Uint8Array(buffer, posicao + 46, nomeLen);
    const nome = decoder.decode(nomeBytes);

    if (!nome.endsWith("/") && /\.html?$/i.test(nome)) {
      totalExpandido += tamanhoOriginal;
      if (totalExpandido > LIMITE_HTML_EXPANDIDO) {
        throw new Error("O ZIP expande para HTML demais. O limite é 12 MB de páginas HTML.");
      }
      const html = await extrairEntradaZip(buffer, view, offsetLocal, tamanhoComprimido, metodo);
      paginas.push({ nome, html });
    }
    posicao += 46 + nomeLen + extraLen + comentarioLen;
  }

  return paginas;
}

async function extrairEntradaZip(
  buffer: ArrayBuffer,
  view: DataView,
  offsetLocal: number,
  tamanhoComprimido: number,
  metodo: number,
) {
  if (offsetLocal + 30 > view.byteLength || view.getUint32(offsetLocal, true) !== 0x04034b50) {
    throw new Error("ZIP com entrada HTML inválida.");
  }
  const nomeLen = view.getUint16(offsetLocal + 26, true);
  const extraLen = view.getUint16(offsetLocal + 28, true);
  const inicioDados = offsetLocal + 30 + nomeLen + extraLen;
  const fimDados = inicioDados + tamanhoComprimido;
  if (fimDados > buffer.byteLength) throw new Error("ZIP corrompido: conteúdo incompleto.");

  const dados = new Uint8Array(buffer.slice(inicioDados, fimDados));
  if (metodo === 0) return new TextDecoder("utf-8").decode(dados);
  if (metodo !== 8) throw new Error("O ZIP usa uma compactação não suportada. Recompacte usando ZIP padrão.");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Seu navegador não consegue abrir ZIP localmente. Extraia o arquivo e selecione o HTML diretamente.");
  }

  const fluxo = new Blob([dados]).stream().pipeThrough(
    new DecompressionStream("deflate-raw" as unknown as CompressionFormat),
  );
  const descompactado = await new Response(fluxo).arrayBuffer();
  return new TextDecoder("utf-8").decode(descompactado);
}

function localizarAssinaturaReversa(view: DataView, assinatura: number, limiteInferior: number) {
  for (let i = view.byteLength - 22; i >= limiteInferior; i -= 1) {
    if (view.getUint32(i, true) === assinatura) return i;
  }
  return -1;
}

function nomeSemExtensao(nome: string) {
  const ultimo = nome.split(/[\\/]/).pop() || "";
  return ultimo.replace(/\.html?$/i, "").replace(/[-_]+/g, " ").trim();
}

function chave(valor: string) {
  return limpar(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function limpar(valor: string | null | undefined) {
  return (valor || "").replace(/\s+/g, " ").trim();
}
