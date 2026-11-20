import test from "node:test";
import assert from "node:assert/strict";
import type { Materia, Revisao } from "../src/types/index.ts";
import type { AnaliseEdital } from "../src/types/editalInteligente.ts";
import { simularImpactoImportacaoEstrutural } from "../src/utils/simulacaoImpactoEstrutural.ts";
import { reconciliarRevisoesComConteudos } from "../src/services/conteudos/sincronizacaoCanonica.ts";

const antes: Materia[] = [{
  id:"curso-rlm", nome:"RLM", assuntos:[
    {
      id:"curso-conectivos", nome:"Conectivos lógicos", concluido:true, prioridade:"media",
      pdf:"pdf-estudo-salvo",
      anotacoes:"Anotações sobre conectivos",
      aulas:[{id:"curso-aula-1",nome:"Conectivos - aula 1",concluida:true,ordem:1,
        progresso:{status:"concluida",atualizadoEm:"2026-11-18T12:00:00Z"},
        url:"https://curso.example/aula/1"}],
      materiais:[{id:"pdf-1",nome:"Resumo de Conectivos",url:"https://curso.example/pdf/1",tipo:"pdf",criadoEm:"2026-11-18T12:00:00Z"}],
    },
    {id:"curso-equivalencia",nome:"Equivalências lógicas",concluido:false,prioridade:"media"},
    {id:"curso-historia",nome:"Lógica argumentativa",concluido:true,prioridade:"media"},
  ],
}];

const edital:AnaliseEdital={
  analisadoEm:"2026-11-19T12:00:00Z",concursoDetectado:"PMPE",
  materias:[{
    id:"ed-rlm",nome:"RLM",incidenciaEstimada:5,
    assuntos:[
      {id:"ed-estruturas",nome:"Estruturas lógicas: proposições, conectivos, quantificadores e falácias",prioridade:"alta"},
      {id:"ed-argumentacao",nome:"Lógica de argumentação: analogias, inferências, deduções, equivalência, implicação e argumentos válidos",prioridade:"alta"},
      {id:"ed-diagramas",nome:"Diagramas lógicos",prioridade:"media"},
      {id:"ed-contagem",nome:"Princípios e técnicas de contagem, princípio multiplicativo, permutações, arranjos, combinações e probabilidade",prioridade:"media"},
    ],
  }],
};

test("simulação do primeiro edital chama o importador real somente em memória",()=>{
  const snapshot=JSON.stringify({antes,edital});
  const relatorio=simularImpactoImportacaoEstrutural({
    materiasAtuais:antes,novoEdital:edital,cursos:[],cursosAtivosIds:[],
  });
  assert.equal(relatorio.modalidade,"primeiro-edital");
  assert.equal(relatorio.materiasAntes,1);
  assert.equal(relatorio.assuntosAntes,3);
  assert.equal(relatorio.concluidosAntes,2);
  assert.equal(relatorio.aulasAntes,1);
  assert.ok(relatorio.assuntosDepois>=3);
  assert.ok(relatorio.avisos.every(achado=>Boolean(achado.tipo&&achado.detalhe)));
  assert.equal(relatorio.seguroEstruturalmente,relatorio.riscosBloqueantes===0);
  assert.equal(relatorio.idempotente,!relatorio.avisos.some(a=>a.tipo==="reimportacao-instavel"));
  assert.equal(JSON.stringify({antes,edital}),snapshot);
  assert.equal(antes[0].assuntos[0].pdf,"pdf-estudo-salvo");
});

test("simulação da troca de edital verifica o segundo caminho e histórico anterior",()=>{
  const editalAntigo:AnaliseEdital={
    analisadoEm:"2026-11-01T12:00:00Z",concursoDetectado:"PMPE",
    materias:[{id:"ed-old",nome:"RLM",incidenciaEstimada:3,assuntos:[
      {id:"curso-conectivos",nome:"Conectivos lógicos",prioridade:"media"}
    ]}],
  };
  const snapshot=JSON.stringify({antes,edital,editalAntigo});
  const relatorio=simularImpactoImportacaoEstrutural({
    materiasAtuais:antes,novoEdital:edital,editalAnterior:editalAntigo,
    cursos:[],cursosAtivosIds:[],
  });
  assert.equal(relatorio.modalidade,"troca-de-edital");
  assert.equal(relatorio.materiasAntes,1);
  assert.ok(relatorio.assuntosDepois>=1);
  assert.equal(relatorio.idempotente,!relatorio.avisos.some(a=>a.tipo==="reimportacao-instavel"));
  assert.equal(relatorio.seguroEstruturalmente,relatorio.riscosBloqueantes===0);
  assert.equal(JSON.stringify({antes,edital,editalAntigo}),snapshot);
});

