import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type {
  Assunto,
  Materia,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
} from "../src/types/index.ts";
import type { CursoImportado } from "../src/types/cursos.ts";
import type {
  AnaliseEdital,
  ConfiguracoesComEdital,
  PlanoEdital,
} from "../src/types/editalInteligente.ts";
import {
  aplicarCursosAtivosNasMaterias,
  mesclarCursoRecebido,
} from "../src/utils/importacaoCurso.ts";
import {
  gerarPlanoEdital,
  mesclarMateriasDoEdital,
  preservarIdsPlanoAnterior,
} from "../src/utils/planoEdital.ts";
import {
  criarAnalisePlanejamentoUnificada,
  scoreAssociacaoAssunto,
  unificarGradeEditalCursos,
} from "../src/utils/uniaoGradeEstudos.ts";
import { EDITAIS_PREDEFINIDOS_SISTEMA } from "../src/data/editaisPredefinidos.ts";
import {
  reconciliarQuestoesComConteudos,
  reconciliarRevisoesComConteudos,
  reconciliarSessoesComConteudos,
} from "../src/services/conteudos/sincronizacaoCanonica.ts";

const AGORA = "2026-10-02T12:00:00.000Z";

function criarEdital(): AnaliseEdital {
  return {
    concursoDetectado: "PMPE",
    bancaDetectada: "Instituto AOCP",
    analisadoEm: AGORA,
    materias: [
      {
        id: "ed-port",
        nome: "Português",
        incidenciaEstimada: 5,
        assuntos: [
          { id: "ed-verbos", nome: "Verbos", prioridade: "alta" },
          {
            id: "ed-interpretacao",
            nome: "Compreensão e interpretação de textos",
            prioridade: "alta",
          },
        ],
      },
      {
        id: "ed-const",
        nome: "Direito Constitucional",
        incidenciaEstimada: 4,
        assuntos: [
          {
            id: "ed-poderes",
            nome: "Organização dos Poderes",
            prioridade: "alta",
          },
          {
            id: "ed-sociais",
            nome: "Direitos sociais",
            prioridade: "media",
          },
          {
            id: "ed-politicos",
            nome: "Direitos políticos",
            prioridade: "media",
          },
        ],
      },
      {
        id: "ed-leg",
        nome: "Legislação Extravagante",
        incidenciaEstimada: 4,
        assuntos: [
          {
            id: "ed-ambientais",
            nome: "Crimes ambientais",
            prioridade: "media",
          },
        ],
      },
      {
        id: "ed-info",
        nome: "Informática",
        incidenciaEstimada: 3,
        assuntos: [
          {
            id: "ed-seguranca",
            nome: "Segurança da informação",
            prioridade: "media",
          },
        ],
      },
    ],
  };
}

