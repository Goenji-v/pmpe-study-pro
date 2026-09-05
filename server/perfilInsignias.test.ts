import assert from "node:assert/strict";
import test from "node:test";

import type { ConquistaPermanente } from "../src/services/conquistasPermanentes";
import {
  alternarInsigniaPerfil,
  LIMITE_INSIGNIAS_PERFIL,
  normalizarInsigniasPerfil,
} from "../src/services/perfilInsignias";

function insignia(id: string, desbloqueada = true): ConquistaPermanente {
  return {
    id,
    icone: "🏅",
    titulo: id,
    descricao: id,
    raridade: "bronze",
    categoria: "inicio",
    moedas: 5,
    desbloqueada,
    progresso: desbloqueada ? 100 : 50,
    atual: "teste",
  };
}

const conquistas = [
  insignia("a"),
  insignia("b"),
  insignia("c"),
  insignia("d"),
  insignia("bloqueada", false),
];

test("perfil aceita no máximo três insígnias desbloqueadas", () => {
  const primeira = alternarInsigniaPerfil({
    atuais: [],
    insigniaId: "a",
    conquistas,
  });
  const segunda = alternarInsigniaPerfil({
    atuais: primeira.ids,
    insigniaId: "b",
    conquistas,
  });
  const terceira = alternarInsigniaPerfil({
    atuais: segunda.ids,
    insigniaId: "c",
    conquistas,
  });
  const quarta = alternarInsigniaPerfil({
    atuais: terceira.ids,
    insigniaId: "d",
    conquistas,
  });

  assert.deepEqual(terceira.ids, ["a", "b", "c"]);
  assert.equal(terceira.ids.length, LIMITE_INSIGNIAS_PERFIL);
  assert.equal(quarta.alterou, false);
  assert.equal(quarta.motivo, "limite");
  assert.deepEqual(quarta.ids, ["a", "b", "c"]);
});

test("clicar em insígnia já equipada remove do perfil", () => {
  const resultado = alternarInsigniaPerfil({
    atuais: ["a", "b"],
    insigniaId: "a",
    conquistas,
  });

  assert.equal(resultado.alterou, true);
  assert.equal(resultado.motivo, "removida");
  assert.deepEqual(resultado.ids, ["b"]);
});

test("insígnia bloqueada não pode ser exibida", () => {
  const resultado = alternarInsigniaPerfil({
    atuais: ["a"],
    insigniaId: "bloqueada",
    conquistas,
  });

  assert.equal(resultado.alterou, false);
  assert.equal(resultado.motivo, "bloqueada");
  assert.deepEqual(resultado.ids, ["a"]);
});

test("normalização remove duplicadas, bloqueadas e ids desconhecidos", () => {
  const resultado = normalizarInsigniasPerfil(
    ["a", "a", "bloqueada", "inexistente", "b", "c", "d"],
    conquistas
  );

  assert.deepEqual(resultado, ["a", "b", "c"]);
});
