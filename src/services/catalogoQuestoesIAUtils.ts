import type { QuestaoIA } from "../types/index";

export type PreferenciaReusoIA =
  | "nao_respondidas"
  | "misturar";

export function normalizarChaveIA(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function chaveConteudoQuestaoIA(
  questao: Pick<QuestaoIA, "materia" | "assunto" | "enunciado">
) {
  return normalizarChaveIA(
    `${questao.materia}::${questao.assunto}::${questao.enunciado}`
  );
}

export function assinaturaCadernoIA(questoes: QuestaoIA[]) {
  return questoes
    .map(chaveConteudoQuestaoIA)
    .sort()
    .join("|");
}

export function selecionarQuestoesParaReuso(
  questoes: QuestaoIA[],
  idsRespondidos: ReadonlySet<string>,
  quantidade: number,
  preferencia: PreferenciaReusoIA,
  aleatorio: () => number = Math.random
) {
  const candidatas = preferencia === "nao_respondidas"
    ? questoes.filter((questao) => !idsRespondidos.has(questao.id))
    : questoes;

  const embaralhadas = embaralhar(candidatas, aleatorio);
  const reutilizadas = embaralhadas.slice(0, Math.max(0, quantidade));

  return {
    reutilizadas,
    quantidadeGerar: Math.max(0, quantidade - reutilizadas.length),
  };
}

export function embaralhar<T>(
  itens: T[],
  aleatorio: () => number = Math.random
) {
  const resultado = [...itens];

  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const destino = Math.floor(aleatorio() * (indice + 1));
    [resultado[indice], resultado[destino]] = [
      resultado[destino],
      resultado[indice],
    ];
  }

  return resultado;
}

export async function fingerprintQuestaoIA(questao: QuestaoIA) {
  const letras = ["A", "B", "C", "D", "E"] as const;
  const conteudo = [
    questao.materia,
    questao.assunto,
    questao.banca,
    questao.enunciado,
    ...letras.map((letra) => `${letra}:${questao.alternativas[letra]}`),
    questao.respostaCorreta,
  ]
    .map(normalizarChaveIA)
    .join("::");

  const bytes = new TextEncoder().encode(conteudo);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** A saved notebook is a snapshot; only currently active catalog rows may run. */
export function reconciliarQuestoesComCatalogo(
  locais: QuestaoIA[],
  ativas: QuestaoIA[]
) {
  const porId = new Map(ativas.map((q) => [q.id, q]));
  return locais.flatMap((q) => {
    const atual = porId.get(q.id);
    return atual ? [{ ...q, ...atual,
      materiaId: atual.materiaId ?? q.materiaId,
      moduloId: atual.moduloId ?? q.moduloId,
      assuntoId: atual.assuntoId ?? q.assuntoId,
    }] : [];
  });
}
