import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { montarPromptAnaliseEdital } from "./editalInteligente.ts";

test("prompt do edital filtra o conteúdo pelo cargo alvo", () => {
  const prompt = montarPromptAnaliseEdital({
    nomeArquivo: "pmpe.pdf",
    concurso: "PMPE",
    banca: "AOCP",
    cargo: "Soldado PMPE",
  });

  assert.match(prompt, /cargo alvo do plano: Soldado PMPE/);
  assert.match(prompt, /FILTRO OBRIGATÓRIO/);
  assert.match(prompt, /SOMENTE matérias e assuntos aplicáveis a esse cargo/);
  assert.match(prompt, /Oficial Médico/);
  assert.match(prompt, /Oficial Dentista/);
});

test("frontend envia cargo selecionado e bloqueia cronograma se o cargo mudar", async () => {
  const [pagina, servico] = await Promise.all([
    readFile("src/pages/MeuEdital/MeuEdital.tsx", "utf8"),
    readFile("src/services/editalInteligenteService.ts", "utf8"),
  ]);

  assert.match(pagina, /"Soldado PMPE"/);
  assert.match(pagina, /cargoInicialDoEdital/);
  assert.match(pagina, /cargo: cargoAlvo/);
  assert.match(pagina, /cargoAlteradoAposAnalise/);
  assert.match(pagina, /Reanalisar para este cargo/);
  assert.match(
    pagina,
    /disabled={cargoAlteradoAposAnalise || processando}/
  );
  assert.match(servico, /cargo: contexto\.cargo \|\| ""/);
});

test("backend registra e fixa o cargo usado como filtro", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  assert.match(codigo, /cargo\?: unknown/);
  assert.match(codigo, /cargoAlvo: cargo \|\| "automatico"/);
  assert.match(codigo, /cargoDetectado: cargo/);
});
