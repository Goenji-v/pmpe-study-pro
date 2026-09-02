import type { Assunto, Materia, Modulo } from "../types";
import { classificarOrigemCurso, identificarDisciplina, origemDaAula } from "./classificacaoCurso";
import type {
  CapturaCurso,
  CursoAula,
  CursoImportado,
  CursoMateria,
  CursoModulo,
  ItemCapturaCurso,
} from "../types/cursos";

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
  return identificarDisciplina(limpo);
}

export function organizarCapturaCurso(captura: CapturaCurso, nomeInformado?: string): CursoImportado {
  if (/study\s*pro/i.test(captura.titulo || "") || /^https?:\/\/pmpe-study-pro[^/]*\/cursos(?:[/?#]|$)/i.test(captura.urlOrigem || "")) {
    throw new Error("Este arquivo foi capturado no próprio Study Pro. Execute o Capturador V3 na página principal da plataforma do curso, onde estão os cartões das matérias.");
  }
  if (captura.versao === 3 && captura.paginas?.length) return organizarPaginasCapturadas(captura, nomeInformado);
  const cartoes = captura.itens.filter((item) => /course-link/.test(`${item.classes || ""} ${item.containerKey || ""}`) && item.href && URL_CURSO.test(item.href));
  if (cartoes.length) {
    const quantidade = new Set(cartoes.map((item) => item.href?.split("/lessons/")[0])).size;
    throw new Error(`Este arquivo contém ${quantidade} cartões de matérias, mas não suas grades. Substitua o favorito antigo pelo Capturador V3 e execute uma vez nessa mesma página principal. Ele percorrerá os cartões automaticamente.`);
  }
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
    if (!texto || texto.length < 2 || /^\d+(?:[.,]\d+)?\s*%$/.test(texto)) continue;
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

    if (sMaterial >= 60 && item.href) {
      if (!ultimaAula) continue;
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

  if (!materiasValidas.length) throw new Error("Não foi possível identificar aulas ou links. Use o Capturador V3 na página principal do curso. Se a plataforma não for compatível, o capturador mostrará essa limitação.");
  const avisos = captura.avisos?.length ? captura.avisos : captura.urlOrigem ? ["Captura de uma única página. Aulas de módulos não carregados podem estar ausentes; isso não comprova que o curso inteiro foi capturado."] : [];
  return normalizarClassificacaoCurso({ id: idCurso, nome, origem: captura.urlOrigem ? "captura-json" : "texto", urlOrigem: captura.urlOrigem, criadoEm: agora, atualizadoEm: agora, materias: materiasValidas,
    relatorioCaptura: avisos.length ? { origensEncontradas: 1, origensLidas: 0, pendencias: [], avisos, cancelada: Boolean(captura.cancelada) } : undefined });
}

function organizarPaginasCapturadas(captura: CapturaCurso, nomeInformado?: string): CursoImportado {
  if (!captura.paginas || captura.paginas.length > 100) throw new Error("O JSON excedeu o limite de 100 matérias por importação.");
  const agora = new Date().toISOString();
  const nome = limparTexto(nomeInformado || captura.titulo || "Curso importado");
  const id = `curso-${slugCurso(nome)}-${agora.replace(/\D/g, "").slice(0, 14)}`;
  const materias: CursoMateria[] = [];
  const relatorio = { origensEncontradas: 0, origensLidas: 0, pendencias: [] as Array<{ nome: string; motivo: string }>, avisos: captura.avisos ?? [], cancelada: Boolean(captura.cancelada) };
  const paginasVistas = new Set<string>();
  const origem = normalizarUrl(captura.urlOrigem);
  if (!origem) throw new Error("A captura não informa a página de origem válida.");
  for (const pagina of captura.paginas) {
    const url = normalizarUrl(pagina.url);
    const nomePagina = limparTexto(pagina.nome) || "Matéria sem nome";
    const caminhoCurso = url && new URL(url).pathname.match(/^\/courses\/[^/]+\//)?.[0];
    if (!url || !caminhoCurso || new URL(url).origin !== new URL(origem).origin) {
      relatorio.origensEncontradas++;
      relatorio.pendencias.push({ nome: nomePagina, motivo: "Página de matéria inválida ou de outra plataforma." });
      continue;
    }
    const chave = new URL(url).origin + caminhoCurso;
    if (paginasVistas.has(chave)) continue;
    paginasVistas.add(chave);
    relatorio.origensEncontradas++;
    const materia: CursoMateria = { id: `${id}-materia-${materias.length + 1}`, nome: nomePagina, origemUrl: url, ordem: materias.length + 1, modulos: [] };
    const vistas = new Set<string>();
    let invalidas = 0;
    for (const modulo of pagina.modulos.slice(0, 300)) {
      const idModulo = `${materia.id}-modulo-${materia.modulos.length + 1}`;
      const aulas: CursoAula[] = [];
      for (const aula of modulo.aulas.slice(0, 5000)) {
        const href = normalizarUrl(aula.url);
        const titulo = limparTexto(aula.nome);
        if (!href || !titulo || /^\d+(?:[.,]\d+)?\s*%$/.test(titulo) || new URL(href).origin !== new URL(url).origin || !new URL(href).pathname.startsWith(`${caminhoCurso}lessons/`)) { invalidas++; continue; }
        if (vistas.has(href)) continue;
        vistas.add(href);
        aulas.push({ id: `${idModulo}-aula-${aulas.length + 1}`, nome: titulo.slice(0, 220), url: href, ordem: aulas.length + 1 });
      }
      if (modulo.aulas.length > 5000) invalidas += modulo.aulas.length - 5000;
      if (aulas.length) materia.modulos.push({ id: idModulo, nome: limparTexto(modulo.nome).slice(0, 160) || "Geral", ordem: materia.modulos.length + 1, aulas });
    }
    if (pagina.modulos.length > 300) invalidas++;
    if (materia.modulos.length) materias.push(materia);
    if (pagina.estado === "lida" && materia.modulos.length && !invalidas) relatorio.origensLidas++;
    else relatorio.pendencias.push({ nome: nomePagina, motivo: [pagina.motivo || "Grade incompleta ou sem aulas acessíveis.", invalidas ? `${invalidas} item(ns) inválido(s) ou acima do limite ignorado(s).` : ""].filter(Boolean).join(" ") });
  }
  if (!materias.length) throw new Error(`Nenhuma grade pôde ser importada. ${relatorio.pendencias.slice(0, 3).map(p => `${p.nome}: ${p.motivo}`).join(" ")}`);
  return normalizarClassificacaoCurso({ id, nome, origem: "captura-json", urlOrigem: origem, criadoEm: agora, atualizadoEm: agora, materias, relatorioCaptura: relatorio });
}

/** Same repair for new files and old catalogs; IDs and lesson objects survive. */
export function normalizarClassificacaoCurso(curso: CursoImportado): CursoImportado {
  if (curso.classificacaoVersao === 1) return curso;
  const materias: CursoMateria[] = [];
  for (const materia of curso.materias) {
    if (materia.classificacaoManual) { materias.push(materia); continue; }
    const grupos = new Map<string, CursoMateria>();
    for (const modulo of materia.modulos) {
      const partes = new Map<string, CursoAula[]>();
      for (const aula of modulo.aulas) {
        const classe = classificarOrigemCurso(materia.nome, aula.url || materia.origemUrl, modulo.nome);
        const chave = `${classe.categoria}|${classe.nome}|${classe.origemUrl || materia.id}`;
        if (!grupos.has(chave)) grupos.set(chave, { ...materia, ...classe, id: grupos.size ? `${materia.id}-grupo-${grupos.size + 1}` : materia.id, modulos: [] });
        const aulas = partes.get(chave) ?? [];
        aulas.push(aula);
        partes.set(chave, aulas);
      }
      let parte = 0;
      for (const [chave, aulas] of partes) {
        const grupo = grupos.get(chave)!;
        grupo.modulos.push({ ...modulo, id: parte++ ? `${modulo.id}-grupo-${parte}` : modulo.id, aulas });
      }
    }
    materias.push(...grupos.values());
  }
  return { ...curso, materias: materias.map((m, i) => ({ ...m, ordem: i + 1 })), classificacaoVersao: 1 };
}

function identidadeCurso(curso: CursoImportado) {
  const origem = normalizarUrl(curso.urlOrigem);
  if (!origem) return undefined;
  return origemDaAula(origem)?.chave || origem.replace(/\/$/, "");
}

export function encontrarCursoExistente(cursos: CursoImportado[], recebido: CursoImportado) {
  const identidade = identidadeCurso(recebido);
  return cursos.find(c => c.id === recebido.id || Boolean(identidade && identidadeCurso(c) === identidade));
}

/** Merge is additive: a partial/new capture cannot delete old lessons or notes. */
export function mesclarCursoRecebido(cursos: CursoImportado[], recebido: CursoImportado): CursoImportado {
  const novo = normalizarClassificacaoCurso(recebido);
  const anteriorBruto = encontrarCursoExistente(cursos, novo);
  if (!anteriorBruto) return novo;
  const anterior = normalizarClassificacaoCurso(anteriorBruto);
  const resultado = structuredClone(anterior);
  const urls = new Set(resultado.materias.flatMap(m => m.modulos.flatMap(x => x.aulas.flatMap(a => a.url ? [normalizarUrl(a.url)] : []))));
  for (const materia of novo.materias) {
    let destino = resultado.materias.find(m => (m.origemUrl && m.origemUrl === materia.origemUrl && m.categoria === materia.categoria) || (slugCurso(m.nome) === slugCurso(materia.nome) && m.categoria === materia.categoria));
    if (!destino) { destino = { ...materia, id: `${anterior.id}-materia-nova-${resultado.materias.length + 1}`, modulos: [] }; resultado.materias.push(destino); }
    for (const modulo of materia.modulos) {
      let moduloDestino = destino.modulos.find(m => slugCurso(m.nome) === slugCurso(modulo.nome));
      for (const aula of modulo.aulas) {
        const url = normalizarUrl(aula.url);
        if (url && urls.has(url)) continue;
        if (!url && moduloDestino?.aulas.some(a => !a.url && slugCurso(a.nome) === slugCurso(aula.nome))) continue;
        if (!moduloDestino) { moduloDestino = { ...modulo, id: `${destino.id}-modulo-novo-${destino.modulos.length + 1}`, aulas: [] }; destino.modulos.push(moduloDestino); }
        moduloDestino.aulas.push({ ...aula, id: `${moduloDestino.id}-aula-nova-${moduloDestino.aulas.length + 1}`, ordem: moduloDestino.aulas.length + 1 });
        if (url) urls.add(url);
      }
    }
  }
  return { ...resultado, atualizadoEm: novo.atualizadoEm, relatorioCaptura: novo.relatorioCaptura ?? resultado.relatorioCaptura,
    materias: resultado.materias.filter(m => m.modulos.length).map((m, i) => ({ ...m, ordem: i + 1 })) };
}

type ExtrasCursos = { cursos?: CursoImportado[]; cursosAtivosIds?: string[] };
export function reconciliarCursosImportados<T extends { materias: Materia[]; configuracoes: object }>(estado: T): T {
  const config = estado.configuracoes as ExtrasCursos;
  const antigos = config.cursos;
  if (!antigos?.length) return estado;
  let cursos = sincronizarProgressoCursos(antigos, estado.materias).map(normalizarClassificacaoCurso);
  const materias = aplicarCursosAtivosNasMaterias(estado.materias, cursos, config.cursosAtivosIds ?? []);
  cursos = sincronizarProgressoCursos(cursos, materias);
  if (JSON.stringify(cursos) === JSON.stringify(antigos) && JSON.stringify(materias) === JSON.stringify(estado.materias)) return estado;
  return { ...estado, materias, configuracoes: { ...estado.configuracoes, cursos } } as T;
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
    if (ehCursoImportado(bruto)) return normalizarClassificacaoCurso(normalizarCursoRecebido(bruto, file.name));
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
      if (materiaCurso.categoria && materiaCurso.categoria !== "disciplina") continue;
      const chave = slugCurso(materiaCurso.nome);
      let indice = base.findIndex((m) => slugCurso(m.nome) === chave);
      if (indice < 0) indice = base.findIndex(m => identificarMateriaCurso(m.nome) === materiaCurso.nome);
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
    const salvo = buscarProgresso(progresso, curso.id, aula);
    return salvo ? { ...aula, concluida: salvo.concluido, concluidaEm: salvo.concluidoEm, registroEstudo: salvo } : aula;
  }) })) })) }));
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
  if (e.closest(".tutor-course-topic")) return "conteudo";
  for (let p: Element | null = e; p && !/^(BODY|HTML)$/.test(p.tagName); p = p.parentElement) {
    if (p.matches("nav,aside,[role='navigation']") || [...p.classList].some(c => /^(menu|sidebar|navigation)(-|$)|^(main|site|primary|nav)-(menu|navigation)$/.test(c))) return "menu";
  }
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

