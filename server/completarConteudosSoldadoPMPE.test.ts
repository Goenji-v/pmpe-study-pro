import assert from "node:assert/strict";
import test from "node:test";
import { EDITAIS_PREDEFINIDOS_SISTEMA } from "../src/data/editaisPredefinidos";
import { migrarMateriasParaModulos, atualizarAssuntoNaArvore } from "../src/services/conteudos/migrarEstruturaConteudos";
import { listarTodosAssuntos } from "../src/services/conteudos/navegarConteudos";
import { completarConteudosSoldadoPMPE } from "../src/utils/completarConteudosSoldadoPMPE";
import { gerarMateriasDoPlano } from "../src/utils/materiasDoPlano";
import type { Materia } from "../src/types";

test("a grade antiga de Soldado recebe assuntos independentes sem substituir o histórico", () => {
  const anterior = gerarMateriasDoPlano();
  const rlm = anterior.find(materia => materia.id === "rlm")!;
  const antigo = rlm.assuntos.find(assunto => assunto.nome === "Análise combinatória")!;
  antigo.concluido = true;
  antigo.anotacoes = "Minha revisão";
  const config = { planoPadraoAtivo: true };
  const grade = completarConteudosSoldadoPMPE(anterior, config);
  const assuntos = listarTodosAssuntos(grade);
  const porNome = (nome: string) => assuntos.find(item => item.assunto.nome === nome);

  assert.equal(porNome(antigo.nome)?.assunto, antigo);
  assert.equal(porNome("Permutação")?.modulo.nome, "Análise combinatória");
  assert.equal(porNome("Permutação")?.assunto.concluido, false);
  assert.equal(porNome("Arranjo")?.modulo.nome, "Análise combinatória");
  assert.match(porNome("Combinação")?.assunto.aula ?? "", /modulo\/4\?aula=580$/);
  assert.match(porNome("Probabilidade condicional")?.assunto.aula ?? "", /modulo\/4\?aula=652$/);
  assert.match(porNome("Convenção Americana sobre Direitos Humanos")?.assunto.aula ?? "", /modulo\/8\?aula=423$/);
  assert.match(porNome("ECA: ato infracional e atuação policial")?.assunto.aula ?? "", /modulo\/9\?aula=110$/);
  assert.ok(porNome("Funções do “que” e do “se”"));
  assert.ok(porNome("Formação de Olinda e Recife"));
  assert.ok(porNome("Funções Essenciais à Justiça"));
  assert.ok(porNome("Hierarquia e disciplina"));
  assert.ok(porNome("LibreOffice 7: Calc")?.assunto.materiais?.length);
  assert.equal(completarConteudosSoldadoPMPE(grade, config), grade);

  const permutacao = porNome("Permutação")!;
  const atualizado = atualizarAssuntoNaArvore(permutacao.materia, permutacao.assunto.id,
    assunto => ({ ...assunto, concluido: true, anotacoes: "Fatorial" }), permutacao.modulo.id);
  const salvo = migrarMateriasParaModulos(grade.map(materia =>
    materia.id === atualizado.id ? atualizado : materia));
  const recarregado = completarConteudosSoldadoPMPE(salvo, config);
  const assunto = listarTodosAssuntos(recarregado).find(item => item.assunto.id === permutacao.assunto.id)?.assunto;
  assert.equal(assunto?.concluido, true);
  assert.equal(assunto?.anotacoes, "Fatorial");
  assert.equal(listarTodosAssuntos(recarregado).filter(item => item.assunto.nome === "Permutação").length, 1);
});

test("reaproveita a matéria e o assunto de uma grade importada e respeita o cargo selecionado", () => {
  const [soldado, oficial] = EDITAIS_PREDEFINIDOS_SISTEMA;
  const permutacoes = { id: "legado-permutacoes", nome: "Permutações", concluido: true, prioridade: "media" as const };
  const materias: Materia[] = [{ id: "rlm-importado", nome: "Raciocínio Lógico", assuntos: [permutacoes] }];
  const configEdital = (edital: typeof soldado) => ({
    planoPadraoAtivo: false,
    editalAtivo: { id: "edital", catalogoId: edital.id, nomeArquivo: "PMPE.pdf", storagePath: "", analise: edital.analise },
  });

  assert.equal(completarConteudosSoldadoPMPE(materias, configEdital(oficial)), materias);
  assert.equal(completarConteudosSoldadoPMPE(materias, { planoPadraoAtivo: false }), materias);
  const vazia: Materia[] = [];
  assert.equal(completarConteudosSoldadoPMPE(vazia, configEdital(soldado)), vazia);

  const grade = completarConteudosSoldadoPMPE(materias, configEdital(soldado));
  assert.equal(grade.filter(materia => materia.nome.includes("Raciocínio Lógico")).length, 1);
  assert.equal(grade[0].id, materias[0].id);
  assert.equal(grade[0].assuntos[0].id, permutacoes.id);
  assert.equal(grade[0].assuntos[0].concluido, true);
  assert.match(grade[0].assuntos[0].resumo ?? "", /5!/);
  assert.equal(grade[0].assuntos.filter(assunto => /^permutaç/i.test(assunto.nome)).length, 1);
  assert.ok(grade[0].assuntos.some(assunto => assunto.nome === "Probabilidade simples"));
});


test("associa material ao assunto oficial já existente em Direitos Humanos e Legislação", () => {
  const idDaMateria = "edital-dh-legislacao";
  const idDoAssunto = "edital-eca";
  const materias: Materia[] = [{
    id: idDaMateria,
    nome: "Direitos Humanos e Legislação Extravagante",
    assuntos: [{
      id: idDoAssunto,
      nome: "Estatuto da Criança e do Adolescente: pontos pertinentes à atividade policial",
      concluido: true,
      prioridade: "alta",
      anotacoes: "Minha nota",
    }],
  }];
  const [soldado] = EDITAIS_PREDEFINIDOS_SISTEMA;
  const config = {
    planoPadraoAtivo: false,
    editalAtivo: { id: "edital", catalogoId: soldado.id, nomeArquivo: "PMPE.pdf", storagePath: "", analise: soldado.analise },
  };
  const grade = completarConteudosSoldadoPMPE(materias, config);
  const assunto = grade.find(materia => materia.id === idDaMateria)?.assuntos[0];
  assert.equal(assunto?.id, idDoAssunto);
  assert.equal(assunto?.concluido, true);
  assert.equal(assunto?.anotacoes, "Minha nota");
  assert.match(assunto?.aula ?? "", /modulo\/9\?aula=110$/);
  assert.match(assunto?.materiais?.[0]?.url ?? "", /l8069.htm$/);
  assert.equal(completarConteudosSoldadoPMPE(grade, config), grade);
});