function criarCurso(id = "curso-rdc"): CursoImportado {
  return {
    id,
    nome: id === "curso-rdc" ? "Resumo do Concurseiro — PMPE" : "Curso 2",
    origem: "captura-json",
    urlOrigem: `https://curso.test/${id}`,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    materias: [
      {
        id: `${id}-port`,
        nome: "Língua Portuguesa",
        ordem: 1,
        categoria: "disciplina",
        modulos: [
          {
            id: `${id}-verbos`,
            nome: "Verbos",
            ordem: 1,
            aulas: [
              {
                id: `${id}-verbos-1`,
                nome: "Verbos - Aula 1",
                url: `https://curso.test/${id}/verbos-1`,
                ordem: 1,
              },
              {
                id: `${id}-verbos-2`,
                nome: "Verbos - Aula 2",
                url: `https://curso.test/${id}/verbos-2`,
                ordem: 2,
              },
            ],
          },
        ],
      },
      {
        id: `${id}-const`,
        nome: "Direito Constitucional",
        ordem: 2,
        categoria: "disciplina",
        modulos: [
          {
            id: `${id}-poderes`,
            nome: "Organização dos Poderes",
            ordem: 1,
            aulas: [
              {
                id: `${id}-executivo`,
                nome: "Poder Executivo",
                url: `https://curso.test/${id}/executivo`,
                ordem: 1,
              },
              {
                id: `${id}-legislativo`,
                nome: "Poder Legislativo",
                url: `https://curso.test/${id}/legislativo`,
                ordem: 2,
              },
              {
                id: `${id}-judiciario`,
                nome: "Poder Judiciário",
                url: `https://curso.test/${id}/judiciario`,
                ordem: 3,
              },
            ],
          },
          {
            id: `${id}-ambiguo`,
            nome: "Poder",
            ordem: 2,
            aulas: [
              {
                id: `${id}-poder`,
                nome: "Poder",
                url: `https://curso.test/${id}/poder`,
                ordem: 1,
              },
            ],
          },
          {
            id: `${id}-generico`,
            nome: "Direitos",
            ordem: 3,
            aulas: [
              {
                id: `${id}-direitos`,
                nome: "Direitos",
                url: `https://curso.test/${id}/direitos`,
                ordem: 1,
              },
            ],
          },
        ],
      },
      {
        id: `${id}-leg`,
        nome: "Legislação Extravagante",
        ordem: 3,
        categoria: "disciplina",
        modulos: [
          {
            id: `${id}-ambientais`,
            nome: "Lei de Crimes Ambientais",
            ordem: 1,
            aulas: [
              {
                id: `${id}-ambientais-1`,
                nome: "Lei de Crimes Ambientais",
                url: `https://curso.test/${id}/ambientais`,
                ordem: 1,
              },
            ],
          },
          {
            id: `${id}-abuso`,
            nome: "Abuso de Autoridade",
            ordem: 2,
            aulas: [
              {
                id: `${id}-abuso-1`,
                nome: "Abuso de Autoridade",
                url: `https://curso.test/${id}/abuso`,
                ordem: 1,
                materiais: [
                  {
                    id: "pdf-abuso",
                    nome: "Resumo de Abuso",
                    tipo: "pdf",
                    url: `https://curso.test/${id}/abuso.pdf`,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: `${id}-adm`,
        nome: "Direito Administrativo",
        ordem: 4,
        categoria: "disciplina",
        modulos: [
          {
            id: `${id}-atos`,
            nome: "Atos Administrativos",
            ordem: 1,
            aulas: [
              {
                id: `${id}-atos-1`,
                nome: "Atos Administrativos",
                url: `https://curso.test/${id}/atos`,
                ordem: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

function config(): ConfiguracoesComEdital {
  return {
    nomeUsuario: "Teste",
    concurso: "PMPE",
    bancaPadrao: "Instituto AOCP",
    metaQuestoesDiaria: 20,
    metaMinutosDiaria: 120,
    metaRevisoesDiaria: 2,
    missoesPorDia: 1,
    materiasPorDia: 1,
    tema: "escuro",
    diasEstudo: ["seg", "ter", "qua", "qui", "sex", "sab"],
    planoPadraoAtivo: false,
    armazenamentoPorConta: true,
  };
}

function materia(materias: Materia[], nome: string) {
  const encontrada = materias.find(
    (item) =>
      item.nome === nome ||
      item.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ===
        nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  );
  assert.ok(encontrada, `Matéria não encontrada: ${nome}`);
  return encontrada;
}

function assuntos(materiaAlvo: Materia) {
  return materiaAlvo.modulos?.flatMap((modulo) => modulo.assuntos) ??
    materiaAlvo.assuntos;
}

function assunto(materiaAlvo: Materia, nome: string) {
  const encontrado = assuntos(materiaAlvo).find((item) => item.nome === nome);
  assert.ok(encontrado, `Assunto não encontrado: ${nome}`);
  return encontrado;
}

function assinaturaGrade(materias: Materia[]) {
  return materias
    .map((mat) => ({
      id: mat.id,
      nome: mat.nome,
      assuntos: assuntos(mat)
        .map((ass) => ({
          id: ass.id,
          nome: ass.nome,
          complementar: Boolean(ass.complementarAoEdital),
          aulas: (ass.aulas ?? [])
            .map((aula) => ({
              nome: aula.nome,
              url: aula.url,
            }))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

test("edital primeiro e curso depois formam uma única grade", () => {
  const edital = criarEdital();
  const curso = criarCurso();

  const baseEdital = mesclarMateriasDoEdital([], edital);
  const grade = aplicarCursosAtivosNasMaterias(
    baseEdital,
    [curso],
    [curso.id],
    edital
  );

  const portugues = materia(grade, "Português");
  assert.equal(
    grade.filter((item) => /portugu/i.test(item.nome)).length,
    1
  );

  const verbos = assunto(portugues, "Verbos");
  assert.equal(verbos.id, "ed-verbos");
  assert.equal(verbos.aulas?.length, 2);
  assert.deepEqual(
    verbos.aulas?.map((aula) => aula.url),
    [
      "https://curso.test/curso-rdc/verbos-1",
      "https://curso.test/curso-rdc/verbos-2",
    ]
  );
  assert.equal(verbos.origemConteudo, "mesclado");
});

test("curso primeiro e edital depois produz a mesma grade canônica", () => {
  const edital = criarEdital();
  const curso = criarCurso();

  const editalPrimeiro = aplicarCursosAtivosNasMaterias(
    mesclarMateriasDoEdital([], edital),
    [curso],
    [curso.id],
    edital
  );

  const somenteCurso = aplicarCursosAtivosNasMaterias(
    [],
    [curso],
    [curso.id]
  );
  const cursoPrimeiro = aplicarCursosAtivosNasMaterias(
    mesclarMateriasDoEdital(somenteCurso, edital),
    [curso],
    [curso.id],
    edital
  );

  assert.deepEqual(
    assinaturaGrade(cursoPrimeiro),
    assinaturaGrade(editalPrimeiro)
  );
  assert.equal(materia(cursoPrimeiro, "Português").id, "ed-port");
});

test("assunto exclusivo do edital permanece sem inventar videoaula", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });

  const seguranca = assunto(materia(grade, "Informática"), "Segurança da informação");
  assert.equal(seguranca.aulas?.length ?? 0, 0);
  assert.equal(seguranca.aula, undefined);
  assert.equal(seguranca.complementarAoEdital, false);
});

test("assunto exclusivo do curso entra como complemento de baixa prioridade e no plano", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });

  const abuso = assunto(
    materia(grade, "Legislação Extravagante"),
    "Abuso de Autoridade"
  );
  assert.equal(abuso.complementarAoEdital, true);
  assert.equal(abuso.prioridade, "baixa");
  assert.equal(abuso.aulas?.[0]?.url, "https://curso.test/curso-rdc/abuso");
  assert.equal(abuso.materiais?.[0]?.url, "https://curso.test/curso-rdc/abuso.pdf");

  const analisePlano = criarAnalisePlanejamentoUnificada(edital, grade);
  const complemento = analisePlano.materias
    .flatMap((mat) => mat.assuntos)
    .find((item) => item.nome === "Abuso de Autoridade");
  assert.equal(complemento?.prioridade, "baixa");

  const plano = gerarPlanoEdital(edital, config(), grade);
  const nomes = plano.semanas.flatMap((semana) =>
    semana.dias.flatMap((dia) => dia.missoes.map((missao) => missao.assunto))
  );
  assert.ok(nomes.includes("Abuso de Autoridade"));
});

test("assunto amplo reúne várias aulas correspondentes na ordem", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });

  const poderes = assunto(
    materia(grade, "Direito Constitucional"),
    "Organização dos Poderes"
  );
  assert.deepEqual(
    poderes.aulas?.map((aula) => aula.nome),
    ["Poder Executivo", "Poder Legislativo", "Poder Judiciário"]
  );
  assert.equal(poderes.id, "ed-poderes");
});

test("nomes equivalentes unem, mas nome genérico e ambíguo não são fundidos à força", () => {
  assert.ok(scoreAssociacaoAssunto("Crimes ambientais", "Lei de Crimes Ambientais") >= 0.86);

  const edital = criarEdital();
  const curso = criarCurso();
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });

  const leg = materia(grade, "Legislação Extravagante");
  const ambientais = assunto(leg, "Crimes ambientais");
  assert.equal(ambientais.aulas?.length, 1);

  const constitucional = materia(grade, "Direito Constitucional");
  const poderAmbiguo = assunto(constitucional, "Poder");
  assert.equal(poderAmbiguo.complementarAoEdital, true);
  assert.equal(poderAmbiguo.vinculoCurso?.status, "ambiguo");
  assert.ok((poderAmbiguo.vinculoCurso?.candidatos?.length ?? 0) >= 2);

  const direitosGenerico = assunto(constitucional, "Direitos");
  assert.equal(direitosGenerico.complementarAoEdital, true);
  assert.notEqual(direitosGenerico.vinculoCurso?.status, "confirmado");
});

test("reimportar e reconciliar novamente não duplica assuntos, aulas ou materiais", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const primeira = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });
  const segunda = unificarGradeEditalCursos({
    materiasAtuais: primeira,
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });

  assert.deepEqual(assinaturaGrade(segunda), assinaturaGrade(primeira));
  const abuso = assunto(
    materia(segunda, "Legislação Extravagante"),
    "Abuso de Autoridade"
  );
  assert.equal(abuso.aulas?.length, 1);
  assert.equal(abuso.materiais?.length, 1);
});

test("importação parcial é aditiva e não apaga aulas anteriores", () => {
  const completo = criarCurso();
  const parcial = criarCurso();
  parcial.materias[0].modulos[0].aulas =
    parcial.materias[0].modulos[0].aulas.slice(0, 1);

  const mesclado = mesclarCursoRecebido([completo], parcial);
  assert.equal(
    mesclado.materias[0].modulos[0].aulas.length,
    2
  );
});

test("progresso, anotações e histórico legado são remapeados ao assunto canônico", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const legado = aplicarCursosAtivosNasMaterias([], [curso], [curso.id]);
  const port = legado.find((item) => /portugues/i.test(
    item.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  ));
  assert.ok(port);

  const entrada = port.modulos?.flatMap((modulo) => modulo.assuntos)
    .find((item) => item.id === "curso:curso-rdc:aula:curso-rdc-verbos-1");
  assert.ok(entrada);
  entrada.concluido = true;
  entrada.concluidoEm = AGORA;
  entrada.anotacoes = "anotação antiga";
  if (entrada.aulas?.[0]) {
    entrada.aulas[0].concluida = true;
    entrada.aulas[0].concluidaEm = AGORA;
  }

  const grade = unificarGradeEditalCursos({
    materiasAtuais: mesclarMateriasDoEdital(legado, edital),
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });
  const verbos = assunto(materia(grade, "Português"), "Verbos");
  const aula1 = verbos.aulas?.find((aula) => aula.nome === "Verbos - Aula 1");
  assert.equal(aula1?.concluida, true);
  assert.equal(verbos.anotacoes, "anotação antiga");
  assert.ok(verbos.idsLegados?.includes("curso:curso-rdc:aula:curso-rdc-verbos-1"));

  const sessao: SessaoEstudo = {
    id: "sessao-antiga",
    data: AGORA,
    tipo: "aula",
    materia: "Língua Portuguesa",
    materiaId: "curso-materia-lingua-portuguesa",
    modulo: "Resumo do Concurseiro — PMPE · Verbos",
    moduloId: "curso:curso-rdc:modulo:curso-rdc-verbos",
    assunto: "Verbos - Aula 1",
    assuntoId: "curso:curso-rdc:aula:curso-rdc-verbos-1",
    minutos: 20,
  };
  const questao: RegistroQuestao = {
    id: "q-antiga",
    materia: sessao.materia,
    materiaId: sessao.materiaId,
    modulo: sessao.modulo,
    moduloId: sessao.moduloId,
    assunto: sessao.assunto,
    assuntoId: sessao.assuntoId,
    banca: "AOCP",
    certas: 8,
    erradas: 2,
    minutos: 0,
    data: AGORA,
  };
  const revisao: Revisao = {
    id: "r-antiga",
    materiaId: sessao.materiaId!,
    moduloId: sessao.moduloId,
    assuntoId: sessao.assuntoId!,
    materia: sessao.materia,
    modulo: sessao.modulo,
    assunto: sessao.assunto,
    etapa: 1,
    dataCriacao: AGORA,
    dataPrevista: AGORA,
    concluida: false,
  };

  const sessaoNova = reconciliarSessoesComConteudos(grade, [sessao])[0];
  const questaoNova = reconciliarQuestoesComConteudos(grade, [questao])[0];
  const revisaoNova = reconciliarRevisoesComConteudos(grade, [revisao])[0];

  for (const item of [sessaoNova, questaoNova, revisaoNova]) {
    assert.equal(item.materiaId, "ed-port");
    assert.equal(item.assuntoId, "ed-verbos");
    assert.equal(item.assunto, "Verbos");
  }
});

test("desativar curso remove vínculos ativos sem apagar conteúdo do edital", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const ativa = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });
  const desativada = unificarGradeEditalCursos({
    materiasAtuais: ativa,
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [],
  });

  const verbos = assunto(materia(desativada, "Português"), "Verbos");
  assert.equal(verbos.aulas?.length ?? 0, 0);
  assert.equal(verbos.id, "ed-verbos");
  assert.ok(
    !assuntos(materia(desativada, "Legislação Extravagante"))
      .some((item) => item.nome === "Abuso de Autoridade")
  );
});

test("mais de um curso reúne aulas distintas no mesmo assunto", () => {
  const edital = criarEdital();
  const curso1 = criarCurso("curso-rdc");
  const curso2 = criarCurso("curso-extra");
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso1, curso2],
    cursosAtivosIds: [curso1.id, curso2.id],
  });

  const verbos = assunto(materia(grade, "Português"), "Verbos");
  assert.equal(verbos.aulas?.length, 4);
  assert.deepEqual(
    [...new Set(verbos.aulas?.map((aula) => aula.origemCurso?.cursoId))].sort(),
    ["curso-extra", "curso-rdc"]
  );
});

