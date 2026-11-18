import assert from "node:assert/strict";
import test from "node:test";
import type { Materia } from "../src/types/index.ts";
import type { CursoImportado } from "../src/types/cursos.ts";
import type { AnaliseEdital } from "../src/types/editalInteligente.ts";
import {
  DISCIPLINAS_CATALOGO,
  FAMILIAS_CATALOGO,
  identificarConteudoCatalogo,
  identificarDisciplinaCatalogo,
} from "../src/utils/catalogoAssuntosCentral.ts";
import {
  candidatosDoCurso,
  candidatosDoEdital,
  compararImportacaoConteudos,
} from "../src/utils/conciliacaoImportacaoCatalogo.ts";

function materia(id:string,nome:string,assuntos: string[]):Materia {
  return {
    id,nome,
    assuntos: assuntos.map((titulo,i)=>({
      id:id+"-"+i,nome:titulo,concluido:i===0,
      prioridade:"media" as const,
      pdf:i===0?"material-nao-remover.pdf":undefined,
    })),
  };
}
const conjunto = [
  materia("rlm", "RLM", ["Conectivos lógicos", "Tabelas-verdade", "Lógica argumentativa"]),
  materia("pt", "Português", ["Dígrafo e encontro consonantal", "Sílaba"]),
  materia("ti", "Informática", ["Conceitos de proteção e segurança - aulas 1 a 4", "Windows - Parte I: Conceito e componentes do sistema"]),
  materia("dh", "Direitos Humanos", ["Estatuto dos Militares do Estado de Pernambuco"]),
  materia("hist", "História de Pernambuco", ["Economia Açucareira","Guerra dos Mascates"]),
];

test("catalogo usa identificadores estáveis, sem duplicar disciplinas, famílias ou subassuntos",()=>{
  assert.equal(DISCIPLINAS_CATALOGO.length,9);
  assert.equal(new Set(DISCIPLINAS_CATALOGO.map(x=>x.id)).size,DISCIPLINAS_CATALOGO.length);
  assert.equal(new Set(FAMILIAS_CATALOGO.map(x=>x.id)).size,FAMILIAS_CATALOGO.length);
  const ids=FAMILIAS_CATALOGO.flatMap(x=>x.subassuntos.map(t=>t.id));
  assert.equal(new Set(ids).size,ids.length);
  for(const familia of FAMILIAS_CATALOGO) {
    assert.ok(DISCIPLINAS_CATALOGO.some(d=>d.id===familia.disciplinaId));
    assert.ok(familia.subassuntos.length>0);
  }
  assert.equal(identificarDisciplinaCatalogo("Raciocínio Lógico e Matemática")?.id,"rlm");
  assert.equal(identificarDisciplinaCatalogo("Língua Portuguesa")?.id,"portugues");
});

test("conectivos e tabela-verdade compartilham família, mas NÃO subassunto",()=>{
  const x=identificarConteudoCatalogo("RLM","Conectivos lógicos");
  const y=identificarConteudoCatalogo("Raciocínio Lógico e Matemática","Tabela verdade");
  const z=identificarConteudoCatalogo("RLM","Equivalências lógicas");
  const composto=identificarConteudoCatalogo("RLM","Conectivos, tabelas-verdade e negação");
  const argumento=identificarConteudoCatalogo("RLM","Lógica argumentativa");
  assert.equal(x.familiaId,y.familiaId);
  assert.equal(y.familiaId,z.familiaId);
  assert.notEqual(x.idsSubassuntos[0],y.idsSubassuntos[0]);
  assert.notEqual(y.idsSubassuntos[0],z.idsSubassuntos[0]);
  assert.equal(composto.tipo,"composto");
  assert.deepEqual(composto.idsSubassuntos,["rlm.conectivos","rlm.tabela","rlm.negacao"]);
  assert.notEqual(argumento.familiaId,x.familiaId);
});

test("Português: dígrafo+encontro composto, crase separada e História não unifica Mascates/Economia",()=>{
  const fonologia=identificarConteudoCatalogo("Português","Dígrafo e encontro consonantal");
  assert.equal(fonologia.tipo,"composto");
  assert.deepEqual(fonologia.idsSubassuntos,["pt.digrafos","pt.encontro-consonantal"]);
  const crase=identificarConteudoCatalogo("Português","Uso do sinal grave indicativo de Crase");
  assert.equal(crase.familiaId,"portugues.crase");
  const historia=identificarConteudoCatalogo("História de Pernambuco","A presença Holandesa, O governo Nassau e a Insurreição Pernambucana");
  assert.equal(historia.tipo,"composto");
  assert.deepEqual(historia.idsSubassuntos,["hist.presenca","hist.insurreicao"]);
  assert.notEqual(identificarConteudoCatalogo("História","Guerra dos Mascates").familiaId,
    identificarConteudoCatalogo("História","Economia Açucareira").familiaId);
});

