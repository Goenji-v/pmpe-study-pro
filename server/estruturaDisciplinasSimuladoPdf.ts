/**
 * A matéria de um caderno de concurso é definida pelo cabeçalho impresso.
 * Uma questão de combinatória, por exemplo, pode pertencer ao bloco de
 * Raciocínio Lógico, mesmo que a resolução isolada sugira "Matemática".
 * Nenhuma divisão é inventada: mapa ausente/incompleto é descartado.
 */
export type SecaoDisciplinaPdf = {
  inicio: number;
  fim: number;
  materia: string;
};

function normalizarTexto(valor: string): string {
  return valor.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim().toLowerCase();
}

export function validarSecoesDisciplinasDoPdf(
  valor: unknown,
  totalQuestoes: number
): SecaoDisciplinaPdf[] {
  if (
    !Number.isInteger(totalQuestoes) ||
    totalQuestoes < 2 ||
    totalQuestoes > 200 ||
    !valor || typeof valor !== "object" || Array.isArray(valor)
  ) return [];
  const raiz = valor as Record<string, unknown>;
  if (!Array.isArray(raiz.secoes)) return [];

  const secoes: SecaoDisciplinaPdf[] = [];
  for (const bruto of raiz.secoes) {
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return [];
    const secao = bruto as Record<string, unknown>;
    const inicio = secao.inicio;
    const fim = secao.fim;
    const materia = typeof secao.materia === "string" ? secao.materia.trim().replace(/\s+/g, " ") : "";
    const cabecalho = typeof secao.cabecalho === "string" ? secao.cabecalho.trim() : "";
    if (
      typeof inicio !== "number" || typeof fim !== "number" ||
      !Number.isInteger(inicio) || !Number.isInteger(fim) ||
      Number(inicio) < 1 || Number(fim) > totalQuestoes ||
      Number(fim) < Number(inicio) ||
      materia.length < 3 || materia.length > 90 ||
      !cabecalho || normalizarTexto(cabecalho) !== normalizarTexto(materia) ||
      /^(?:sem materia|nao classificada|nao identificado|desconhecid)/i.test(normalizarTexto(materia))
    ) return [];
    secoes.push({ inicio: Number(inicio), fim: Number(fim), materia });
  }

  // Um único bloco genérico não justifica sobrescrever a IA por questão.
  if (secoes.length < 2 || secoes.length > Math.min(totalQuestoes, 20)) return [];
  secoes.sort((a, b) => a.inicio - b.inicio);
  let proximo = 1;
  for (const secao of secoes) {
    if (secao.inicio !== proximo) return [];
    proximo = secao.fim + 1;
  }
  if (proximo !== totalQuestoes + 1) return [];
  return secoes;
}

export function materiaDoNumero(
  secoes: SecaoDisciplinaPdf[],
  numero: number
): string | null {
  return secoes.find((s) => numero >= s.inicio && numero <= s.fim)?.materia ?? null;
}

/**
 * Questões históricas que perguntam "a que movimento se refere?"
 * devem ter o movimento identificado como assunto, não apenas um
 * período genérico. Só usamos a alternativa se a letra está
 * comprovada pelo próprio documento, nunca pelo palpite da IA.
 */
export function assuntoHistoricoDaAlternativaConfirmada(params: {
  materia: string;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  gabarito: string;
  gabaritoConfirmado: boolean;
}): string | null {
  if (!params.gabaritoConfirmado) return null;
  if (!/historia|cultura pernambucana/.test(normalizarTexto(params.materia))) return null;
  const enunciado = normalizarTexto(params.enunciado);
  if (!/(?:refere[ -]?se|referem[ -]?se|se referem?|corresponde(?:m)? ao movimento|identifique o movimento|qual (?:foi|e) o movimento|como (?:foi|era|e) denominad[ao]|como (?:se )?cham(?:ou|ava))/.test(enunciado)) {
    return null;
  }
  const gabarito = params.gabarito.trim().toUpperCase();
  if (!/^[A-E]$/.test(gabarito)) return null;
  const alternativa = params.alternativas.find((a) => a.id.trim().toUpperCase() === gabarito);
  if (!alternativa) return null;
  const titulo = alternativa.texto.replace(/\s+/g, " ").trim().replace(/[.!;:]+$/, "");
  if (
    titulo.length < 8 ||
    titulo.length > 90 ||
    !/^(?:confedera[cç][aã]o|revolu[cç][aã]o|guerra (?:do|dos|de|da)|insurrei[cç][aã]o|revolta (?:do|dos|de|da)|quilombo (?:do|dos|de|da)|movimento |patrim[oô]nio vivo)/i.test(titulo)
  ) return null;
  return titulo;
}

/**
 * Identifica um documento normativo explicitamente nomeado no enunciado.
 * Regras estritas: não inventa fonte com base apenas na alternativa ou
 * em palavras soltas como "direitos fundamentais".
 */
export function assuntoDeDocumentoCitadoNoEnunciado(enunciado: string): string | null {
  const texto = normalizarTexto(enunciado);
  if (/declaracao universal d[oa]s direitos humanos(?:\s*\(dudh\))?|\bdudh\b/.test(texto)) {
    return "Declaração Universal dos Direitos Humanos (DUDH)";
  }
  if (/estatuto da crianca e do adolescente|\blei\s*n[ºo.]?\s*8\.?069\/(?:19)?90\b|\beca\b/.test(texto)) {
    return "Estatuto da Criança e do Adolescente (ECA)";
  }
  return null;
}


/**
 * Especifica o dispositivo cobrado APENAS quando o enunciado cita a
 * norma e a alternativa confirmada pelo documento contém o conteúdo.
 * Nunca deduz uma resposta/um artigo a partir do número da questão.
 */
export function subassuntoDeDocumentoCitadoNoEnunciado(params: {
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  gabarito: string;
  gabaritoConfirmado: boolean;
}): string | null {
  if (!params.gabaritoConfirmado) return null;
  const documento = assuntoDeDocumentoCitadoNoEnunciado(params.enunciado);
  if (!documento) return null;
  const letra = params.gabarito.trim().toUpperCase();
  if (!/^[A-E]$/.test(letra)) return null;
  const alternativa = params.alternativas.find((item) => item.id.trim().toUpperCase() === letra);
  if (!alternativa) return null;
  const enunciado = normalizarTexto(params.enunciado);
  const texto = normalizarTexto(alternativa.texto);

  if (
    documento === "Declaração Universal dos Direitos Humanos (DUDH)" &&
    /(?:artigo|art\.?)\s*(?:iii|3(?:º|o)?)/.test(enunciado) &&
    /vida/.test(texto) && /liberdade/.test(texto) && /seguranca pessoal/.test(texto)
  ) {
    return "Artigo III — direito à vida, à liberdade e à segurança pessoal";
  }

  if (
    documento === "Estatuto da Criança e do Adolescente (ECA)" &&
    /(?:vender|fornecer|entregar)/.test(texto) &&
    /(?:arma|municao|explosiv)/.test(texto) &&
    /(?:crianca|adolescente)/.test(texto)
  ) {
    return "Venda, fornecimento ou entrega de armas, munições ou explosivos a criança ou adolescente";
  }

  return null;
}
