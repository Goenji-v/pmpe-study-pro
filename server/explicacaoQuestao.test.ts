import assert from "node:assert/strict";
import test from "node:test";

import {
  estruturarExplicacaoQuestao,
} from "../src/utils/explicacaoQuestao.ts";

test("separa a explicacao geral das correcoes por alternativa", () => {
  const resultado = estruturarExplicacaoQuestao(
    "A sesmaria era o instrumento jurídico de concessão de terras indivisas ou devolutas pela Coroa, sob a condição obrigatória de cultivo. A está errada por confundir com pequenas propriedades de subsistência. C está errada porque a sesmaria era uma concessão individual (privada). D está errada pois a terra era concedida pela Coroa. E está errada pois a finalidade era justamente a exploração econômica."
  );

  assert.equal(
    resultado.resumo,
    "A sesmaria era o instrumento jurídico de concessão de terras indivisas ou devolutas pela Coroa, sob a condição obrigatória de cultivo."
  );

  assert.deepEqual(
    resultado.alternativas.map(
      ({ letra, status }) => ({
        letra,
        status,
      })
    ),
    [
      { letra: "A", status: "errada" },
      { letra: "C", status: "errada" },
      { letra: "D", status: "errada" },
      { letra: "E", status: "errada" },
    ]
  );

  assert.equal(
    resultado.alternativas[0].texto,
    "por confundir com pequenas propriedades de subsistência."
  );
});

test("reconhece alternativa correta e variacoes de escrita", () => {
  const resultado = estruturarExplicacaoQuestao(
    "Resumo da regra. Alternativa B é a correta porque corresponde ao conceito. C esta incorreta por outro motivo."
  );

  assert.equal(
    resultado.alternativas[0].letra,
    "B"
  );
  assert.equal(
    resultado.alternativas[0].status,
    "correta"
  );
  assert.equal(
    resultado.alternativas[1].letra,
    "C"
  );
  assert.equal(
    resultado.alternativas[1].status,
    "errada"
  );
});

test("mantem explicacao comum quando nao ha marcadores de alternativa", () => {
  const resultado = estruturarExplicacaoQuestao(
    "A regra aplicável decorre do conceito apresentado no enunciado."
  );

  assert.equal(
    resultado.resumo,
    "A regra aplicável decorre do conceito apresentado no enunciado."
  );
  assert.deepEqual(
    resultado.alternativas,
    []
  );
});
