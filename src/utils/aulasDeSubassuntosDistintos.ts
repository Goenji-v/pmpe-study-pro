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
        .replace(/\p{M}/gu, "").toLowerCase();
      if (/principio multiplicativo/.test(nome)) return "rlm.contagem.multiplicativo";
      if (/principios? (de|da) contagem/.test(nome)) return "rlm.contagem.principios";
    }
    return item.idsSubassuntos[0];
  });
  // Subassuntos individuais diferentes; não confundir sinônimos.
  if (new Set(ids).size !== aulas.length) return [];
  return aulas;
}

/**
 * Projeção apenas de interface: quando o tópico composto do edital já contém
 * a aula real do curso, não repetir essa mesma aula no seletor de assuntos.
 * Não apaga nem reescreve assuntos/sessões legados.
 * Em caso de dúvida, mantém o assunto visível.
 */
export function assuntosPrincipaisSemDuplicarAulas(
  materiaNome: string,
  assuntos: Assunto[]
): Assunto[] {
  return assuntos.filter((candidato) => {
    const sub = identificarConteudoCatalogo(materiaNome, candidato.nome);
    if (sub.tipo !== "subassunto" || sub.idsSubassuntos.length !== 1) return true;
    const id = sub.idsSubassuntos[0];
    const pais = assuntos.filter((principal) => {
      if (principal.id === candidato.id) return false;
      const tipo = identificarConteudoCatalogo(materiaNome, principal.nome);
      if (tipo.tipo !== "composto" || !tipo.idsSubassuntos.includes(id)) return false;
      return (principal.aulas ?? []).some((aula) => {
        const aulaSub = identificarConteudoCatalogo(materiaNome, aula.nome);
        return aulaSub.tipo === "subassunto" && aulaSub.idsSubassuntos.includes(id);
      });
    });
    return pais.length !== 1;
  });
}