test("IDs de missão antiga são preservados pelo conteúdo e novos complementos são estáveis", () => {
  const edital = criarEdital();
  const curso = criarCurso();
  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: edital,
    cursos: [curso],
    cursosAtivosIds: [curso.id],
  });

  const novo = gerarPlanoEdital(edital, config(), grade);
  const primeira = novo.semanas.flatMap((semana) =>
    semana.dias.flatMap((dia) => dia.missoes)
  )[0];
  assert.ok(primeira);

  const antigo: PlanoEdital = structuredClone(novo);
  const antigaPrimeira = antigo.semanas.flatMap((semana) =>
    semana.dias.flatMap((dia) => dia.missoes)
  )[0];
  antigaPrimeira.id = "edital-s1-seg-m1";

  const preservado = preservarIdsPlanoAnterior(novo, antigo);
  const correspondente = preservado.semanas
    .flatMap((semana) => semana.dias)
    .flatMap((dia) => dia.missoes)
    .find(
      (missao) =>
        missao.materiaId === primeira.materiaId &&
        missao.assuntoId === primeira.assuntoId
    );
  assert.equal(correspondente?.id, "edital-s1-seg-m1");

  const abuso = preservado.semanas
    .flatMap((semana) => semana.dias)
    .flatMap((dia) => dia.missoes)
    .find((missao) => missao.assunto === "Abuso de Autoridade");
  assert.match(abuso?.id ?? "", /^edital-conteudo-/);
});

