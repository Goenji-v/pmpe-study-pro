export type EntradaPromptGeracaoQuestoesIA = {
  assunto: string;
  quantidade: number;
  banca: string;
  enunciadosEvitar?: string[];
  dataReferencia?: string;
};

const PERFIL_AOCP_PMPE_2024 = [
  "REFERÊNCIA EDITORIAL OBRIGATÓRIA: caderno Tipo 01 de Soldado da PMPE, Instituto AOCP, aplicado em 2024.",
  "Use apenas o padrão editorial das 54 questões válidas do caderno. Não imite as questões 11, 16, 19, 37, 40 e 53, anuladas no gabarito definitivo.",
  "A semelhança desejada de 80% a 90% é de estrutura, dificuldade, linguagem e raciocínio; a semelhança textual deve ser zero.",
  "Nunca copie, traduza, parafraseie de perto nem troque apenas nomes ou números de questão oficial, de apostila ou do banco existente.",
  "Use cinco alternativas A-E homogêneas, plausíveis e de extensão equilibrada, com exatamente uma resposta integralmente correta.",
  "Reproduza a densidade da prova válida: Português, RLM e Informática normalmente usam enunciados contextualizados de 180 a 500 caracteres; Constitucional, de 160 a 400; História e leis podem ser mais diretas, de 100 a 300. Não alongue artificialmente.",
  "Evite questões de uma linha que apenas peçam definição decorada, salvo quando a dificuldade solicitada for Fácil e essa habilidade tiver aderência ao edital.",
  "Varie o comando e a habilidade. Não repita a mesma regra ou operação apenas mudando personagens, objetos ou valores.",
  "Português: prefira análise contextual, trechos autossuficientes e combinação de interpretação com gramática; preserve exatamente qualquer destaque necessário no próprio texto.",
  "História de Pernambuco: contextualize agente, período e consequência; evite anacronismos, causalidade simplista e versões historiográficas controversas como se fossem fato único.",
  "RLM: use situação-problema ou estrutura lógica completa e demonstre o cálculo/tabela; nunca confunda inferência válida com equivalência lógica.",
  "Informática: use cenário operacional e documentação oficial da tecnologia/versão citada; não transforme simplificação didática em regra universal.",
  "Constitucional, Direitos Humanos e Leis: use caso concreto ou literalidade qualificada, texto vigente na data de referência e jurisprudência ainda válida.",
  "Nos comandos negativos (NÃO, INCORRETA, EXCETO), destaque a palavra em maiúsculas e confira todas as alternativas uma segunda vez.",
].join("\n");

export function montarPromptGeracaoQuestoesIA({
  assunto,
  quantidade,
  banca,
  enunciadosEvitar = [],
  dataReferencia = new Date().toISOString().slice(0, 10),
}: EntradaPromptGeracaoQuestoesIA) {
  const listaEvitar = enunciadosEvitar
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 120);

  const restricaoRepeticao = listaEvitar.length > 0
    ? [
        "QUESTÕES JÁ EXISTENTES - NÃO REPITA A HABILIDADE NEM PARAFRASEIE:",
        ...listaEvitar.map((item, indice) => `${indice + 1}. ${item}`),
      ].join("\n")
    : "Não há enunciados anteriores fornecidos; ainda assim, cada questão do lote deve cobrar uma habilidade distinta.";

  return `Você é elaborador sênior e revisor factual de concursos públicos brasileiros.

Crie exatamente ${quantidade} questões inéditas sobre o contexto abaixo.

CONTEÚDO:
${assunto}

BANCA-ALVO:
${banca}

DATA-LIMITE DA LEGISLAÇÃO, JURISPRUDÊNCIA E TECNOLOGIA:
${dataReferencia}

${PERFIL_AOCP_PMPE_2024}

${restricaoRepeticao}

CONTROLE DE CORREÇÃO ANTES DE RESPONDER:
1. Resolva cada questão sem olhar para a chave que você redigiu.
2. Julgue A, B, C, D e E individualmente. Se duas alternativas puderem ser defendidas, descarte e crie outra questão.
3. Confira datas, nomes, ortografia, divisão silábica, cálculo, artigo, inciso, súmula, versão de software e exceções.
4. Para conteúdo jurídico, use a redação consolidada vigente na data-limite e informe norma e dispositivo exatos.
5. Para História, Português e Informática, informe uma fonte identificável e tecnicamente adequada. Para RLM, demonstre a resolução completa.
6. Não use alternativas absurdas apenas para completar cinco opções e não use “todas/nenhuma das anteriores”.
7. A explicação deve justificar a correta e mostrar objetivamente por que cada distrator está errado.

Retorne SOMENTE um JSON válido, sem markdown, comentários ou texto externo:
[
  {
    "id": "1",
    "materia": "Português",
    "assunto": "Crase",
    "banca": "${banca}",
    "dificuldade": "Média",
    "enunciado": "texto",
    "alternativas": {"A":"texto","B":"texto","C":"texto","D":"texto","E":"texto"},
    "respostaCorreta": "A",
    "explicacao": "justificativa da correta e rejeição de A-E",
    "fonteNome": "fonte verificável",
    "norma": "norma, obra ou documentação",
    "dispositivo": "artigo, regra, seção ou cálculo",
    "auditoria": {
      "veredito": "APROVADA",
      "confianca": "alta",
      "alternativasCorretas": ["A"],
      "fontePrimaria": "fonte usada na conferência",
      "justificativaUnicidade": "por que somente A satisfaz integralmente o comando",
      "dataReferencia": "${dataReferencia}"
    }
  }
]`;
}