test("revisões e histórico não entram nos argumentos do simulador e nunca são mutados",()=>{
  const historico:Revisao[]=[{
    id:"rev-1",materia:"RLM",assunto:"Conectivos lógicos",
    materiaId:"curso-rlm",assuntoId:"curso-conectivos",
    etapa:4,concluida:true,dataCriacao:"2026-11-01",dataPrevista:"2026-11-15",
    desempenho:"facil",
  }];
  const snapshot=JSON.stringify(historico);
  simularImpactoImportacaoEstrutural({
    materiasAtuais:antes,novoEdital:edital,cursos:[],cursosAtivosIds:[],
  });
  assert.equal(JSON.stringify(historico),snapshot);
});

test("proteção da prévia impede aplicação se importador simulado falhar",async()=>{
  const {readFile}=await import("node:fs/promises");
  const pagina=await readFile("src/pages/MeuEdital/MeuEdital.tsx","utf8");
  assert.match(pagina,/simularImpactoImportacaoEstrutural/);
  assert.match(pagina,/!impactoSeguro/);
  assert.match(pagina,/impactoEstrutural=/);
  assert.match(pagina,/sincronizacaoInsegura/);
});


test("pendências repetidas não são apagadas na conciliação; a agenda faz a deduplicação visual",()=>{
  const revBase:Revisao={
    id:"r1",materia:"RLM",materiaId:"curso-rlm",
    assunto:"Conectivos lógicos",assuntoId:"curso-conectivos",
    dataCriacao:"2026-11-01",dataPrevista:"2026-11-17",etapa:3,concluida:false
  };
  const revisoes=[revBase,{...revBase,id:"r2",dataPrevista:"2026-11-18"}];
  const out=reconciliarRevisoesComConteudos(antes,revisoes);
  assert.equal(out.length,2);
  assert.deepEqual(out.map(x=>x.id),["r1","r2"]);
  assert.deepEqual(out.map(x=>x.dataPrevista),["2026-11-17","2026-11-18"]);
  const relatorio=simularImpactoImportacaoEstrutural({
    materiasAtuais:antes,novoEdital:edital,cursos:[],cursosAtivosIds:[],
    revisoes,
  });
  assert.equal(relatorio.revisoesAntes,2);
  assert.equal(relatorio.revisoesDepois,2);
  assert.ok(!relatorio.avisos.some(x=>x.tipo==="historico"));
  assert.equal(revisoes[0].dataPrevista,"2026-11-17");
});

test("simulador protege dados e quantidades reais de estudo e questões",()=>{
  const revisoes:Revisao=[{
    id:"r3",materia:"RLM",materiaId:"curso-rlm",assunto:"Conectivos lógicos",
    assuntoId:"curso-conectivos",dataCriacao:"2026-11-01",dataPrevista:"2026-11-17",
    etapa:4,concluida:true,desempenho:"facil",certas:8,erradas:2
  }];
  const sessoes=[{
    id:"sessao-1",data:"2026-11-17",tipo:"aula" as const,
    materia:"RLM",materiaId:"curso-rlm",assunto:"Conectivos lógicos",
    assuntoId:"curso-conectivos",minutos:30,conteudoConcluido:true,
    finalizadaEm:"2026-11-17T13:00:00Z"
  }];
  const questoes=[{
    id:"questao-1",data:"2026-11-17",materia:"RLM",materiaId:"curso-rlm",
    assunto:"Conectivos lógicos",assuntoId:"curso-conectivos",
    banca:"AOCP",certas:8,erradas:2,minutos:25
  }];
  const snapshot=JSON.stringify({revisoes,sessoes,questoes});
  const relatorio=simularImpactoImportacaoEstrutural({
    materiasAtuais:antes,novoEdital:edital,cursos:[],cursosAtivosIds:[],
    revisoes,sessoes,questoes
  });
  assert.equal(relatorio.revisoesAntes,1);
  assert.equal(relatorio.revisoesDepois,1);
  assert.equal(relatorio.sessoesAntes,1);
  assert.equal(relatorio.sessoesDepois,1);
  assert.equal(relatorio.questoesAntes,1);
  assert.equal(relatorio.questoesDepois,1);
  assert.ok(!relatorio.avisos.some(x=>x.tipo==="historico"));
  assert.equal(JSON.stringify({revisoes,sessoes,questoes}),snapshot);
});