test("Central usa Matéria -> Assunto -> Aula sem seletor visual de módulo", async () => {
  const codigo = await readFile(
    "src/pages/CentralEstudos/CentralEstudos.tsx",
    "utf8"
  );

  assert.match(codigo, /const assuntosComModulo = useMemo/);
  assert.match(codigo, /<label>Aula<\/label>/);
  assert.match(codigo, /texto: "Questões"/);
  assert.doesNotMatch(codigo, /<label>Módulo<\/label>/);
  assert.match(codigo, /urlAula: proximaAula\?\.url \?\? assunto\?\.aula/);
});

test("Plano abre a referência canônica e a aula real antes do fallback por nome", async () => {
  const codigo = await readFile(
    "src/pages/PlanoEdital/PlanoEditalGateway.tsx",
    "utf8"
  );

  assert.match(codigo, /function localizarMissaoNaGrade/);
  assert.match(codigo, /function abrirMissaoCanonica/);
  assert.match(codigo, /aulaId: aula\?\.id/);
  assert.match(codigo, /urlAula: aula\?\.url \?\? localizacao\.assunto\.aula/);
  assert.match(codigo, /if \(abrirMissaoCanonica\(missao\)\)/);
});

test("migração automática da grade fica restrita a plano dinâmico, preservando o plano legado", async () => {
  const importacao = await readFile(
    "src/utils/importacaoCurso.ts",
    "utf8"
  );
  const cursos = await readFile(
    "src/pages/Cursos/Cursos.tsx",
    "utf8"
  );

  assert.match(importacao, /plano\?\.versao \?\? 0\) >= 3/);
  assert.match(cursos, /plano\?\.versao \?\? 0\) >= 3/);
});


