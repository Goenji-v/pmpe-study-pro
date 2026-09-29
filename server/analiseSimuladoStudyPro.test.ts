import assert from "node:assert/strict";
import test from "node:test";

import {
  analisarSimuladoStudyPro,
  resumirAnaliseParaHistorico,
  type EntradaAnaliseSimulado,
  type QuestaoAnaliseSimulado,
} from "../src/utils/analiseSimuladoStudyPro";

function questao(
  id: string,
  assunto: string,
  dificuldade: QuestaoAnaliseSimulado["dificuldade"] = "Média",
  subassunto?: string
): QuestaoAnaliseSimulado {
  return {
    id,
    numero: Number(id.replace(/\D/g, "")) || 1,
    materia: "Português",
    modulo: "Gramática",
    assunto,
    subassunto,
    dificuldade,
    enunciado: `Enunciado ${id}`,
    alternativas: [
      { id: "A", texto: "Alternativa A" },
      { id: "B", texto: "Alternativa B" },
      { id: "C", texto: "Alternativa C" },
      { id: "D", texto: "Alternativa D" },
      { id: "E", texto: "Alternativa E" },
    ],
    gabarito: "A",
    explicacao: "A alternativa A aplica corretamente a regra central do assunto.",
  };
}

function analisar(
  parcial: Partial<EntradaAnaliseSimulado> & Pick<EntradaAnaliseSimulado, "questoes" | "respostas">
) {
  return analisarSimuladoStudyPro({
    tentativaId: parcial.tentativaId ?? "tentativa-atual",
    nome: parcial.nome ?? "Simulado teste",
    data: parcial.data ?? "2026-09-28T00:00:00.000Z",
    questoes: parcial.questoes,
    respostas: parcial.respostas,
    marcacoes: parcial.marcacoes,
    motivosErro: parcial.motivosErro,
    historico: parcial.historico,
  });
}

test("separa não estudado sem tratar como deficiência do conteúdo estudado", () => {
  const analise = analisar({
    questoes: [
      questao("q1", "Crase"),
      questao("q2", "Pontuação"),
    ],
    respostas: {
      q1: "A",
      q2: "B",
    },
    marcacoes: {
      q2: "nao_estudado",
    },
  });

  assert.equal(analise.resumo.totalAcertos, 1);
  assert.equal(analise.resumo.totalErros, 0);
  assert.equal(analise.resumo.totalNaoEstudadas, 1);
  assert.equal(analise.resumo.aproveitamentoGeral, 100);
  assert.equal(analise.aindaNaoEstudado.length, 1);
  assert.equal(analise.aindaNaoEstudado[0]?.assunto, "Pontuação");

  const naoEstudado = analise.assuntos.find((item) => item.assunto === "Pontuação");
  assert.equal(naoEstudado?.avaliadas, 0);
  assert.equal(
    naoEstudado?.dominio,
    "Ainda não estudado — manter cronograma"
  );
  assert.equal(
    analise.planoRevisao.some((item) => item.assunto === "Pontuação"),
    false
  );
  assert.match(analise.recomendacaoFinal, /cronograma normal/i);
});

test("acerto por chute pontua mas entra no caderno e não consolida o assunto", () => {
  const analise = analisar({
    questoes: [
      questao("q1", "Crase"),
      questao("q2", "Crase"),
      questao("q3", "Crase"),
      questao("q4", "Crase"),
      questao("q5", "Crase"),
    ],
    respostas: {
      q1: "A",
      q2: "A",
      q3: "A",
      q4: "A",
      q5: "A",
    },
    marcacoes: {
      q1: "chutei",
    },
  });

  assert.equal(analise.resumo.aproveitamentoGeral, 100);
  assert.equal(analise.resumo.totalAcertosPorChute, 1);
  assert.equal(analise.correcao[0]?.status, "acerto_chute");
  assert.equal(analise.cadernoErros.length, 1);
  assert.equal(analise.cadernoErros[0]?.status, "acerto_chute");

  const crase = analise.assuntos[0];
  assert.equal(crase?.dominio, "Questões + revisão espaçada");
  assert.equal(crase?.prioridade, "alta");
});

