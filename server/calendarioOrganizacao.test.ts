import assert from 'node:assert/strict';
import test from 'node:test';
import {agruparEventosCalendario} from '../src/utils/agruparEventosCalendario';
import {inicializarInicioPlano} from '../src/utils/inicioAutomaticoPlano';
import {criarConfiguracoesIniciais} from '../src/utils/contaInicial';
test('primeiro acesso define data local uma vez e preserva demais dados',()=>{
 const config={...criarConfiguracoesIniciais(),dataProva:'2027-02-27'};
 const primeiro=inicializarInicioPlano(config,new Date(2026,10,7,23));
 assert.equal(primeiro.dataInicioPlano,'2026-11-07');
 assert.equal(primeiro.dataProva,'2027-02-27');
 assert.equal(config.dataInicioPlano,undefined);
 assert.strictEqual(inicializarInicioPlano(primeiro,new Date(2026,10,8)),primeiro);
});
test('início existente não é sobrescrito em outro login ou aparelho',()=>{
 const config={...criarConfiguracoesIniciais(),dataInicioPlano:'2026-10-01'};
 assert.strictEqual(inicializarInicioPlano(config,new Date(2026,10,7)),config);
});
test('agrupamento reúne sessões e questões sem duplicar tempo espelhado',()=>{
 const eventos=[{id:'s1',titulo:'Informática',tipo:'sessao',minutos:30},{id:'q1',titulo:'INFORMÁTICA',tipo:'questoes',minutos:30,quantidadeQuestoes:17},{id:'r1',titulo:'Informática',tipo:'revisao',minutos:0,status:'concluida'},{id:'r2',titulo:'Informática',tipo:'revisao',minutos:0,status:'pendente'},{id:'s2',titulo:'Estatuto PMPE',tipo:'sessao',minutos:14},{id:'s3',titulo:'Estatuto PMPE',tipo:'sessao',minutos:31}];
 const grupos=agruparEventosCalendario(eventos);
 assert.equal(grupos.length,2);
 assert.equal(grupos[0].minutos,30);assert.equal(grupos[0].questoes,17);
 assert.equal(grupos[0].revisoesConcluidas,1);assert.equal(grupos[0].revisoesPendentes,1);
 assert.equal(grupos[1].minutos,45);assert.equal(grupos[0].eventos.length,4);
});
