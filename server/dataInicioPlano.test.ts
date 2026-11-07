import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDataInicioPlano } from '../src/utils/dataInicioPlano';
test('hoje pode ser salvo antes do meio-dia e no fim do dia',()=>{
 for(const hora of [0,7,11,12,23]) assert.equal(validarDataInicioPlano('2026-11-07',new Date(2026,10,7,hora,0)), 'valida');
});
test('data passada é válida; amanhã é futura',()=>{
 const hoje=new Date(2026,10,7,7);assert.equal(validarDataInicioPlano('2026-11-06',hoje),'valida');assert.equal(validarDataInicioPlano('2026-11-08',hoje),'futura');
});
test('validação rejeita dia inexistente, formato incorreto e reconhece bissexto',()=>{
 const hoje=new Date(2026,10,7);assert.equal(validarDataInicioPlano('2026-02-30',hoje),'invalida');assert.equal(validarDataInicioPlano('07/11/2026',hoje),'invalida');assert.equal(validarDataInicioPlano('2024-02-29',hoje),'valida');
});
