import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catálogo inicial separa PMPE 2026 em Soldado e Oficial", async () => {
  const codigo = await readFile("src/data/editaisPredefinidos.ts", "utf8");

  assert.match(codigo, /slug: "pmpe-2026-soldado"/);
  assert.match(codigo, /cargo: "Soldado PMPE"/);
  assert.match(codigo, /grupoCargo: "soldado"/);
  assert.match(codigo, /slug: "pmpe-2026-oficial-qopm"/);
  assert.match(codigo, /cargo: "Oficial PMPE"/);
  assert.match(codigo, /grupoCargo: "oficial"/);
  assert.match(codigo, /idiomas: \["Inglês", "Espanhol"\]/);
});

test("Meu Edital prioriza catálogo e restringe upload manual ao administrador", async () => {
  const codigo = await readFile("src/pages/MeuEdital/MeuEdital.tsx", "utf8");

  assert.match(codigo, /EDITAIS PRÉ-DEFINIDOS/);
  assert.match(codigo, /Polícia Militar — Soldado/);
  assert.match(codigo, /Polícia Militar — Oficial/);
  assert.match(codigo, /\{administrador && \(/);
  assert.match(codigo, /SOMENTE ADM/);
  assert.match(codigo, /selecionarEditalCatalogo/);
  assert.match(codigo, /catalogoId: editalCatalogoSelecionado\.id/);
});

test("painel administrativo cadastra o edital uma vez para o catálogo global", async () => {
  const codigo = await readFile(
    "src/components/AdminEditaisCatalogo/AdminEditaisCatalogo.tsx",
    "utf8"
  );

  assert.match(codigo, /Adicionar edital policial/);
  assert.match(codigo, /analisarPdfEdital/);
  assert.match(codigo, /criarEditalCatalogo/);
  assert.match(codigo, /Publicar no catálogo/);
  assert.match(codigo, /PM — Soldado/);
  assert.match(codigo, /PM — Oficial/);
});

test("migration protege escrita do catálogo com sou_admin e RLS", async () => {
  const sql = await readFile(
    "supabase/migrations/20261002110000_catalogo_editais_predefinidos.sql",
    "utf8"
  );

  assert.match(sql, /alter table public\.editais_catalogo enable row level security/);
  assert.match(sql, /status = 'publicado'/);
  assert.match(sql, /public\.sou_admin\(\)/);
  assert.match(sql, /editais-catalogo/);
  assert.match(sql, /for insert\s+to authenticated[\s\S]*sou_admin/);
});


test("Meu Edital permite revisar e personalizar conteúdos antes de selecionar", async () => {
  const codigo = await readFile("src/pages/MeuEdital/MeuEdital.tsx", "utf8");

  assert.match(codigo, /Ver conteúdos/);
  assert.match(codigo, /ConteudosEditalModal/);
  assert.match(codigo, /Usar este edital com estas alterações/);
  assert.match(codigo, /Restaurar original/);
  assert.match(codigo, /\+ Adicionar matéria/);
  assert.match(codigo, /\+ Adicionar assunto/);
  assert.match(codigo, /Remover matéria/);
  assert.match(codigo, /prepararAnaliseCatalogo\(edital, \{ idioma \}\)/);
  assert.match(codigo, /analisePersonalizada \?\?/);
});

test("personalização do aluno não altera o catálogo global", async () => {
  const codigo = await readFile("src/pages/MeuEdital/MeuEdital.tsx", "utf8");

  assert.match(
    codigo,
    /As alterações feitas aqui valem apenas para o seu plano/
  );
  assert.doesNotMatch(
    codigo,
    /from\("editais_catalogo"\)[\s\S]{0,300}\.update\(/
  );
});
