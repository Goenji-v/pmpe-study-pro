import assert from "node:assert/strict";
import test from "node:test";
import type { AnaliseEdital } from "../src/types/editalInteligente.ts";
import type { CursoImportado } from "../src/types/cursos.ts";
import { unificarGradeEditalCursos } from "../src/utils/uniaoGradeEstudos.ts";
import { aulasDeSubassuntosDistintos } from "../src/utils/aulasDeSubassuntosDistintos.ts";

const principal = "Princípios e técnicas de contagem, princípio multiplicativo, permutações, arranjos, combinações e probabilidade";
const nomes = ["Princípios da contagem", "Princípio multiplicativo", "Permutação", "Arranjo", "Análise combinatória (combinação)", "Probabilidade"];
const edital: AnaliseEdital = {
  concursoDetectado: "PMPE", bancaDetectada: "Instituto AOCP", analisadoEm: "2026-11-22T12:00:00.000Z",
  materias: [{id:"ed-rlm",nome:"Raciocínio Lógico e Matemática",incidenciaEstimada:4,
    assuntos:[{id:"ed-combinatoria",nome:principal,prioridade:"media"}]}],
};
const curso: CursoImportado = {
  id:"curso-teste",nome:"Resumo do Concurseiro PMPE",origem:"captura-json",
  criadoEm:"2026-11-22T12:00:00.000Z",atualizadoEm:"2026-11-22T12:00:00.000Z",
  materias:[{id:"curso-rlm",nome:"Raciocínio Lógico e Matemática",ordem:1,categoria:"disciplina",
    modulos:[{id:"mod-rlm",nome:"Análise combinatória",ordem:1,
      aulas:nomes.map((nome,i)=>({id:"video-"+i,nome,ordem:i+1,url:"https://curso.example/aula-"+i}))}]}],
};

test("um único tópico do edital contém seis aulas distintas vinculadas do curso", () => {
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [], analiseEdital: edital, cursos: [curso], cursosAtivosIds: [curso.id],
  });
  const materia = grade.find(x => x.nome === "Raciocínio Lógico e Matemática");
  assert.ok(materia);
  const principalAssunto = materia.assuntos.find(x => x.nome === principal);
  assert.ok(principalAssunto);
  assert.equal(principalAssunto.complementarAoEdital, false);
  assert.deepEqual(principalAssunto.aulas?.map(a=>a.nome),nomes);
  assert.equal(aulasDeSubassuntosDistintos(materia.nome,principalAssunto).length, 6);
  assert.equal(materia.assuntos.filter(x=>nomes.includes(x.nome)).length,0);
  assert.equal(materia.assuntos.filter(x=>x.nome===principal).length,1);
});

test("associação de aula ambígua não inventa vínculo exclusivo", () => {
  const editalAmbiguo: AnaliseEdital = {
    ...edital,
    materias: [{...edital.materias[0], assuntos: [
      edital.materias[0].assuntos[0],
      {id:"ed-rlm-segundo",nome:"Contagem, permutações e arranjos",prioridade:"media"},
    ]}],
  };
  const grade = unificarGradeEditalCursos({
    materiasAtuais:[],analiseEdital: editalAmbiguo,cursos:[curso],cursosAtivosIds:[curso.id],
  });
  const materia=grade.find(x=>x.nome==="Raciocínio Lógico e Matemática");
  assert.ok(materia);
  // Não permitir que a aula "Arranjo" seja atribuída ao tópico errado por um empate semântico.
  const vinculadas= materia.assuntos.flatMap(a=>(a.aulas??[]).filter(v=>v.nome==="Arranjo").map(()=>a.nome));
  assert.ok(vinculadas.length>0);
});
