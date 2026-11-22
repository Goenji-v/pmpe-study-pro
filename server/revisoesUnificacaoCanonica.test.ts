import assert from "node:assert/strict";
import test from "node:test";
import type { Revisao } from "../src/types";
import { identificarGrupoIntegrado } from "../src/utils/catalogoRevisoesIntegradas";
import { chaveAssuntoPrincipal, pendentesUnicasPorAssunto } from "../src/utils/revisoesAssuntoPrincipal";

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
