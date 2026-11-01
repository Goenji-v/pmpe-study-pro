import test from "node:test";
import assert from "node:assert/strict";
import { gerarResumoSemanal } from "../src/pages/Dashboard/ResumoSemanaDashboard.tsx";
import type { ConfiguracoesApp, Materia, RegistroQuestao, Revisao, SessaoEstudo, Simulado } from "../src/types/index.ts";

const config = {metaMinutosDiaria:60,metaQuestoesDiaria:20} as ConfiguracoesApp;
const materias = [{id:"pt",nome:"Português",assuntos:[]},{id:"mat",nome:"Matemática",assuntos:[]}] as Materia[];
const sessao=(id:string,data:string,materia:string,minutos:number)=>({id,data,materia,assunto:"Geral",tipo:"estudo",minutos}) as SessaoEstudo;
const registro=(data:string,certas:number,erradas:number)=>({id:"q",data,materia:"Português",assunto:"Geral",banca:"AOCP",certas,erradas,minutos:20}) as RegistroQuestao;
const simulado=(data:string,certas:number,erradas:number)=>({id:data,nome:"Simulado",banca:"AOCP",data,certas,erradas,anuladas:0,minutos:60}) as Simulado;
const revisao=(dataPrevista:string,concluida:boolean)=>({id:dataPrevista,materiaId:"pt",assuntoId:"a",materia:"Português",assunto:"Geral",etapa:1,dataCriacao:"2026-10-01",dataPrevista,concluida}) as Revisao;
test("resumo semanal considera segunda a domingo, evita dias duplicados e não mistura semanas",()=>{
 const resumo=gerarResumoSemanal({materias,configuracoes:config,sessoes:[
  sessao("1","2026-10-26T12:00:00","Português",40),
  sessao("2","2026-10-26T15:00:00","Português",20),
  sessao("3","2026-10-28T12:00:00","Português",30),
  sessao("4","2026-10-25T12:00:00","Português",999),
 ],questoes:[
 registro("2026-10-29T12:00:00",8,2),
 registro("2026-10-25T12:00:00",50,0)
 ],revisoes:[revisao("2026-10-20T12:00:00",false),revisao("2026-10-27T12:00:00",true)],simulados:[
 simulado("2026-10-29T12:00:00",8,2),simulado("2026-10-20T12:00:00",6,4)
 ]},new Date(2026,9,31,12));
 assert.equal(resumo.inicio,"2026-10-26");
 assert.equal(resumo.fim,"2026-11-01");
 assert.equal(resumo.totalMinutos,90);
 assert.equal(resumo.feitas,10);
 assert.equal(resumo.dias,2);
 assert.equal(resumo.porMateria.find(x=>x.nome==="Português")?.dias,2);
 assert.equal(resumo.atrasadas,1);
 assert.equal(resumo.ultimo,80);
 assert.equal(resumo.anterior,60);
 assert.ok(resumo.prioridades.length<=3);
 assert.equal(resumo.prioridades[0].rota,"/revisoes");
});
test("sem registros semanais produz números zero e orientações sem inventar dados",()=>{
 const resumo=gerarResumoSemanal({materias,configuracoes:config,sessoes:[],questoes:[],revisoes:[],simulados:[]},new Date(2026,9,31,12));
 assert.equal(resumo.totalMinutos,0);
 assert.equal(resumo.feitas,0);
 assert.equal(resumo.dias,0);
 assert.equal(resumo.ultimo,null);
 assert.equal(resumo.anterior,null);
 assert.ok(resumo.semEstudo.includes("Matemática"));
});

test("simulados futuros não interferem na comparação de desempenho",()=>{
 const resumo=gerarResumoSemanal({materias,configuracoes:config,sessoes:[],questoes:[],revisoes:[],simulados:[
 simulado("2026-11-10T12:00:00",10,0),
 simulado("2026-10-30T12:00:00",7,3),
 simulado("2026-10-25T12:00:00",6,4)
 ]},new Date(2026,9,31,12));
 assert.equal(resumo.ultimo,70);
 assert.equal(resumo.anterior,60);
});
test("semana que atravessa o ano usa datas corretas",()=>{
 const resumo=gerarResumoSemanal({materias,configuracoes:config,sessoes:[
 sessao("virada","2027-01-01T12:00:00","Matemática",50),
 ],questoes:[],revisoes:[],simulados:[]},new Date(2027,0,1,14));
 assert.equal(resumo.inicio,"2026-12-28");
 assert.equal(resumo.fim,"2027-01-03");
 assert.equal(resumo.totalMinutos,50);
 assert.equal(resumo.dias,1);
});

test("sessões e questões futuras dentro da semana atual não entram no resumo",()=>{
 const resumo=gerarResumoSemanal({materias,configuracoes:config,sessoes:[
 sessao("ontem","2026-10-30T12:00:00","Português",40),
 sessao("amanha","2026-11-01T12:00:00","Português",180),
 ],questoes:[
 registro("2026-10-30T12:00:00",8,2),
 registro("2026-11-01T12:00:00",30,0),
 ],revisoes:[],simulados:[]},new Date(2026,9,31,12));
 assert.equal(resumo.totalMinutos,40);
 assert.equal(resumo.feitas,10);
 assert.equal(resumo.dias,1);
});
