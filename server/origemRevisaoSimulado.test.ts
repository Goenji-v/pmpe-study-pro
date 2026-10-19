import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro.ts";
import { adicionarErrosSimuladoARevisao } from "../src/utils/revisaoSimuladoStudyPro.ts";
import { rotuloOrigemRevisaoSimulado } from "../src/utils/rotuloOrigemRevisaoSimulado.ts";
import type { Revisao } from "../src/types/index.ts";

function diagnostico(nome = "Simulado 4", tentativaId = "prova-4") {
  const questoes = Array.from({ length: 5 }, (_, i) => ({
    id: `q${i + 1}`,
    numero: i + 1,
    materia: "Português",
    assunto: "Verbos",
    dificuldade: "Média" as const,
    enunciado: `Questão ${i + 1}`,
    alternativas: ["A", "B", "C", "D", "E"].map((id) => ({ id, texto: id })),
    gabarito: "A",
  }));
  return analisarSimuladoStudyPro({
    tentativaId,
    nome,
    data: "2026-10-18T13:00:00.000Z",
    questoes,
    respostas: Object.fromEntries(questoes.map((q) => [q.id, "B"])),
  });
}

test("revisão criada mostra o nome exato do simulado, sem mudar assunto e matéria", () => {
  const primeira = adicionarErrosSimuladoARevisao({
    revisoes: [],
    materias: [],
    analise: diagnostico(),
    agora: new Date("2026-10-18T13:00:00.000Z"),
    criarId: () => "rev-4",
  });
  assert.equal(primeira.criadas, 1);
  const revisao = primeira.revisoes[0];
  assert.equal(revisao.origemSimulado?.tentativaId, "prova-4");
  assert.equal(revisao.origemSimulado?.nome, "Simulado 4");
  assert.equal(revisao.materia, "Língua Portuguesa");
  assert.equal(revisao.assunto, "Verbos");
  assert.equal(rotuloOrigemRevisaoSimulado(revisao), "Revisão de erros · Simulado 4");

  const repeticao = adicionarErrosSimuladoARevisao({
    revisoes: primeira.revisoes, materias: [], analise: diagnostico(),
    agora: new Date("2026-10-18T13:00:00.000Z"),
  });
  assert.equal(repeticao.criadas, 0);
  assert.equal(repeticao.revisoes.length, 1);
  assert.equal(repeticao.revisoes[0].id, "rev-4");
});

test("revisão histórica consulta nome pelo ID e não inventa outro simulado", () => {
  const antiga = {
    origemSimulado: {
      tentativaId: "antiga-1",
      materiaDiagnostico: "Português",
      assuntoDiagnostico: "Verbos",
      vinculo: "sem_conteudo" as const,
    },
  } as Revisao;
  assert.equal(rotuloOrigemRevisaoSimulado(antiga), "Revisão de erros · Simulado");
  assert.equal(rotuloOrigemRevisaoSimulado(antiga, { "antiga-1": "Simulado 10" }), "Revisão de erros · Simulado 10");
  assert.equal(rotuloOrigemRevisaoSimulado(antiga, { "outra": "Simulado 4" }), "Revisão de erros · Simulado");
  assert.equal(rotuloOrigemRevisaoSimulado({} as Revisao), null);
});

test("revisão comum preexistente não é rotulada incorretamente após reforço por simulado", () => {
  const antiga = {
    id: "antiga",
    materiaId: "m-portugues",
    assuntoId: "a-verbos",
    materia: "Língua Portuguesa",
    assunto: "Verbos",
    etapa: 1,
    dataCriacao: "2026-10-01T12:00:00.000Z",
    dataPrevista: "2026-10-28T12:00:00.000Z",
    concluida: false,
  } as Revisao;
  const resultado = adicionarErrosSimuladoARevisao({
    revisoes: [antiga], materias: [], analise: diagnostico(),
    agora: new Date("2026-10-18T13:00:00.000Z"),
  });
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0].id, antiga.id);
  assert.equal(rotuloOrigemRevisaoSimulado(resultado.revisoes[0]), null);
});

test("outra prova não sobrescreve a origem conhecida da revisão existente", () => {
  const primeira = adicionarErrosSimuladoARevisao({
    revisoes: [], materias: [], analise: diagnostico(), criarId: () => "rev-4",
  });
  const segunda = adicionarErrosSimuladoARevisao({
    revisoes: primeira.revisoes, materias: [],
    analise: diagnostico("Simulado 10", "prova-10"),
  });
  assert.equal(segunda.criadas, 0);
  assert.equal(segunda.revisoes[0].origemSimulado?.nome, "Simulado 4");
});

test("fila, histórico, dashboard e calendário exibem a origem rastreável", async () => {
  const [fila, dashboard, calendario] = await Promise.all([
    readFile("src/pages/Revisoes/Revisoes.tsx", "utf8"),
    readFile("src/pages/Dashboard/Dashboard.tsx", "utf8"),
    readFile("src/pages/Calendario/Calendario.tsx", "utf8"),
  ]);
  assert.match(fila, /rotuloOrigemRevisaoSimulado\(revisao, nomesSimulados\)/);
  assert.match(dashboard, /rotuloOrigemRevisaoSimulado\(revisao, nomesSimulados\)/);
  assert.match(calendario, /rotuloOrigemRevisaoSimulado\(revisao, nomesSimulados\)/);
});
