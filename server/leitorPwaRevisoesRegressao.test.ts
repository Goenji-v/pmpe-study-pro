import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Revisao } from "../src/types";
import { revisaoCorrespondeASessao } from "../src/utils/revisoes";

const ler = (path: string) => readFileSync(path, "utf8");

test("PWA publica tamanhos reais e mantém marca maskable segura", () => {
  const manifest = JSON.parse(ler("public/manifest.webmanifest")) as {
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };
  const esperados = [
    ["192x192", "any", "study-pro-192.png"],
    ["512x512", "any", "study-pro-512.png"],
    ["512x512", "maskable", "study-pro-maskable-512.png"],
  ] as const;
  for (const [sizes, purpose, file] of esperados) {
    const icone = manifest.icons.find((i) => i.sizes === sizes && i.purpose === purpose);
    assert.ok(icone, `Ícone ${sizes} ${purpose} ausente`);
    assert.ok(icone.src.includes(file));
    const buffer = readFileSync(`public/assets/${file}`);
    assert.equal(buffer.subarray(1, 4).toString(), "PNG");
    const [largura, altura] = sizes.split("x").map(Number);
    assert.equal(buffer.readUInt32BE(16), largura);
    assert.equal(buffer.readUInt32BE(20), altura);
  }
  const html = ler("index.html");
  assert.match(html, /study-pro-apple-180\.png\?v=6/);
  assert.match(html, /study-pro-favicon-64\.png\?v=6/);
  assert.match(html, /manifest\.webmanifest\?v=6/);
});

test("leitor PDF ocupa a janela e conserva leitor/anotações e alternativa de pop-up", () => {
  const css = ler("src/components/LeitorMaterial/LeitorMaterial.css");
  const reader = ler("src/components/LeitorMaterial/LeitorMaterial.tsx");
  assert.match(css, /width:100vw;max-width:100vw;height:100dvh;max-height:100dvh/);
  assert.doesNotMatch(css, /1200px|92dvh/);
  assert.match(css, /leitor-drive-preview/);
  assert.match(reader, /<PdfAnotavel/);
  assert.match(reader, /onAnotacoesChange=\{guardar\}/);
  assert.match(reader, /aberturaExternaBloqueada/);
  assert.match(reader, /Abrir PDF em nova aba/);
  assert.match(reader, /study:abrir-pdf-interno/);
});

test("preferência PDF é autossalva sem trocar outros campos da conta", () => {
  const config = ler("src/pages/Configuracoes/Configuracoes.tsx");
  const tipos = ler("src/types/index.ts");
  assert.match(tipos, /aberturaPdf\?: "interno" \| "navegador"/);
  assert.match(config, /setConfiguracoes\(\(anterior\) => \(\{ \.\.\.anterior, aberturaPdf \}\)\)/);
  assert.match(config, /Dentro do Study Pro/);
  assert.match(config, /No navegador — nova aba/);
  assert.match(config, /salvarMarcacoesPdf/);
});

test("seleção de revisão mantém identidade histórica até finalizar a sessão", () => {
  const rev: Revisao = {
    id: "revisao-1",
    materiaId: "materia-antiga",
    assuntoId: "assunto-antigo",
    materia: "Direito Constitucional",
    assunto: "Dos princípios fundamentais",
    etapa: 1,
    dataCriacao: "2026-10-20T12:00:00Z",
    dataPrevista: "2026-10-21T12:00:00Z",
    concluida: false,
  };
  const sessao = {
    tipo: "revisao" as const,
    revisaoId: rev.id,
    materiaId: rev.materiaId,
    assuntoId: rev.assuntoId,
    moduloId: undefined,
    materia: rev.materia,
    assunto: rev.assunto,
  };
  assert.equal(revisaoCorrespondeASessao(rev, sessao), true);
  assert.equal(revisaoCorrespondeASessao(rev, { ...sessao, revisaoId: "outra" }), false);
  assert.equal(revisaoCorrespondeASessao(rev, { ...sessao, assuntoId: "assunto-homonimo" }), false);

  const central = ler("src/pages/CentralEstudos/CentralEstudos.tsx");
  const trecho = central.split("function selecionarRevisaoPendente(")[1]?.split("\n  function alterarTipo(")[0] ?? "";
  assert.match(trecho, /revisaoId: revisao\.id/);
  assert.match(trecho, /materiaId: revisao\.materiaId/);
  assert.match(trecho, /assuntoId: revisao\.assuntoId/);
  const resumo = ler("src/utils/revisoesCentral.ts");
  assert.match(central, /resumoRevisoesDaCentral\(revisoes\)/);
  assert.match(resumo, /\.filter\(\(item\) => !item\.concluida\)/);
});
