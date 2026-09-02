import assert from "node:assert/strict";
import test from "node:test";
import type { Revisao, SessaoEstudo } from "../src/types/index.ts";
import { avaliarRevisaoPorQuestoes, concluirRevisaoNaLista } from "../src/utils/revisoes.ts";
import { aplicarAlteracoesComVinculoSeguro } from "../src/utils/vinculoPlano.ts";

const agora = new Date(2026, 8, 2, 12);
const revisao: Revisao = {
  id: "revisao", materia: "Português", materiaId: "portugues",
  assunto: "Fonemas", assuntoId: "fonemas", moduloId: "geral",
  etapa: 2, concluida: false, dataCriacao: agora.toISOString(), dataPrevista: agora.toISOString(),
};
const sessao: SessaoEstudo = {
  id: "sessao", revisaoId: revisao.id, materia: revisao.materia, materiaId: revisao.materiaId,
  assunto: revisao.assunto, assuntoId: revisao.assuntoId, moduloId: revisao.moduloId,
  tipo: "revisao", formatoRevisao: "questoes", minutos: 17, data: agora.toISOString(),
  quantidadeQuestoes: 10, quantidadeAcertos: 8, quantidadeErros: 2,
};
const parametros = {
  revisaoId: revisao.id, desempenho: "facil" as const, limiteDiario: 2, agora, proximaId: "proxima", sessao,
};

test("avaliação usa acertos sobre o total sem arredondar os limites de 50% e 80%", () => {
  for (const [total, certas, esperado] of [
    [10, 8, "facil"], [10, 5, "media"], [10, 4, "dificil"], [10, 0, "dificil"],
    [1000, 499, "dificil"], [1000, 799, "media"], [10, 10, "facil"],
  ] as const) assert.equal(avaliarRevisaoPorQuestoes(total, certas), esperado);
  // Questões em branco pertencem ao total, nunca aumentam a taxa de acertos.
  assert.equal(avaliarRevisaoPorQuestoes(10, 4), "dificil");
});

test("avaliação recusa dados ausentes, fracionários, negativos ou inconsistentes", () => {
  for (const [total, certas] of [[10, undefined], [undefined, 1], [0, 0], [10, -1], [10, 11], [1.5, 1], [10, 1.5], [NaN, 1], [10, Infinity]]) {
    assert.equal(avaliarRevisaoPorQuestoes(total, certas), null);
  }
});

test("concluir a sessão guarda seu vínculo e resultado e agenda a próxima etapa uma única vez", () => {
  const lista = [revisao];
  const resultado = concluirRevisaoNaLista({ ...parametros, revisoes: lista });
  const concluida = resultado.find((item) => item.id === revisao.id)!;
  assert.equal(concluida.concluida, true);
  assert.equal(concluida.sessaoId, sessao.id);
  assert.equal(concluida.desempenho, "facil");
  assert.equal(concluida.certas, 8);
  assert.equal(concluida.erradas, 2);
  assert.equal(resultado[0].etapa, 3);
  assert.equal(new Date(resultado[0].dataPrevista).getDate(), 9);
  assert.equal(lista[0].concluida, false);
  assert.equal(concluirRevisaoNaLista({ ...parametros, revisoes: resultado }), resultado);
  // Replay do updater do React também produz exatamente os mesmos IDs e datas.
  assert.deepEqual(concluirRevisaoNaLista({ ...parametros, revisoes: lista }), resultado);
});

test("dificuldade repete a etapa até a última; fácil encerra o ciclo na etapa 4", () => {
  for (const [desempenho, dia] of [["media", 5], ["dificil", 3]] as const) {
    const resultado = concluirRevisaoNaLista({ ...parametros, desempenho, revisoes: [{ ...revisao, etapa: 4 }] });
    assert.equal(resultado.length, 2);
    assert.equal(resultado[0].etapa, 4);
    assert.equal(new Date(resultado[0].dataPrevista).getDate(), dia);
  }
  const resultado = concluirRevisaoNaLista({ ...parametros, revisoes: [{ ...revisao, etapa: 4 }] });
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].concluida, true);
});

test("agenda respeita a capacidade e preserva outra revisão pendente sem duplicar", () => {
  const ocupada = { ...revisao, id: "outra", assuntoId: "silabas", dataPrevista: new Date(2026, 8, 3, 12).toISOString() };
  const resultado = concluirRevisaoNaLista({ ...parametros, desempenho: "dificil", limiteDiario: 1, revisoes: [revisao, ocupada] });
  assert.equal(new Date(resultado[0].dataPrevista).getDate(), 4);
  assert.equal(resultado.find((item) => item.id === "outra"), ocupada);
  const jaAgendada = { ...revisao, id: "agendada", etapa: 3 as const };
  const semDuplicata = concluirRevisaoNaLista({ ...parametros, revisoes: [revisao, jaAgendada] });
  assert.equal(semDuplicata.length, 2);
  assert.equal(semDuplicata[1], jaAgendada);
});

test("sessão sem vínculo ou de outro conteúdo nunca conclui uma revisão", () => {
  const revisoes = [revisao];
  for (const alteracoes of [
    { revisaoId: undefined }, { revisaoId: "outra" }, { materiaId: "historia" },
    { assuntoId: "silabas" }, { moduloId: "outro" }, { tipo: "questoes" as const },
  ]) {
    assert.equal(concluirRevisaoNaLista({ ...parametros, revisoes, sessao: { ...sessao, ...alteracoes } }), revisoes);
  }
});

test("trocar formato preserva revisão, trocar assunto ou tipo desfaz o vínculo", () => {
  assert.equal(aplicarAlteracoesComVinculoSeguro(sessao, { formatoRevisao: "teoria" }).revisaoId, revisao.id);
  assert.equal(aplicarAlteracoesComVinculoSeguro(sessao, { objetivo: "Ler novamente" }).revisaoId, revisao.id);
  assert.equal(aplicarAlteracoesComVinculoSeguro(sessao, { assuntoId: "silabas" }).revisaoId, undefined);
  assert.equal(aplicarAlteracoesComVinculoSeguro(sessao, { tipo: "aula" }).revisaoId, undefined);
});

test("conclusão teórica usa avaliação manual sem inventar acertos", () => {
  const teorica: SessaoEstudo = { ...sessao, formatoRevisao: "teoria", quantidadeAcertos: undefined, quantidadeErros: undefined };
  const resultado = concluirRevisaoNaLista({ ...parametros, desempenho: "media", sessao: teorica, revisoes: [revisao] });
  assert.equal(resultado[1].certas, undefined);
  assert.equal(resultado[1].desempenho, "media");
  assert.equal(new Date(resultado[0].dataPrevista).getDate(), 5);
});
