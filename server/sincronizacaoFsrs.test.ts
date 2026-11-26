import assert from "node:assert/strict";
import test from "node:test";
import type { Observacao } from "../src/services/inteligenciaRevisao/eventos";
import { combinarObservacoes, enfileirar, filaVazia, sincronizarFsrs,
  type RepositorioFilaFsrs, type RespostaFsrs } from "../src/services/inteligenciaRevisao/sincronizacao";

const escopo = { usuarioId: "sintetico", epoca: "inicial" };
const evento = (id: string): Observacao => ({
  evento: { usuarioId: escopo.usuarioId, ocorridoEm: "2027-01-01T10:00:00Z", tipo: "recuperacao",
    conteudo: { materiaId: "m", assuntoId: "a" }, origem: "sessao", ocorrenciaId: id },
  evidencia: { modo: "recuperacao", certas: 7, erradas: 3 },
});
const resposta = (eventos: Observacao[], revisao: number, revisaoLegado = 1): RespostaFsrs =>
  ({ eventos, revisao, revisaoLegado, revisaoEventos: revisao, checkpoint: null, resultado: "ok" });
function repositorio(): RepositorioFilaFsrs {
  let fila = filaVazia();
  return { ler: async () => fila, atualizar: async (_, aplicar) => fila = aplicar(fila) };
}

test("um ACK atrasado não apaga eventos enfileirados durante a chamada nem regride a foto do servidor", async () => {
  const repo = repositorio();
  const a = evento("a"), b = evento("b"), c = evento("c");
  let enviar!: () => void;
  const pediu = new Promise<void>(resolver => { enviar = resolver; });
  let liberar!: (resposta: RespostaFsrs) => void;
  const primeiraResposta = new Promise<RespostaFsrs>(resolver => { liberar = resolver; });
  await enfileirar(repo, escopo, [a]);
  const primeira = sincronizarFsrs(repo, { trocar: async (_, lote) => {
    assert.deepEqual(lote, [a]);
    enviar();
    return primeiraResposta;
  } }, escopo);
  await pediu;
  await enfileirar(repo, escopo, [b]);
  await sincronizarFsrs(repo, { trocar: async (_, lote) => resposta(combinarObservacoes(lote, [c]), 2, 2) }, escopo);
  const d = evento("d");
  await enfileirar(repo, escopo, [d]);
  liberar(resposta([a], 1, 1));
  const { fila } = await primeira;
  assert.deepEqual(fila.pendentes, [d]);
  assert.equal(fila.confirmado?.revisao, 2);
  assert.equal(fila.confirmado?.revisaoLegado, 2);
});

test("recusas, identidade alheia e ACK parcial preservam o lote", async () => {
  const repo = repositorio();
  const a = evento("a");
  await enfileirar(repo, escopo, [a]);
  await assert.rejects(sincronizarFsrs(repo, { trocar: async () => { throw new Error("offline"); } }, escopo), /offline/);
  await assert.rejects(sincronizarFsrs(repo, { trocar: async () => resposta([], 1) }, escopo), /confirmação integral/);
  await assert.rejects(sincronizarFsrs(repo, { trocar: async () => resposta([a,
    { ...a, evento: { ...a.evento, usuarioId: "outro" } }], 1) }, escopo), /outro escopo/);
  assert.deepEqual((await repo.ler(escopo)).pendentes, [a]);
});

test("lotes são limitados e variantes da mesma chave mantêm a evidência original", async () => {
  const repo = repositorio();
  const itens = Array.from({ length: 251 }, (_, i) => evento(String(i)));
  const variante = { ...itens[0], evidencia: { ...itens[0].evidencia, certas: 6 } };
  await enfileirar(repo, escopo, [...itens, itens[0], variante]);
  const { fila } = await sincronizarFsrs(repo, { trocar: async (_, lote) => {
    assert.equal(lote.length, 250);
    return resposta(lote, 1);
  } }, escopo);
  assert.deepEqual(fila.pendentes, [itens[250], variante]);
  assert.equal(combinarObservacoes(itens, [variante]).length, 252);
});
