import assert from "node:assert/strict";
import test from "node:test";

import {
  aplicarCursosAtivosNasMaterias,
  mesclarCursoRecebido,
  normalizarClassificacaoCurso,
  reconciliarCursosImportados,
  organizarCapturaCurso,
  sincronizarProgressoCursos,
} from "../src/utils/importacaoCurso.ts";
import type { CapturaCurso, CursoImportado } from "../src/types/cursos.ts";

const captura: CapturaCurso = {
  versao: 1,
  titulo: "Curso PMPE",
  urlOrigem: "https://curso.exemplo/area",
  itens: [
    { tipo: "cabecalho", texto: "Língua Portuguesa", nivel: 2 },
    { tipo: "cabecalho", texto: "Módulo 01 - Fonologia", nivel: 3 },
    { tipo: "link", texto: "Aula 01 - Fonema e letra", href: "https://curso.exemplo/aula/1" },
    { tipo: "link", texto: "Aula 02 - Dígrafos", href: "https://curso.exemplo/aula/2" },
    { tipo: "cabecalho", texto: "RLM", nivel: 2 },
    { tipo: "cabecalho", texto: "Módulo 01 - Proposições", nivel: 3 },
    { tipo: "link", texto: "Aula 01 - Proposição simples", href: "https://curso.exemplo/aula/3" },
  ],
};

test("organiza captura em matéria, módulo, aula e preserva links", () => {
  const curso = organizarCapturaCurso(captura);
  assert.equal(curso.materias.length, 2);
  assert.equal(curso.materias[0].nome, "Língua Portuguesa");
  assert.equal(curso.materias[0].modulos[0].nome, "Fonologia");
  assert.equal(curso.materias[0].modulos[0].aulas.length, 2);
  assert.equal(curso.materias[0].modulos[0].aulas[0].url, "https://curso.exemplo/aula/1");
  assert.equal(curso.materias[1].nome, "Raciocínio Lógico e Matemática");
});

test("dois cursos ficam em módulos separados dentro da mesma matéria", () => {
  const cursoA = organizarCapturaCurso(captura, "CETEM");
  const cursoB: CursoImportado = {
    ...organizarCapturaCurso(captura, "Projeto Caveira"),
    id: "curso-caveira",
    nome: "Projeto Caveira",
  };

  const materias = aplicarCursosAtivosNasMaterias([], [cursoA, cursoB], [cursoA.id, cursoB.id]);
  const portugues = materias.find((materia) => materia.nome === "Língua Portuguesa");
  assert.ok(portugues);
  assert.equal(portugues.modulos?.length, 2);
  assert.ok(portugues.modulos?.[0].nome.startsWith("CETEM ·"));
  assert.ok(portugues.modulos?.[1].nome.startsWith("Projeto Caveira ·"));
});

test("desativar um curso remove apenas seus módulos e preserva o outro", () => {
  const cursoA = organizarCapturaCurso(captura, "CETEM");
  const cursoB = { ...organizarCapturaCurso(captura, "Caveira"), id: "curso-caveira", nome: "Caveira" };
  const combinadas = aplicarCursosAtivosNasMaterias([], [cursoA, cursoB], [cursoA.id, cursoB.id]);
  const somenteA = aplicarCursosAtivosNasMaterias(combinadas, [cursoA, cursoB], [cursoA.id]);
  const portugues = somenteA.find((materia) => materia.nome === "Língua Portuguesa");
  assert.equal(portugues?.modulos?.length, 1);
  assert.ok(portugues?.modulos?.[0].nome.startsWith("CETEM ·"));
});

test("progresso de aula do curso volta para o catálogo antes de alternar cursos", () => {
  const curso = organizarCapturaCurso(captura, "CETEM");
  const materias = aplicarCursosAtivosNasMaterias([], [curso], [curso.id]);
  const portugues = materias.find((materia) => materia.nome === "Língua Portuguesa");
  assert.ok(portugues?.modulos?.[0].assuntos[0]);
  portugues!.modulos![0].assuntos[0].concluido = true;
  portugues!.modulos![0].assuntos[0].concluidoEm = "2026-08-26T10:00:00.000Z";

  const atualizados = sincronizarProgressoCursos([curso], materias);
  assert.equal(atualizados[0].materias[0].modulos[0].aulas[0].concluida, true);
  assert.equal(atualizados[0].materias[0].modulos[0].aulas[0].concluidaEm, "2026-08-26T10:00:00.000Z");
});

function cursoGenerico(): CursoImportado {
  const origens = [
    ["portugues", 36], ["historia-de-pernambuco", 22], ["raciocinio-logico", 13], ["informatica", 47],
    ["direito-constitucional", 22], ["direitos-humanos", 2], ["legislacao-extravagante-raiz", 24],
  ] as const;
  return {
    id: "curso-rdc", nome: "RDC", origem: "captura-json", urlOrigem: "https://rdc.test/modulo-pmpe/", criadoEm: "2026-09-02", atualizadoEm: "2026-09-02",
    materias: origens.map(([origem, quantidade], i) => ({
      id: `generica-${i}`, nome: "Imagem do curso", ordem: i + 1,
      modulos: [{ id: `modulo-${i}`, nome: `Conteúdo ${i}`, ordem: 1, aulas: Array.from({ length: quantidade }, (_, j) => ({ id: `aula-${i}-${j}`, nome: j % 2 ? "PDF" : "Aula", url: `https://rdc.test/courses/pmpe-${origem}/lessons/item-${j}/`, ordem: j + 1 })) }],
    })),
  };
}

