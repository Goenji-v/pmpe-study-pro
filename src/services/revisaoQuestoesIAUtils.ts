export type EntradaRevisaoQuestoesIA = {
  contextoOriginal: string;
  banca: string;
  questoes: unknown[];
};

export function montarPromptRevisaoQuestoesIA({
  contextoOriginal,
  banca,
  questoes,
}: EntradaRevisaoQuestoesIA) {
  return [
    "TAREFA DE REVISÃO SEMÂNTICA OBRIGATÓRIA.",
    "",
    "Você recebeu um lote de questões para treino de concurso público.",
    "NÃO aceite o gabarito anterior por confiança: resolva cada questão novamente, de forma independente.",
    "",
    "Antes de devolver o lote, verifique CADA questão:",
    "1. O enunciado é tecnicamente correto e não contém contradição, termo trocado ou premissa falsa.",
    "2. Existe EXATAMENTE UMA alternativa correta. Se duas puderem ser defendidas, reescreva a questão ou as alternativas.",
    "3. A respostaCorreta corresponde de fato à única alternativa correta.",
    "4. A explicação prova o gabarito e não contém regra inventada, conceito trocado ou exemplo incompatível.",
    "5. Ortografia, acentuação, divisão silábica, datas, artigos de lei, conceitos técnicos e nomenclaturas devem estar corretos.",
    "6. Se houver qualquer dúvida factual, substitua a questão por outra mais simples e inequívoca do MESMO assunto; não improvise.",
    "7. Preserve a quantidade de questões e, sempre que possível, preserve matéria, módulo, assunto, banca e dificuldade de cada item.",
    "8. Não crie pegadinha baseada em grafia errada se essa grafia tornar mais de uma alternativa defensável.",
    "9. Em fonologia, explicite a convenção quando houver ditongo crescente/hiato ou proparoxítona aparente. Não use uma variante reconhecida como distrator falso.",
    "10. Avalie cada alternativa inteira, inclusive qualificadores como apenas, exatamente e sozinho na sílaba. Enumere todos os encontros quando a questão cobrar quantidade.",
    "11. Mesma regra de acentuação exige critério explícito: não misture uma categoria geral válida com uma regra específica em alternativas concorrentes.",
    "",
    `Contexto original do treino:\n${contextoOriginal}`,
    "",
    `Banca-alvo: ${banca}`,
    "",
    "Lote que deve ser auditado e, se necessário, corrigido:",
    JSON.stringify(questoes),
    "",
    "Retorne somente o lote FINAL corrigido no mesmo formato JSON de questões, sem comentários fora do JSON.",
  ].join("\n");
}

export function validarLoteRevisado(
  questoes: unknown[],
  quantidadeEsperada: number
) {
  if (questoes.length !== quantidadeEsperada) {
    throw new Error(
      `A revisão de qualidade devolveu ${questoes.length} questão(ões), mas eram esperadas ${quantidadeEsperada}. O lote não foi liberado.`
    );
  }

  return questoes;
}
