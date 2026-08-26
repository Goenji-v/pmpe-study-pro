import type { Assunto, Materia, Modulo } from "../types";
import type {
  CapturaCurso,
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

export function slugCurso(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

export function identificarMateriaCurso(texto: string): string | undefined {
  const limpo = limparTexto(texto);
  if (!limpo || limpo.length > 180) return undefined;

  return MATERIAS_CONHECIDAS.find((materia) =>
    materia.expressoes.some((expressao) => expressao.test(limpo))
  )?.nome;
}

export function organizarCapturaCurso(
  captura: CapturaCurso,
  nomeInformado?: string
): CursoImportado {
  const agora = new Date().toISOString();
  const nome = limparTexto(nomeInformado || captura.titulo || "Curso importado");
  const idCurso = `curso-${slugCurso(nome)}-${agora.replace(/\D/g, "").slice(0, 14)}`;
  const materias = new Map<string, CursoMateria>();
  let materiaAtual = "Curso importado";
  let moduloAtual = "Geral";

  const garantirMateria = (nomeMateria: string) => {
    const chave = slugCurso(nomeMateria);
    let materia = materias.get(chave);
    if (!materia) {
      materia = {
        id: `${idCurso}-materia-${chave}`,
        nome: nomeMateria,
        ordem: materias.size + 1,
        modulos: [],
      };
      materias.set(chave, materia);
    }
    return materia;
  };

  const garantirModulo = (materia: CursoMateria, nomeModulo: string) => {
    const chave = slugCurso(nomeModulo);
    let modulo = materia.modulos.find((item) => slugCurso(item.nome) === chave);
    if (!modulo) {
      modulo = {
        id: `${materia.id}-modulo-${chave}-${materia.modulos.length + 1}`,
        nome: nomeModulo,
        ordem: materia.modulos.length + 1,
        aulas: [],
      };
      materia.modulos.push(modulo);
    }
    return modulo;
  };

  for (const item of captura.itens.slice(0, 5000)) {
    const texto = limparTexto(item.texto);
    if (!texto || texto.length < 2) continue;

    const materiaDetectada = identificarMateriaCurso(texto);
    const ehCabecalho = item.tipo === "titulo" || item.tipo === "cabecalho";

    if (ehCabecalho && materiaDetectada && pareceTituloDeMateria(texto, materiaDetectada)) {
      materiaAtual = materiaDetectada;
      moduloAtual = "Geral";
      garantirMateria(materiaAtual);
      continue;
    }

    if (ehCabecalho && pareceModulo(texto)) {
      if (materiaDetectada) materiaAtual = materiaDetectada;
      moduloAtual = limparNomeModulo(texto, materiaAtual);
      garantirModulo(garantirMateria(materiaAtual), moduloAtual);
      continue;
    }

    if (ehCabecalho && !item.href && texto.length <= 90 && !pareceAula(texto)) {
      if (materiaDetectada) {
        materiaAtual = materiaDetectada;
        moduloAtual = "Geral";
      } else if (materiaAtual !== "Curso importado") {
        moduloAtual = texto;
      }
      continue;
    }

    const candidatoAula = Boolean(item.href) || pareceAula(texto) || item.tipo === "texto";
    if (!candidatoAula) continue;

    if (materiaDetectada && materiaAtual === "Curso importado") {
      materiaAtual = materiaDetectada;
    }

    if (materiaDetectada && !pareceAula(texto) && texto.length < 55 && item.tipo === "link") {
      materiaAtual = materiaDetectada;
      moduloAtual = "Geral";
      garantirMateria(materiaAtual);
      continue;
    }

    const materia = garantirMateria(materiaAtual);
    const modulo = garantirModulo(materia, moduloAtual);
    const href = normalizarUrl(item.href);
    const duplicada = modulo.aulas.some((aula) =>
      slugCurso(aula.nome) === slugCurso(texto) || Boolean(href && aula.url === href)
    );
    if (duplicada) continue;

    modulo.aulas.push({
      id: `${modulo.id}-aula-${modulo.aulas.length + 1}-${slugCurso(texto).slice(0, 50)}`,
      nome: texto.slice(0, 220),
      url: href,
      ordem: modulo.aulas.length + 1,
    });
  }

  const materiasValidas = [...materias.values()]
    .map((materia) => ({
      ...materia,
      modulos: materia.modulos
        .map((modulo) => ({ ...modulo, aulas: modulo.aulas.filter((aula) => aula.nome) }))
        .filter((modulo) => modulo.aulas.length > 0),
    }))
    .filter((materia) => materia.modulos.length > 0);

  if (materiasValidas.length === 0) {
    throw new Error("Não foi possível identificar aulas ou links no arquivo. Tente salvar a página completa ou usar o Capturador do Study Pro.");
  }

  return {
    id: idCurso,
    nome: nome || "Curso importado",
    origem: captura.urlOrigem ? "captura-json" : "texto",
    urlOrigem: captura.urlOrigem,
    criadoEm: agora,
    atualizadoEm: agora,
    materias: materiasValidas,
  };
}

export function capturaDeTexto(textoOriginal: string, titulo = "Curso importado"): CapturaCurso {
  const linhas = textoOriginal
    .split(/\r?\n/)
    .map(limparTexto)
    .filter((linha) => linha.length >= 2)
    .slice(0, 5000);

  return {
    versao: 1,
    titulo,
    itens: linhas.map((texto) => ({
      tipo: pareceModulo(texto) || Boolean(identificarMateriaCurso(texto)) ? "cabecalho" : "texto",
      texto,
    })),
  };
}

export function capturaDeHtml(html: string, urlOrigem?: string, tituloArquivo?: string): CapturaCurso {
  if (typeof DOMParser === "undefined") {
    throw new Error("A leitura de HTML precisa ser executada no navegador.");
  }

  const documento = new DOMParser().parseFromString(html, "text/html");
  const titulo = limparTexto(documento.title || tituloArquivo || "Curso importado");
  const baseHref = documento.querySelector("base[href]")?.getAttribute("href") || urlOrigem;
  const seletores = "h1,h2,h3,h4,h5,h6,[role='heading'],a[href],button,[data-title],[class*='aula'],[class*='lesson']";
  const vistos = new Set<string>();
  const itens: ItemCapturaCurso[] = [];

  for (const elemento of Array.from(documento.querySelectorAll(seletores)).slice(0, 7000)) {
    const texto = limparTexto(elemento.textContent || elemento.getAttribute("data-title") || "");
    if (!texto || texto.length < 2 || texto.length > 260) continue;

    const tag = elemento.tagName.toLowerCase();
    const hrefBruto = tag === "a" ? elemento.getAttribute("href") || undefined : undefined;
    const href = resolverUrl(hrefBruto, baseHref);
    const tipo: ItemCapturaCurso["tipo"] = /^h[1-6]$/.test(tag) || elemento.getAttribute("role") === "heading"
      ? "cabecalho"
      : href
        ? "link"
        : "texto";
    const chave = `${tipo}|${slugCurso(texto)}|${href || ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    itens.push({
      tipo,
      texto,
      href,
      nivel: /^h[1-6]$/.test(tag) ? Number(tag.slice(1)) : undefined,
    });
  }

  return { versao: 1, titulo, urlOrigem, itens };
}

export async function extrairCursoDeArquivo(file: File): Promise<CursoImportado> {
  const nomeMinusculo = file.name.toLowerCase();
  if (nomeMinusculo.endsWith(".zip")) {
    throw new Error("ZIP ainda não é lido diretamente. Abra o ZIP e envie o HTML/MHTML principal ou use o Capturador do Study Pro.");
  }
  if (nomeMinusculo.endsWith(".pdf")) {
    throw new Error("Para curso em PDF, copie a grade/cronograma como texto nesta tela. O importador de site preserva os links quando você usa HTML, MHTML ou o Capturador.");
  }

  const texto = await file.text();

  if (nomeMinusculo.endsWith(".json")) {
    const bruto = JSON.parse(texto) as unknown;
    if (ehCursoImportado(bruto)) {
      return normalizarCursoRecebido(bruto, file.name);
    }
    if (ehCapturaCurso(bruto)) {
      const curso = organizarCapturaCurso(bruto, bruto.titulo || removerExtensao(file.name));
      return { ...curso, origem: "captura-json", nomeArquivo: file.name };
    }
    throw new Error("O JSON não está no formato de curso ou captura do Study Pro.");
  }

  if (nomeMinusculo.endsWith(".mhtml") || nomeMinusculo.endsWith(".mht")) {
    const mhtml = extrairHtmlDoMhtml(texto);
    const captura = capturaDeHtml(mhtml.html, mhtml.urlOrigem, removerExtensao(file.name));
    const curso = organizarCapturaCurso(captura, captura.titulo || removerExtensao(file.name));
    return { ...curso, origem: "mhtml", nomeArquivo: file.name };
  }

  if (nomeMinusculo.endsWith(".html") || nomeMinusculo.endsWith(".htm")) {
    const captura = capturaDeHtml(texto, undefined, removerExtensao(file.name));
    const curso = organizarCapturaCurso(captura, captura.titulo || removerExtensao(file.name));
    return { ...curso, origem: "html", nomeArquivo: file.name };
  }

  const curso = organizarCapturaCurso(capturaDeTexto(texto, removerExtensao(file.name)), removerExtensao(file.name));
  return { ...curso, origem: "texto", nomeArquivo: file.name };
}

export function aplicarCursosAtivosNasMaterias(
  materiasAtuais: Materia[],
  cursos: CursoImportado[],
  ativosIds: string[]
): Materia[] {
  const progresso = mapearProgressoDosCursos(materiasAtuais);
  const base = removerModulosDeCursos(materiasAtuais);
  const ativos = cursos.filter((curso) => ativosIds.includes(curso.id));

  for (const curso of ativos) {
    for (const materiaCurso of curso.materias) {
      const chaveMateria = slugCurso(materiaCurso.nome);
      let indice = base.findIndex((materia) => slugCurso(materia.nome) === chaveMateria);

      if (indice < 0) {
        base.push({ id: `curso-materia-${chaveMateria}`, nome: materiaCurso.nome, modulos: [], assuntos: [] });
        indice = base.length - 1;
      }

      const atual = base[indice];
      const modulosCurso = materiaCurso.modulos.map((modulo) => converterModuloCurso(curso, materiaCurso, modulo, progresso));
      const modulos = [...(atual.modulos ?? []), ...modulosCurso];
      base[indice] = { ...atual, modulos, assuntos: modulos.flatMap((modulo) => modulo.assuntos) };
    }
  }

  return base.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function sincronizarProgressoCursos(
  cursos: CursoImportado[],
  materias: Materia[]
): CursoImportado[] {
  const progresso = mapearProgressoDosCursos(materias);
  return cursos.map((curso) => ({
    ...curso,
    materias: curso.materias.map((materia) => ({
      ...materia,
      modulos: materia.modulos.map((modulo) => ({
        ...modulo,
        aulas: modulo.aulas.map((aula) => {
          const salvo = progresso.get(chaveProgresso(curso.id, materia.nome, aula.nome));
          return salvo ? { ...aula, concluida: salvo.concluido, concluidaEm: salvo.concluidoEm } : aula;
        }),
      })),
    })),
  }));
}

export function criarCodigoCapturadorCurso(): string {
  const codigo = `(function(){const q='h1,h2,h3,h4,h5,h6,[role="heading"],a[href]';const itens=[...document.querySelectorAll(q)].slice(0,7000).map(e=>{const t=(e.innerText||e.textContent||'').replace(/\\s+/g,' ').trim();if(!t||t.length>260)return null;const tag=e.tagName.toLowerCase();let href;if(tag==='a'){try{href=new URL(e.getAttribute('href'),location.href).href}catch(_){}}return{tipo:/^h[1-6]$/.test(tag)||e.getAttribute('role')==='heading'?'cabecalho':href?'link':'texto',texto:t,href,nivel:/^h[1-6]$/.test(tag)?Number(tag.slice(1)):undefined}}).filter(Boolean);const dados={versao:1,titulo:document.title,urlOrigem:location.href,capturadoEm:new Date().toISOString(),itens};const blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='study-pro-curso.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})();`;
  return `javascript:${codigo}`;
}

function converterModuloCurso(
  curso: CursoImportado,
  materia: CursoMateria,
  modulo: CursoModulo,
  progresso: Map<string, { concluido: boolean; concluidoEm?: string }>
): Modulo {
  const assuntos: Assunto[] = modulo.aulas.map((aula) => {
    const salvo = progresso.get(chaveProgresso(curso.id, materia.nome, aula.nome));
    const concluido = salvo?.concluido ?? aula.concluida ?? false;
    const concluidoEm = salvo?.concluidoEm ?? aula.concluidoEm;
    const idAssunto = `curso:${curso.id}:aula:${aula.id}`;
    return {
      id: idAssunto,
      nome: aula.nome,
      concluido,
      concluidoEm,
      prioridade: "media",
      aula: aula.url,
      aulas: [{
        id: `${idAssunto}:link`,
        nome: aula.nome,
        url: aula.url,
        ordem: 1,
        concluida: concluido,
        concluidaEm: concluidoEm,
      }],
    };
  });

  return {
    id: `curso:${curso.id}:modulo:${modulo.id}`,
    nome: `${curso.nome} · ${modulo.nome}`,
    ordem: modulo.ordem,
    assuntos,
  };
}

function removerModulosDeCursos(materias: Materia[]): Materia[] {
  return materias.flatMap((materia) => {
    const modulos = (materia.modulos ?? []).filter((modulo) => !modulo.id.startsWith("curso:"));
    const assuntos = modulos.flatMap((modulo) => modulo.assuntos);
    const materiaCriadaSoPorCurso = materia.id.startsWith("curso-materia-");
    if (materiaCriadaSoPorCurso && modulos.length === 0) return [];
    return [{ ...materia, modulos, assuntos: modulos.length > 0 ? assuntos : materia.assuntos.filter((assunto) => !assunto.id.startsWith("curso:")) }];
  });
}

function mapearProgressoDosCursos(materias: Materia[]) {
  const mapa = new Map<string, { concluido: boolean; concluidoEm?: string }>();
  for (const materia of materias) {
    for (const modulo of materia.modulos ?? []) {
      const cursoId = obterCursoIdDoModulo(modulo.id);
      if (!cursoId) continue;
      for (const assunto of modulo.assuntos) {
        mapa.set(chaveProgresso(cursoId, materia.nome, assunto.nome), {
          concluido: assunto.concluido,
          concluidoEm: assunto.concluidoEm,
        });
      }
    }
  }
  return mapa;
}

function obterCursoIdDoModulo(id: string) {
  const match = id.match(/^curso:(.+?):modulo:/);
  return match?.[1];
}

function chaveProgresso(cursoId: string, materia: string, aula: string) {
  return `${cursoId}|${slugCurso(materia)}|${slugCurso(aula)}`;
}

function pareceTituloDeMateria(texto: string, materia: string) {
  const a = slugCurso(texto);
  const b = slugCurso(materia);
  return a === b || a.startsWith(`${b}-`) || a.length <= b.length + 24;
}

function pareceModulo(texto: string) {
  return /\b(m[oó]dulo|unidade|bloco|cap[ií]tulo|trilha|disciplina)\b/i.test(texto);
}

function pareceAula(texto: string) {
  return /\b(aula|videoaula|v[ií]deo|parte\s*\d+|pdf|material|resumo)\b/i.test(texto) || /^\d+[.)-]\s+/.test(texto);
}

function limparNomeModulo(texto: string, materia: string) {
  const limpo = limparTexto(texto)
    .replace(/^\s*(m[oó]dulo|unidade|bloco)\s*\d*\s*[-:–—]?\s*/i, "")
    .trim();
  if (!limpo || slugCurso(limpo) === slugCurso(materia)) return "Geral";
  return limpo.slice(0, 160);
}

function limparTexto(valor: string) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function normalizarUrl(url?: string) {
  if (!url) return undefined;
  const limpo = url.trim();
  if (!/^https?:\/\//i.test(limpo)) return undefined;
  return limpo.slice(0, 2000);
}

function resolverUrl(href?: string, base?: string) {
  if (!href || href.startsWith("javascript:") || href.startsWith("#")) return undefined;
  try {
    if (base) return new URL(href, base).href;
    return /^https?:\/\//i.test(href) ? href : undefined;
  } catch {
    return undefined;
  }
}

function removerExtensao(nome: string) {
  return nome.replace(/\.(html?|mhtml|mht|json|txt)$/i, "");
}

function ehCapturaCurso(valor: unknown): valor is CapturaCurso {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Partial<CapturaCurso>;
  return item.versao === 1 && Array.isArray(item.itens);
}

function ehCursoImportado(valor: unknown): valor is CursoImportado {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Partial<CursoImportado>;
  return typeof item.nome === "string" && Array.isArray(item.materias);
}

function normalizarCursoRecebido(curso: CursoImportado, nomeArquivo: string): CursoImportado {
  const agora = new Date().toISOString();
  return {
    ...curso,
    id: curso.id || `curso-${slugCurso(curso.nome)}-${Date.now()}`,
    origem: "captura-json",
    nomeArquivo,
    criadoEm: curso.criadoEm || agora,
    atualizadoEm: agora,
  };
}

function extrairHtmlDoMhtml(texto: string): { html: string; urlOrigem?: string } {
  const cabecalho = texto.slice(0, 5000);
  const boundary = cabecalho.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\r\n]+))/i)?.slice(1).find(Boolean)?.trim();
  if (!boundary) throw new Error("Não foi possível identificar a estrutura do MHTML.");

  const partes = texto.split(`--${boundary}`);
  for (const parte of partes) {
    if (!/content-type:\s*text\/html/i.test(parte)) continue;
    const separador = parte.search(/\r?\n\r?\n/);
    if (separador < 0) continue;
    const headers = parte.slice(0, separador);
    let corpo = parte.slice(separador).replace(/^\r?\n\r?\n/, "");
    const urlOrigem = headers.match(/content-location:\s*([^\r\n]+)/i)?.[1]?.trim();
    const encoding = headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();
    if (encoding === "base64") corpo = decodificarBase64(corpo.replace(/\s+/g, ""));
    if (encoding === "quoted-printable") corpo = decodificarQuotedPrintable(corpo);
    return { html: corpo, urlOrigem };
  }
  throw new Error("O MHTML não contém uma página HTML legível.");
}

function decodificarBase64(valor: string) {
  const binario = atob(valor);
  const bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function decodificarQuotedPrintable(valor: string) {
  const semQuebra = valor.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < semQuebra.length; i += 1) {
    if (semQuebra[i] === "=" && /^[0-9A-F]{2}$/i.test(semQuebra.slice(i + 1, i + 3))) {
      bytes.push(parseInt(semQuebra.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(semQuebra.charCodeAt(i));
    }
  }
  return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
}
