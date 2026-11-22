import type { Assunto, AulaAssunto } from "../types";
import { identificarConteudoCatalogo } from "./catalogoAssuntosCentral";

/**
 * Somente separa automaticamente um assunto quando o curso contém aulas
 * que o catálogo reconhece, sem ambiguidade, como subassuntos diferentes.
 * "Parte 1 / Parte 2" do mesmo conteúdo não é uma nova revisão.
 * Nenhum registro do aluno é alterado nesta identificação.
 */
export function aulasDeSubassuntosDistintos(
  materiaNome: string,
  assunto: Assunto
): AulaAssunto[] {
  const aulas = (assunto.aulas ?? []).filter((aula) =>
    !/^(pdf|material de apoio|apostila|resumo|material complementar)(?:\b|\s|-)/i.test(aula.nome.trim())
  );
  if (aulas.length < 2) return [];
  const identificacoes = aulas.map((aula) =>
    identificarConteudoCatalogo(materiaNome, aula.nome)
  );
  if (identificacoes.some((item) =>
    item.tipo !== "subassunto" || item.idsSubassuntos.length !== 1
  )) return [];
  const ids = identificacoes.map((item, indice) => {
    // O curso distingue princípios de contagem e princípio multiplicativo
    // mesmo quando o catálogo geral os aproxima dentro da mesma família.
    if (item.idsSubassuntos[0] === "rlm.contagem") {
      const nome = aulas[indice].nome.normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
      if (/principio multiplicativo/.test(nome)) return "rlm.contagem.multiplicativo";
      if (/principios? (de|da) contagem/.test(nome)) return "rlm.contagem.principios";
    }
    return item.idsSubassuntos[0];
  });
  // Subassuntos individuais diferentes; não confundir sinônimos.
  if (new Set(ids).size !== aulas.length) return [];
  return aulas;
}
