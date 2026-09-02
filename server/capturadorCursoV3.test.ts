import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parseHTML, DOMParser } from "linkedom";
import type { CapturaCurso } from "../src/types/cursos";
import { capturaDeHtml, criarCodigoCapturadorCurso, extrairCursoDeArquivo, organizarCapturaCurso } from "../src/utils/importacaoCurso";

const origin = "https://curso.example.test";
// Sanitized reproduction of the supplied RDC dashboard: Astra body, image cards,
// percentage-only labels, navigation noise and ten distinct course links.
const subjects = ["comece-aqui", "plano-de-estudos", "mentoria", "portugues", "historia-de-pernambuco", "raciocinio-logico", "informatica", "direito-constitucional", "direitos-humanos", "legislacao-extravagante"];
const lessonUrl = (subject: string, lesson = "aula-01") => `${origin}/courses/pmpe-${subject}/lessons/${lesson}/`;
const card = (subject: string) => `<div class="carousel-item vertical"><a class="course-link trigger-carousel" href="${lessonUrl(subject)}">44%</a></div>`;
const dashboard = `<html><head><title>Módulo PMPE – Área de Membros | RDC</title></head><body class="logged-in ast-no-sidebar wp-theme-astra"><nav><a href="/logout">Sair</a><a href="/courses/indesejado/">Cursos</a></nav><main>${subjects.map(card).join("")}${card("portugues")}<a class="course-link" href="https://externo.test/courses/outro/">65%</a><a class="course-link" href="/courses/pagamento/?action=buy">Comprar</a></main></body></html>`;

function topic(subject: string, module: string, lessons: string[], locked = false) {
  return `<div class="tutor-course-topic"><div class="tutor-accordion-item-header"><div class="tutor-course-topic-title">${module}<div class="tutor-course-topic-title-info">Não faz parte do título</div></div><div class="tutor-course-topic-summary">0/${lessons.length + Number(locked)}</div></div><div class="tutor-accordion-item-body tutor-display-none">${lessons.map((name, i) => `<div class="tutor-course-topic-item tutor-course-topic-item-lesson"><a href="${lessonUrl(subject, module + '-' + i)}"><span class="tutor-course-topic-item-title">${name}</span><span class="tutor-course-topic-item-duration">00:20:00</span><input type="checkbox" checked disabled></a></div>`).join("")}${locked ? '<div class="tutor-course-topic-item tutor-course-topic-item-lesson"><a href="#"><span class="tutor-course-topic-item-title">Aula bloqueada</span></a></div>' : ""}</div></div>`;
}

type Reply = { html?: string; status?: number; url?: string; contentType?: string };
async function capture(html = dashboard, respond?: (url: string, doc: Document, signal: AbortSignal) => Reply | Promise<Reply>, pageUrl = `${origin}/modulo-pmpe/`) {
  const { document } = parseHTML(html);
  const requests: string[] = [];
  const alerts: string[] = [];
  let blob: Blob | undefined;
  let downloadedName = "";
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });
  class CaptureURL extends URL {
    static createObjectURL(value: Blob) { blob = value; return "blob:test"; }
    static revokeObjectURL() { /* No real network or object URLs in this harness. */ }
  }
  const create = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const e = create(tag);
    if (tag === "a") e.click = () => { downloadedName = e.download; resolveDone(); };
    return e;
  }) as typeof document.createElement;
  runInNewContext(criarCodigoCapturadorCurso().replace(/^javascript:/, ""), {
    document, location: new URL(pageUrl), URL: CaptureURL, Blob, DOMParser, AbortController,
    alert: (message: string) => { alerts.push(message); resolveDone(); },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay === 20000 ? 2000 : 0), clearTimeout,
    fetch: async (url: string, options: RequestInit) => {
      requests.push(url);
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.mode, "same-origin");
      assert.equal(options.redirect, "error");
      assert.equal(new URL(url).origin, origin);
      const subject = new URL(url).pathname.split('/')[2].replace(/^pmpe-/, '');
      const reply = respond ? await respond(url, document as unknown as Document, options.signal!) : { html: topic(subject, "Fonologia", ["Fonema e letra", "Dígrafos"]) + topic(subject, "Ortografia", ["Aula 01"]) };
      return { status: reply.status ?? 200, ok: (reply.status ?? 200) < 400, url: reply.url ?? url, headers: new Headers({ "content-type": reply.contentType ?? "text/html" }), text: async () => reply.html ?? "" };
    },
  }, { timeout: 1000 });
  const guard = setTimeout(() => resolveDone(), 4000);
  await done;
  clearTimeout(guard);
  assert.ok(blob || alerts.length, "bookmarklet deve terminar em download ou aviso");
  return { data: blob ? JSON.parse(await blob.text()) as CapturaCurso : undefined, requests, alerts, downloadedName, document };
}