test("aplica exatamente as faixas de domínio 49, 50, 70 e 80 por cento", () => {
  function bloco(prefixo: string, assunto: string, certas: number, total = 100) {
    const questoes = Array.from({ length: total }, (_, i) =>
      questao(`${prefixo}${i + 1}`, assunto)
    );
    const respostas = Object.fromEntries(
      questoes.map((item, i) => [item.id, i < certas ? "A" : "B"])
    );
    return { questoes, respostas };
  }

  const b49 = bloco("a", "A49", 49);
  const b50 = bloco("b", "A50", 50);
  const b70 = bloco("c", "A70", 70);
  const b80 = bloco("d", "A80", 80);

  const analise = analisar({
    questoes: [...b49.questoes, ...b50.questoes, ...b70.questoes, ...b80.questoes],
    respostas: {
      ...b49.respostas,
      ...b50.respostas,
      ...b70.respostas,
      ...b80.respostas,
    },
  });

  const porAssunto = Object.fromEntries(
    analise.assuntos.map((item) => [item.assunto, item.dominio])
  );

  assert.equal(porAssunto.A49, "Teoria + questões");
  assert.equal(porAssunto.A50, "Revisão curta + questões");
  assert.equal(porAssunto.A70, "Questões + revisão espaçada");
  assert.equal(porAssunto.A80, "Assunto consolidado — manter revisão");
});

test("caderno de erros traz somente erro e acerto por chute com explicação objetiva", () => {
  const analise = analisar({
    questoes: [
      questao("q1", "Crase", "Média", "Crase obrigatória"),
      questao("q2", "Crase"),
      questao("q3", "Crase"),
    ],
    respostas: {
      q1: "B",
      q2: "A",
      q3: "A",
    },
    marcacoes: {
      q2: "chutei",
    },
    motivosErro: {
      q1: "confundi_regra",
    },
  });

  assert.equal(analise.cadernoErros.length, 2);
  assert.equal(analise.cadernoErros[0]?.assuntoEspecifico, "Crase obrigatória");
  assert.match(analise.cadernoErros[0]?.motivoProvavel ?? "", /Confundi/i);
  assert.ok((analise.cadernoErros[0]?.comentario.length ?? 0) <= 560);
  assert.match(analise.cadernoErros[0]?.oQueRevisar ?? "", /Portugues/);
});

test("classifica dificuldade geral considerando a distribuição das questões", () => {
  const analise = analisar({
    questoes: [
      questao("q1", "Crase", "Fácil"),
      questao("q2", "Crase", "Média"),
      questao("q3", "Crase", "Média"),
      questao("q4", "Crase", "Difícil"),
    ],
    respostas: { q1: "A", q2: "A", q3: "A", q4: "A" },
  });

  assert.deepEqual(analise.dificuldade, {
    facil: { quantidade: 1, percentual: 25 },
    media: { quantidade: 2, percentual: 50 },
    dificil: { quantidade: 1, percentual: 25 },
    geral: "Média para difícil",
  });
});

test("erro reincidente sobe a prioridade e recomenda teoria novamente quando segue abaixo de 50%", () => {
  const primeira = analisar({
    tentativaId: "t1",
    questoes: [
      questao("q1", "Negação"),
      questao("q2", "Negação"),
      questao("q3", "Negação"),
      questao("q4", "Negação"),
    ],
    respostas: { q1: "B", q2: "B", q3: "A", q4: "B" },
  });

  const segunda = analisar({
    tentativaId: "t2",
    questoes: [
      questao("q1", "Negação"),
      questao("q2", "Negação"),
      questao("q3", "Negação"),
      questao("q4", "Negação"),
    ],
    respostas: { q1: "B", q2: "B", q3: "A", q4: "B" },
    historico: [resumirAnaliseParaHistorico(primeira)],
  });

  const assunto = segunda.assuntos.find((item) => item.assunto === "Negação");
  assert.equal(assunto?.reincidencias, 1);
  assert.equal(assunto?.prioridade, "alta");
  assert.match(assunto?.orientacao ?? "", /Teoria/i);
});

