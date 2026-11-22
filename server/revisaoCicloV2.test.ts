import assert from "node:assert/strict";
import test from "node:test";
import {
 iniciarCicloRevisaoV2, concluirEtapaRevisaoV2,
 obterFormatoRevisaoV2, inventariarRevisoesLegadasV2
} from "../src/utils/revisaoCicloV2";

test("aula gera uma revisão D+1 e já registra recordação de 4h", () => {
 const c=iniciarCicloRevisaoV2({materiaId:"rlm",aulaId:"argumentativa",dataAula:"2026-11-22"});
 assert.equal(c.quatroHorasRegistrada,true);
 assert.equal(c.marco,"d1");
 assert.equal(c.proximaData,"2026-11-23");
 assert.equal(c.historico.length,0);
 assert.equal(obterFormatoRevisaoV2("d1"),"teoria");
});

test("fluxo aprovado: D+1, D+7 e D+14 sem ciclo paralelo", () => {
 const a=iniciarCicloRevisaoV2({materiaId:"rlm",aulaId:"argumentativa",dataAula:"2026-11-22"});
 const b=concluirEtapaRevisaoV2(a,{dataConclusao:"2026-11-23",sessaoId:"teoria"});
 assert.equal(b.marco,"d7");
 assert.equal(b.proximaData,"2026-11-29");
 assert.equal(obterFormatoRevisaoV2(b.marco!),"questoes");
 const c=concluirEtapaRevisaoV2(b,{dataConclusao:"2026-11-29",percentual:60,sessaoId:"questoes-1"});
 assert.equal(c.marco,"d14");
 assert.equal(c.proximaData,"2026-12-06");
 assert.equal(c.historico.length,2);
 const d=concluirEtapaRevisaoV2(c,{dataConclusao:"2026-12-06",percentual:95,sessaoId:"questoes-2"});
 assert.equal(d.marco,null);
 assert.equal(d.proximaData,null);
 assert.equal(d.historico.length,3);
});

test("resultado abaixo de 60 gera reforço em quatro dias SEM criar outra pendência", () => {
 const a=iniciarCicloRevisaoV2({materiaId:"rlm",aulaId:"argumentativa",dataAula:"2026-11-22"});
 const b=concluirEtapaRevisaoV2(a,{dataConclusao:"2026-11-23"});
 const c=concluirEtapaRevisaoV2(b,{dataConclusao:"2026-11-29",percentual:59});
 assert.equal(c.marco,"d7");
 assert.equal(c.proximaData,"2026-12-03");
 assert.equal(c.historico.at(-1)?.resultado,"reforco");
 const d=concluirEtapaRevisaoV2(c,{dataConclusao:"2026-12-03",percentual:70});
 assert.equal(d.marco,"d14");
 assert.equal(d.proximaData,"2026-12-06");
 assert.equal(d.historico.length,3);
});

test("conclusão tardia nunca agenda revisão no passado", () => {
 const a=iniciarCicloRevisaoV2({materiaId:"rlm",aulaId:"argumentativa",dataAula:"2026-11-22"});
 const b=concluirEtapaRevisaoV2(a,{dataConclusao:"2026-12-10"});
 assert.equal(b.marco,"d7");
 assert.equal(b.proximaData,"2026-12-10");
});

test("salvar a mesma sessão duas vezes é idempotente", () => {
 const a=iniciarCicloRevisaoV2({materiaId:"rlm",aulaId:"argumentativa",dataAula:"2026-11-22"});
 const b=concluirEtapaRevisaoV2(a,{dataConclusao:"2026-11-23",sessaoId:"sessao-01"});
 assert.equal(concluirEtapaRevisaoV2(b,{dataConclusao:"2026-11-23",sessaoId:"sessao-01"}),b);
});

test("sem nota não conclui etapa de questões", () => {
 const a=iniciarCicloRevisaoV2({materiaId:"rlm",aulaId:"argumentativa",dataAula:"2026-11-22"});
 const b=concluirEtapaRevisaoV2(a,{dataConclusao:"2026-11-23"});
 assert.throws(()=>concluirEtapaRevisaoV2(b,{dataConclusao:"2026-11-29"}),/percentage/);
});

test("inventário legado guarda todas as entradas e não mistura aula teórica com exercícios", () => {
 const rows=[
 {id:"1",materiaId:"rlm",materia:"RLM",assuntoId:"curso-aula-79",assunto:"Lógica argumentativa",etapa:1,concluida:true},
 {id:"2",materiaId:"rlm",materia:"RLM",assuntoId:"curso-aula-79",assunto:"Lógica argumentativa",etapa:2,concluida:false},
 {id:"3",materiaId:"rlm",materia:"RLM",assuntoId:"curso-aula-84",assunto:"Exercícios - Lógica argumentativa",etapa:2,concluida:false},
 {id:"4",materia:"Português",assunto:"Crase",etapa:4,concluida:true}
 ];
 const groups=inventariarRevisoesLegadasV2(rows);
 assert.equal(groups.length,3);
 assert.equal(groups.reduce((sum,g)=>sum+g.total,0),4);
 assert.equal(groups.reduce((sum,g)=>sum+g.pendentes,0),2);
 assert.ok(groups.find(g=>g.assunto==="Crase")?.exigeMapeamento);
 assert.ok(groups.find(g=>g.assunto==="Lógica argumentativa")?.idsLegados.includes("1"));
});