test("V3 percorre os dez cartões do painel, inclusive percentuais, e lê módulos recolhidos", async () => {
  const result = await capture();
  assert.equal(result.requests.length, 10);
  assert.equal(new Set(result.requests).size, 10);
  assert.equal(result.downloadedName, "study-pro-curso-v3.json");
  assert.equal(result.data?.paginas?.length, 10);
  assert.ok(result.data?.paginas?.every(p => p.estado === "lida" && p.modulos.length === 2));
  const course = organizarCapturaCurso(result.data!);
  assert.equal(course.materias.length, 10);
  assert.equal(course.relatorioCaptura?.origensLidas, 10);
  assert.equal(course.materias.flatMap(m => m.modulos.flatMap(x => x.aulas)).length, 30);
  assert.equal(course.materias[3].nome, "Língua Portuguesa");
  assert.equal(course.materias[3].modulos[0].nome, "Fonologia");
  assert.ok(course.materias.flatMap(m => m.modulos.flatMap(x => x.aulas)).every(a => !a.concluida && !a.nome.includes("00:20") && !a.nome.includes("%")));
});

test("V3 não importa a página do próprio Study Pro", async () => {
  const result = await capture('<html><head><title>PMPE Study Pro</title></head><body><section class="cursos-page"></section></body></html>');
  assert.equal(result.requests.length, 0);
  assert.match(result.alerts[0], /não no Study Pro/);
  assert.throws(() => organizarCapturaCurso({ versao: 2, titulo: "PMPE Study Pro", itens: [] }), /próprio Study Pro/);
});

test("V2 com cartões antigos recebe orientação específica, não aulas fictícias", () => {
  const items = subjects.map(s => ({ tipo: "link" as const, texto: "44%", href: lessonUrl(s), area: "menu" as const, classes: "course-link trigger-carousel" }));
  assert.throws(() => organizarCapturaCurso({ versao: 2, titulo: "Módulo PMPE", itens: items }), /10 cartões.*Capturador V3/);
});

test("falha de uma matéria preserva as outras e informa pendência no arquivo e na importação", async () => {
  const result = await capture(dashboard, url => url.includes("portugues") ? { status: 500 } : { html: topic(new URL(url).pathname.split('/')[2].replace('pmpe-', ''), "Geral", ["Aula 01"]) });
  const course = organizarCapturaCurso(result.data!);
  assert.equal(result.requests.length, 10);
  assert.equal(course.materias.length, 9);
  assert.equal(course.relatorioCaptura?.pendencias.length, 1);
  assert.match(course.relatorioCaptura!.pendencias[0].motivo, /HTTP 500/);
});

for (const status of [401, 403, 429]) test(`HTTP ${status} interrompe novas consultas sem tentar contornar o bloqueio`, async () => {
  const result = await capture(dashboard, () => ({ status }));
  assert.equal(result.requests.length, 1);
  assert.ok(result.data?.paginas?.every(p => p.estado === "pendente" && p.motivo));
  assert.throws(() => organizarCapturaCurso(result.data!), /Nenhuma grade/);
});

test("login com HTTP 200 interrompe a captura", async () => {
  const result = await capture(dashboard, () => ({ html: '<form><input type="password"></form>' }));
  assert.equal(result.requests.length, 1);
  assert.match(result.data!.paginas![0].motivo!, /login/);
});

test("cancelar aborta consulta e preserva relatório sem disparar as demais", async () => {
  const result = await capture(dashboard, (_url, doc, signal) => {
    (doc.querySelector('#study-pro-captura-v3 button') as HTMLButtonElement).click();
    assert.equal(signal.aborted, true);
    throw new Error('aborted');
  });
  assert.equal(result.requests.length, 1);
  assert.equal(result.data!.cancelada, true);
  assert.ok(result.data!.paginas!.every(p => /cancelada/.test(p.motivo!)));
});

test("aulas bloqueadas são pendências; links repetidos não duplicam aulas; nomes iguais com URLs diferentes são preservados", async () => {
  const html = `<html><head><title>Curso</title></head><body>${card('portugues')}</body></html>`;
  const result = await capture(html, () => ({ html: topic('portugues', 'Fonologia', ['Aula 01', 'Aula 01'], true) + topic('portugues', 'Fonologia', ['Aula 01']) }));
  const course = organizarCapturaCurso(result.data!);
  assert.equal(course.materias[0].modulos[0].aulas.length, 2);
  assert.equal(course.relatorioCaptura?.origensLidas, 0);
  assert.equal(course.relatorioCaptura?.pendencias.length, 1);
});

