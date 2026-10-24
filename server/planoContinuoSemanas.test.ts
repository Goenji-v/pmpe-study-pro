import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SessaoEstudo, Materia } from "../src/types";
import { criarPlanoCalendario } from "../src/utils/planoCalendario";
import type { SemanaPlano } from "../src/data/planoPMPE";
import { calcularSemanaCorrida, criarSemanasContinuas, listarPendenciasAnteriores, obterMissaoHoje, obterProximaMissaoContinua } from "../src/utils/planoContinuo";

const sessao = (data: string): SessaoEstudo => ({
  id: "sessao-real", materia: "Informática", assunto: "Redes", tipo: "aula", data, minutos: 40
});
const plano: SemanaPlano[] = [
  { numero: 1, nome: "Semana 01", dias: [
    { numero: 1, missoes: [{ id: "s1-seg", numero: 1, materia: "História", assunto: "Formação dos quilombos", tipo: "conteudo" }] },
    { numero: 3, missoes: [{ id: "s1-qua", numero: 1, materia: "Informática", assunto: "Redes", tipo: "conteudo" }] },
  ] },
  { numero: 2, nome: "Semana 02", dias: [
    { numero: 1, missoes: [{ id: "s2-seg", numero: 1, materia: "Português", assunto: "Verbos", tipo: "conteudo" }] },
    { numero: 3, missoes: [{ id: "s2-qua", numero: 1, materia: "RLM", assunto: "Proposições", tipo: "conteudo" }] },
  ] },
];

test("semana avança na segunda mesmo com tarefas incompletas", () => {
  const inicio = [sessao("2026-10-05T14:00:00.000Z")];
  assert.equal(calcularSemanaCorrida(inicio, 1, new Date("2026-10-11T13:00:00.000Z")), 1);
  assert.equal(calcularSemanaCorrida(inicio, 1, new Date("2026-10-12T13:00:00.000Z")), 2);
  assert.equal(calcularSemanaCorrida(inicio, 1, new Date("2026-10-19T13:00:00.000Z")), 3);
  assert.equal(calcularSemanaCorrida(inicio, 4, new Date("2026-10-19T13:00:00.000Z")), 4);
});

test("continua na semana 5 ou 9 sem inventar atividades", () => {
  const snapshot = JSON.stringify(plano);
  const visao = criarSemanasContinuas(plano, 9);
  assert.equal(visao.length, 9);
  assert.equal(visao[8].numero, 9);
  assert.equal(visao[8].dias.length, 7);
  assert.ok(visao[8].dias.every(d => d.missoes.length === 0));
  assert.deepEqual(visao.slice(0, 2), plano);
  assert.equal(JSON.stringify(plano), snapshot);
});

test("segunda de semana nova mostra atrasadas sem marcá-las feitas", () => {
  const concluidas = ["s1-seg", "s1-qua"];
  const snapshot = JSON.stringify(concluidas);
  const pendencias = listarPendenciasAnteriores(plano, concluidas, 2, 1);
  assert.deepEqual(pendencias, []);
  assert.equal(obterMissaoHoje(plano, concluidas, 2, 1)?.missao.id, "s2-seg");
  const atrasada = listarPendenciasAnteriores(plano, ["s1-seg"], 2, 3);
  assert.deepEqual(atrasada.map(x => x.missao.id), ["s1-qua", "s2-seg"]);
  assert.equal(obterMissaoHoje(plano, ["s1-seg"], 2, 3)?.missao.id, "s2-qua");
  assert.equal(obterProximaMissaoContinua(plano, ["s1-seg"], 2, 3)?.missao.id, "s1-qua");
  assert.equal(JSON.stringify(concluidas), snapshot);
});

test("histórico real registra a data do ciclo e permite corrigir início sem criar estudo", () => {
  assert.equal(calcularSemanaCorrida([], 4, new Date(2026,9,24,12)), 4);
  assert.equal(calcularSemanaCorrida([], 1, new Date(2026,9,24,12), "2026-09-28"), 4);
  assert.equal(calcularSemanaCorrida([sessao("2026-10-05T14:00:00Z")], 1, new Date(2026,9,24,12), "2026-09-28"), 4);
  assert.deepEqual(listarPendenciasAnteriores(plano, [], 9, 1).map(x=>x.missao.id),
    ["s1-seg","s1-qua","s2-seg","s2-qua"]);
});

test("telas não anunciam falso plano concluído com backlog", () => {
  const arquivos = [
    "src/pages/Dashboard/Dashboard.tsx",
    "src/components/MissaoDoDia/MissaoDoDia.tsx",
    "src/pages/PlanoEstudos/PlanoEstudos.tsx",
  ].map(p => readFileSync(p,"utf8"));
  assert.match(arquivos[0], /pendenciasAnteriores\.length > 0/);
  assert.match(arquivos[1], /obterProximaMissaoContinua/);
  assert.match(arquivos[2], /Encerrada · pendente/);
  assert.match(arquivos[2], /type="date"/);
});

test("trocar de conta ou atualizar o curso muda o plano dinâmico sem misturar cache", () => {
  const curso = (id: string, titulo: string): Materia[] => [{
    id, nome: titulo,
    assuntos: [{ id: id+"-assunto", nome: titulo+" - primeira aula", concluido: false, prioridade: "media" }]
  }];
  const primeiro = criarPlanoCalendario(1, false, undefined, curso("curso-a", "Informática"));
  const segundo = criarPlanoCalendario(1, false, undefined, curso("curso-b", "História"));
  const assuntos = (visao: SemanaPlano[]) => visao.flatMap(s => s.dias.flatMap(d => d.missoes.filter(m => m.tipo === "conteudo").map(m => m.materia)));
  assert.deepEqual(assuntos(primeiro), ["Informática"]);
  assert.deepEqual(assuntos(segundo), ["História"]);
  assert.deepEqual(assuntos(primeiro), ["Informática"]);
});
