import test from "node:test";
import assert from "node:assert/strict";
import type { Materia, Revisao, SessaoEstudo } from "../src/types/index.ts";
import { existeEstudoConcluido, mesmoSubassuntoComprovado } from "../src/utils/elegibilidadeRevisao.ts";
import { montarHistoricoRevisaoIntegrado, pertenceAoMesmoHistorico } from "../src/utils/historicoRevisoesIntegrado.ts";

const rlm:Materia={
  id:"rlm-curso",nome:"RLM",assuntos:[
    {id:"conectivos",nome:"Conectivos lógicos",concluido:true,prioridade:"media"},
    {id:"tabela",nome:"Tabelas-verdade",concluido:false,prioridade:"media"},
    {id:"argumentativa",nome:"Lógica argumentativa",concluido:false,prioridade:"media"},
  ],
};
const edital:Materia={
  id:"rlm-edital",nome:"Raciocínio Lógico e Matemática",assuntos:[
    {id:"operadores",nome:"Operadores lógicos",concluido:false,prioridade:"media"},
    {id:"equivalencia",nome:"Equivalências lógicas",concluido:false,prioridade:"media"},
  ]
};

function revisao(id:string,materia:string,assunto:string,concluida=false):Revisao {
  return {
    id,materiaId:"materia:"+id,assuntoId:"assunto:"+id,
    materia,assunto,etapa:2,concluida,
    dataCriacao:"2026-11-05T12:00:00.000Z",
    dataPrevista:"2026-11-20T12:00:00.000Z",
  };
}

test("conclusão de conectivos via curso reconhece alias do edital, sem concluir equivalência ou tabelas",()=>{
  assert.equal(existeEstudoConcluido({
    materias:[rlm,edital],revisoes:[],materia:edital,assunto:edital.assuntos[0],
  }),true);
  assert.equal(existeEstudoConcluido({
    materias:[rlm,edital],revisoes:[],materia:edital,assunto:edital.assuntos[1],
  }),false);
  assert.equal(existeEstudoConcluido({
    materias:[rlm],revisoes:[],materia:rlm,assunto:rlm.assuntos[1],
  }),false);
  assert.equal(mesmoSubassuntoComprovado(
    {materia:rlm,assunto:rlm.assuntos[0]},
    {materia:rlm,assunto:rlm.assuntos[1]}
  ),false);
});

test("revisão CONCLUÍDA do mesmo subassunto pode comprovar estudo legado; revisão pendente não comprova",()=>{
  const materia:Materia={id:"info",nome:"Informática",assuntos:[
    {id:"seg",nome:"Conceitos de proteção e segurança - aulas 1 a 4",concluido:false,prioridade:"media"}
  ]};
  const alvo=materia.assuntos[0];
  const anterior=revisao("passada","Informática",alvo.nome,true);
  const params={materias:[materia],materia,assunto:alvo};
  assert.equal(existeEstudoConcluido({...params,revisoes:[anterior]}),true);
  assert.equal(existeEstudoConcluido({...params,revisoes:[{...anterior,concluida:false}]}),false);
});

test("nota em exercícios sem conclusão não autoriza criar revisão espaçada",()=>{
  const alvo=edital.assuntos[1];
  assert.equal(existeEstudoConcluido({
    materias:[edital],revisoes:[],materia:edital,assunto:alvo,
  }),false);
  const sessao:SessaoEstudo={id:"s1",data:"2026-11-20",tipo:"aula",
    materia:edital.nome,materiaId:edital.id,
    assunto:alvo.nome,assuntoId:alvo.id,
    minutos:30,conteudoConcluido:true};
  assert.equal(existeEstudoConcluido({
    materias:[edital],revisoes:[],sessoes:[sessao],materia:edital,assunto:alvo,
  }),true);
});

test("histórico integra segurança mesmo com novos nomes, IDs, datas e etapas distintos",()=>{
  const a={...revisao("a","Informática","Conceitos de proteção e segurança - aulas 1 a 4",true),etapa:3 as const};
  const b={...revisao("b","Informática","Segurança da Informação (PDF)",true),etapa:4 as const};
  const c={...revisao("c","Informática","Conceito e princípios da Segurança da Informação"),etapa:1 as const};
  const d={...revisao("d","Informática","Conceitos de proteção e segurança - aulas 5 a 9"),integradaEmId:"c"};
  const estrangeira=revisao("e","Direitos Humanos","Segurança da Informação");
  const outras=[a,b,c,d,estrangeira];
  const snap=JSON.stringify(outras);
  const historico=montarHistoricoRevisaoIntegrado(c,outras,[]);
  assert.deepEqual(historico.map(item=>item.revisao.id),["a","b","c","d"]);
  assert.equal(historico.filter(item=>item.revisao.concluida).length,2);
  assert.equal(historico.find(item=>item.revisao.id==="d")?.revisao.integradaEmId,"c");
  assert.equal(JSON.stringify(outras),snap);
  assert.equal(pertenceAoMesmoHistorico(c,estrangeira),false);
});

test("histórico de argumentativa não incorpora tabela-verdade por similaridade genérica",()=>{
  const a=revisao("arg","RLM","Lógica argumentativa");
  const b=revisao("tab","RLM","Tabela verdade");
  assert.equal(pertenceAoMesmoHistorico(a,b),false);
  assert.equal(montarHistoricoRevisaoIntegrado(a,[a,b],[]).length,1);
});

test("registro de sessão é vinculado apenas ao ID da revisão original",()=>{
  const a=revisao("rev-1","RLM","Conectivos lógicos",true);
  const b=revisao("rev-2","RLM","Tabelas-verdade",true);
  const sessao:SessaoEstudo={id:"s1",data:"2026-11-20",tipo:"revisao",
    revisaoId:a.id,materia:a.materia,assunto:a.assunto,minutos:20};
  const historico=montarHistoricoRevisaoIntegrado(b,[a,b],[sessao]);
  assert.equal(historico.find(item=>item.revisao.id==="rev-1")?.sessao?.id,"s1");
  assert.equal(historico.find(item=>item.revisao.id==="rev-2")?.sessao,undefined);
});
