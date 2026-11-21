import test from "node:test";
import assert from "node:assert/strict";
import type { Revisao } from "../src/types/index.ts";
import { encontrarDataDisponivelParaReforco } from "../src/utils/agendadorReforcos.ts";
import { aplicarRevisaoAdaptativa } from "../src/utils/revisaoAdaptativa.ts";
import { concluirRevisaoNaLista } from "../src/utils/revisoes.ts";

const AGORA = new Date("2026-11-21T15:00:00");
const referencia = {
  materiaId:"port",assuntoId:"crase",materia:"Português",assunto:"Crase",
  conteudoEstudado:true,
};
function revisao(id:string, data:string, extras:Partial<Revisao>={}):Revisao {
  return {id,materiaId:"m:"+id,assuntoId:"a:"+id,
    materia:"Legislação",assunto:"Lei exemplo "+id,
    etapa:2,dataCriacao:"2026-11-15T12:00:00",
    dataPrevista:data,concluida:false,...extras};
}
function aplicar(
  revisoes:Revisao[], assunto:string,resultadoId:string, limiteDiario=5
) {
  return aplicarRevisaoAdaptativa({
    ...referencia,materiaId:"m:"+assunto,assuntoId:assunto,
    assunto,resultadoId,revisoes,limiteDiario,
    certas:4,erradas:6,agora:AGORA,criarId:()=>resultadoId,
  });
}

test("cinco revisões programadas amanhã ocupam vagas antes de qualquer reforço novo",()=>{
  const pendentes=Array.from({length:5},(_,i)=>revisao("rev"+i,"2026-11-22T12:00:00"));
  const snapshot=JSON.stringify(pendentes);
  const resultado=aplicar(pendentes,"Crase","reforco-crase");
  assert.equal(resultado.acao,"criada");
  assert.equal(resultado.dataAgendada?.slice(0,10),"2026-11-23");
  assert.equal(resultado.adiadaPorCapacidade,true);
  assert.equal(resultado.revisoes.length,6);
  assert.equal(JSON.stringify(pendentes),snapshot);
  assert.ok(pendentes.every(r=>r.dataPrevista==="2026-11-22T12:00:00"));
});

test("três notas baixas usam no máximo duas vagas adaptativas de cinco por dia",()=>{
  const a=aplicar([],"Crase","r-a");
  const b=aplicar(a.revisoes,"Pontuação","r-b");
  const c=aplicar(b.revisoes,"Interpretação","r-c");
  assert.equal(a.dataAgendada?.slice(0,10),"2026-11-22");
  assert.equal(b.dataAgendada?.slice(0,10),"2026-11-22");
  assert.equal(c.dataAgendada?.slice(0,10),"2026-11-23");
  assert.equal(c.revisoes.length,3);
  assert.deepEqual(c.revisoes.map(x=>x.id).sort(),["r-a","r-b","r-c"]);
});

test("pendências atrasadas têm prioridade sem serem regravadas nem antecipadas",()=>{
  const pendentes=Array.from({length:8},(_,i)=>
    revisao("antiga"+i,"2026-11-19T12:00:00"));
  const original=JSON.stringify(pendentes);
  const data=encontrarDataDisponivelParaReforco({
    dataIdeal:new Date("2026-11-22T12:00:00"),agora:AGORA,
    revisoes:pendentes,limiteDiario:3,
  });
  assert.equal(data?.toISOString().slice(0,10),"2026-11-23");
  assert.equal(JSON.stringify(pendentes),original);
});

test("revisões concluídas hoje contam para a meta e bloqueiam novos reforços hoje",()=>{
  const feitas=Array.from({length:5},(_,i)=>
    revisao("feita"+i,"2026-11-21T12:00:00",{
      concluida:true,dataConclusao:"2026-11-21T13:00:00",
    }));
  const data=encontrarDataDisponivelParaReforco({
    dataIdeal:AGORA,agora:AGORA,revisoes:feitas,limiteDiario:5,
  });
  assert.equal(data?.toISOString().slice(0,10),"2026-11-22");
});

test("repetir notas baixas em uma pendência não cria mais de um ciclo nem muda a data original",()=>{
  const pendente=revisao("uma","2026-12-10T12:00:00",{
    materiaId:"m:Crase",assuntoId:"Crase",materia:"Português",assunto:"Crase",
  });
  const snapshot=JSON.stringify(pendente);
  let atuais=[pendente];
  for(let i=1;i<=5;i++){
    const resultado=aplicar(atuais,"Crase","tentativa-"+i);
    assert.equal(resultado.acao,"atualizada");
    assert.equal(resultado.revisoes.length,1);
    assert.equal(resultado.revisoes[0].dataPrevista,"2026-12-10T12:00:00");
    assert.equal(resultado.revisoes[0].etapa,2);
    atuais=resultado.revisoes;
  }
  assert.equal(atuais[0].sequenciaResultadosBaixos,2);
  assert.equal(atuais[0].reforcoTeoriaRecomendado,true);
  assert.equal(JSON.stringify(pendente),snapshot);
});

test("concluir uma revisão difícil avança apenas uma etapa; não reinicia indefinidamente",()=>{
  const primeira=revisao("etapa1","2026-11-21T12:00:00",{
    materia:"Português",assunto:"Crase",materiaId:"port",assuntoId:"crase",etapa:1
  });
  const lista=concluirRevisaoNaLista({
    revisoes:[primeira],revisaoId:primeira.id,desempenho:"dificil",
    agora:AGORA,limiteDiario:5,proximaId:"etapa2",
  });
  assert.equal(lista.find(x=>x.id==="etapa1")?.concluida,true);
  assert.equal(lista.filter(x=>!x.concluida).length,1);
  assert.equal(lista.find(x=>x.id==="etapa2")?.etapa,2);
});

test("sem limite configurado continua possível agendar pelo intervalo ideal",()=>{
  const data=encontrarDataDisponivelParaReforco({
    dataIdeal:new Date("2026-11-22T15:00:00"),agora:AGORA,
    revisoes:[],limiteDiario:0,
  });
  assert.equal(data?.toISOString().slice(0,10),"2026-11-22");
});
