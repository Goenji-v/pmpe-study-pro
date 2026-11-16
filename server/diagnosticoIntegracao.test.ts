import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarResumoSemanal } from '../src/utils/resumoSemanal';
import { inferirInicioAutomaticoPlano } from '../src/utils/inicioAutomaticoPlano';
import { criarConfiguracoesIniciais } from '../src/utils/contaInicial';
import { criarPlanoOperacional, obterConclusoesPlanoOperacional } from '../src/utils/planoOperacional';
import { getSemanaOperacional } from '../src/utils/planoUtils';
import { indexarPlanoPorData } from '../src/utils/planoAtivo';
import { criarProximaRevisao, adicionarReforcoFinal, precisaReforcoFinal } from '../src/utils/revisoes';
import { calcularDesempenhoPorMateria } from '../src/utils/desempenhoMaterias';
import type { RegistroQuestao, Revisao, Simulado } from '../src/types';

const agora = new Date(2026,10,16,12);
const config = criarConfiguracoesIniciais('Teste');
const q = {id:'q1',materia:'Português',assunto:'Crase',data:agora.toISOString(),certas:8,erradas:2,minutos:15} as RegistroQuestao;

test('resumo conta estudo apenas por questões e simulados sem duplicar tentativas',()=>{
 const resultado=gerarResumoSemanal({materias:[],questoes:[q],sessoes:[],simulados:[],revisoes:[],configuracoes:config},agora);
 assert.equal(resultado.dias,1); assert.equal(resultado.feitas,10); assert.equal(resultado.totalMinutos,15);
 const sim={id:'s1',tentativaId:'s1',data:agora.toISOString(),certas:8,erradas:2,minutos:30} as Simulado;
 const espelho={...q,origem:'simulado-ia',tentativaId:'s1'} as RegistroQuestao;
 const r=gerarResumoSemanal({materias:[],questoes:[espelho],sessoes:[],simulados:[sim],revisoes:[],configuracoes:config},agora);
 assert.equal(r.feitas,10); assert.equal(r.dias,1);
});

test('início automático preserva data existente e semana das contas antigas',()=>{
 assert.equal(inferirInicioAutomaticoPlano({...config,dataInicioPlano:'2026-09-01'},[],[],agora),'2026-09-01');
 assert.equal(inferirInicioAutomaticoPlano(config,[],[],agora),'2026-11-16');
 const base=criarPlanoOperacional([],[],config);
 const feitas=base.flatMap(s=>s.dias.filter(d=>d.numero!==7).flatMap(d=>d.missoes)).slice(0,44).map(m=>m.id);
 const grade=criarPlanoOperacional([],feitas,config);
 const canonicas=obterConclusoesPlanoOperacional([],feitas,grade);
 const semana=getSemanaOperacional(canonicas,grade,undefined,undefined,agora);
 const inicio=inferirInicioAutomaticoPlano(config,[],feitas,agora);
 assert.equal(getSemanaOperacional(canonicas,grade,undefined,inicio,agora),semana);
 assert.equal(indexarPlanoPorData(grade,inicio).get('2026-11-16')?.semana,semana);
});

const revisao={id:'r',materiaId:'m',assuntoId:'a',materia:'Português',assunto:'Crase',etapa:2,concluida:false,dataCriacao:agora.toISOString(),dataPrevista:agora.toISOString(),desempenho:'dificil'} as Revisao;
test('agenda cheia não adia conteúdo difícil por semanas e preserva pendências',()=>{
 const fila=Array.from({length:20},(_,i)=>({...revisao,id:`ocupada-${i}`,assuntoId:`outro-${i}`,dataPrevista:new Date(2026,10,17+i,12).toISOString()}));
 const copia=JSON.stringify(fila);
 const proxima=criarProximaRevisao(revisao,fila,1,agora,'nova');
 assert.equal(new Date(proxima!.dataPrevista).getDate(),19); assert.equal(JSON.stringify(fila),copia);
});
test('reforço é opcional, preserva etapa 5 concluída e impede duplicação',()=>{
 const final={...revisao,etapa:5,concluida:true,certas:5,erradas:5,dataConclusao:agora.toISOString()} as Revisao;
 assert.equal(precisaReforcoFinal(final,[final]),true);
 const lista=adicionarReforcoFinal([final],final.id,agora,'reforco');
 assert.equal(lista[1],final); assert.equal(lista[0].etapa,1); assert.equal(lista[0].concluida,false);
 assert.equal(adicionarReforcoFinal(lista,final.id),lista);
 assert.equal(precisaReforcoFinal({...final,certas:10,erradas:0,desempenho:'facil'},[final]),false);
});
test('estatísticas unem Português e RLM sem perder resultados',()=>{
 const dados=calcularDesempenhoPorMateria([q,{...q,id:'q2',materia:'Língua Portuguesa'},{...q,id:'q3',materia:'RLM'},{...q,id:'q4',materia:'Raciocínio Lógico e Matemática'}]);
 assert.equal(dados.length,2); assert.equal(dados.reduce((n,m)=>n+m.total,0),40);
});
