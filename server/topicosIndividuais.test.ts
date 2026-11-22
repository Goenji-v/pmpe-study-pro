import assert from "node:assert/strict";
import test from "node:test";
import { EDITAIS_PREDEFINIDOS_SISTEMA } from "../src/data/editaisPredefinidos.ts";
import { garantirTopicosIndividuais, partesDoAssunto, topicosDaMateria } from "../src/utils/topicosIndividuais.ts";
import { unificarGradeEditalCursos } from "../src/utils/uniaoGradeEstudos.ts";
import { gerarPlanoEdital, normalizarAnaliseEdital } from "../src/utils/planoEdital.ts";
import { atualizarAssuntoNaArvore } from "../src/services/conteudos/migrarEstruturaConteudos.ts";
import { criarPlanoMateriasRuntime } from "../src/utils/planoMateriasRuntime.ts";
import { obterConclusoesPlanoOperacional } from "../src/utils/planoOperacional.ts";

test("Central e Plano separam Arranjo, Permutação e cada elemento das três linhas de RLM", () => {
  const analise = normalizarAnaliseEdital(EDITAIS_PREDEFINIDOS_SISTEMA[0].analise);
  const materias = unificarGradeEditalCursos({materiasAtuais: [], analiseEdital: analise, cursos: [], cursosAtivosIds: []});
  const rlm = materias.find(m => m.nome === "Raciocínio Lógico")!;
  const topicos = topicosDaMateria(rlm);
  assert.deepEqual(garantirTopicosIndividuais(materias), materias);
  assert.ok(topicos.every(t => !partesDoAssunto(t.nome)));
  const plano = gerarPlanoEdital(analise, {materiasPorDia: 1} as never, materias);
  const dias = plano.semanas.flatMap(s => s.dias);
  for (const nome of ["Arranjo", "Permutação", "Combinação", "Deduções", "Equivalências lógicas", "Falácias"]) {
    assert.equal(topicos.filter(t => t.nome === nome).length, 1);
    assert.equal(dias.flatMap(d => d.missoes).filter(m => m.assunto === nome && m.materia === rlm.nome).length, 1);
  }
  assert.ok(dias.every(d => d.missoes.length <= 1));
  const arranjo = topicos.find(t => t.nome === "Arranjo")!;
  const atualizada = atualizarAssuntoNaArvore(rlm, arranjo.assunto.id,
    a => ({...a, concluido: true}), arranjo.modulo.id);
  const runtime = criarPlanoMateriasRuntime(1, undefined, [atualizada]);
  const feitos = obterConclusoesPlanoOperacional([atualizada], [], runtime);
  const missoes = runtime.flatMap(s => s.dias.flatMap(d => d.missoes));
  assert.ok(feitos.includes(missoes.find(m => m.assunto === "Arranjo")!.id));
  assert.ok(!feitos.includes(missoes.find(m => m.assunto === "Permutação")!.id));
});
