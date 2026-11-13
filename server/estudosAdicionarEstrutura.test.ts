import test from 'node:test';
import assert from 'node:assert/strict';
import { adicionarEstrutura } from '../src/pages/Estudos/adicionarEstrutura';
import type { Materia } from '../src/types';
const assunto={id:'a',nome:'Crase',concluido:true,prioridade:'media' as const,pdf:'https://example.com/resumo.pdf'};
const materias:Materia[]=[{id:'p',nome:'Português',assuntos:[assunto]}];
test('novo módulo conserva assunto legado, conclusão, PDF e identidade',()=>{
 const r=adicionarEstrutura(materias,'modulo','Sintaxe','p','');
 assert.equal(r[0].modulos?.length,2);
 assert.strictEqual(r[0].modulos?.[0].assuntos[0],assunto);
 assert.strictEqual(r[0].assuntos[0],assunto);
 assert.equal(materias[0].modulos,undefined);
});
test('novo assunto só é incluído no módulo escolhido e mantém os vínculos',()=>{
 const base=adicionarEstrutura(materias,'modulo','Sintaxe','p','');
 const id=base[0].modulos![1].id;
 const r=adicionarEstrutura(base,'assunto','Concordância','p',id);
 assert.strictEqual(r[0].modulos![0],base[0].modulos![0]);
 assert.equal(r[0].modulos![1].assuntos[0].nome,'Concordância');
 assert.equal(r[0].assuntos.length,2);
 assert.throws(()=>adicionarEstrutura(r,'assunto','CONCORDANCIA','p',id));
 assert.throws(()=>adicionarEstrutura(r,'assunto','Outra','p','curso-visao:inexistente'));
});
test('nova matéria não altera as existentes e rejeita duplicata',()=>{
 const r=adicionarEstrutura(materias,'materia','História','','');
 assert.strictEqual(r[0],materias[0]);assert.equal(r[1].modulos![0].nome,'Geral');
 assert.throws(()=>adicionarEstrutura(materias,'materia','PORTUGUES','',''));
});
