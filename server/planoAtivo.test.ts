import assert from 'node:assert/strict';
import test from 'node:test';
import { criarPlanoAtivo, indexarPlanoPorData } from '../src/utils/planoAtivo';
import { gerarPlanoEdital } from '../src/utils/planoEdital';
import { criarConfiguracoesIniciais } from '../src/utils/contaInicial';
import { normalizarRespostaAnaliseEdital } from './editalInteligente';
import type { ConfiguracoesComEdital } from '../src/types/editalInteligente';
import { encontrarAulasParaMissao } from '../src/utils/relacionarCursoEdital';
import type { CursoImportado } from '../src/types/cursos';

const analise = normalizarRespostaAnaliseEdital({concursoDetectado: 'Teste', materias: [{nome:'RLM', incidenciaEstimada:5, assuntos:Array.from({length:18},(_,i)=>({nome:`Tema ${i+1}`, prioridade:'alta'}))}]});
const config: ConfiguracoesComEdital = {...criarConfiguracoesIniciais(), dataInicioPlano:'2026-11-02', diasEstudo:['seg','ter','qua','qui','sex','sab','dom'], materiasPorDia:1};
config.editalAtivo = {analise, plano:gerarPlanoEdital(analise,config,[])} as ConfiguracoesComEdital['editalAtivo'];
const ids = (p: ReturnType<typeof criarPlanoAtivo>) => p.flatMap(s=>s.dias.flatMap(d=>d.missoes.map(m=>m.id)));

test('plano ativo usa edital mesmo quando plano padrão está desligado',()=>{
 const p=criarPlanoAtivo(config,[],new Date(2026,10,6));
 assert.equal(p[0].dias[0].missoes[0].materia,'RLM');
 assert.equal(p[0].dias[0].missoes[0].id,config.editalAtivo!.plano.semanas[0].dias[0].missoes[0].id);
 assert.deepEqual(p[0].dias[6].missoes.map(m=>m.tipo),['redacao','simulado']);
 assert.equal(new Set(ids(p)).size, ids(p).length);
});
test('renderizar novamente não muda IDs nem depende de conclusões',()=>{
 const antes=JSON.stringify(config);
 const p=criarPlanoAtivo(config,[],new Date(2026,10,6));
 assert.deepEqual(ids(p),ids(criarPlanoAtivo(config,[],new Date(2026,10,7))));
 assert.equal(JSON.stringify(config),antes);
});
test('trocar dias de atividades mantém seus IDs semanais e não duplica missões',()=>{
 const p=criarPlanoAtivo({...config,diaRedacaoSemanal:'qui',diaSimuladoSemanal:'sab'},[],new Date(2026,10,6));
 assert.ok(p[0].dias[3].missoes.some(m=>m.tipo==='redacao'));
 assert.ok(p[0].dias[5].missoes.some(m=>m.tipo==='simulado'));
 assert.equal(p[0].dias.flatMap(d=>d.missoes).filter(m=>m.tipo==='redacao').length,1);
 assert.equal(p[0].dias[3].missoes.find(m=>m.tipo==='redacao')!.id,'edital-s1-atividade-redacao');
});
test('calendário aponta para a mesma missão e trata virada do ano sem UTC deslocar dia',()=>{
 const p=criarPlanoAtivo(config,[],new Date(2026,10,6));
 const mapa=indexarPlanoPorData(p,'2026-11-02');
 assert.deepEqual(mapa.get('2026-11-06')!.missoes,p[0].dias[4].missoes);
 assert.equal(indexarPlanoPorData(p,'2026-12-30').get('2027-01-04')!.semana,2);
 assert.equal(indexarPlanoPorData(p,undefined).size,0);
 assert.equal(indexarPlanoPorData(p,'2026-02-30').size,0);
});
test('aula de conectivos não é sugerida para diagramas lógicos',()=>{
 const curso={id:'c',nome:'Curso',materias:[{nome:'RLM',modulos:[{id:'logica',nome:'Lógica',aulas:[{id:'a',nome:'Conectivos lógicos',url:'https://example.com/a'}]}]}]} as CursoImportado;
 assert.equal(encontrarAulasParaMissao([curso],['c'],'RLM','Diagramas lógicos').length,0);
 assert.equal(encontrarAulasParaMissao([curso],['c'],'RLM','Conectivos lógicos').length,1);
});

 test('início antigo não infla plano com semanas vazias nem altera IDs',()=>{
 const original=criarPlanoAtivo(config,[]);
 const antigo=criarPlanoAtivo({...config,dataInicioPlano:'2025-11-24',semanaAtualPlano:50},[],new Date(2026,10,7));
 assert.equal(antigo.length,original.length);
 assert.deepEqual(ids(antigo),ids(original));
 assert.equal(indexarPlanoPorData(antigo,'2025-11-24').has('2026-11-07'),false);
 });