function converterModuloCurso(curso: CursoImportado, _materia: CursoMateria, modulo: CursoModulo, progresso: Map<string, Assunto>): Modulo {
  const assuntos: Assunto[] = modulo.aulas.map((aula) => {
    const salvo = buscarProgresso(progresso, curso.id, aula) ?? aula.registroEstudo;
    const concluido = salvo?.concluido ?? aula.concluida ?? false;
    const concluidoEm = salvo?.concluidoEm ?? aula.concluidaEm ?? aula.concluidoEm;
    const id = `curso:${curso.id}:aula:${aula.id}`;
    return { ...salvo, id, nome: salvo?.nome ?? aula.nome, concluido, concluidoEm, prioridade: salvo?.prioridade ?? "media", aula: aula.url,
      aulas: salvo?.aulas?.length ? salvo.aulas : [{ id: `${id}:link`, nome: aula.nome, url: aula.url, ordem: 1, concluida: concluido, concluidaEm: concluidoEm }] };
  });
  return { id: `curso:${curso.id}:modulo:${modulo.id}`, nome: `${curso.nome} · ${modulo.nome}`, ordem: modulo.ordem, assuntos };
}

function removerModulosDeCursos(materias: Materia[]): Materia[] {
  return materias.flatMap((materia) => {
    const modulos = (materia.modulos ?? []).filter((m) => !m.id.startsWith("curso:"));
    const assuntos = modulos.length ? modulos.flatMap((m) => m.assuntos) : materia.assuntos.filter((a) => !a.id.startsWith("curso:"));
    if (materia.id.startsWith("curso-materia-") && !modulos.length && !assuntos.length) return [];
    return [{ ...materia, modulos, assuntos }];
  });
}

