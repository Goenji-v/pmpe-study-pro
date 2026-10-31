import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EspelhoSimuladoPdf, { gerarPromptDiagnostico } from "../src/pages/SimuladoPdf/EspelhoSimuladoPdf";
import type { QuestaoAnaliseSimulado } from "../src/utils/analiseSimuladoStudyPro";

const base = {
  modulo: "Geral", assunto: "Geral", dificuldade: "media",
  enunciado: "Enunciado", alternativas: [] as Array<{id:string;texto:string}>,
} as const;
const questoes: QuestaoAnaliseSimulado[] = [
  { ...base, id:"pdf-1",numero:1,materia:"Português",gabarito:"A" },
  { ...base, id:"pdf-2",numero:2,materia:"Português",gabarito:"B" },
  { ...base, id:"pdf-3",numero:3,materia:"Matemática",gabarito:"C" },
  { ...base, id:"pdf-4",numero:4,materia:"História",gabarito:"",anulada:true },
] as QuestaoAnaliseSimulado[];

test("espelho contabiliza acerto, erro, branco e questão sem gabarito separadamente",()=>{
  const html=renderToStaticMarkup(React.createElement(EspelhoSimuladoPdf,{
    questoes,respostas:{"pdf-1":"A","pdf-2":"C","pdf-3":"","pdf-4":"B"},nome:"Simulado teste"
  }));
  assert.match(html,/1 acertos/);
  assert.match(html,/1 erros/);
  assert.match(html,/1 em branco/);
  assert.match(html,/1 anuladas/);
  assert.match(html,/Português/);
  assert.match(html,/Matemática/);
  assert.match(html,/História/);
  assert.match(html,/Anulada \/ gabarito não confiável/);
  assert.match(html,/Copiar respostas do aluno/);
  assert.match(html,/Copiar prompt completo/);
});

test("prompt inclui ambos os gabaritos e exige conferência com PDFs",()=>{
 const prompt=gerarPromptDiagnostico("PMPE","1-A 2-B","1-A 2-C","Português: 1 acerto");
 assert.match(prompt,/1-A 2-B/);
 assert.match(prompt,/1-A 2-C/);
 assert.match(prompt,/PDFs anexados/);
 assert.match(prompt,/Português: 1 acerto/);
});
