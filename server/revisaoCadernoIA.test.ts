import assert from "node:assert/strict";
import test from "node:test";
import type { QuestaoIA } from "../src/types";
import type { CadernoSimuladoIA } from "../src/services/cadernosSimuladosIAService";
import {
  consolidarTentativasRevisao, pertenceAoCaderno, possuiCorrecaoCompleta,
  recuperarRespostasDaTentativa, numerarQuestoesRevisao, normalizarTentativaRevisao,
  type TentativaRevisaoIA,
} from "../src/utils/revisaoCadernoIA";

const questoes: QuestaoIA[] = ["q1", "q2", "q3"].map((id) => ({
  id, materia: "Português", assunto: "Sílaba", banca: "AOCP", dificuldade: "Média",
  enunciado: `Enunciado ${id}`, alternativas: { A: "Correta", B: "Outra", C: "C", D: "D", E: "E" },
  respostaCorreta: "A", explicacao: "Comentário salvo.",
}));
const data = "2026-09-01T15:00:00.000Z";
const tentativa: TentativaRevisaoIA = {
  id: "t1", data, cadernoId: "c1", total: 3, certas: 1, erradas: 1, emBranco: 1, percentual: 33.33,
};
const caderno: CadernoSimuladoIA = {
  id: "c1", nome: "Português", materia: "Português", assunto: "Sílaba", banca: "AOCP",
  dificuldade: "Mista", questoes, criadoEm: data, atualizadoEm: data,
  estatisticas: { tentativas: 1, acertos: 1, erros: 1, emBranco: 1, aproveitamento: 33.33, ultimaTentativaEm: data },
};

test("vínculo explícito impede misturar cadernos que reutilizam as mesmas questões", () => {
  assert.equal(pertenceAoCaderno({ ...tentativa, cadernoId: "outro", questoes }, caderno), false);
  assert.equal(pertenceAoCaderno({ ...tentativa, cadernoId: undefined, questoes }, caderno), true);
  assert.equal(pertenceAoCaderno({ ...tentativa, cadernoId: undefined, data: "2026-08-31T15:00:00Z" }, caderno), false);
});

test("auditoria remota prevalece sobre respostas e gabarito antigos sem duplicar a tentativa", () => {
  const local = { ...tentativa, questoes, respostas: { q1: "A" as const, q2: "B" as const } };
  const remota: TentativaRevisaoIA = { ...tentativa, certas: 1, erradas: 0, emBranco: 1, total: 2,
    auditoria: { revisadaEm: data, totalAplicadas: 3, excluidas: [{ id: "q2", numero: 2, motivo: "Ambígua" }],
      questoesValidas: [questoes[0], questoes[2]], respostas: { q1: "A", q2: "B" } } };
  const antes = JSON.stringify({ local, remota, caderno });
  const revisoes = consolidarTentativasRevisao(caderno, [local], [remota]);
  assert.equal(revisoes.length, 1);
  assert.equal(possuiCorrecaoCompleta(revisoes[0]), true);
  assert.deepEqual(numerarQuestoesRevisao(revisoes[0]).map((q) => [q.numero, q.status]), [[1, "acerto"], [3, "branco"]]);
  assert.equal(JSON.stringify({ local, remota, caderno }), antes);
});

test("resumo remoto preserva detalhes locais da mesma tentativa e ordena as resoluções", () => {
  const local = { ...tentativa, questoes, respostas: { q1: "A" as const, q2: "B" as const } };
  const anterior = { ...local, id: "t0", data: "2026-08-31T15:00:00Z" };
  const resultado = consolidarTentativasRevisao(caderno, [anterior, local], [tentativa]);
  assert.deepEqual(resultado.map((r) => r.id), ["t1", "t0"]);
  assert.equal(possuiCorrecaoCompleta(resultado[0]), true);
});

test("recuperação antiga distingue erro, acerto e branco e ignora outra resolução", () => {
  const linhas = [
    { questao_id: "q1", resposta: "A", respondida_em: "2026-09-01T15:00:02Z" },
    { questao_id: "q2", resposta: "B", respondida_em: "2026-09-01T15:00:02Z" },
    { questao_id: "q2", resposta: "A", respondida_em: "2026-08-31T15:00:02Z" },
  ];
  const respostas = recuperarRespostasDaTentativa(tentativa, questoes, linhas);
  assert.deepEqual(respostas, { q1: "A", q2: "B" });
  assert.deepEqual(numerarQuestoesRevisao({ ...tentativa, questoes, respostas: respostas! }).map((q) => q.status), ["acerto", "erro", "branco"]);
});

test("recuperação recusa lotes incompletos ou múltiplos em vez de inventar respostas", () => {
  const linhas = [{ questao_id: "q1", resposta: "A", respondida_em: data }];
  assert.equal(recuperarRespostasDaTentativa(tentativa, questoes, linhas), null);
  const lote = [...linhas, { questao_id: "q2", resposta: "B", respondida_em: data }];
  assert.equal(recuperarRespostasDaTentativa(tentativa, questoes, [...lote, ...lote.map((l) => ({ ...l, respondida_em: "2026-09-01T15:00:03Z" }))]), null);
});

test("respostas ausentes e snapshots incoerentes não são apresentados como correção", () => {
  assert.equal(possuiCorrecaoCompleta({ ...tentativa, questoes }), false);
  assert.equal(possuiCorrecaoCompleta({ ...tentativa, questoes, respostas: {} }), false);
  assert.equal(normalizarTentativaRevisao({ id: "t", data: "inválida", certas: 1, erradas: 0 }), null);
  assert.equal(normalizarTentativaRevisao({ ...tentativa, respostas: null })?.respostas, undefined);
});
