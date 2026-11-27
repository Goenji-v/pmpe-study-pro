import assert from "node:assert/strict";
import test from "node:test";
import { CONTEUDOS_SOLDADO_PMPE } from "../src/data/conteudosSoldadoPMPE";
import { EDITAIS_PREDEFINIDOS_SISTEMA } from "../src/data/editaisPredefinidos";
import { atualizarAssuntoNaArvore, migrarMateriasParaModulos } from "../src/services/conteudos/migrarEstruturaConteudos";
import { listarTodosAssuntos } from "../src/services/conteudos/navegarConteudos";
import type { Materia } from "../src/types";
import { assuntoDaTrilhaRdc, completarConteudosSoldadoPMPE, exibirTrilhaRdcEmConteudos } from "../src/utils/completarConteudosSoldadoPMPE";
import { gerarMateriasDoPlano } from "../src/utils/materiasDoPlano";
import { planejarEscopoRevisao } from "../src/utils/revisaoPorBloco";

const config = { planoPadraoAtivo: true };

test("a aba segue os assuntos e as aulas disponíveis no RDC", () => {
  const anterior = gerarMateriasDoPlano();
  const grade = completarConteudosSoldadoPMPE(anterior, config);
  const visiveis = listarTodosAssuntos(exibirTrilhaRdcEmConteudos(grade, config));
  const porNome = (nome: string) => visiveis.find(item => item.assunto.nome === nome)?.assunto;

  assert.equal(visiveis.length, CONTEUDOS_SOLDADO_PMPE.reduce((soma, disciplina) => soma + disciplina.assuntos.length, 0));
  assert.match(porNome("Guerra dos Mascates")?.aulas?.[0]?.url ?? "", /modulo\/3\?aula=29$/);
  assert.match(porNome("Revolução Pernambucana")?.aulas?.[0]?.url ?? "", /modulo\/3\?aula=30$/);
  assert.equal(porNome("Formação de Olinda e Recife"), undefined);
  assert.equal(porNome("Permutação"), undefined);
  assert.equal(porNome("Arranjo"), undefined);
  const combinatoria = porNome("Análise combinatória");
  assert.match(combinatoria?.aulas?.[0]?.url ?? "", /modulo\/4\?aula=580$/);
  assert.match(combinatoria?.aulas?.[1]?.url ?? "", /modulo\/4\?aula=581$/);
  assert.match(combinatoria?.aulas?.[1]?.nome ?? "", /arranjo, permutação e combinação/);
  assert.deepEqual(porNome("Probabilidade")?.aulas?.map(aula => new URL(aula.url!).searchParams.get("aula")),
    ["426", "651", "652", "653"]);
  assert.match(porNome("Convenção Americana sobre Direitos Humanos")?.aulas?.[0]?.url ?? "", /modulo\/8\?aula=423$/);
  assert.match(porNome("Estatuto da Criança e do Adolescente")?.aulas?.[0]?.url ?? "", /modulo\/9\?aula=110$/);
  assert.ok(visiveis.every(({ assunto }) => assunto.aulas?.every(aula => aula.url)));
  assert.equal(completarConteudosSoldadoPMPE(grade, config), grade);
});

test("Verbos preserva as quatro aulas e é uma única unidade de revisão", () => {
  const anterior = gerarMateriasDoPlano();
  const verbos = anterior.find(materia => materia.id === "portugues")!.modulos!.flatMap(modulo => modulo.assuntos).find(assunto => assunto.nome === "Verbos")!;
  verbos.aulas![0].concluida = true;
  verbos.anotacoes = "Anotação anterior";
  const grade = completarConteudosSoldadoPMPE(anterior, config);
  const visiveis = listarTodosAssuntos(exibirTrilhaRdcEmConteudos(grade, config));
  const assuntosVerbos = visiveis.filter(item => item.assunto.nome === "Verbos");
  assert.equal(assuntosVerbos.length, 1);
  const { materia, modulo, assunto } = assuntosVerbos[0];
  assert.equal(assunto.id, verbos.id);
  assert.equal(assunto.aulas?.length, 4);
  assert.equal(assunto.aulas?.filter(aula => aula.concluida).length, 1);
  assert.equal(assunto.anotacoes, "Anotação anterior");
  const revisarAssuntoIndividual = assuntoDaTrilhaRdc(materia, assunto);
  assert.equal(planejarEscopoRevisao({ materia, modulo, assunto, concluido: false, revisarAssuntoIndividual }).completo, false);
  const revisao = planejarEscopoRevisao({ materia, modulo, assunto, concluido: true, revisarAssuntoIndividual });
  assert.equal(revisao.assunto, "Verbos");
  assert.equal(revisao.assuntoId, verbos.id);
  assert.equal(revisao.completo, true);
  assert.equal(revisao.escopoGrupo, false);
});

