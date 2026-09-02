// Kept as a literal so the bookmarklet never depends on Vite/TypeScript helpers.
// Tutor curriculum selectors follow the upstream lesson_sidebar.php template.
export const CODIGO_CAPTURADOR_CURSO = String.raw`void (async function () {
  'use strict';
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const percent = value => /^\d+(?:[.,]\d+)?\s*%$/.test(clean(value));
  if (/study\s*pro/i.test(document.title) || document.querySelector('.cursos-page')) {
    alert('Execute este favorito na página principal da plataforma do curso, não no Study Pro.');
    return;
  }
  if (document.getElementById('study-pro-captura-v3')) return;
  const origin = location.origin;
  const absolute = (href, base) => {
    if (!href || /^(#|javascript:|data:|mailto:|tel:)/i.test(href)) return;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol) || u.username || u.password) return;
      u.hash = '';
      return u.href;
    } catch (_) { return; }
  };
  const courseKey = href => {
    try {
      const u = new URL(href);
      if (u.origin !== origin || u.search || u.username || u.password) return;
      const match = u.pathname.match(/^\/courses\/([^/]+)(?:\/(?:lessons\/[^/]+)?)?\/?$/i);
      return match ? u.origin + '/courses/' + match[1] + '/' : undefined;
    } catch (_) { return; }
  };
  const usefulName = (...values) => values.map(clean).find(v => v && !percent(v));
  const slugName = key => {
    const slug = new URL(key).pathname.split('/')[2];
    try { return decodeURIComponent(slug).replace(/-/g, ' '); } catch (_) { return slug.replace(/-/g, ' '); }
  };
  const cardName = (a, key) => usefulName(
    a.getAttribute('aria-label'), a.getAttribute('title'), a.querySelector('img')?.getAttribute('alt'),
    a.textContent, slugName(key)
  ).slice(0, 180);
  const isNavigation = e => {
    for (let p = e; p && !/^(BODY|HTML)$/.test(p.tagName); p = p.parentElement) {
      if (p.matches('nav,header,footer,[role="navigation"],[role="banner"],[role="contentinfo"]')) return true;
      if ([...p.classList].some(c => /^(menu|sidebar|navigation)(-|$)|^(main|site|primary|nav)-(menu|navigation)$/.test(c))) return true;
    }
    return false;
  };
  const seeds = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    const href = absolute(a.getAttribute('href'), location.href);
    const key = courseKey(href);
    if (!key || isNavigation(a) || a.closest('.tutor-course-topic')) continue;
    const isCard = a.matches('.course-link') || a.closest('.tutor-course-card,.carousel-item');
    if (!isCard && new URL(href).pathname.replace(/\/$/, '') !== new URL(key).pathname.replace(/\/$/, '')) continue;
    if (!seeds.has(key)) seeds.set(key, { nome: cardName(a, key), url: href, estado: 'pendente', modulos: [] });
  }

  const titleWithoutInfo = element => {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.tutor-course-topic-title-info,.tutor-course-topic-summary,.tutor-course-topic-item-duration').forEach(e => e.remove());
    return clean(clone.textContent);
  };
  const curriculum = (doc, page) => {
    const key = courseKey(page.url);
    const modules = [];
    const seen = new Set();
    let missing = 0;
    let truncated = false;
    const topics = [...doc.querySelectorAll('.tutor-course-topic')];
    if (topics.length > 300) truncated = true;
    for (const topic of topics.slice(0, 300)) {
      const name = titleWithoutInfo(topic.querySelector('.tutor-course-topic-title'));
      const aulas = [];
      const rows = [...topic.querySelectorAll('.tutor-course-topic-item-lesson')];
      for (const row of rows) {
        const a = row.querySelector('a[href]');
        const href = absolute(a?.getAttribute('href'), page.url);
        const text = titleWithoutInfo(row.querySelector('.tutor-course-topic-item-title'));
        if (!href || courseKey(href) !== key || !/\/lessons\//i.test(href) || !text || percent(text)) { missing++; continue; }
        if (seen.has(href)) continue;
        if (seen.size >= 5000) { truncated = true; break; }
        seen.add(href);
        aulas.push({ nome: text.slice(0, 220), url: href });
      }
      const expected = clean(topic.querySelector('.tutor-course-topic-summary')?.textContent).match(/\d+\s*\/\s*(\d+)/);
      const allRows = topic.querySelectorAll('.tutor-course-topic-item').length;
      if (expected && Number(expected[1]) > allRows) missing += Number(expected[1]) - allRows;
      if (aulas.length) modules.push({ nome: (name || 'Geral').slice(0, 160), aulas });
    }
    if (!modules.length) return { ...page, estado: 'pendente', motivo: 'Nenhuma grade de aulas acessível no HTML. A plataforma pode exigir login ou carregar a grade por JavaScript.', modulos: [] };
    const partial = missing > 0 || truncated;
    return { ...page, modulos: modules, estado: partial ? 'parcial' : 'lida',
      motivo: partial ? (truncated ? 'Limite de captura atingido. ' : '') + missing + ' item(ns) da grade sem link ou ainda não carregado(s).' : undefined };
  };
  const legacyItems = () => {
    const result = [], seen = new Set();
    const selector = 'h1,h2,h3,h4,h5,h6,[role="heading"],a[href],button,[data-title]';
    for (const e of [...document.querySelectorAll(selector)].slice(0, 7000)) {
      if (e.closest('#study-pro-captura-v3')) continue;
      const texto = clean(e.textContent || e.getAttribute('data-title'));
      if (texto.length < 2 || texto.length > 260 || percent(texto)) continue;
      const tag = e.tagName.toLowerCase();
      const href = tag === 'a' ? absolute(e.getAttribute('href'), location.href) : undefined;
      const heading = /^h[1-6]$/.test(tag) || e.getAttribute('role') === 'heading';
      const tipo = heading ? 'cabecalho' : href ? 'link' : 'texto';
      const key = [tipo, texto, href].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const lesson = href && (/\/(lessons?|aulas?)\//i.test(href) || new URL(href).searchParams.has('classId'));
      result.push({ tipo, texto, href, nivel: heading ? Number(tag.slice(1)) || 3 : undefined,
        area: lesson && !e.closest('header,footer') ? 'conteudo' : isNavigation(e) ? 'menu' : 'conteudo',
        containerKey: clean(e.closest('[data-module],[class*="module"],[class*="modulo"]')?.className) || undefined });
    }
    return result;
  };
  const data = { versao: 3, titulo: document.title, urlOrigem: location.href, capturadoEm: new Date().toISOString(), itens: [], paginas: [], avisos: [], cancelada: false };
  const localCourse = courseKey(location.href);
  if (localCourse && document.querySelector('.tutor-course-topic')) {
    seeds.clear();
    const courseLink = [...document.querySelectorAll('a[href]')].find(a => absolute(a.getAttribute('href'), location.href) === localCourse);
    const nome = courseLink ? cardName(courseLink, localCourse) : slugName(localCourse);
    data.paginas.push(curriculum(document, { nome, url: location.href }));
    data.avisos.push('Captura iniciada dentro de uma matéria. Para incluir as demais, execute na página principal com todos os cartões.');
  }
  if (!seeds.size && !data.paginas.length) {
    data.itens = legacyItems();
    data.avisos.push('Captura somente da página aberta: não foi encontrada uma grade Tutor LMS nem cartões de matérias compatíveis. Conteúdo carregado apenas ao abrir módulos pode estar ausente.');
  }
  data.paginas.push(...seeds.values());
  if (data.paginas.length) data.avisos.push('São capturados nomes, módulos e links das aulas presentes nas grades. Vídeos, PDFs e materiais internos de cada aula não são baixados; seu progresso não é alterado.');
  const panel = document.createElement('section');
  panel.id = 'study-pro-captura-v3';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Capturador Study Pro V3');
  panel.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#101b2d;color:#fff;padding:20px;border:1px solid #8bbaff;border-radius:12px;width:min(420px,90vw);font:15px/1.5 system-ui;box-shadow:0 8px 40px #0008';
  const heading = document.createElement('strong'); heading.textContent = 'Study Pro · Captura da página principal';
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar';
  const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Baixar JSON único'; download.disabled = true;
  for (const button of [cancel, download]) button.style.cssText = 'margin:4px;padding:10px;border:1px solid #9ac5ff;border-radius:6px;background:#175be0;color:white;cursor:pointer';
  panel.append(heading, status, cancel, download); document.body.append(panel);
  let controller;
  let finished = false;
  cancel.onclick = () => {
    if (finished) { panel.remove(); return; }
    data.cancelada = true; controller?.abort(); status.textContent = 'Cancelando e preservando o que já foi capturado...';
  };
  download.onclick = () => {
    if (!finished) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'study-pro-curso-v3.json';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  let stopped = '';
  try {
    for (let i = 0; i < data.paginas.length; i++) {
      const page = data.paginas[i];
      if (page.estado !== 'pendente' || page.motivo) continue;
      if (data.cancelada || stopped || i >= 40) {
        page.motivo = data.cancelada ? 'Captura cancelada.' : stopped || 'Limite de 40 matérias por execução atingido.';
        continue;
      }
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 400));
      if (data.cancelada) { page.motivo = 'Captura cancelada.'; continue; }
      status.textContent = 'Lendo ' + (i + 1) + '/' + data.paginas.length + ': ' + page.nome;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(page.url, { method: 'GET', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', signal: controller.signal });
        if ([401, 403, 429].includes(response.status)) {
          stopped = response.status === 429 ? 'A plataforma limitou as consultas. Tente novamente mais tarde.' : 'Acesso não autorizado. Faça login na plataforma antes de capturar.';
          page.motivo = stopped; continue;
        }
        if (!response.ok) { page.motivo = 'Página indisponível (HTTP ' + response.status + ').'; continue; }
        if (!response.headers.get('content-type')?.includes('text/html')) { page.motivo = 'A página não retornou HTML.'; continue; }
        if (response.url && courseKey(response.url) !== courseKey(page.url)) { stopped = 'A plataforma redirecionou a navegação. Abra novamente a página principal e confira seu login.'; page.motivo = stopped; continue; }
        const html = await response.text();
        if (html.length > 8000000) { page.motivo = 'Página muito grande para captura segura.'; continue; }
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const challenge = doc.querySelector('form input[type="password"],#challenge-form,#cf-challenge-running');
        if (challenge && !doc.querySelector('.tutor-course-topic-item-lesson a[href]')) {
          stopped = 'A plataforma pediu login ou verificação de acesso. Resolva isso na página principal antes de tentar novamente.'; page.motivo = stopped; continue;
        }
        data.paginas[i] = curriculum(doc, page);
      } catch (_) {
        stopped = data.cancelada ? 'Captura cancelada.' : 'A consulta foi interrompida (tempo limite, conexão ou redirecionamento). Confira o acesso na página principal.';
        page.motivo = stopped;
      } finally { clearTimeout(timeout); }
    }
  } catch (_) {
    data.avisos.push('A captura foi interrompida por uma estrutura inesperada. Confira as pendências.');
  } finally {
    const read = data.paginas.filter(p => p.estado === 'lida').length;
    const pending = data.paginas.filter(p => p.estado !== 'lida').length;
    const lessons = data.paginas.reduce((n, p) => n + p.modulos.reduce((sum, m) => sum + m.aulas.length, 0), 0);
    status.textContent = data.paginas.length ? read + '/' + data.paginas.length + ' grades lidas · ' + lessons + ' aulas · ' + pending + ' pendência(s).' : 'Página capturada. Esta plataforma não teve captura automática das demais matérias. Confira o aviso ao importar.';
    if (data.cancelada) status.textContent = 'Captura cancelada. ' + status.textContent;
    finished = true; cancel.textContent = 'Fechar'; download.disabled = false;
    download.click();
  }
})()`;