test("comparação usa pontos percentuais e avisa quando a dificuldade mudou", () => {
  const anterior = analisar({
    tentativaId: "t1",
    data: "2026-09-20T00:00:00.000Z",
    questoes: [
      questao("q1", "Crase", "Fácil"),
      questao("q2", "Crase", "Fácil"),
    ],
    respostas: { q1: "A", q2: "B" },
  });

  const atual = analisar({
    tentativaId: "t2",
    data: "2026-09-28T00:00:00.000Z",
    questoes: [
      questao("q1", "Crase", "Difícil"),
      questao("q2", "Crase", "Difícil"),
    ],
    respostas: { q1: "A", q2: "A" },
    historico: [resumirAnaliseParaHistorico(anterior)],
  });

  assert.equal(atual.evolucao.length, 1);
  assert.equal(atual.evolucao[0]?.anterior, 50);
  assert.equal(atual.evolucao[0]?.atual, 100);
  assert.equal(atual.evolucao[0]?.variacaoPp, 50);
  assert.equal(atual.evolucao[0]?.rotulo, "Evolução: +50 p.p.");
  assert.match(atual.evolucao[0]?.observacao ?? "", /dificuldade/i);
});


test("consolida subassuntos do mesmo assunto em uma única análise", () => {
  const analise = analisar({
    questoes: [
      questao("q1", "Crase", "Média", "Crase obrigatória"),
      questao("q2", "Crase", "Média", "Crase facultativa"),
    ],
    respostas: {
      q1: "B",
      q2: "B",
    },
  });

  const crase = analise.assuntos.filter(
    (item) => item.assunto === "Crase"
  );

  assert.equal(crase.length, 1);
  assert.equal(crase[0]?.total, 2);
  assert.equal(crase[0]?.erros, 2);
  assert.equal(crase[0]?.assuntoEspecifico, "Crase");
  assert.equal(analise.planoRevisao.length, 1);
});

test("normaliza matérias geradas pela IA e separa direito misturado pelo contexto", () => {
  const q1 = {
    ...questao("q1", "Brasil Império"),
    materia: "História e Cultura Brasileira",
  };
  const q2 = {
    ...questao("q2", "Era Vargas"),
    materia: "História",
  };
  const q3 = {
    ...questao("q3", "Habeas corpus e direitos fundamentais"),
    materia: "Direito Administrativo e Constitucional",
  };
  const q4 = {
    ...questao("q4", "Atos administrativos e poderes administrativos"),
    materia: "Direito Administrativo e Constitucional",
  };

  const analise = analisar({
    questoes: [q1, q2, q3, q4],
    respostas: {
      q1: "A",
      q2: "A",
      q3: "A",
      q4: "A",
    },
  });

  const porMateria = Object.fromEntries(
    analise.materias.map((item) => [item.materia, item.total])
  );

  assert.equal(porMateria["História do Brasil"], 2);
  assert.equal(porMateria["Direito Constitucional"], 1);
  assert.equal(porMateria["Direito Administrativo"], 1);
  assert.equal(
    analise.materias.some(
      (item) =>
        item.materia === "Direito Administrativo e Constitucional"
    ),
    false
  );
});

test("plano de revisão seleciona no máximo oito focos", () => {
  const nomes = [
    "Crase",
    "Pontuação",
    "Regência",
    "Concordância",
    "Ortografia",
    "Morfologia",
    "Sintaxe",
    "Semântica",
    "Coesão",
    "Interpretação",
    "Pronomes",
    "Verbos",
    "Advérbios",
    "Preposições",
    "Conjunções",
  ];
  const questoes = nomes.map((assunto, indice) =>
    questao(`q${indice + 1}`, assunto)
  );
  const respostas = Object.fromEntries(
    questoes.map((item) => [item.id, "B"])
  );

  const analise = analisar({
    questoes,
    respostas,
  });

  assert.equal(analise.planoRevisao.length, 8);
  assert.ok(
    analise.planoRevisao.every(
      (item) => item.prioridade !== "alta"
    )
  );
  assert.equal(analise.correcao.length, 15);
  assert.equal(analise.cadernoErros.length, 15);
});