test("projeção mantém dados legados e personalizados guardados e respeita a escolha de edital", () => {
  const [soldado, oficial] = EDITAIS_PREDEFINIDOS_SISTEMA;
  const configEdital = (edital: typeof soldado) => ({
    planoPadraoAtivo: false,
    editalAtivo: { id: "edital", catalogoId: edital.id, nomeArquivo: "PMPE.pdf", storagePath: "", analise: edital.analise },
  });
  const assuntos = [
    { id: "edital-permutacao", nome: "Permutação", origemEditalId: "antigo", concluido: true, prioridade: "media" as const, anotacoes: "Histórico" },
    { id: "manual-exemplo", nome: "Meu assunto", concluido: false, prioridade: "media" as const },
  ];
  const anteriores: Materia[] = [{ id: "rlm-importado", nome: "Raciocínio Lógico", assuntos }];
  assert.equal(completarConteudosSoldadoPMPE(anteriores, configEdital(oficial)), anteriores);
  assert.equal(completarConteudosSoldadoPMPE(anteriores, { planoPadraoAtivo: false }), anteriores);

  const grade = completarConteudosSoldadoPMPE(anteriores, configEdital(soldado));
  const visiveis = listarTodosAssuntos(exibirTrilhaRdcEmConteudos(grade, configEdital(soldado)));
  assert.ok(visiveis.some(item => item.assunto.id === "manual-exemplo"));
  assert.ok(!visiveis.some(item => item.assunto.id === "edital-permutacao"));
  assert.equal(grade[0].assuntos.find(assunto => assunto.id === "edital-permutacao")?.anotacoes, "Histórico");

  const probabilidade = visiveis.find(item => item.assunto.nome === "Probabilidade")!;
  const novaMateria = atualizarAssuntoNaArvore(probabilidade.materia, probabilidade.assunto.id,
    assunto => ({ ...assunto, aulas: assunto.aulas?.map((aula, indice) =>
      indice === 0 ? { ...aula, concluida: true } : aula) }), probabilidade.modulo.id);
  const recarregada = completarConteudosSoldadoPMPE(migrarMateriasParaModulos(grade.map(materia =>
    materia.id === novaMateria.id ? novaMateria : materia)), configEdital(soldado));
  const probabilidadeSalva = listarTodosAssuntos(recarregada).find(item => item.assunto.id === probabilidade.assunto.id)?.assunto;
  assert.equal(probabilidadeSalva?.aulas?.length, 4);
  assert.equal(probabilidadeSalva?.aulas?.filter(aula => aula.concluida).length, 1);
});

test("atualiza os títulos da prévia anterior mantendo a aula e seu progresso", () => {
  const assuntoId = "soldado-pmpe-2026:rlm:assunto:combinacao";
  const aulaId = assuntoId + ":aula:581";
  const anteriores: Materia[] = [{
    id: "rlm",
    nome: "RLM",
    assuntos: [{
      id: assuntoId,
      nome: "Análise combinatória: combinação",
      prioridade: "media",
      concluido: false,
      aulas: [{
        id: aulaId,
        nome: "Exercícios de análise combinatória",
        ordem: 1,
        concluida: true,
        url: "https://app.resumodoconcurseiro.com.br/m/g4uvgyi/modulo/4?aula=581",
      }],
    }],
  }];
  const grade = completarConteudosSoldadoPMPE(anteriores, config);
  const combinatoria = listarTodosAssuntos(exibirTrilhaRdcEmConteudos(grade, config))
    .find(({ assunto }) => assunto.id === assuntoId)?.assunto;
  assert.equal(combinatoria?.nome, "Análise combinatória");
  assert.equal(combinatoria?.aulas?.length, 2);
  const exercicios = combinatoria?.aulas?.find(aula => aula.id === aulaId);
  assert.match(exercicios?.nome ?? "", /arranjo, permutação e combinação/);
  assert.equal(exercicios?.concluida, true);
  assert.equal(completarConteudosSoldadoPMPE(grade, config), grade);
});