test("fallback informa que capturou só a página atual e preserva classId", async () => {
  const result = await capture('<html><head><title>Português</title></head><body><h1>Língua Portuguesa</h1><h2>Módulo 01 - Fonologia</h2><a href="/m/lessons/portugues?classId=1949">Aula 01 - Fonemas</a><a href="/m/lessons/portugues?classId=1950">Aula 02 - Dígrafos</a></body></html>', undefined, `${origin}/m/lessons/portugues`);
  assert.equal(result.requests.length, 0);
  const course = organizarCapturaCurso(result.data!);
  assert.equal(course.materias[0].modulos[0].aulas.length, 2);
  assert.match(course.relatorioCaptura!.avisos[0], /somente da página aberta/);
});

test("HTML Astra ast-no-sidebar não classifica o conteúdo inteiro como menu", () => {
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
  try {
    const data = capturaDeHtml('<html><body class="ast-no-sidebar"><nav><a href="/logout">Sair</a></nav><main><h2>Português</h2><h3>Módulo 01 - Fonologia</h3><a href="/courses/p/lessons/a/">Aula 01</a></main></body></html>', origin);
    assert.equal(data.itens.find(i => i.texto === 'Aula 01')?.area, 'conteudo');
    assert.equal(data.itens.find(i => i.texto === 'Sair')?.area, 'menu');
    assert.equal(organizarCapturaCurso(data).materias[0].modulos[0].aulas.length, 1);
  } finally { globalThis.DOMParser = previous; }
});

test("V3 é aceito pela entrada real de arquivo; JSON malformado recebe erro de formato", async () => {
  const result = await capture();
  const file = new File([JSON.stringify(result.data)], 'study-pro-curso-v3.json');
  assert.equal((await extrairCursoDeArquivo(file)).materias.length, 10);
  await assert.rejects(() => extrairCursoDeArquivo(new File([JSON.stringify({ versao: 3, itens: [], paginas: [null] })], 'ruim.json')), /formato/);
});

test("HTML de plataforma dinâmica não é apresentado como curso completo", async () => {
  const result = await capture(dashboard, () => ({ html: '<html><body><div id="app">Carregando...</div></body></html>' }));
  assert.equal(result.data!.paginas!.filter(p => p.estado === 'lida').length, 0);
  assert.throws(() => organizarCapturaCurso(result.data!), /Nenhuma grade.*JavaScript/);
});

test("grade iniciada dentro de uma matéria funciona sem consultas extras e avisa sobre as demais", async () => {
  const html = `<html><head><title>Português</title></head><body><a href="${origin}/courses/pmpe-portugues/">Português</a>${topic('portugues', 'Fonologia', ['Aula 01'])}</body></html>`;
  const result = await capture(html, undefined, lessonUrl('portugues'));
  assert.equal(result.requests.length, 0);
  assert.equal(organizarCapturaCurso(result.data!).materias.length, 1);
  assert.match(result.data!.avisos![0], /dentro de uma matéria/);
});

test("redirecionamento externo ou de autenticação interrompe novas consultas", async () => {
  const result = await capture(dashboard, () => ({ url: 'https://externo.test/login', html: '' }));
  assert.equal(result.requests.length, 1);
  assert.match(result.data!.paginas![0].motivo!, /redirecionou/);
});

test("limite de quarenta matérias preserva as excedentes como pendência", async () => {
  const html = `<html><head><title>Curso</title></head><body>${Array.from({ length: 42 }, (_, i) => card('materia-' + i)).join('')}</body></html>`;
  const result = await capture(html);
  assert.equal(result.requests.length, 40);
  assert.equal(result.data!.paginas!.length, 42);
  assert.match(result.data!.paginas![41].motivo!, /Limite de 40/);
});

test("captura nova não aceita aulas externas ou de outra matéria", async () => {
  const result = await capture();
  const page = result.data!.paginas![0];
  page.modulos[0].aulas.push({ nome: 'Outra matéria', url: lessonUrl('outro') }, { nome: 'Externo', url: 'https://externo.test/aula' });
  const course = organizarCapturaCurso(result.data!);
  assert.equal(course.materias[0].modulos[0].aulas.length, 2);
  assert.match(course.relatorioCaptura!.pendencias[0].motivo, /2 item/);
});
