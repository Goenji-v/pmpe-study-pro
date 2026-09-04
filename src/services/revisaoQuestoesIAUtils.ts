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
    "12. Imite o padrão estrutural e a dificuldade do caderno Tipo 01 da PMPE/Instituto AOCP de 2024, mas não copie nem parafraseie seu texto. Ignore as questões oficiais 11, 16, 19, 37, 40 e 53, anuladas.",
    "13. Em normas e jurisprudência, confira a redação consolidada vigente na dataReferencia. Regra revogada, precedente superado ou exceção omitida reprova o item.",
    "14. Rejeite repetição da mesma habilidade com mera troca de nomes, objetos ou números.",
    "15. A explicação deve justificar a correta e refutar objetivamente cada uma das quatro alternativas erradas.",
    "",
    `Contexto original do treino:\n${contextoOriginal}`,
    "",
    `Banca-alvo: ${banca}`,
    "",
    "Lote que deve ser auditado e, se necessário, corrigido:",
    JSON.stringify(questoes),
    "",
    "Cada questão final deve trazer fonteNome, norma, dispositivo e auditoria.",
    "auditoria deve conter: veredito='APROVADA', confianca='alta', alternativasCorretas com uma única letra igual a respostaCorreta, fontePrimaria identificável, justificativaUnicidade e dataReferencia ISO.",
    "Se não conseguir comprovar algum desses campos, substitua a questão; nunca marque como aprovada por aproximação.",
    "Retorne somente o lote FINAL corrigido no mesmo formato JSON de questões, sem comentários fora do JSON.",
  ].join("\n");
}

export function validarLoteRevisado(
  questoes: unknown[],
  quantidadeEsperada: number,
  contextoOriginal = ""
) {
  if (questoes.length !== quantidadeEsperada) {
    throw new Error(
      `A revisão de qualidade devolveu ${questoes.length} questão(ões), mas eram esperadas ${quantidadeEsperada}. O lote não foi liberado.`
    );
  }

  questoes.forEach((valor, indice) =>
    validarAuditoriaEditorial(valor, indice + 1, contextoOriginal)
  );

  validarRepeticaoSemantica(questoes);

  return questoes;
}

function validarAuditoriaEditorial(
  valor: unknown,
  numero: number,
  contextoOriginal: string
) {
  const questao = objeto(valor);
  const auditoria = objeto(questao.auditoria);
  const resposta = texto(questao.respostaCorreta).toUpperCase();
  const corretas = Array.isArray(auditoria.alternativasCorretas)
    ? auditoria.alternativasCorretas.map((item) => texto(item).toUpperCase())
    : [];

  if (
    auditoria.veredito !== "APROVADA" ||
    texto(auditoria.confianca).toLowerCase() !== "alta" ||
    corretas.length !== 1 ||
    corretas[0] !== resposta ||
    texto(auditoria.fontePrimaria).length < 8 ||
    texto(auditoria.justificativaUnicidade).length < 20 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(texto(auditoria.dataReferencia))
  ) {
    throw new Error(
      `Questão ${numero}: a auditoria independente não comprovou uma única resposta com confiança alta. O lote não foi liberado.`
    );
  }

  if (texto(questao.fonteNome).length < 4) {
    throw new Error(
      `Questão ${numero}: fonte verificável ausente. O lote não foi liberado.`
    );
  }

  const contextoLegal = /(constitucional|direitos humanos|leis?\s|lei |direito)/i
    .test(`${contextoOriginal} ${texto(questao.materia)}`);

  if (
    contextoLegal &&
    (texto(questao.norma).length < 3 || texto(questao.dispositivo).length < 3)
  ) {
    throw new Error(
      `Questão ${numero}: norma ou dispositivo jurídico ausente. O lote não foi liberado.`
    );
  }
}

function validarRepeticaoSemantica(questoes: unknown[]) {
  for (let atual = 0; atual < questoes.length; atual += 1) {
    const enunciadoAtual = texto(objeto(questoes[atual]).enunciado);
    for (let anterior = 0; anterior < atual; anterior += 1) {
      const enunciadoAnterior = texto(objeto(questoes[anterior]).enunciado);
      if (similaridade(enunciadoAtual, enunciadoAnterior) >= 0.84) {
        throw new Error(
          `Questões ${anterior + 1} e ${atual + 1}: repetição semântica detectada. O lote não foi liberado.`
        );
      }
    }
  }
}

function similaridade(a: string, b: string) {
  const tokensA = new Set(tokens(a));
  const tokensB = new Set(tokens(b));
  if (tokensA.size < 4 || tokensB.size < 4) return 0;
  const intersecao = [...tokensA].filter((item) => tokensB.has(item)).length;
  return intersecao / Math.min(tokensA.size, tokensB.size);
}

function tokens(valor: string) {
  return valor.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((item) => item.length > 2);
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object"
    ? valor as Record<string, unknown>
    : {};
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}