function mapearProgressoDosCursos(materias: Materia[]) {
  const mapa = new Map<string, Assunto>();
  for (const materia of materias) for (const modulo of materia.modulos ?? []) {
    const cursoId = modulo.id.match(/^curso:(.+?):modulo:/)?.[1];
    if (!cursoId) continue;
    for (const assunto of modulo.assuntos) {
      mapa.set(`id:${assunto.id}`, assunto);
      for (const url of [assunto.aula, ...(assunto.aulas ?? []).map(a => a.url)]) if (url) mapa.set(`url:${cursoId}|${normalizarUrl(url)}`, assunto);
    }
  }
  return mapa;
}

function buscarProgresso(mapa: Map<string, Assunto>, cursoId: string, aula: CursoAula) {
  return mapa.get(`id:curso:${cursoId}:aula:${aula.id}`) ?? (aula.url ? mapa.get(`url:${cursoId}|${normalizarUrl(aula.url)}`) : undefined);
}
function pareceTituloDeMateria(texto: string, materia: string) { const a = slugCurso(texto), b = slugCurso(materia); return a === b || a.startsWith(`${b}-`) || a.length <= b.length + 24; }
function pareceModulo(texto: string) { return /\b(m[oó]dulo|unidade|bloco|cap[ií]tulo|trilha|disciplina)\b/i.test(texto); }
function pareceAula(texto: string) { return /\b(aula|videoaula|v[ií]deo|parte\s*\d+)\b/i.test(texto) || /^\d+[.)-]\s+/.test(texto); }
function limparNomeModulo(texto: string, materia: string) { const limpo = limparTexto(texto).replace(/^\s*(m[oó]dulo|unidade|bloco|cap[ií]tulo|trilha|disciplina)\s*\d*\s*[-:–—]?\s*/i, "").trim(); return !limpo || slugCurso(limpo) === slugCurso(materia) ? "Geral" : limpo.slice(0, 160); }
function limparTexto(valor: string) { return String(valor || "").replace(/\s+/g, " ").trim(); }
function normalizarUrl(url?: string) { if (typeof url !== "string" || url.length > 2000) return undefined; try { const x = new URL(url); if (!/^https?:$/.test(x.protocol) || x.username || x.password) return undefined; x.hash = ""; return x.href; } catch { return undefined; } }
function resolverUrl(href?: string, base?: string) { if (!href || href.startsWith("javascript:") || href.startsWith("#")) return undefined; try { return base ? new URL(href, base).href : /^https?:\/\//i.test(href) ? href : undefined; } catch { return undefined; } }
function removerExtensao(nome: string) { return nome.replace(/\.(html?|mhtml|mht|json|txt)$/i, ""); }
function ehCapturaCurso(valor: unknown): valor is CapturaCurso {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Partial<CapturaCurso>;
  if (![1, 2, 3].includes(v.versao ?? 0) || !Array.isArray(v.itens) || !v.itens.every(i => i && typeof i.texto === "string")) return false;
  if (v.avisos !== undefined && (!Array.isArray(v.avisos) || !v.avisos.every(a => typeof a === "string"))) return false;
  if (v.versao === 3 && v.paginas !== undefined) {
    if (!Array.isArray(v.paginas)) return false;
    const validas = v.paginas.every(p => p && typeof p.nome === "string" && typeof p.url === "string"
      && Array.isArray(p.modulos) && p.modulos.every(m => m && typeof m.nome === "string"
        && Array.isArray(m.aulas) && m.aulas.every(a => a && typeof a.nome === "string" && typeof a.url === "string")));
    if (!validas) return false;
  }
  return true;
}
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
