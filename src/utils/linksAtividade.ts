type ReferenciasAtividade = {
  urlAulaSessao?: string;
  urlQuestoesSessao?: string;
  urlAulaSelecionada?: string;
  urlAulaAssunto?: string;
  urlQuestoesAssunto?: string;
  urlAulaMaterial?: string;
  urlQuestoesMaterial?: string;
};

function primeiraUrl(...valores: (string | undefined)[]): string | undefined {
  return valores.map((valor) => valor?.trim()).find(Boolean);
}

/**
 * A Central pode abrir pela fila de revisão, calendário, dashboard ou curso.
 * Nem todo caminho preenche as URLs no estado da sessão. A aula selecionada
 * e o assunto canônico continuam sendo fontes válidas para os botões.
 */
export function resolverLinksAtividade(referencias: ReferenciasAtividade) {
  return {
    aula: primeiraUrl(
      referencias.urlAulaSessao,
      referencias.urlAulaSelecionada,
      referencias.urlAulaAssunto,
      referencias.urlAulaMaterial
    ),
    questoes: primeiraUrl(
      referencias.urlQuestoesMaterial,
      referencias.urlQuestoesSessao,
      referencias.urlQuestoesAssunto
    ),
  };
}
