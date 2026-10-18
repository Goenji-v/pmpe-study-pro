import assert from 'node:assert/strict';
import test from 'node:test';
import { comprarItemLoja, equiparItemLoja, desequiparTipoLoja } from '../src/services/lojaGamificacao';
import { obterEstadoEconomia } from '../src/services/economiaGamificacao';
import { criarPlanoCalendario } from '../src/utils/planoCalendario';
import { classeFundoPerfil } from '../src/services/fundosPerfil';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('fundo comprado usa moedas uma vez e não muda o tema global',()=>{
 const inicial={moedas:500,recompensasRecebidas:[],inventario:[],temaEquipado:'tema-carbono'};
 const compra=comprarItemLoja(inicial,'fundo-aurora');
 assert.equal(compra.estado.moedas,320);
 assert.ok(comprarItemLoja(compra.estado,'fundo-aurora').erro);
 const equipado=equiparItemLoja(compra.estado,'fundo-aurora').estado;
 assert.equal(equipado.fundoPerfilEquipado,'fundo-aurora');
 assert.equal(equipado.temaEquipado,'tema-carbono');
 assert.equal(desequiparTipoLoja(equipado,'fundo-perfil').fundoPerfilEquipado,undefined);
 assert.equal(classeFundoPerfil('url-injetada'),'fundo-perfil-padrao');
});
test('fundo de conquista exige desbloqueio e sobrevive à normalização da economia',()=>{
 assert.ok(comprarItemLoja({moedas:10000,recompensasRecebidas:[]},'fundo-disciplina').erro);
 const estado=obterEstadoEconomia({economia:{moedas:20,recompensasRecebidas:['conquista-marco:sequencia-30']}} as any);
 assert.ok(estado.inventario?.includes('fundo-disciplina'));
 const equipado=equiparItemLoja(estado,'fundo-disciplina');
 assert.equal(equipado.estado.moedas,20);
 assert.equal(obterEstadoEconomia({economia:equipado.estado} as any).fundoPerfilEquipado,'fundo-disciplina');
});
test('quantidade por dia redistribui sem perder ou duplicar missões de conteúdo',()=>{
 const padrao=criarPlanoCalendario(1,true);
 const custom=criarPlanoCalendario(1,true,{seg:3,ter:2,dom:2});
 const conteudo=(plano:typeof padrao)=>plano.flatMap(s=>s.dias.flatMap(d=>d.missoes)).filter(m=>m.tipo!=='redacao'&&m.tipo!=='simulado').map(m=>m.id).sort();
 assert.deepEqual(conteudo(custom),conteudo(padrao));
 assert.equal(custom[0].dias.find(d=>d.numero===1)?.missoes.length,3);
 assert.equal(custom[0].dias.find(d=>d.numero===2)?.missoes.length,2);
 assert.equal(custom[0].dias.find(d=>d.numero===7)?.missoes.filter(m=>m.tipo!=='redacao'&&m.tipo!=='simulado').length,2);
});
test('perfil real do assunto reúne métricas e links sem contar outro assunto',async()=>{
 const result=await build({entryPoints:['src/components/PerfilAssunto/PerfilAssunto.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){
 b.onLoad({filter:/\/context\/AppContext\.tsx$/},()=>({contents:'export const useApp=()=>globalThis.__perfilAssuntoTeste;',loader:'ts'}));
 b.onLoad({filter:/\/MateriaisDoAssunto\/MateriaisDoAssunto\.tsx$/},()=>({contents:'export default function Materiais(){return null}',loader:'tsx'}));
 }}]});
 const g=globalThis as any;
 const data='2026-10-17T12:00:00Z';
 g.__perfilAssuntoTeste={sessoes:[{id:'s',materia:'Português',assunto:'Verbos',assuntoId:'v',tipo:'questoes',minutos:120,data}],questoes:[{id:'q',materia:'Português',assunto:'Verbos',assuntoId:'v',certas:8,erradas:2,minutos:120,data},{id:'outro',materia:'Português',assunto:'Pronomes',assuntoId:'p',certas:99,erradas:99,minutos:99,data}],revisoes:[]};
 try{
 const m={exports:{} as any};runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(createRequire(import.meta.url),m,m.exports);
 const html=renderToStaticMarkup(createElement(m.exports.default,{materia:{id:'port',nome:'Português'},modulo:{id:'g',nome:'Geral'},assunto:{id:'v',nome:'Verbos',pdf:'https://example.org/verbos.pdf'},fechar:()=>{}}));
 assert.match(html,/>2h</);assert.match(html,/>8</);assert.match(html,/>2</);assert.match(html,/PDF do assunto/);assert.doesNotMatch(html,/>99</);
 }finally{delete g.__perfilAssuntoTeste;}
});