test("nomes reais do PMPE 2026 recebem aulas equivalentes do curso", () => {
  const editalSoldado = EDITAIS_PREDEFINIDOS_SISTEMA.find(
    (edital) => edital.slug === "pmpe-2026-soldado"
  );
  assert.ok(editalSoldado);

  const cursoReal: CursoImportado = {
    id: "rdc-pmpe",
    nome: "Resumo do Concurseiro — PMPE",
    origem: "captura-json",
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    materias: [
      {
        id: "rdc-info",
        nome: "Informática",
        ordem: 1,
        categoria: "disciplina",
        modulos: [
          {
            id: "rdc-internet",
            nome: "Internet e intranet",
            ordem: 1,
            aulas: [
              {
                id: "rdc-internet-1",
                nome: "Conceitos de internet e intranet",
                url: "https://curso.test/rdc/internet",
                ordem: 1,
              },
            ],
          },
        ],
      },
      {
        id: "rdc-const",
        nome: "Direito Constitucional",
        ordem: 2,
        categoria: "disciplina",
        modulos: [
          {
            id: "rdc-poderes",
            nome: "Organização dos Poderes",
            ordem: 1,
            aulas: [
              {
                id: "rdc-executivo",
                nome: "Poder Executivo",
                url: "https://curso.test/rdc/executivo",
                ordem: 1,
              },
              {
                id: "rdc-legislativo",
                nome: "Poder Legislativo",
                url: "https://curso.test/rdc/legislativo",
                ordem: 2,
              },
            ],
          },
        ],
      },
      {
        id: "rdc-leg",
        nome: "Legislação Extravagante",
        ordem: 3,
        categoria: "disciplina",
        modulos: [
          {
            id: "rdc-abuso",
            nome: "Abuso de Autoridade",
            ordem: 1,
            aulas: [
              {
                id: "rdc-abuso-1",
                nome: "Lei de Abuso de Autoridade",
                url: "https://curso.test/rdc/abuso",
                ordem: 1,
              },
            ],
          },
          {
            id: "rdc-ambientais",
            nome: "Lei de Crimes Ambientais",
            ordem: 2,
            aulas: [
              {
                id: "rdc-ambientais-1",
                nome: "Crimes Ambientais",
                url: "https://curso.test/rdc/ambientais",
                ordem: 1,
              },
            ],
          },
        ],
      },
    ],
  };

  const grade = unificarGradeEditalCursos({
    materiasAtuais: [],
    analiseEdital: editalSoldado.analise,
    cursos: [cursoReal],
    cursosAtivosIds: [cursoReal.id],
  });

  const internet = assunto(materia(grade, "Informática"), "Internet e intranet");
  assert.equal(internet.aulas?.[0]?.url, "https://curso.test/rdc/internet");

  const poderes = assunto(
    materia(grade, "Direito Constitucional"),
    "Organização dos Poderes e Funções Essenciais à Justiça"
  );
  assert.deepEqual(
    poderes.aulas?.map((aula) => aula.nome),
    ["Poder Executivo", "Poder Legislativo"]
  );

  const legislacao = materia(grade, "Direitos Humanos e Legislação Extravagante");
  const abuso = assuntos(legislacao).find((item) =>
    item.nome.includes("Abuso de Autoridade")
  );
  const ambientais = assuntos(legislacao).find((item) =>
    item.nome.includes("Crimes Ambientais")
  );
  assert.equal(abuso?.aulas?.[0]?.url, "https://curso.test/rdc/abuso");
  assert.equal(ambientais?.aulas?.[0]?.url, "https://curso.test/rdc/ambientais");
});
