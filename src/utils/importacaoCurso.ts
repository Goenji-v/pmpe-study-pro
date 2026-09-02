import type { Assunto, Materia, Modulo } from "../types";
import type {
  CapturaCurso,
  CursoAula,
  CursoImportado,
  CursoMateria,
  CursoModulo,
  ItemCapturaCurso,
} from "../types/cursos";

const MATERIAS_CONHECIDAS: Array<{ nome: string; expressoes: RegExp[] }> = [
  { nome: "Língua Portuguesa", expressoes: [/\bportugu[eê]s\b/i, /l[ií]ngua portuguesa/i, /gram[aá]tica/i] },
  { nome: "Raciocínio Lógico e Matemática", expressoes: [/racioc[ií]nio l[oó]gico/i, /\brlm\b/i, /\bmatem[aá]tica\b/i] },
  { nome: "Informática", expressoes: [/inform[aá]tica/i, /tecnologia da informa[cç][aã]o/i, /fundamentos da computa[cç][aã]o/i] },
  { nome: "História", expressoes: [/\bhist[oó]ria\b/i] },
  { nome: "Geografia", expressoes: [/\bgeografia\b/i] },
  { nome: "Direito Constitucional", expressoes: [/constitucional/i] },
  { nome: "Direito Administrativo", expressoes: [/administrativo/i] },
  { nome: "Direito Penal", expressoes: [/(^|\s)direito penal\b/i, /\bpenal\b/i] },
  { nome: "Direito Processual Penal", expressoes: [/processual penal/i, /processo penal/i] },
  { nome: "Direitos Humanos", expressoes: [/direitos humanos/i] },
  { nome: "Legislação Extravagante", expressoes: [/legisla[cç][aã]o extravagante/i, /legisla[cç][aã]o especial/i, /leis especiais/i] },
  { nome: "Redação", expressoes: [/\breda[cç][aã]o\b/i] },
];

