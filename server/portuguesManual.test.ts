import test from "node:test";
import assert from "node:assert/strict";
import { ehTrilhaOficialPortugues, CURSO_PORTUGUES_ID } from "../src/data/cursoPortugues";
import { gerarMateriasDoPlano } from "../src/utils/materiasDoPlano";
import { aplicarCursosAtivosNasMaterias } from "../src/utils/importacaoCurso";
import { criarMateriaManual, materiaPermiteRenomear, materiaTemCursoImportado, moduloProtegido, prepararMateriaParaConteudos } from "../src/pages/Estudos/estudosHierarquia";
import { reconciliarRevisoesComConteudos, reconciliarSessoesComConteudos, localizarReferenciaCanonica } from "../src/services/conteudos/sincronizacaoCanonica";
import { migrarMateriasParaModulos } from "../src/services/conteudos/migrarEstruturaConteudos";
import type { Materia, Revisao, SessaoEstudo } from "../src/types";
import type { CursoImportado } from "../src/types/cursos";

const data = "2027-01-01T15:00:00Z";
const aula = { id: "aula-manual", nome: "Minha aula", ordem: 0, concluida: true, concluidaEm: data };
const assunto = { id: "assunto-manual", nome: "Crase", concluido: true, prioridade: "media" as const, aulas: [aula] };
const manual: Materia = { id: "portugues-manual", nome: "Português", origemConteudo: "manual", assuntos: [assunto],
  modulos: [{ id: "oficina", nome: "Oficina", ordem: 0, assuntos: [assunto] }] };
const oficial = gerarMateriasDoPlano().find(m => m.id === CURSO_PORTUGUES_ID)!;

test("identidade da trilha oficial e reidratação de Português manual", () => {
  const nova = criarMateriaManual("portugues-novo", "Português");
  assert.equal(nova.origemConteudo, "manual");
  assert.deepEqual(nova.modulos?.map(m => [m.id, m.assuntos.length]), [["modulo-geral-portugues-novo", 0]]);
  assert.equal(ehTrilhaOficialPortugues(nova), false);
  assert.equal(ehTrilhaOficialPortugues(manual), false);
  assert.equal(ehTrilhaOficialPortugues({ ...manual, id: CURSO_PORTUGUES_ID }), false);
  assert.equal(ehTrilhaOficialPortugues(oficial), true);
  assert.equal(ehTrilhaOficialPortugues({ ...oficial, nome: "Rebatizada" }), true);
  const [reidratada] = migrarMateriasParaModulos(JSON.parse(JSON.stringify([manual])));
  assert.equal(reidratada.origemConteudo, "manual");
  assert.equal(moduloProtegido(reidratada, reidratada.modulos![0]), false);
  assert.equal(reidratada.modulos![0].assuntos[0].aulas?.[0].concluidaEm, data);
  assert.equal(moduloProtegido(oficial, oficial.modulos![0]), true);
});

test("curso importado e Português manual coexistem com proteção por origem", () => {
  const curso: CursoImportado = { id: "curso-sintetico", nome: "Curso", origem: "texto", criadoEm: data, atualizadoEm: data,
    materias: [{ id: "disciplina", nome: "Português", ordem: 0, modulos: [{
      id: "m-curso", nome: "Aulas importadas", ordem: 0,
      aulas: [{ id: "externa", nome: "Outra aula", ordem: 0, concluida: false }],
    }] }] };
  const comCursoBruto = aplicarCursosAtivosNasMaterias([manual], [curso], [curso.id])[0];
  const comCurso = prepararMateriaParaConteudos(comCursoBruto);
  assert.equal(ehTrilhaOficialPortugues(comCurso), false);
  assert.equal(materiaTemCursoImportado(comCurso), true);
  assert.equal(moduloProtegido(comCurso, comCurso.modulos!.find(m => m.id === "oficina")!), false);
  assert.ok(comCurso.modulos!.some(m => moduloProtegido(comCurso, m)));
  assert.equal(materiaPermiteRenomear(comCurso), true);
  const materias = aplicarCursosAtivosNasMaterias([{ ...comCursoBruto, nome: "Minha gramática" }], [curso], [curso.id]);
  assert.equal(materias.length, 1);
  assert.equal(materias[0].id, manual.id);
  assert.ok(materias[0].modulos?.some(m => moduloProtegido(materias[0], m)));
  assert.equal(comCurso.modulos!.find(m => m.id === "oficina")!.assuntos[0].aulas?.[0].id, aula.id);
});

test("reconciliação mantém IDs manuais e recusa histórico ambíguo", () => {
  const ref = { materiaId: manual.id, moduloId: "oficina", assuntoId: assunto.id, materia: "Português", assunto: "Crase" };
  const sessao: SessaoEstudo = { ...ref, id: "sessao-antiga", data, tipo: "aula", minutos: 20, aulaId: aula.id };
  const revisao: Revisao = { ...ref, id: "rev-antiga", etapa: 2, dataCriacao: data, dataPrevista: data, concluida: false };
  const movida = { ...manual, nome: "Língua Portuguesa", modulos: [{ id: "outro", nome: "Novo", ordem: 0, assuntos: [assunto] }] };
  const materias = [oficial, movida];
  const [s] = reconciliarSessoesComConteudos(materias, [sessao]);
  const [r] = reconciliarRevisoesComConteudos(materias, [revisao]);
  assert.deepEqual([s.id, s.aulaId, s.materiaId, s.assuntoId, s.moduloId, s.data], [sessao.id, aula.id, manual.id, assunto.id, "outro", data]);
  assert.deepEqual([r.id, r.materiaId, r.assuntoId, r.moduloId, r.dataPrevista], [revisao.id, manual.id, assunto.id, "outro", data]);
  assert.equal(localizarReferenciaCanonica([oficial, manual], { materia: "Português", assunto: "Crase" }), null);
  assert.equal(localizarReferenciaCanonica([oficial, manual], { ...ref, assuntoId: "assunto-excluido" }), null);
});
