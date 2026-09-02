import type { CategoriaCursoMateria } from "../types/cursos";

const disciplinas: Array<[string, RegExp]> = [
  ["Língua Portuguesa", /\b(portugues|lingua portuguesa|gramatica)\b/],
  ["Raciocínio Lógico e Matemática", /\b(raciocinio logico|rlm|matematica)\b/],
  ["Informática", /\b(informatica|tecnologia da informacao|fundamentos da computacao)\b/],
  ["História", /\bhistoria\b/],
  ["Geografia", /\bgeografia\b/],
  ["Direito Constitucional", /\bconstitucional\b/],
  ["Direito Administrativo", /\badministrativo\b/],
  ["Direito Processual Penal", /\b(processual penal|processo penal)\b/],
  ["Direito Penal", /\bpenal\b/],
  ["Direitos Humanos", /\bdireitos humanos\b/],
  ["Legislação Extravagante", /\b(legislacao extravagante|legislacao especial|leis especiais|leis extravagantes)\b/],
  ["Redação", /\bredacao\b/],
];

export function textoIdentidadeCurso(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function identificarDisciplina(texto: string): string | undefined {
  const t = textoIdentidadeCurso(texto).replace(/\d{8,}/g, "");
  const encontrados = disciplinas.filter(([, regex]) => regex.test(t)).map(([nome]) => nome);
  if (encontrados.includes("Direito Processual Penal")) encontrados.splice(encontrados.indexOf("Direito Penal"), 1);
  return encontrados.length === 1 ? encontrados[0] : undefined;
}

export function nomeGenericoCurso(nome: string) {
  const t = textoIdentidadeCurso(nome);
  return !t || /^(imagem|image|foto|capa|thumbnail|banner)( do curso| de curso| course)?$/.test(t)
    || /^(curso|curso importado|principal|geral|conteudo|conteudos|aulas?|modulos?|clique aqui|saiba mais|acessar curso|classificacao pendente)$/.test(t)
    || /^\d+$/.test(t);
}

export function origemDaAula(url?: string): { chave: string; nome: string } | undefined {
  if (!url) return;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return;
    const match = u.pathname.match(/^(\/courses?\/[^/]+|\/m\/lessons\/[^/]+)/i);
    if (!match) return;
    const slug = match[1].split("/").at(-1)!;
    return { chave: u.origin + match[1] + "/", nome: decodeURIComponent(slug).replace(/-/g, " ").replace(/\d{8,}$/, "").trim() };
  } catch { return; }
}

function tipoComplemento(texto: string): string | undefined {
  const t = textoIdentidadeCurso(texto).replace(/^(pmpe|pmpb|pmal|curso)\s+/, "");
  if (/\bmentorias?\b/.test(t)) return "Mentoria";
  if (/\b(cronograma|plano de estudos|planejamento de estudos)\b/.test(t)) return "Cronograma e orientação";
  if (/^(comece aqui|boas vindas|orientacoes|conhecendo o projeto|apresentacao do curso)\b/.test(t)) return "Orientações iniciais";
  if (/^(lives?|ao vivo|aulas ao vivo)\b/.test(t) && !identificarDisciplina(t)) return "Lives e encontros";
  return;
}

export function classificarOrigemCurso(nome: string, url?: string, modulo = ""): { nome: string; categoria: CategoriaCursoMateria; origemUrl?: string } {
  const origem = origemDaAula(url);
  const complemento = tipoComplemento(origem?.nome || "") || tipoComplemento(nome) || tipoComplemento(modulo);
  if (complemento) return { nome: complemento, categoria: "complementar", origemUrl: origem?.chave };
  const disciplina = identificarDisciplina(origem?.nome || "") || identificarDisciplina(nome);
  if (disciplina) return { nome: disciplina, categoria: "disciplina", origemUrl: origem?.chave };
  if (!nomeGenericoCurso(nome)) return { nome, categoria: "disciplina", origemUrl: origem?.chave };
  return { nome: `A identificar · ${origem?.nome || "conteúdo sem origem"}`, categoria: "pendente", origemUrl: origem?.chave };
}
