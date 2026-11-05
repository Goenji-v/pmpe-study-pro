import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SemanaPlano } from "../src/data/planoPMPE";
import {
  ampliarPlanoAteSemana,
  getProximaMissao,
  getSemanaAtual,
  listarPendenciasAteSemana,
  listarPendenciasAnterioresAoDia,
  obterDataReferenciaPlano,
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
  assert.doesNotMatch(pagina,/projetarPlanoCompactado\(base, concluidas\)/);
  assert.match(pagina,/listarPendenciasAnterioresAoDia/);
});

test("data de começo do plano prevalece sobre primeiro estudo e não é alterada",()=>{
 const sessoes=[{data:"2026-07-29T15:57:39.868Z"}];
 assert.deepEqual(obterDataReferenciaPlano("2026-07-28",sessoes),{data:"2026-07-28",estimada:false});
 assert.deepEqual(obterDataReferenciaPlano(undefined,sessoes),{data:"2026-07-29",estimada:true});
 assert.deepEqual(obterDataReferenciaPlano(undefined,[]),{data:undefined,estimada:false});
 assert.equal(semanaPorDataInicio("2026-07-29",new Date(2026,10,3,12)),15);
});
test("terça cria missão nova; segunda ausente fica atrasada sem deslocar quarta",()=>{
 const plano:SemanaPlano[]=[{numero:1,nome:"Semana 1",dias:[
 {numero:1,missoes:[{id:"seg",numero:1,materia:"Português",assunto:"Crase",tipo:"conteudo"}]},
 {numero:2,missoes:[{id:"ter",numero:1,materia:"RLM",assunto:"Conectivos",tipo:"conteudo"}]},
 {numero:3,missoes:[{id:"qua",numero:1,materia:"História",assunto:"República",tipo:"conteudo"}]},
 ]}];
 const atrasadas=listarPendenciasAnterioresAoDia([],plano,1,2);
 assert.deepEqual(atrasadas.map(x=>x.missao.id),["seg"]);
 assert.equal(plano[0].dias[1].missoes[0].id,"ter");
 assert.equal(plano[0].dias[2].missoes[0].id,"qua");
 assert.deepEqual(listarPendenciasAnterioresAoDia(["seg"],plano,1,2),[]);
});
test("domingo atrasado aparece na fila, mas não substitui nova missão da terça",()=>{
 const plano:SemanaPlano[]=[{numero:1,nome:"Semana 1",dias:[{numero:7,missoes:[
 {id:"domingo",numero:1,materia:"Simulado",assunto:"Simulado semanal",tipo:"simulado"}
 ]}]},{numero:2,nome:"Semana 2",dias:[{numero:1,missoes:[
 {id:"segunda",numero:1,materia:"Português",assunto:"Verbos",tipo:"conteudo"}
 ]},{numero:2,missoes:[
 {id:"terca",numero:1,materia:"Informática",assunto:"Windows",tipo:"conteudo"}
 ]}]}];
 const atrasadas=listarPendenciasAnterioresAoDia([],plano,2,2);
 assert.deepEqual(atrasadas.map(x=>x.missao.id),["domingo","segunda"]);
 assert.equal(plano[1].dias[1].missoes[0].id,"terca");
});

test("dashboard usa a mesma configuração de redação e simulado do Plano de Estudos",()=>{
 const dashboard=readFileSync("src/components/MissaoDoDia/MissaoDoDia.tsx","utf8");
 const pagina=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx","utf8");
 assert.match(dashboard,/aplicarDiasAtividadesSemanais/);
 assert.match(pagina,/aplicarDiasAtividadesSemanais/);
 assert.match(dashboard,/listarPendenciasAnterioresAoDia/);
 assert.match(pagina,/listarPendenciasAnterioresAoDia/);
 assert.doesNotMatch(dashboard,/getProximaMissao\(/);
});
test("missão de amanhã não vira pendência de hoje",()=>{
 const plano:SemanaPlano[]=[{numero:3,nome:"Semana 3",dias:[
 {numero:1,missoes:[{id:"segunda",numero:1,materia:"Português",assunto:"Crase",tipo:"conteudo"}]},
 {numero:2,missoes:[{id:"terça",numero:1,materia:"RLM",assunto:"Conectivos",tipo:"conteudo"}]},
 {numero:3,missoes:[{id:"quarta",numero:1,materia:"Informática",assunto:"Excel",tipo:"conteudo"}]},
 ]}];
 assert.deepEqual(listarPendenciasAnterioresAoDia(["segunda"],plano,3,2),[]);
 assert.deepEqual(listarPendenciasAnterioresAoDia([],plano,3,2).map(x=>x.missao.id),["segunda"]);
 assert.deepEqual(listarPendenciasAnterioresAoDia([],plano,3,3).map(x=>x.missao.id),["segunda","terça"]);
});

test("painel de retomada separa matérias, revisões e redações/simulados em abas",()=>{
 const pagina=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx","utf8");
 const estilo=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.css","utf8");
 assert.match(pagina,/className="plano-retomada"/);
 assert.match(pagina,/pendenciasMaterias/);
 assert.match(pagina,/pendenciasRevisoes/);
 assert.match(pagina,/pendenciasExtras/);
 assert.match(pagina,/pendenciasFiltradas\.slice\(0, 6\)/);
 assert.match(pagina,/aria-pressed=/);
 assert.match(estilo,/\.plano-retomada-lista\s*\{/);
 assert.match(estilo,/@media\(max-width:600px\)/);
 assert.doesNotMatch(pagina,/Atividades das semanas anteriores<\/h3>/);
});

test("prévia exibe resumo diário, calendário e checklist sem concluir missões",()=>{
 const pagina=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx","utf8");
 const css=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.css","utf8");
 assert.match(pagina,/Visão geral do dia/);
 assert.match(pagina,/Calendário da semana/);
 assert.match(pagina,/situacaoDia\(numero\)/);
 assert.match(pagina,/Checklist da missão/);
 assert.match(pagina,/Marcar etapas não conclui a missão/);
 assert.match(pagina,/salvarChecklistPlano/);
 assert.match(pagina,/checklistLocal\[primeiraMissaoPendenteHoje\.id\]/);
 assert.match(pagina,/chaveChecklistPlano\(usuario\.id, configuracoes\.dadosReiniciadosEm\)/);
 assert.match(css,/\.plano-painel-diario/);
 assert.match(css,/\.plano-painel-tarefas/);
});
