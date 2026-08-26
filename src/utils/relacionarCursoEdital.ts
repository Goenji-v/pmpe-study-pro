import type { CursoImportado } from "../types/cursos";

export type AulaRelacionadaAoEdital = {
  cursoId: string;
  curso: string;
  materia: string;
  modulo: string;
  aula: string;
  url: string;
  score: number;
};

const STOPWORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "entre",
  "na", "nas", "no", "nos", "o", "os", "para", "por", "que", "se", "um", "uma", "art", "arts",
  "lei", "leis", "n", "numero", "parte", "aula", "modulo", "conteudo",
]);

export function encontrarAulasParaMissao(
  cursos: CursoImportado[],
  ativosIds: string[],
  materiaMissao: string,
  assuntoMissao: string,
  limite = 3
): AulaRelacionadaAoEdital[] {
  const materiaAlvo = normalizar(materiaMissao);
  const assuntoAlvo = normalizar(assuntoMissao);
  const tokensAssunto = tokens(assuntoMissao);

  const resultados: AulaRelacionadaAoEdital[] = [];

  for (const curso of cursos) {
    if (!ativosIds.includes(curso.id)) continue;

    for (const materia of curso.materias) {
      const scoreMateria = similaridadeMateria(materiaAlvo, normalizar(materia.nome));
      if (scoreMateria < 0.45) continue;

      for (const modulo of materia.modulos) {
        for (const aula of modulo.aulas) {
          if (!aula.url) continue;
          const scoreAssunto = similaridadeAssunto(
            assuntoAlvo,
            tokensAssunto,
            aula.nome,
            modulo.nome
          );
          const score = scoreMateria * 0.3 + scoreAssunto * 0.7;
          if (score < 0.38) continue;

          resultados.push({
            cursoId: curso.id,
            curso: curso.nome,
            materia: materia.nome,
            modulo: modulo.nome,
            aula: aula.nome,
            url: aula.url,
            score: Math.round(score * 100) / 100,
          });
        }
      }
    }
  }

  return resultados
    .sort((a, b) => b.score - a.score || a.curso.localeCompare(b.curso, "pt-BR"))
    .filter((item, indice, lista) =>
      lista.findIndex((outro) => outro.url === item.url) === indice
    )
    .slice(0, Math.max(1, limite));
}

function similaridadeMateria(alvo: string, candidato: string) {
  if (!alvo || !candidato) return 0;
  if (alvo === candidato) return 1;
  if (alvo.includes(candidato) || candidato.includes(alvo)) return 0.9;

  const a = tokens(alvo);
  const b = tokens(candidato);
  if (a.length === 0 || b.length === 0) return 0;
  return jaccard(a, b);
}

function similaridadeAssunto(
  alvoNormalizado: string,
  tokensAlvo: string[],
  nomeAula: string,
  nomeModulo: string
) {
  const aulaNormalizada = normalizar(nomeAula);
  const moduloNormalizado = normalizar(nomeModulo);
  const combinado = `${aulaNormalizada} ${moduloNormalizado}`.trim();

  if (!alvoNormalizado || !combinado) return 0;
  if (aulaNormalizada === alvoNormalizado) return 1;
  if (
    aulaNormalizada.includes(alvoNormalizado) ||
    alvoNormalizado.includes(aulaNormalizada)
  ) return 0.92;

  const tokensCandidato = tokens(combinado);
  const sobreposicao = jaccard(tokensAlvo, tokensCandidato);
  const cobertura = coberturaTokens(tokensAlvo, tokensCandidato);
  const bonusTermoForte = tokensAlvo.some((token) =>
    token.length >= 7 && combinado.includes(token)
  ) ? 0.12 : 0;

  return Math.min(1, sobreposicao * 0.45 + cobertura * 0.55 + bonusTermoForte);
}

function coberturaTokens(alvo: string[], candidato: string[]) {
  if (alvo.length === 0) return 0;
  const conjunto = new Set(candidato);
  const encontrados = alvo.filter((token) => conjunto.has(token)).length;
  return encontrados / alvo.length;
}

function jaccard(a: string[], b: string[]) {
  const conjuntoA = new Set(a);
  const conjuntoB = new Set(b);
  if (conjuntoA.size === 0 || conjuntoB.size === 0) return 0;
  const intersecao = [...conjuntoA].filter((item) => conjuntoB.has(item)).length;
  const uniao = new Set([...conjuntoA, ...conjuntoB]).size;
  return uniao > 0 ? intersecao / uniao : 0;
}

function tokens(texto: string) {
  return normalizar(texto)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function normalizar(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