test("comparação preserva estado original e NÃO equipara materiais, História ou legislação sem confirmar",()=>{
  const antes=JSON.stringify(conjunto);
  const candidatos=[
    {origem:"edital" as const,materia:"Raciocínio Lógico e Matemática",assunto:"Conectivos",idOrigem:"c1"},
    {origem:"edital" as const,materia:"RLM",assunto:"Tabelas-verdade",idOrigem:"c2"},
    {origem:"edital" as const,materia:"RLM",assunto:"Equivalências lógicas",idOrigem:"c3"},
    {origem:"edital" as const,materia:"RLM",assunto:"Conectivos, tabelas-verdade e negação",idOrigem:"c4"},
    {origem:"edital" as const,materia:"História",assunto:"Guerra dos Mascates",idOrigem:"c5"},
    {origem:"edital" as const,materia:"Informática",assunto:"Conceitos de proteção e segurança - aulas 5 a 9",idOrigem:"c6"},
  ];
  const a=compararImportacaoConteudos(conjunto,candidatos);
  assert.equal(a.itens[0].situacao,"alias");
  assert.equal(a.itens[1].situacao,"exato");
  assert.equal(a.itens[2].situacao,"mesma-familia");
  assert.equal(a.itens[3].situacao,"titulo-composto");
  assert.equal(a.itens[4].situacao,"exato");
  assert.equal(a.itens[5].situacao,"mesma-familia");
  assert.equal(a.risco,1);
  assert.equal(JSON.stringify(conjunto),antes);
  assert.deepEqual(compararImportacaoConteudos(conjunto,candidatos),a);
});

test("importação inicial detecta repetições no próprio arquivo mesmo sem curso anterior",()=>{
  const incoming=[
    {origem:"curso" as const,materia:"RLM",assunto:"Conectivos lógicos",idOrigem:"l1"},
    {origem:"curso" as const,materia:"RLM",assunto:"Conectivos",idOrigem:"l2"},
    {origem:"curso" as const,materia:"RLM",assunto:"Tabelas-verdade",idOrigem:"l3"},
    {origem:"curso" as const,materia:"Língua Portuguesa",assunto:"Fonemas",idOrigem:"l4"},
  ];
  const resultado=compararImportacaoConteudos([],incoming);
  assert.equal(resultado.itens[1].situacao,"repetido-no-arquivo");
  assert.equal(resultado.itens[2].situacao,"novo");
  assert.equal(resultado.risco,1);
});

test("Estatuto em Direitos Humanos exige conferência de classificação, jamais muda disciplina automaticamente",()=>{
  const resultado=compararImportacaoConteudos(conjunto,[
    {origem:"edital",materia:"Direitos Humanos",assunto:"Estatuto dos Policiais Militares de Pernambuco (Lei 6.783/74)",idOrigem:"estatuto-1"}
  ]);
  assert.equal(resultado.itens[0].situacao,"disciplina-divergente");
  assert.equal(resultado.risco,1);
});

test("fontes curso/edital são transformadas em prévia, sem modificar a origem",()=>{
  const curso:CursoImportado={
    id:"curso-x",nome:"RDC",origem:"texto",criadoEm:"2026-11-01",atualizadoEm:"2026-11-01",
    materias:[{id:"rlm",nome:"RLM",ordem:0,modulos:[{
      id:"m",nome:"Lógica",ordem:0,aulas:[{id:"a",nome:"Conectivos lógicos",ordem:0}]
    }]}]
  };
  const edital:AnaliseEdital={
    concursoDetectado:"PMPE",analisadoEm:"2026-11-01",materias:[{
      id:"rlm",nome:"RLM",incidenciaEstimada:3,assuntos:[{
        id:"x",nome:"Tabelas-verdade",prioridade:"alta"
      }]
    }]
  };
  const anteriorCurso=JSON.stringify(curso);
  const anteriorEdital=JSON.stringify(edital);
  assert.deepEqual(candidatosDoCurso(curso).map(x=>x.assunto),["Conectivos lógicos"]);
  assert.deepEqual(candidatosDoEdital(edital).map(x=>x.assunto),["Tabelas-verdade"]);
  assert.equal(JSON.stringify(curso),anteriorCurso);
  assert.equal(JSON.stringify(edital),anteriorEdital);
});

test("UI da prévia bloqueia aplicação sem conferência e com conflito de sincronização",async()=>{
  const {readFile}=await import("node:fs/promises");
  const edital=await readFile("src/pages/MeuEdital/MeuEdital.tsx","utf8");
  const cursos=await readFile("src/pages/Cursos/Cursos.tsx","utf8");
  assert.match(edital,/conferenciaValida/);
  assert.match(edital,/sincronizacaoInsegura/);
  assert.match(edital,/aplicarEstadoEstruturalSeguro/);
  assert.match(cursos,/conferenciaValida/);
  assert.match(cursos,/sincronizacaoInsegura/);
  assert.match(cursos,/aplicarEstadoEstruturalSeguro/);
  assert.match(cursos,/criarBackupAutomaticoLocal/);
});
