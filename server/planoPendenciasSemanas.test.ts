import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SemanaPlano } from "../src/data/planoPMPE";
import {
  ampliarPlanoAteSemana,
  getProximaMissao,
  getSemanaAtual,
  listarPendenciasAteSemana,
  semanaPorDataInicio,
} from "../src/utils/planoUtils";

const semanas: SemanaPlano[] = Array.from({length:4}, (_, i) => ({
  numero:i+1, nome:`Semana ${i+1}`,
  dias:[{numero:1, missoes:[{id:`m-${i+1}`,numero:1,materia:"Português",assunto:`Assunto ${i+1}`,tipo:"conteudo"}]}]
}));

test("semana 4 avança para 5 na segunda-feira mesmo sem marcar qualquer missão",()=>{
  // Início na segunda-feira 21/09; semana 5 começa em 19/10.
  assert.equal(semanaPorDataInicio("2026-09-21", new Date(2026,9,18,12)),4);
  assert.equal(semanaPorDataInicio("2026-09-21", new Date(2026,9,19,12)),5);
  assert.equal(getSemanaAtual([],semanas,undefined,"2026-09-21",new Date(2026,9,24,12)),5);
});
test("fuso de verão não deve fazer semana avançar ou atrasar",()=>{
  assert.equal(semanaPorDataInicio("2026-10-01", new Date(2026,9,5,12)),2);
  assert.equal(semanaPorDataInicio("2026-10-01", new Date(2026,9,4,12)),1);
});
test("sem data de início definida, não inventa a idade do plano",()=>{
  assert.equal(semanaPorDataInicio(undefined),null);
  assert.equal(semanaPorDataInicio("2026-99-01"),null);
  assert.equal(semanaPorDataInicio("2026-02-30"),null);
});
test("semanas novas são exibidas vazias; não criam assunto fictício",()=>{
  const a=ampliarPlanoAteSemana(semanas,5);
  assert.equal(a.length,5);
  assert.equal(a[4].numero,5);
  assert.equal(a[4].dias.length,7);
  assert.ok(a[4].dias.every(d=>d.missoes.length===0));
  assert.deepEqual(a.slice(0,4),semanas);
});
test("pendências antigas aparecem antes das novas; semana avançada não diz plano concluído",()=>{
  const feitas=["m-1","m-3"];
  const a=ampliarPlanoAteSemana(semanas,5);
  const atrasadas=listarPendenciasAteSemana(feitas,a,5);
  assert.deepEqual(atrasadas.map(x=>x.missao.id),["m-2","m-4"]);
  assert.equal(getProximaMissao(feitas,a,5)?.missao.id,"m-2");
  assert.equal(getSemanaAtual(feitas,a,undefined,"2026-09-21",new Date(2026,9,24,12)),5);
  assert.deepEqual(feitas,["m-1","m-3"]);
});
test("régua extra e revisões separadas não aparecem no plano",()=>{
  const pagina=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx","utf8");
  assert.doesNotMatch(pagina,/reajuste-visual-individual|Aplicar régua nesta conta|Fila separada de revisões/);
  assert.match(pagina,/base, Math.max\(semanaCalendario, configuracoes.semanaAtualPlano \?\? 1\)/);
});
