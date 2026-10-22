import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Materia } from "../src/types";
import { prepararMateriaParaConteudos } from "../src/pages/Estudos/estudosHierarquia";
import { atualizarAssuntoNaArvore } from "../src/services/conteudos/migrarEstruturaConteudos";

function criarHistoria(qtd = 13, concluidas = 8): Materia {
  return {
    id: "historia-curso",
    nome: "História",
    assuntos: [],
    modulos: [{
      id: "curso:rdc:modulo:historia-pernambuco",
      nome: "RDC · História de Pernambuco",
      ordem: 0,
      assuntos: Array.from({length: qtd}, (_, i) => {
        const id = `historia-aula-${i + 1}`;
        const concluida = i < concluidas;
        return {
          id,
          nome: i === 0 ? "Formação de quilombos" :
                i === 1 ? "Guerra dos Cabanos" :
                i === 2 ? "Revolução Praieira" : `Tema da aula ${i + 1}`,
          prioridade: "alta" as const,
          concluido: concluida,
          aulas: [{
            id: `video-${i + 1}`,
            nome: `Videoaula ${i + 1}`,
            url: `https://curso.example/aula-${i + 1}`,
            ordem: i + 1,
            concluida,
            concluidaEm: concluida ? "2026-10-21T12:00:00.000Z" : undefined,
          }],
        };
      }),
    }],
  };
}

test("História mostra assuntos separados, com videoaula como subassunto sem recriar dados", () => {
  const original = criarHistoria();
  const snapshot = JSON.stringify(original);
  const exibida = prepararMateriaParaConteudos(original);
  const modulo = exibida.modulos?.[0];
  assert.equal(modulo?.nome, "Geral");
  assert.equal(modulo?.assuntos.length, 13);
  assert.deepEqual(modulo?.assuntos.slice(0, 3).map(a => a.nome), [
    "Formação de quilombos", "Guerra dos Cabanos", "Revolução Praieira",
  ]);
  assert.ok(modulo?.assuntos.every(a => a.aulas?.length === 1));
  assert.equal(modulo?.assuntos.filter(a => a.concluido).length, 8);
  assert.equal(modulo?.assuntos.flatMap(a => a.aulas ?? []).filter(a => a.concluida).length, 8);
  assert.equal(modulo?.assuntos[0].aulas?.[0].url, "https://curso.example/aula-1");
  assert.equal(JSON.stringify(original), snapshot, "visão não altera o curso nem o histórico");
});

test("conclusão de subassunto atualiza somente a aula original vinculada", () => {
  const original = criarHistoria();
  const visao = prepararMateriaParaConteudos(original).modulos![0];
  const alvo = visao.assuntos[8];
  const atualizado = atualizarAssuntoNaArvore(original, alvo.id, a => ({
    ...a,
    concluido: true,
    aulas: a.aulas?.map((aula) => ({...aula, concluida: true})),
  }), visao.id);
  assert.equal(atualizado.modulos?.[0].assuntos[8].concluido, true);
  assert.equal(atualizado.modulos?.[0].assuntos[8].aulas?.[0].concluida, true);
  assert.equal(atualizado.modulos?.[0].assuntos[9].concluido, false);
  assert.equal(atualizado.modulos?.[0].assuntos[9].aulas?.[0].concluida, false);
  assert.equal(original.modulos?.[0].assuntos[8].concluido, false);
});

test("História: aula com várias partes continua como um assunto e vários subassuntos", () => {
  const original = criarHistoria(1, 0);
  const fonte = original.modulos![0].assuntos[0];
  fonte.aulas!.push({id:"parte-2", nome:"Parte 2", ordem:2, concluida:false});
  const visao = prepararMateriaParaConteudos(original).modulos![0];
  assert.equal(visao.assuntos.length, 1);
  assert.equal(visao.assuntos[0].aulas?.length, 2);
});

test("módulos distintos de História não são fundidos pela regra especial", () => {
  const original = criarHistoria(2, 0);
  original.modulos![0].nome = "RDC · História de Portugal";
  const visao = prepararMateriaParaConteudos(original).modulos![0];
  assert.equal(visao.assuntos.length, 1);
  assert.equal(visao.assuntos[0].aulas?.length, 2);
});

test("Estudos identifica as aulas de História como subassuntos, preservando ação original", () => {
  const source = readFileSync("src/pages/Estudos/Estudos.tsx", "utf8");
  assert.match(source, /historiaPernambuco/);
  assert.match(source, /Subassuntos · aulas do curso/);
  assert.match(source, /Subassunto \$\{indice \+ 1\}/);
  assert.match(source, /definirConclusaoAula\(/);
  assert.match(source, /aula\.id/);
});
