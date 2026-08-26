import type {
  AnaliseEdital,
  MateriaEdital,
  PrioridadeEdital,
} from "../src/types/editalInteligente.ts";

export function montarPromptAnaliseEdital(contexto: {
  nomeArquivo: string;
  concurso?: string;
  banca?: string;
}) {
  return `
Você é um analista de editais de concursos públicos brasileiros.

Analise o PDF anexado e extraia SOMENTE os conteúdos programáticos que realmente aparecem no documento.

CONTEXTO INFORMADO PELO USUÁRIO:
- arquivo: ${contexto.nomeArquivo}
- concurso: ${contexto.concurso || "não informado"}
- banca: ${contexto.banca || "não informada"}

OBJETIVO:
1. identificar o concurso, cargo e banca quando isso estiver explícito no PDF;
2. localizar o conteúdo programático/conhecimentos exigidos;
3. separar em MATÉRIAS;
4. dentro de cada matéria, separar os ASSUNTOS cobrados;
5. não inventar assunto que não esteja no edital;
6. consolidar itens repetidos sem perder conteúdo;
7. manter assuntos específicos separados quando forem claramente diferentes;
8. destrinchar itens muito amplos em unidades menores e estudáveis quando o próprio texto do edital trouxer uma lista de subtópicos;
9. evitar devolver um único assunto com uma sequência longa de conceitos separados por vírgulas quando esses conceitos puderem virar blocos de estudo independentes;
10. atribuir prioridade alta, média ou baixa a cada assunto considerando a recorrência histórica típica da banca/concurso e a importância do tópico para a disciplina;
11. atribuir incidenciaEstimada de 1 a 5 para cada matéria. Essa incidência é uma estimativa de prioridade de estudo, não uma probabilidade estatística;
12. quando houver acesso à pesquisa, use-a somente para ajudar na PRIORIZAÇÃO. A lista de conteúdos deve continuar vindo exclusivamente do PDF.

EXEMPLO DE GRANULARIDADE:
- se o edital disser "Ato administrativo (conceito, requisitos, atributos, classificação, espécies, invalidação, anulação, revogação)", prefira separar em blocos menores coerentes, sem acrescentar conteúdo externo;
- se o edital disser apenas "Lei nº 10.826/2003 (Estatuto do Desarmamento)", preserve como um único assunto, pois o PDF não detalhou subtópicos.

IMPORTANTE:
- a prioridade pode usar conhecimento histórico/pesquisa, mas NUNCA acrescente matéria ou assunto que não esteja no PDF;
- não declare percentuais de cobrança sem fonte explícita;
- se o PDF estiver incompleto, verticalizado ou ambíguo, informe isso em observacao;
- não inclua requisitos administrativos, datas, inscrições, exames médicos, TAF ou etapas do concurso como matérias de estudo;
- não use markdown.

Retorne SOMENTE JSON válido neste formato:
{
  "concursoDetectado": "nome",
  "cargoDetectado": "cargo ou vazio",
  "bancaDetectada": "banca ou vazio",
  "observacao": "observação curta ou vazio",
  "materias": [
    {
      "nome": "Português",
      "incidenciaEstimada": 5,
      "assuntos": [
        {
          "nome": "Interpretação de textos",
          "prioridade": "alta",
          "justificativaPrioridade": "Recorrente em provas da banca e central na disciplina."
        }
      ]
    }
  ]
}
`;
}

export function normalizarRespostaAnaliseEdital(valor: unknown): AnaliseEdital {
  if (!valor || typeof valor !== "object") {
    throw new Error("A IA retornou uma análise vazia.");
  }

  const bruto = valor as Record<string, unknown>;
  const materiasBrutas = Array.isArray(bruto.materias) ? bruto.materias : [];
  const materias: MateriaEdital[] = [];
  const nomesMaterias = new Set<string>();

  for (const item of materiasBrutas.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const materia = item as Record<string, unknown>;
    const nome = textoSeguro(materia.nome, 140);
    if (!nome) continue;
    const chaveMateria = normalizarChave(nome);
    if (nomesMaterias.has(chaveMateria)) continue;
    nomesMaterias.add(chaveMateria);

    const assuntosBrutos = Array.isArray(materia.assuntos) ? materia.assuntos : [];
    const assuntos: MateriaEdital["assuntos"] = [];
    const nomesAssuntos = new Set<string>();

    for (const itemAssunto of assuntosBrutos.slice(0, 160)) {
      if (!itemAssunto || typeof itemAssunto !== "object") continue;
      const assunto = itemAssunto as Record<string, unknown>;
      const nomeAssunto = textoSeguro(assunto.nome, 220);
      if (!nomeAssunto) continue;
      const chaveAssunto = normalizarChave(nomeAssunto);
      if (nomesAssuntos.has(chaveAssunto)) continue;
      nomesAssuntos.add(chaveAssunto);

      const prioridadeBruta = textoSeguro(assunto.prioridade, 20).toLowerCase();
      const prioridade: PrioridadeEdital =
        prioridadeBruta === "alta" || prioridadeBruta === "baixa"
          ? prioridadeBruta
          : "media";

      assuntos.push({
        id: "",
        nome: nomeAssunto,
        prioridade,
        justificativaPrioridade:
          textoSeguro(assunto.justificativaPrioridade, 260) || undefined,
      });
    }

    if (assuntos.length === 0) continue;

    materias.push({
      id: "",
      nome,
      incidenciaEstimada: Math.max(
        1,
        Math.min(5, Math.round(numeroSeguro(materia.incidenciaEstimada, 3)))
      ),
      assuntos,
    });
  }

  if (materias.length === 0) {
    throw new Error(
      "Não foi possível identificar uma grade de matérias e assuntos no PDF. Confira se o arquivo contém o conteúdo programático."
    );
  }

  return {
    concursoDetectado: textoSeguro(bruto.concursoDetectado, 180) || "Concurso",
    cargoDetectado: textoSeguro(bruto.cargoDetectado, 180) || undefined,
    bancaDetectada: textoSeguro(bruto.bancaDetectada, 120) || undefined,
    observacao: textoSeguro(bruto.observacao, 500) || undefined,
    materias,
    analisadoEm: new Date().toISOString(),
  };
}

function textoSeguro(valor: unknown, limite: number) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function numeroSeguro(valor: unknown, padrao: number) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

function normalizarChave(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