const RUIDO = /\b(edital|perfil|minha conta|sair|logout|login|entrar|carrinho|suporte|certificado|ranking|comunidade|grupo\s+live|ao\s+vivo|anota[cç][oõ]es?)\b/i;
const URL_AULA = /\/(lessons?|aulas?|videoaulas?|topics?|conteudos?|course-content|lesson-content)(\/|$)/i;
const URL_CURSO = /\/courses?(\/|$)/i;
const URL_MATERIAL = /\.(pdf|docx?|pptx?|xlsx?|zip)(?:[?#]|$)|\/(downloads?|materiais?|apostilas?)(\/|$)/i;

export function slugCurso(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

export function identificarMateriaCurso(texto: string): string | undefined {
  const limpo = limparTexto(texto);
  if (!limpo || limpo.length > 180) return undefined;
  return MATERIAS_CONHECIDAS.find((m) => m.expressoes.some((r) => r.test(limpo)))?.nome;
}

export function organizarCapturaCurso(captura: CapturaCurso, nomeInformado?: string): CursoImportado {
  const agora = new Date().toISOString();
  const nome = limparTexto(nomeInformado || captura.titulo || "Curso importado");
  const idCurso = `curso-${slugCurso(nome)}-${agora.replace(/\D/g, "").slice(0, 14)}`;
  const materias = new Map<string, CursoMateria>();
  let materiaAtual = "Curso importado";
  let moduloAtual = "Geral";
  let ultimaAula: CursoAula | undefined;

  const garantirMateria = (nomeMateria: string) => {
    const chave = slugCurso(nomeMateria);
    let materia = materias.get(chave);
    if (!materia) {
      materia = { id: `${idCurso}-materia-${chave}`, nome: nomeMateria, ordem: materias.size + 1, modulos: [] };
      materias.set(chave, materia);
    }
    return materia;
  };

  const garantirModulo = (materia: CursoMateria, nomeModulo: string) => {
    const nomeLimpo = limparTexto(nomeModulo) || "Geral";
    const chave = slugCurso(nomeLimpo);
    let modulo = materia.modulos.find((m) => slugCurso(m.nome) === chave);
    if (!modulo) {
      modulo = { id: `${materia.id}-modulo-${chave}-${materia.modulos.length + 1}`, nome: nomeLimpo, ordem: materia.modulos.length + 1, aulas: [] };
      materia.modulos.push(modulo);
    }
    return modulo;
  };

  for (const item of captura.itens.slice(0, 7000)) {
    const texto = limparTexto(item.texto);
    if (!texto || texto.length < 2) continue;
    const materiaDetectada = identificarMateriaCurso(texto);
    const sMateria = pontuarMateria(item, texto, materiaDetectada);
    const sModulo = pontuarModulo(item, texto);
    const sMaterial = pontuarMaterial(item, texto);
    const sAula = pontuarAula(item, texto);

    if (sMateria >= 55 && materiaDetectada) {
      materiaAtual = materiaDetectada;
      moduloAtual = "Geral";
      ultimaAula = undefined;
      garantirMateria(materiaAtual);
      continue;
    }

    if (sModulo >= 50) {
      if (materiaDetectada && sMateria >= 35) materiaAtual = materiaDetectada;
      moduloAtual = limparNomeModulo(texto, materiaAtual);
      ultimaAula = undefined;
      garantirModulo(garantirMateria(materiaAtual), moduloAtual);
      continue;
    }

    if (sMaterial >= 60 && item.href && ultimaAula) {
      const href = normalizarUrl(item.href);
      if (href) {
        const materiais = ultimaAula.materiais ?? [];
        if (!materiais.some((m) => m.url === href || slugCurso(m.nome) === slugCurso(texto))) {
          materiais.push({ id: `${ultimaAula.id}-material-${materiais.length + 1}`, nome: texto.slice(0, 220), tipo: tipoMaterial(texto, href), url: href });
          ultimaAula.materiais = materiais;
        }
      }
      continue;
    }

    if (sAula < 50 || (deveIgnorar(item, texto) && sAula < 80)) continue;
    if (materiaDetectada && materiaAtual === "Curso importado" && sMateria >= 25) materiaAtual = materiaDetectada;

    const modulo = garantirModulo(garantirMateria(materiaAtual), moduloAtual);
    const href = normalizarUrl(item.href);
    const existente = modulo.aulas.find((a) => slugCurso(a.nome) === slugCurso(texto) || Boolean(href && a.url === href));
    if (existente) {
      ultimaAula = existente;
      continue;
    }

    const aula: CursoAula = {
      id: `${modulo.id}-aula-${modulo.aulas.length + 1}-${slugCurso(texto).slice(0, 50)}`,
      nome: texto.slice(0, 220), url: href, ordem: modulo.aulas.length + 1,
    };
    modulo.aulas.push(aula);
    ultimaAula = aula;
  }

  const materiasValidas = [...materias.values()].map((materia) => ({
    ...materia,
    modulos: materia.modulos.map((modulo) => ({ ...modulo, aulas: modulo.aulas.filter((aula) => aula.nome) }))
      .filter((modulo) => modulo.aulas.length > 0),
  })).filter((materia) => materia.modulos.length > 0);

  if (!materiasValidas.length) throw new Error("Não foi possível identificar aulas ou links. Abra a página onde aparecem os módulos/aulas e use o Capturador V2.");
  return { id: idCurso, nome, origem: captura.urlOrigem ? "captura-json" : "texto", urlOrigem: captura.urlOrigem, criadoEm: agora, atualizadoEm: agora, materias: materiasValidas };
}

export function capturaDeTexto(textoOriginal: string, titulo = "Curso importado"): CapturaCurso {
  const linhas = textoOriginal.split(/\r?\n/).map(limparTexto).filter((l) => l.length >= 2).slice(0, 5000);
  return { versao: 2, titulo, itens: linhas.map((texto) => ({ tipo: pareceModulo(texto) || Boolean(identificarMateriaCurso(texto)) ? "cabecalho" : "texto", texto, area: "conteudo" })) };
}

export function capturaDeHtml(html: string, urlOrigem?: string, tituloArquivo?: string): CapturaCurso {
  if (typeof DOMParser === "undefined") throw new Error("A leitura de HTML precisa ser executada no navegador.");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const titulo = limparTexto(doc.title || tituloArquivo || "Curso importado");
  const baseHref = doc.querySelector("base[href]")?.getAttribute("href") || urlOrigem;
  const seletores = "h1,h2,h3,h4,h5,h6,[role='heading'],a[href],button,[data-title],[class*='aula'],[class*='lesson'],[class*='modulo'],[class*='module']";
  const vistos = new Set<string>();
  const itens: ItemCapturaCurso[] = [];
  for (const elemento of Array.from(doc.querySelectorAll(seletores)).slice(0, 7000)) {
    const item = itemDeElemento(elemento, baseHref);
    if (!item) continue;
    const chave = `${item.tipo}|${slugCurso(item.texto)}|${item.href || ""}|${item.containerKey || ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push(item);
  }
  return { versao: 2, titulo, urlOrigem, itens };
}

export async function extrairCursoDeArquivo(file: File): Promise<CursoImportado> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".zip")) throw new Error("ZIP ainda não é lido diretamente. Use HTML/MHTML ou o Capturador.");
  if (nome.endsWith(".pdf")) throw new Error("Para curso em PDF, copie a grade como texto. Para preservar links, use o Capturador.");
  const texto = await file.text();
  if (nome.endsWith(".json")) {
    const bruto = JSON.parse(texto) as unknown;
    if (ehCursoImportado(bruto)) return normalizarCursoRecebido(bruto, file.name);
    if (ehCapturaCurso(bruto)) return { ...organizarCapturaCurso(bruto, bruto.titulo || removerExtensao(file.name)), origem: "captura-json", nomeArquivo: file.name };
    throw new Error("O JSON não está no formato de curso ou captura do Study Pro.");
  }
  if (nome.endsWith(".mhtml") || nome.endsWith(".mht")) {
    const mhtml = extrairHtmlDoMhtml(texto);
    return { ...organizarCapturaCurso(capturaDeHtml(mhtml.html, mhtml.urlOrigem, removerExtensao(file.name))), origem: "mhtml", nomeArquivo: file.name };
  }
  if (nome.endsWith(".html") || nome.endsWith(".htm")) {
    return { ...organizarCapturaCurso(capturaDeHtml(texto, undefined, removerExtensao(file.name))), origem: "html", nomeArquivo: file.name };
  }
  return { ...organizarCapturaCurso(capturaDeTexto(texto, removerExtensao(file.name))), origem: "texto", nomeArquivo: file.name };
}

export function aplicarCursosAtivosNasMaterias(materiasAtuais: Materia[], cursos: CursoImportado[], ativosIds: string[]): Materia[] {
  const progresso = mapearProgressoDosCursos(materiasAtuais);
  const base = removerModulosDeCursos(materiasAtuais);
  for (const curso of cursos.filter((c) => ativosIds.includes(c.id))) {
    for (const materiaCurso of curso.materias) {
      const chave = slugCurso(materiaCurso.nome);
      let indice = base.findIndex((m) => slugCurso(m.nome) === chave);
      if (indice < 0) { base.push({ id: `curso-materia-${chave}`, nome: materiaCurso.nome, modulos: [], assuntos: [] }); indice = base.length - 1; }
      const atual = base[indice];
      const modulos = [...(atual.modulos ?? []), ...materiaCurso.modulos.map((m) => converterModuloCurso(curso, materiaCurso, m, progresso))];
      base[indice] = { ...atual, modulos, assuntos: modulos.flatMap((m) => m.assuntos) };
    }
  }
  return base.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function sincronizarProgressoCursos(cursos: CursoImportado[], materias: Materia[]): CursoImportado[] {
  const progresso = mapearProgressoDosCursos(materias);
  return cursos.map((curso) => ({ ...curso, materias: curso.materias.map((materia) => ({ ...materia, modulos: materia.modulos.map((modulo) => ({ ...modulo, aulas: modulo.aulas.map((aula) => {
    const salvo = progresso.get(chaveProgresso(curso.id, materia.nome, aula.nome));
    return salvo ? { ...aula, concluida: salvo.concluido, concluidaEm: salvo.concluidoEm } : aula;
  }) })) })) }));
}

export function criarCodigoCapturadorCurso(): string {
  const codigo = `(function(){
const clean=s=>(s||'').replace(/\\s+/g,' ').trim();
const area=e=>{if(e.closest('nav,aside,[role="navigation"],[class*="sidebar"],[class*="menu"]'))return'menu';if(e.closest('header,[role="banner"]'))return'cabecalho';if(e.closest('footer,[role="contentinfo"]'))return'rodape';if(e.closest('main,article,[role="main"],[class*="content"],[class*="course"],[class*="lesson"]'))return'conteudo';return'desconhecida'};
const container=e=>{const c=e.closest('[id],[data-id],[data-module],[data-section],[class*="module"],[class*="modulo"],[class*="accordion"],[class*="section"],[class*="lesson"],[class*="aula"]');if(!c)return;return clean(c.id||c.getAttribute('data-id')||c.getAttribute('data-module')||c.getAttribute('data-section')||c.className).slice(0,180)};
const q='h1,h2,h3,h4,h5,h6,[role="heading"],a[href],button,[data-title],[class*="aula"],[class*="lesson"],[class*="modulo"],[class*="module"]';const seen=new Set(),itens=[];
[...document.querySelectorAll(q)].slice(0,7000).forEach(e=>{const t=clean(e.innerText||e.textContent||e.getAttribute('data-title'));if(!t||t.length<2||t.length>260)return;const tag=e.tagName.toLowerCase();let href;if(tag==='a'){try{href=new URL(e.getAttribute('href'),location.href).href}catch(_){}}const tipo=/^h[1-6]$/.test(tag)||e.getAttribute('role')==='heading'?'cabecalho':href?'link':'texto';const p=e.parentElement;const k=[tipo,t,href||'',container(e)||''].join('|');if(seen.has(k))return;seen.add(k);itens.push({tipo,texto:t,href,nivel:/^h[1-6]$/.test(tag)?Number(tag.slice(1)):undefined,tag,role:e.getAttribute('role')||undefined,classes:clean(typeof e.className==='string'?e.className:'').slice(0,240)||undefined,parentTag:p?p.tagName.toLowerCase():undefined,parentClasses:p&&typeof p.className==='string'?clean(p.className).slice(0,240)||undefined:undefined,containerKey:container(e),area:area(e),top:Math.round(e.getBoundingClientRect().top+scrollY)})});
const dados={versao:2,titulo:document.title,urlOrigem:location.href,capturadoEm:new Date().toISOString(),itens};const blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='study-pro-curso-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})();`;
  return `javascript:${codigo}`;
}

function pontuarMateria(item: ItemCapturaCurso, texto: string, materia?: string) {
  if (!materia) return -100;
  let s = pareceTituloDeMateria(texto, materia) ? 45 : 15;
  if (item.tipo === "cabecalho" || item.tipo === "titulo") s += 20;
  if (item.area === "conteudo") s += 10;
  if (item.area === "menu") s -= 20;
  if (item.href && URL_CURSO.test(item.href) && !URL_AULA.test(item.href)) s += 15;
  if (item.href && URL_AULA.test(item.href)) s -= 35;
  return s;
}

function pontuarModulo(item: ItemCapturaCurso, texto: string) {
  let s = 0;
  const heading = item.tipo === "cabecalho" || item.tipo === "titulo";
  if (pareceModulo(texto)) s += 60;
  if (heading) s += 25;
  if (heading && item.nivel && item.nivel >= 2 && item.nivel <= 5 && texto.length <= 100) s += 15;
  if (item.containerKey && /module|modulo|módulo|accordion|section|secao|seção/i.test(item.containerKey)) s += 20;
  if (item.area === "conteudo") s += 15;
  if (item.area === "menu") s -= 45;
  if (item.href && URL_AULA.test(item.href)) s -= 70;
  if (RUIDO.test(texto)) s -= 80;
  if (!pareceModulo(texto) && !heading) s -= 30;
  return s;
}

function pontuarAula(item: ItemCapturaCurso, texto: string) {
  const href = item.href || "";
  let s = 0;
  if (href && URL_AULA.test(href)) s += 65;
  if (pareceAula(texto)) s += 30;
  if (item.tipo === "link" && href) s += 15;
  if (item.area === "conteudo") s += 20;
  if (item.containerKey && /lesson|aula|module|modulo|accordion|section/i.test(item.containerKey)) s += 10;
  if (item.area === "menu") s -= 60;
  if (item.area === "cabecalho" || item.area === "rodape") s -= 80;
  if (href && URL_CURSO.test(href) && !URL_AULA.test(href)) s -= 45;
  if (RUIDO.test(texto) && !URL_AULA.test(href)) s -= 60;
  if (!item.area && item.tipo === "texto" && pareceAula(texto)) s += 30;
  if (!item.area && item.tipo === "link" && href && !URL_CURSO.test(href)) s += 20;
  return s;
}

function pontuarMaterial(item: ItemCapturaCurso, texto: string) {
  if (!item.href) return -100;
  let s = 0;
  if (URL_MATERIAL.test(item.href)) s += 70;
  if (/\b(pdf|apostila|material complementar|download|slides?|resumo)\b/i.test(texto)) s += 35;
  if (item.area === "conteudo") s += 15;
  if (item.area === "menu") s -= 60;
  if (URL_AULA.test(item.href)) s -= 40;
  return s;
}

function deveIgnorar(item: ItemCapturaCurso, texto: string) {
  if (item.area === "cabecalho" || item.area === "rodape") return true;
  if (item.area === "menu" && !URL_AULA.test(item.href || "")) return true;
  return RUIDO.test(texto) && !URL_AULA.test(item.href || "");
}

function itemDeElemento(elemento: Element, base?: string): ItemCapturaCurso | undefined {
  const texto = limparTexto(elemento.textContent || elemento.getAttribute("data-title") || "");
  if (!texto || texto.length < 2 || texto.length > 260) return undefined;
  const tag = elemento.tagName.toLowerCase();
  const href = resolverUrl(tag === "a" ? elemento.getAttribute("href") || undefined : undefined, base);
  const tipo: ItemCapturaCurso["tipo"] = /^h[1-6]$/.test(tag) || elemento.getAttribute("role") === "heading" ? "cabecalho" : href ? "link" : "texto";
  const pai = elemento.parentElement;
  return { tipo, texto, href, nivel: /^h[1-6]$/.test(tag) ? Number(tag.slice(1)) : undefined, tag,
    role: elemento.getAttribute("role") || undefined,
    classes: limparTexto(typeof elemento.className === "string" ? elemento.className : "").slice(0, 240) || undefined,
    parentTag: pai?.tagName.toLowerCase(), parentClasses: limparTexto(typeof pai?.className === "string" ? pai.className : "").slice(0, 240) || undefined,
    containerKey: obterContainerKey(elemento), area: detectarArea(elemento) };
}

function detectarArea(e: Element): ItemCapturaCurso["area"] {
  if (e.closest("nav,aside,[role='navigation'],[class*='sidebar'],[class*='menu']")) return "menu";
  if (e.closest("header,[role='banner']")) return "cabecalho";
  if (e.closest("footer,[role='contentinfo']")) return "rodape";
  if (e.closest("main,article,[role='main'],[class*='content'],[class*='course'],[class*='lesson']")) return "conteudo";
  return "desconhecida";
}

function obterContainerKey(e: Element) {
  const c = e.closest("[id],[data-id],[data-module],[data-section],[class*='module'],[class*='modulo'],[class*='accordion'],[class*='section'],[class*='lesson'],[class*='aula']");
  if (!c) return undefined;
  return limparTexto(c.id || c.getAttribute("data-id") || c.getAttribute("data-module") || c.getAttribute("data-section") || (typeof c.className === "string" ? c.className : "")).slice(0, 180) || undefined;
}

function tipoMaterial(texto: string, href: string): "pdf" | "download" | "material" | "link" {
  if (/\.pdf(?:[?#]|$)/i.test(href) || /\bpdf\b/i.test(texto)) return "pdf";
  if (/\/downloads?(\/|$)/i.test(href) || /\bdownload\b/i.test(texto)) return "download";
  if (/\b(material|apostila|resumo|slide)\b/i.test(texto)) return "material";
  return "link";
}

function converterModuloCurso(curso: CursoImportado, materia: CursoMateria, modulo: CursoModulo, progresso: Map<string, { concluido: boolean; concluidoEm?: string }>): Modulo {
  const assuntos: Assunto[] = modulo.aulas.map((aula) => {
    const salvo = progresso.get(chaveProgresso(curso.id, materia.nome, aula.nome));
    const concluido = salvo?.concluido ?? aula.concluida ?? false;
    const concluidoEm = salvo?.concluidoEm ?? aula.concluidoEm;
    const id = `curso:${curso.id}:aula:${aula.id}`;
    return { id, nome: aula.nome, concluido, concluidoEm, prioridade: "media", aula: aula.url, aulas: [{ id: `${id}:link`, nome: aula.nome, url: aula.url, ordem: 1, concluida: concluido, concluidaEm: concluidoEm }] };
  });
  return { id: `curso:${curso.id}:modulo:${modulo.id}`, nome: `${curso.nome} · ${modulo.nome}`, ordem: modulo.ordem, assuntos };
}

function removerModulosDeCursos(materias: Materia[]): Materia[] {
  return materias.flatMap((materia) => {
    const modulos = (materia.modulos ?? []).filter((m) => !m.id.startsWith("curso:"));
    if (materia.id.startsWith("curso-materia-") && !modulos.length) return [];
    return [{ ...materia, modulos, assuntos: modulos.length ? modulos.flatMap((m) => m.assuntos) : materia.assuntos.filter((a) => !a.id.startsWith("curso:")) }];
  });
}

function mapearProgressoDosCursos(materias: Materia[]) {
  const mapa = new Map<string, { concluido: boolean; concluidoEm?: string }>();
  for (const materia of materias) for (const modulo of materia.modulos ?? []) {
    const cursoId = modulo.id.match(/^curso:(.+?):modulo:/)?.[1];
    if (!cursoId) continue;
    for (const assunto of modulo.assuntos) mapa.set(chaveProgresso(cursoId, materia.nome, assunto.nome), { concluido: assunto.concluido, concluidoEm: assunto.concluidoEm });
  }
  return mapa;
}

function chaveProgresso(cursoId: string, materia: string, aula: string) { return `${cursoId}|${slugCurso(materia)}|${slugCurso(aula)}`; }
function pareceTituloDeMateria(texto: string, materia: string) { const a = slugCurso(texto), b = slugCurso(materia); return a === b || a.startsWith(`${b}-`) || a.length <= b.length + 24; }
function pareceModulo(texto: string) { return /\b(m[oó]dulo|unidade|bloco|cap[ií]tulo|trilha|disciplina)\b/i.test(texto); }
function pareceAula(texto: string) { return /\b(aula|videoaula|v[ií]deo|parte\s*\d+)\b/i.test(texto) || /^\d+[.)-]\s+/.test(texto); }
function limparNomeModulo(texto: string, materia: string) { const limpo = limparTexto(texto).replace(/^\s*(m[oó]dulo|unidade|bloco|cap[ií]tulo|trilha|disciplina)\s*\d*\s*[-:–—]?\s*/i, "").trim(); return !limpo || slugCurso(limpo) === slugCurso(materia) ? "Geral" : limpo.slice(0, 160); }
function limparTexto(valor: string) { return String(valor || "").replace(/\s+/g, " ").trim(); }
function normalizarUrl(url?: string) { if (!url) return undefined; const x = url.trim(); return /^https?:\/\//i.test(x) ? x.slice(0, 2000) : undefined; }
function resolverUrl(href?: string, base?: string) { if (!href || href.startsWith("javascript:") || href.startsWith("#")) return undefined; try { return base ? new URL(href, base).href : /^https?:\/\//i.test(href) ? href : undefined; } catch { return undefined; } }
function removerExtensao(nome: string) { return nome.replace(/\.(html?|mhtml|mht|json|txt)$/i, ""); }
function ehCapturaCurso(valor: unknown): valor is CapturaCurso { if (!valor || typeof valor !== "object") return false; const v = valor as Partial<CapturaCurso>; return (v.versao === 1 || v.versao === 2) && Array.isArray(v.itens); }
function ehCursoImportado(valor: unknown): valor is CursoImportado { if (!valor || typeof valor !== "object") return false; const v = valor as Partial<CursoImportado>; return typeof v.nome === "string" && Array.isArray(v.materias); }
function normalizarCursoRecebido(curso: CursoImportado, nomeArquivo: string): CursoImportado { const agora = new Date().toISOString(); return { ...curso, id: curso.id || `curso-${slugCurso(curso.nome)}-${Date.now()}`, origem: "captura-json", nomeArquivo, criadoEm: curso.criadoEm || agora, atualizadoEm: agora }; }

function extrairHtmlDoMhtml(texto: string): { html: string; urlOrigem?: string } {
  const boundary = texto.slice(0, 5000).match(/boundary\s*=\s*(?:"([^"]+)"|([^;\r\n]+))/i)?.slice(1).find(Boolean)?.trim();
  if (!boundary) throw new Error("Não foi possível identificar a estrutura do MHTML.");
  for (const parte of texto.split(`--${boundary}`)) {
    if (!/content-type:\s*text\/html/i.test(parte)) continue;
    const sep = parte.search(/\r?\n\r?\n/); if (sep < 0) continue;
    const headers = parte.slice(0, sep); let corpo = parte.slice(sep).replace(/^\r?\n\r?\n/, "");
    const urlOrigem = headers.match(/content-location:\s*([^\r\n]+)/i)?.[1]?.trim();
    const encoding = headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();
    if (encoding === "base64") { const bin = atob(corpo.replace(/\s+/g, "")); corpo = new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
    if (encoding === "quoted-printable") { const sem = corpo.replace(/=\r?\n/g, ""); const bytes: number[] = []; for (let i = 0; i < sem.length; i++) { if (sem[i] === "=" && /^[0-9A-F]{2}$/i.test(sem.slice(i + 1, i + 3))) { bytes.push(parseInt(sem.slice(i + 1, i + 3), 16)); i += 2; } else bytes.push(sem.charCodeAt(i)); } corpo = new TextDecoder("utf-8").decode(Uint8Array.from(bytes)); }
    return { html: corpo, urlOrigem };
  }
  throw new Error("O MHTML não contém uma página HTML legível.");
}