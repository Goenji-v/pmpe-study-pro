import assert from "node:assert/strict";
import test from "node:test";
import type { Revisao } from "../src/types/index.ts";
import {
  chaveAssuntoPrincipal,
  integrarPendenciasNaConclusao,
  pendentesUnicasPorAssunto,
  revisoesDoMesmoAssunto,
  tituloAssuntoPrincipal,
} from "../src/utils/revisoesAssuntoPrincipal.ts";
import { concluirRevisaoNaLista, criarProximaRevisao } from "../src/utils/revisoes.ts";

const dia = "2026-11-17T15:00:00.000Z";
const diaFuturo = "2026-12-10T15:00:00.000Z";
const hoje = new Date("2026-11-17T16:00:00.000Z");

function nova(
  id: string, materia: string, assunto: string,
  etapa: Revisao["etapa"] = 3, dataPrevista = dia
): Revisao {
  return {
    id, materia, assunto, etapa,
    materiaId: "materia:" + id,
    assuntoId: "assunto:" + id,
    dataCriacao: "2026-11-10T15:00:00.000Z",
    dataPrevista,
    concluida: false,
  };
}

test("conectivos e tabelas-verdade são uma revisão, inclusive entre datas e IDs diferentes", () => {
  const a = nova("a", "RLM", "Conectivos lógicos", 5);
  const b = nova("b", "Raciocínio Lógico e Matemática", "Conectivos, tabelas-verdade e negação", 3);
  const c = nova("c", "RLM", "Equivalências lógicas", 4, diaFuturo);
  const d = nova("d", "RLM", "Lógica argumentativa", 2);
  const antes = JSON.stringify([a,b,c,d]);
  assert.equal(chaveAssuntoPrincipal(a), chaveAssuntoPrincipal(b));
  assert.equal(chaveAssuntoPrincipal(b), chaveAssuntoPrincipal(c));
  assert.notEqual(chaveAssuntoPrincipal(a), chaveAssuntoPrincipal(d));
  assert.equal(tituloAssuntoPrincipal(a), "Lógica Proposicional");
  assert.deepEqual(pendentesUnicasPorAssunto([a,b,c,d]).map(x => x.id).sort(), ["b","d"]);
  assert.equal(JSON.stringify([a,b,c,d]), antes);
});

test("conclusão de uma revisão principal mantém outros registros auditáveis e cria somente próxima etapa conservadora", () => {
  const a = nova("a","RLM","Conectivos lógicos", 5);
  const b = nova("b","Raciocínio Lógico e Matemática","Conectivos, tabelas-verdade e negação", 3);
  const c = nova("c","RLM","Tautologias, contradições e contingências", 1, diaFuturo);
  const entrada = [a,b,c];
  const atualizado = concluirRevisaoNaLista({
    revisoes: entrada, revisaoId: "b", desempenho: "media",
    agora: hoje, limiteDiario: 2, proximaId: "proxima",
  });
  assert.equal(atualizado.length, 4);
  assert.equal(atualizado.find(x=>x.id==="b")?.concluida, true);
  assert.equal(atualizado.find(x=>x.id==="a")?.integradaEmId, "b");
  assert.equal(atualizado.find(x=>x.id==="a")?.concluida, false);
  assert.equal(atualizado.find(x=>x.id==="c")?.integradaEmId, "b");
  assert.equal(atualizado.find(x=>x.id==="c")?.dataPrevista, diaFuturo);
  assert.equal(atualizado.find(x=>x.id==="c")?.etapa, 1);
  assert.equal(atualizado.find(x=>x.id==="proxima")?.etapa, 2);
  assert.deepEqual(pendentesUnicasPorAssunto(atualizado).map(x=>x.id), ["proxima"]);
  assert.deepEqual(concluirRevisaoNaLista({
    revisoes: atualizado, revisaoId: "b", desempenho: "media",
    agora: hoje, limiteDiario: 2, proximaId: "proxima",
  }),atualizado);
  assert.equal(entrada.some(x=>Boolean(x.integradaEmId) || x.concluida), false);
});

test("nenhuma revisão de História, legislação ou lógica argumentativa é incluída por palavras genéricas", () => {
  const lista = [
    nova("hist1","História de Pernambuco","Economia Açucareira"),
    nova("hist2","História de Pernambuco","Presença Holandesa"),
    nova("lei1","Legislação Extravagante","Lei de Tortura"),
    nova("lei2","Legislação Extravagante","Lei de Drogas"),
    nova("rlm1","RLM","Lógica argumentativa"),
    nova("rlm2","RLM","Exercícios - Lógica argumentativa"),
  ];
  assert.equal(pendentesUnicasPorAssunto(lista).length, lista.length);
});

test("Fonologia, Segurança e Windows possuem somente uma pendência; assuntos independentes permanecem separados", () => {
  const lista = [
    nova("f1","Português","Fonemas"),
    nova("f2","Língua Portuguesa","Dígrafo e encontro consonantal", 2,diaFuturo),
    nova("p3","Português","Crase"),
    nova("s1","Informática","Conceitos de proteção e segurança - aulas 1 a 4"),
    nova("s2","Informática","Conceitos de proteção e segurança - aulas 5 a 9",5,diaFuturo),
    nova("w1","Informática","Windows - Parte I"),
    nova("w2","Informática","Windows - Parte III",4,diaFuturo),
    nova("i1","Informática","Excel"),
  ];
  const ativos = pendentesUnicasPorAssunto(lista);
  assert.deepEqual(ativos.map(x=>x.id).sort(), ["f1","i1","p3","s1","w1"]);
  assert.equal(revisoesDoMesmoAssunto(lista,lista[0]).length,2);
});

test("pendências de simulados e revisões já vinculadas nunca reaparecem como revisão normal", () => {
  const a=nova("a","RLM","Conectivos lógicos");
  const b={...nova("b","RLM","Tabelas-verdade"),integradaEmId:"a"};
  const c={...nova("ia-1","RLM","Conectivos lógicos"),etapa:5 as const};
  assert.deepEqual(pendentesUnicasPorAssunto([a,b,c]).map(x=>x.id), ["a"]);
  const resultado=integrarPendenciasNaConclusao({revisoes:[a,b,c],revisaoPrincipal:a,agora:hoje});
  assert.equal(resultado.quantidadeIntegradas,0);
  assert.equal(criarProximaRevisao({...a,concluida:true,desempenho:"facil"},[a,b,c],0,hoje,"nova")?.etapa,4);
});
