import assert from "node:assert/strict";
import test from "node:test";
import type { Revisao } from "../src/types";
import { identificarGrupoIntegrado } from "../src/utils/catalogoRevisoesIntegradas";
import { chaveAssuntoPrincipal, pendentesUnicasPorAssunto, reconciliarArgumentativaLegada, tituloAssuntoPrincipal } from "../src/utils/revisoesAssuntoPrincipal";

function revisao(id: string, assunto: string, materia = "Raciocínio Lógico"): Revisao {
  return {
    id, materia, assunto, materiaId: "rlm", assuntoId: id,
    etapa: 2, concluida: false,
    dataCriacao: "2026-11-20T12:00:00.000Z",
    dataPrevista: "2026-11-27T12:00:00.000Z",
  };
}

test("Lógica Proposicional e nomes legados pertencem ao mesmo ciclo", () => {
  const atual = revisao("nova", "Lógica Proposicional");
  const antiga = revisao("antiga", "Conectivos, tabelas-verdade e negação");
  const tabela = revisao("tabela", "Tabela verdade");
  const chave = chaveAssuntoPrincipal(atual);
  assert.equal(identificarGrupoIntegrado(atual)?.id, "logica-proposicional");
  assert.equal(chave, chaveAssuntoPrincipal(antiga));
  assert.equal(chave, chaveAssuntoPrincipal(tabela));
  assert.equal(pendentesUnicasPorAssunto([atual, antiga, tabela]).length, 1);
});

test("Lógica argumentativa permanece separada de Lógica Proposicional", () => {
  const atual = revisao("nova", "Lógica Proposicional");
  const distinta = revisao("argumentativa", "Lógica argumentativa");
  assert.equal(identificarGrupoIntegrado(distinta), null);
  assert.equal(pendentesUnicasPorAssunto([atual, distinta]).length, 2);
});

test("A deduplicação é somente projeção e preserva IDs, etapas e histórico", () => {
  const primeira = revisao("a", "Conectivos lógicos");
  const segunda = { ...revisao("b", "Lógica Proposicional"), etapa: 3 as const };
  const concluida = { ...revisao("c", "Tabela verdade"), concluida: true };
  const entrada = [primeira, segunda, concluida];
  const antes = JSON.stringify(entrada);
  assert.equal(pendentesUnicasPorAssunto(entrada).length, 1);
  assert.equal(entrada.length, 3);
  assert.equal(JSON.stringify(entrada), antes);
});

test("Argumentativa: teoria e exercícios são um único ciclo distinto da proposicional", () => {
  const teoria = revisao("teoria", "Lógica argumentativa");
  const exercicios = revisao("ex", "Exercícios - Lógica argumentativa", "Raciocínio Lógico e Matemática");
  const outro = revisao("outro", "Lógica Proposicional");
  assert.equal(chaveAssuntoPrincipal(teoria), "rlm:logica-argumentativa");
  assert.equal(chaveAssuntoPrincipal(teoria), chaveAssuntoPrincipal(exercicios));
  assert.equal(tituloAssuntoPrincipal(exercicios), "Lógica argumentativa");
  assert.equal(pendentesUnicasPorAssunto([teoria, exercicios, outro]).length, 2);
  assert.equal(chaveAssuntoPrincipal(revisao("hist", "Exercícios de lógica argumentativa", "História")), null);
});

test("Argumentativa: mantém conclusão e retorno de 14/12, vincula atraso de 25/11", () => {
  const data = "2026-11-27T20:00:00.000Z";
  const antiga = {...revisao("ex", "Exercícios - Lógica argumentativa"), dataPrevista: "2026-11-25T12:00:00.000Z", certas: 6, erradas: 4};
  const concluida: Revisao = {...revisao("teoria", "Lógica argumentativa"), etapa: 3, concluida: true, dataConclusao: data, certas: 5, erradas: 1};
  const retorno: Revisao = {...revisao("retorno", "Lógica argumentativa"), assuntoId: concluida.assuntoId, etapa: 4, dataCriacao: data, dataPrevista: "2026-12-14T12:00:00.000Z"};
  const entrada = [antiga, concluida, retorno];
  const antes = JSON.stringify(entrada);
  const saida = reconciliarArgumentativaLegada(entrada);
  assert.deepEqual(pendentesUnicasPorAssunto(saida), [retorno]);
  assert.deepEqual(saida[0], {...antiga, integradaEmId: concluida.id, integradaEm: data});
  assert.equal(saida[1], concluida);
  assert.equal(saida[2], retorno);
  assert.equal(JSON.stringify(entrada), antes);
  assert.equal(reconciliarArgumentativaLegada(saida), saida);
  assert.equal(reconciliarArgumentativaLegada([antiga, concluida])[0], antiga);
  const nova = {...antiga, dataCriacao: "2026-11-28T12:00:00.000Z"};
  assert.equal(reconciliarArgumentativaLegada([nova, concluida, retorno])[0], nova);
});
