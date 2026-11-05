import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const codigo = readFileSync("src/context/CronometroContext.tsx", "utf8");
const estilo = readFileSync("src/context/CronometroBloqueio.css", "utf8");

test("iniciar e preparar preservam cronômetro rodando ou pausado até confirmação",()=>{
 const inicio = codigo.slice(codigo.indexOf("function iniciar(dados:"), codigo.indexOf("function iniciarSemBloqueio("));
 const preparo = codigo.slice(codigo.indexOf("function prepararSessao(dados:"), codigo.indexOf("function prepararSessaoSemBloqueio("));
 assert.match(inicio,/sessaoEmExecucao\(\)/);
 assert.match(inicio,/setTrocaPendente\(\{ acao: "iniciar", dados \}\)/);
 assert.match(inicio,/return false/);
 assert.match(preparo,/sessaoEmExecucao\(\)/);
 assert.match(preparo,/setTrocaPendente\(\{ acao: "preparar", dados \}\)/);
 assert.match(codigo,/cronometroAtivo \|\| carregarSessao\(chaveStorage\)\.status !== "parado"/);
 assert.doesNotMatch(inicio,/localStorage\.removeItem/);
 assert.doesNotMatch(preparo,/localStorage\.removeItem/);
});
test("descartar só executa depois do clique e não finaliza a sessão antiga",()=>{
 const inicio = codigo.indexOf("function confirmarTrocaSessao()");
 const fim = codigo.indexOf("function cancelar(",inicio);
 const confirmar = codigo.slice(inicio,fim);
 assert.ok(inicio>0 && fim>inicio);
 assert.match(confirmar,/setTrocaPendente\(null\)/);
 assert.match(confirmar,/localStorage\.removeItem\(chaveStorage\)/);
 assert.match(confirmar,/iniciarSemBloqueio\(dados\)/);
 assert.match(confirmar,/prepararSessaoSemBloqueio\(dados\)/);
 assert.doesNotMatch(confirmar,/finalizar\(/);
 assert.match(codigo,/onClick=\{confirmarTrocaSessao\}/);
 assert.match(codigo,/onClick=\{\(\) => setTrocaPendente\(null\)\}/);
 assert.match(codigo,/As atividades já finalizadas e salvas continuam intactas/);
});
test("conflito mostra atividade em andamento e controles acessíveis",()=>{
 assert.match(codigo,/role="alertdialog"/);
 assert.match(codigo,/aria-modal="true"/);
 assert.match(codigo,/Manter atividade atual/);
 assert.match(codigo,/Descartar e começar outra/);
 assert.match(codigo,/sessaoAtiva\.materia/);
 assert.match(codigo,/sessaoAtiva\.assunto/);
 assert.match(estilo,/\.cronometro-bloqueio-overlay/);
 assert.match(estilo,/@media\(min-width:520px\)/);
});

const codigoPlano = readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx", "utf8");
const codigoCentral = readFileSync("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8");

test("Plano Tático encaminha a missão escolhida mesmo havendo cronômetro anterior", () => {
  const inicio = codigoPlano.indexOf("function iniciarEstudo(");
  const fim = codigoPlano.indexOf("function iniciarQuestoesReforco(", inicio);
  assert.ok(inicio >= 0 && fim > inicio);
  const abrirEstudo = codigoPlano.slice(inicio, fim);
  assert.doesNotMatch(abrirEstudo, /if\s*\(\s*cronometroAtivo\s*\)/);
  assert.match(abrirEstudo, /criarDadosSessaoDaMissao\s*\(/);
  assert.match(abrirEstudo, /sessionStorage\.setItem\s*\(/);
  assert.match(abrirEstudo, /prefillSessao:\s*dadosSessao/);

  const preparar = codigoCentral.slice(
    codigoCentral.indexOf("const prefillAplicadoRef"),
    codigoCentral.indexOf("const materiaSelecionada")
  );
  assert.match(preparar, /location\.state as EstadoNavegacaoCentral/);
  assert.match(preparar, /prepararSessao\s*\(\s*\{/);
  assert.match(preparar, /missaoId:\s*prefill\.missaoId/);
});
