import assert from "node:assert/strict";
import test from "node:test";

import {
  extrairBearer,
  limiteCorpoBytes,
  montarOrigensPermitidas,
  origemPermitida,
  regraRateLimit,
  rotaPublica,
} from "./apiGatewaySecurity.ts";

test("gateway permite produção configurada e desenvolvimento local", () => {
  const permitidas = montarOrigensPermitidas("https://study.example.com");

  assert.equal(origemPermitida("https://study.example.com", permitidas), true);
  assert.equal(origemPermitida("https://pmpe-study-pro-two.vercel.app", permitidas), true);
  assert.equal(origemPermitida("http://localhost:5173", permitidas), true);
  assert.equal(origemPermitida("https://site-malicioso.example", permitidas), false);
});

test("somente saúde e preflight são públicos", () => {
  assert.equal(rotaPublica("GET", "/api/saude"), true);
  assert.equal(rotaPublica("OPTIONS", "/api/gerar"), true);
  assert.equal(rotaPublica("POST", "/api/gerar"), false);
  assert.equal(rotaPublica("POST", "/api/coach"), false);
});

test("rotas pesadas e comuns possuem limites de payload diferentes", () => {
  assert.equal(limiteCorpoBytes("/api/gerar"), 1024 * 1024);
  assert.equal(limiteCorpoBytes("/api/analisar-prova"), 36 * 1024 * 1024);
});

test("rate limit é mais restritivo para operações de maior custo", () => {
  assert.equal(regraRateLimit("/api/analisar-prova").maximo, 10);
  assert.equal(regraRateLimit("/api/coach").maximo, 30);
  assert.equal(regraRateLimit("/api/gerar").maximo, 60);
});

test("bearer só aceita cabeçalho Authorization válido", () => {
  assert.equal(extrairBearer("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extrairBearer("bearer token"), "token");
  assert.equal(extrairBearer("Basic valor"), null);
  assert.equal(extrairBearer(undefined), null);
});
