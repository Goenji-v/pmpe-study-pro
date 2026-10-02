import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CursoImportado } from "../src/types/cursos.ts";
import { encontrarAulasParaMissao } from "../src/utils/relacionarCursoEdital.ts";

const curso: CursoImportado = {
  id: "curso-rdc",
  nome: "Curso RDC",
  origem: "texto",
  criadoEm: "2026-10-02T00:00:00.000Z",
  atualizadoEm: "2026-10-02T00:00:00.000Z",
  materias: [
    {
      id: "materia-portugues",
      nome: "Português",
      ordem: 1,
      categoria: "disciplina",
      modulos: [
        {
          id: "modulo-sintaxe",
          nome: "Sintaxe",
          ordem: 1,
          aulas: [
            {
              id: "aula-concordancia",
              nome: "Concordância verbal",
              ordem: 1,
            },
            {
              id: "aula-crase",
              nome: "Crase",
              ordem: 2,
              url: "https://curso.test/crase",
              concluida: true,
            },
          ],
        },
      ],
    },
  ],
};

test("relaciona aula do curso ao edital mesmo quando o link não foi capturado", () => {
  const aulas = encontrarAulasParaMissao(
    [curso],
    [curso.id],
    "Português",
    "Concordância verbal",
    3
  );

  assert.equal(aulas.length, 1);
  assert.equal(aulas[0].aula, "Concordância verbal");
  assert.equal(aulas[0].url, undefined);
  assert.equal(aulas[0].moduloId, "curso:curso-rdc:modulo:modulo-sintaxe");
  assert.equal(aulas[0].assuntoId, "curso:curso-rdc:aula:aula-concordancia");
  assert.equal(
    aulas[0].aulaId,
    "curso:curso-rdc:aula:aula-concordancia:link"
  );
  assert.equal(aulas[0].concluida, false);
});

test("Plano Tático envia a aula relacionada para a Central com o vínculo da missão", async () => {
  const codigo = await readFile(
    "src/pages/PlanoEdital/PlanoEditalGateway.tsx",
    "utf8"
  );

  assert.match(
    codigo,
    /sincronizarProgressoCursos\(configCursos\.cursos \?\? \[\], materias\)/
  );
  assert.match(codigo, /cursosSincronizados/);
  assert.match(codigo, /pmpe:central-estudos:prefill/);
  assert.match(codigo, /moduloId: aula\.moduloId/);
  assert.match(codigo, /assuntoId: aula\.assuntoId/);
  assert.match(codigo, /aulaId: aula\.aulaId/);
  assert.match(codigo, /missaoId: missao\.id/);
  assert.match(codigo, /navigate\("\/central-estudos"\)/);
});

test("finalizar missão dinâmica conclui o conteúdo do curso e a Central reconhece o vínculo", async () => {
  const [cronometro, central] = await Promise.all([
    readFile("src/context/CronometroContext.tsx", "utf8"),
    readFile("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8"),
  ]);

  assert.match(cronometro, /const materiaVinculada/);
  assert.match(cronometro, /const aulaVinculada/);
  assert.match(cronometro, /definirConclusaoAula\(/);
  assert.match(cronometro, /sessaoAtiva\.missaoId as string/);

  assert.match(
    central,
    /estado\.missaoId && \(estado\.assuntoId \|\| estado\.aulaId\)/
  );
});


test("Plano dinâmico usa o mesmo layout didático do PlanoEstudos", async () => {
  const codigo = await readFile(
    "src/pages/PlanoEdital/PlanoEditalGateway.tsx",
    "utf8"
  );

  assert.match(codigo, /\.\.\/PlanoEstudos\/PlanoEstudos\.css/);
  assert.match(codigo, /className="plano-container plano-unificado"/);
  assert.match(codigo, /className="plano-semanas"/);
  assert.match(codigo, /className="plano-resumo-semana"/);
  assert.match(codigo, /className="plano-dias"/);
  assert.match(codigo, /className="plano-conteudo-dia"/);
  assert.match(codigo, /plano-missao-card/);
  assert.match(codigo, /plano-estudar/);
  assert.match(codigo, /plano-desmarcar/);
  assert.match(codigo, /plano-concluir/);
});

test("missão do edital abre aula do curso quando houver correspondência", async () => {
  const codigo = await readFile(
    "src/pages/PlanoEdital/PlanoEditalGateway.tsx",
    "utf8"
  );

  assert.match(codigo, /function iniciarMissaoDoPlano/);
  assert.match(codigo, /const primeiraAula = aulasRelacionadas\[0\]/);
  assert.match(codigo, /iniciarAulaDoCurso\(missao, primeiraAula\)/);
  assert.match(codigo, /Módulo: \{aulaPrincipal\?\.modulo \?\? "Edital atual"\}/);
});
