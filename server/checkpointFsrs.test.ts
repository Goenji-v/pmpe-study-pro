import assert from "node:assert/strict";
import test from "node:test";
import type { Materia, Revisao } from "../src/types";
import { decidirGravacao, prepararCheckpoint, type EscopoFsrs, type RegistroFsrs,
  type TransporteFsrs } from "../src/services/inteligenciaRevisao/checkpoint";
import { observarSessoes, type Observacao } from "../src/services/inteligenciaRevisao/eventos";
import { carregarMemoria, versaoMemoria } from "../src/services/inteligenciaRevisao/memoria";
import { planejarRevisoes, type EntradaPlano } from "../src/services/inteligenciaRevisao/plano";

const escopo: EscopoFsrs = { usuarioId: "sintetico", epoca: "inicial" };
const materias: Materia[] = [{ id: "m", nome: "Matéria", assuntos: [
  { id: "a", nome: "Assunto", prioridade: "alta", concluido: true, idsLegados: ["antigo"] },
] }];
const observacoes = observarSessoes(escopo.usuarioId, [{
  id: "aula", data: "2027-01-01T15:00:00Z", tipo: "aula", materia: "Matéria", materiaId: "m",
  assunto: "Assunto", assuntoId: "antigo", minutos: 20, conteudoConcluido: true,
}]);
const questoes: Observacao = {
  evento: { ...observacoes[0].evento, ocorrenciaId: "questoes", tipo: "recuperacao", ocorridoEm: "2027-01-02T15:00:00Z" },
  evidencia: { modo: "recuperacao", certas: 8, erradas: 2 },
};
const revisaoLegada: Revisao = { id: "legada", materia: "Matéria", materiaId: "m", assunto: "Assunto", assuntoId: "antigo",
  etapa: 4, concluida: true, desempenho: "facil", dataPrevista: "2026-12-30T15:00:00Z", dataCriacao: "2026-12-27T15:00:00Z" };
const entrada: EntradaPlano = { materias, revisoes: [revisaoLegada], diario: { versao: versaoMemoria, retencao: .9, observacoes },
  agora: new Date("2027-01-02T20:00:00Z"), limites: { minutos: 30, revisoes: 1, semana: [0, 1, 2, 3, 4, 5, 6] },
  compromissos: [] };

async function gerar(lista: Observacao[], revisao: number, e = entrada) {
  const dados = { ...e, diario: { ...e.diario, observacoes: lista } };
  return prepararCheckpoint(escopo, dados, await planejarRevisoes(dados), revisao);
}

test("checkpoint reidrata avaliações reais sem converter nota legada em rating", async () => {
  const inicial = await gerar(observacoes, 1);
  assert.equal(inicial.avaliados.length, 0);
  assert.equal(inicial.estados[0].cartao, undefined);
  assert.equal(inicial.agendamentos[0].ideal, "2027-01-02");
  const dados = await gerar([...observacoes, questoes, questoes], 2);
  assert.equal(dados.avaliados.length, 1);
  assert.equal(dados.diario.observacoes.length, 2);
  const motor = await carregarMemoria(materias, JSON.parse(JSON.stringify(dados.diario)), entrada.agora);
  assert.deepEqual([...motor.estados.values()], dados.estados);
  assert.deepEqual(entrada.revisoes, [revisaoLegada]);
});

test("dois clientes compartilham o CAS e recuperam resposta perdida sem duplicar", async () => {
  let atual: RegistroFsrs | undefined;
  const servico: TransporteFsrs = {
    ler: async () => atual,
    confirmar: async (proposta, base) => {
      const resultado = decidirGravacao(atual, proposta, base);
      if (resultado.status === "gravado") atual = resultado.registro;
      return resultado;
    },
  };
  const primeira = await gerar(observacoes, 1);
  const segunda = await gerar([...observacoes, questoes], 2);
  const [a, b] = await Promise.all([servico.confirmar(primeira, 0), servico.confirmar(segunda, 0)]);
  assert.equal(a.status, "gravado");
  assert.equal(b.status, "conflito");
  assert.equal((await servico.confirmar(segunda, 1)).status, "gravado");
  assert.equal((await servico.confirmar(segunda, 1)).status, "repetido");
  assert.equal((await servico.confirmar(primeira, 2)).status, "conflito");
  assert.deepEqual((await servico.ler(escopo))?.checkpoint, segunda);
});

test("preserva variantes conflitantes e protege o escopo de conta e reinício", async () => {
  const conflito = { ...questoes, evidencia: { ...questoes.evidencia, certas: 7 } };
  const estado = await gerar([...observacoes, questoes, conflito], 1);
  assert.equal(estado.diario.observacoes.length, 3);
  assert.equal(estado.pendentes.length, 1);
  assert.equal(estado.avaliados.length, 0);
  const a = decidirGravacao(undefined, estado, 0);
  assert.equal(a.status, "gravado");
  assert.throws(() => decidirGravacao(a.registro, { ...estado, escopo: { ...escopo, epoca: "reiniciado" } }, 1));
});

test("revisão atual não autoriza apagar observações nem publicar um calendário fora de ordem", async () => {
  const completo = await gerar([...observacoes, questoes], 2);
  const gravado = decidirGravacao(undefined, completo, 0);
  assert.equal(gravado.status, "gravado");
  const desfalcado = await gerar(observacoes, 3);
  assert.equal(decidirGravacao(gravado.registro, desfalcado, 1).status, "conflito");
  assert.equal(decidirGravacao(gravado.registro, { ...completo, calculadoPara: "2027-01-01" }, 1).status, "conflito");
  assert.equal(decidirGravacao(gravado.registro, { ...completo, revisaoLegado: undefined }, 1).status, "conflito");
});
