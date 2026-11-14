import test from 'node:test';
import assert from 'node:assert/strict';
import {avaliarBlocoPreview} from '../src/pages/Estudos/regrasBlocoPreview';
test('bloco exige aulas obrigatórias e cinco questões respondidas',()=>{
 assert.equal(avaliarBlocoPreview(false,5,0).liberado,false);
 assert.equal(avaliarBlocoPreview(true,4,0).liberado,false);
 assert.equal(avaliarBlocoPreview(true,4,0,1).liberado,false);
});
test('quatro de cinco segue normal e três de cinco conclui com reforço',()=>{
 const boa=avaliarBlocoPreview(true,4,1);assert.equal(boa.liberado,true);assert.equal(boa.reforco,false);assert.equal(boa.percentual,80);
 const fraca=avaliarBlocoPreview(true,3,2);assert.equal(fraca.liberado,true);assert.equal(fraca.reforco,true);assert.match(fraca.mensagem,/10 questões/);
 assert.equal(avaliarBlocoPreview(true,8,2).reforco,false);
 assert.equal(avaliarBlocoPreview(true,7,3).reforco,true);
});
test('não aceita frações, negativos ou infinitos e considera branco no aproveitamento',()=>{
 for(const valor of [2.5,-1,NaN,Infinity])assert.equal(avaliarBlocoPreview(true,valor,5).liberado,false);
 assert.equal(avaliarBlocoPreview(true,4,1,1).reforco,true);
});
