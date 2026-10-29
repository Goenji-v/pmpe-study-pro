import assert from "node:assert/strict";
import { test } from "node:test";
import { arquivoMidiaValido } from "./validacaoMidia.ts";

test("aceita JPEG com assinatura FF D8 FF", () => {
  assert.equal(arquivoMidiaValido(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), "image/jpeg"), true);
});

test("aceita JPEG com bytes extras após o marcador final", () => {
  assert.equal(arquivoMidiaValido(Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01]), "image/jpeg"), true);
});

test("rejeita JPEG falso e arquivo curto", () => {
  assert.equal(arquivoMidiaValido(Buffer.from([0xff, 0xd8, 0x00, 0xd9]), "image/jpeg"), false);
  assert.equal(arquivoMidiaValido(Buffer.from([0xff, 0xd8]), "image/jpeg"), false);
});

test("preserva assinaturas PDF, PNG e WEBP", () => {
  assert.equal(arquivoMidiaValido(Buffer.from("%PDF-1.7"), "application/pdf"), true);
  assert.equal(arquivoMidiaValido(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(arquivoMidiaValido(Buffer.from("RIFF0000WEBP"), "image/webp"), true);
});