test("repara o caso real de 166 itens genéricos em sete matérias sem perder entradas", () => {
  const reparado = normalizarClassificacaoCurso(cursoGenerico());
  assert.deepEqual(reparado.materias.map(m => m.nome), ["Língua Portuguesa", "História", "Raciocínio Lógico e Matemática", "Informática", "Direito Constitucional", "Direitos Humanos", "Legislação Extravagante"]);
  assert.equal(reparado.materias.flatMap(m => m.modulos.flatMap(x => x.aulas)).length, 166);
  assert.ok(reparado.materias.every(m => m.categoria === "disciplina"));
  const estado = reconciliarCursosImportados({ materias: [], configuracoes: { cursos: [cursoGenerico()], cursosAtivosIds: ["curso-rdc"] } });
  assert.equal(estado.materias.find(m => m.nome === "Imagem do curso"), undefined);
  assert.equal(estado.materias.reduce((n, m) => n + m.assuntos.length, 0), 166);
  assert.ok(reconciliarCursosImportados(estado) === estado, "segunda execução deve ser idempotente");
});

test("cronograma, mentoria e live geral ficam guardados fora das matérias", () => {
  const curso = cursoGenerico();
  curso.materias = ["plano-de-estudos", "mentoria", "aulas-ao-vivo-2026", "curso-desconhecido"].map((slug, i) => ({ id: `extra-${i}`, nome: "Imagem do curso", ordem: i + 1, modulos: [{ id: `extra-mod-${i}`, nome: "Geral", ordem: 1, aulas: [{ id: `extra-aula-${i}`, nome: "Acessar", ordem: 1, url: `https://rdc.test/courses/pmpe-${slug}/lessons/item/` }] }] }));
  const reparado = normalizarClassificacaoCurso(curso);
  assert.deepEqual(reparado.materias.map(m => [m.nome, m.categoria]), [["Cronograma e orientação", "complementar"], ["Mentoria", "complementar"], ["Lives e encontros", "complementar"], ["A identificar · pmpe curso desconhecido", "pendente"]]);
  assert.equal(aplicarCursosAtivosNasMaterias([], [reparado], [reparado.id]).length, 0);
});

test("reimportar o mesmo painel mescla aulas novas sem duplicar ou apagar a antiga", () => {
  const anterior = normalizarClassificacaoCurso(cursoGenerico());
  anterior.materias[0].modulos[0].aulas[0].concluida = true;
  const novo = cursoGenerico(); novo.id = "novo-id"; novo.materias[0].modulos[0].aulas.push({ id: "nova", nome: "Aula nova", url: "https://rdc.test/courses/pmpe-portugues/lessons/nova/", ordem: 37 });
  const mesclado = mesclarCursoRecebido([anterior], novo);
  assert.equal(mesclado.id, anterior.id);
  assert.equal(mesclado.materias[0].modulos[0].aulas.length, 37);
  assert.equal(mesclado.materias[0].modulos[0].aulas[0].concluida, true);
});

test("aulas de mesmo nome não compartilham progresso", () => {
  const curso = normalizarClassificacaoCurso(cursoGenerico());
  const materias = aplicarCursosAtivosNasMaterias([], [curso], [curso.id]);
  const portugues = materias.find(m => m.nome === "Língua Portuguesa")!;
  portugues.modulos![0].assuntos[1].concluido = true;
  const salvo = sincronizarProgressoCursos([curso], materias)[0];
  assert.equal(salvo.materias[0].modulos[0].aulas[1].concluida, true);
  assert.notEqual(salvo.materias[0].modulos[0].aulas[3].concluida, true);
});

test("migração do bloco antigo preserva IDs, notas, materiais, prioridades e conclusão", () => {
  const curso = cursoGenerico();
  const antes = aplicarCursosAtivosNasMaterias([], [curso], [curso.id]);
  const alvo = antes[0].modulos![0].assuntos[0];
  alvo.concluido = true; alvo.concluidoEm = '2026-09-02T12:00:00Z'; alvo.anotacoes = 'Nota pessoal'; alvo.prioridade = 'alta';
  alvo.pdf = 'https://material.test/resumo.pdf';
  const idsAntes = antes.flatMap(m => m.assuntos.map(a => a.id)).sort();
  const estado = reconciliarCursosImportados({ materias: antes, configuracoes: { cursos: [curso], cursosAtivosIds: [curso.id] }, sessoes: [{ id: 'historico-intocado' }] });
  const atual = estado.materias.flatMap(m => m.assuntos).find(a => a.id === alvo.id)!;
  assert.deepEqual(atual, alvo);
  assert.deepEqual(estado.materias.flatMap(m => m.assuntos.map(a => a.id)).sort(), idsAntes);
  assert.deepEqual(estado.sessoes, [{ id: 'historico-intocado' }]);
  assert.ok(reconciliarCursosImportados(estado) === estado);
});

test("captura parcial reimportada não remove módulos ausentes nem troca IDs", () => {
  const anterior = normalizarClassificacaoCurso(cursoGenerico());
  const parcial = { ...structuredClone(anterior), id: 'id-novo', materias: [structuredClone(anterior.materias[0])] };
  parcial.materias[0].modulos[0].aulas = parcial.materias[0].modulos[0].aulas.slice(0, 1);
  const resultado = mesclarCursoRecebido([anterior], parcial);
  assert.deepEqual(resultado.materias, anterior.materias);
});

test("live didática dentro de uma disciplina continua sendo conteúdo da matéria", () => {
  const curso = cursoGenerico(); curso.materias = [curso.materias[0]];
  curso.materias[0].modulos[0].nome = 'Fonologia'; curso.materias[0].modulos[0].aulas[0].nome = 'Live de dígrafos';
  assert.equal(normalizarClassificacaoCurso(curso).materias[0].categoria, 'disciplina');
});
