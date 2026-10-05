import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";

import {
  aplicarCursosAtivosNasMaterias,
  mesclarCursoRecebido,
  organizarCapturaCurso,
} from "../src/utils/importacaoCurso";
import { criarCodigoCapturadorRdc } from "../src/utils/capturadorCursoRdc";
import type { CapturaCurso } from "../src/types/cursos";

function capturaRdc(materiais = [
  {
    nome: "Resumo de Direitos Humanos.pdf",
    tipo: "pdf" as const,
    url: "https://cdn.exemplo.test/dh/resumo.pdf",
  },
]): CapturaCurso {
  return {
    versao: 4,
    titulo: "Polícia Militar de Pernambuco — RDC",
    urlOrigem: "https://app.resumodoconcurseiro.com.br/m/g4uvgyi",
    itens: [],
    paginas: [
      {
        nome: "Direitos Humanos",
        url: "https://app.resumodoconcurseiro.com.br/m/g4uvgyi/modulo/8",
        estado: "lida",
        modulos: [
          {
            nome: "Direitos Humanos",
            aulas: [
              {
                nome: "2. Evolução histórica e gerações de direitos humanos",
                url: "https://app.resumodoconcurseiro.com.br/m/g4uvgyi/modulo/8?aula=421",
                materiais,
              },
            ],
          },
        ],
      },
    ],
  };
}

test("captura V4 do RDC importa materiais da aula", () => {
  const curso = organizarCapturaCurso(capturaRdc());

  assert.equal(curso.materias.length, 1);
  assert.equal(curso.materias[0].nome, "Direitos Humanos");
  const aula = curso.materias[0].modulos[0].aulas[0];
  assert.equal(aula.materiais?.length, 1);
  assert.equal(aula.materiais?.[0].tipo, "pdf");
  assert.equal(
    aula.materiais?.[0].url,
    "https://cdn.exemplo.test/dh/resumo.pdf"
  );
});

test("material capturado aparece no assunto do Study Pro e define atalho PDF", () => {
  const curso = organizarCapturaCurso(capturaRdc());
  const materias = aplicarCursosAtivosNasMaterias(
    [],
    [curso],
    [curso.id]
  );
  const assunto = materias
    .find((materia) => materia.nome === "Direitos Humanos")
    ?.modulos?.[0]
    .assuntos[0];

  assert.ok(assunto);
  assert.equal(assunto.materiais?.length, 1);
  assert.equal(assunto.materiais?.[0].tipo, "pdf");
  assert.equal(
    assunto.pdf,
    "https://cdn.exemplo.test/dh/resumo.pdf"
  );
});

test("nova captura mescla materiais na aula existente sem duplicar progresso", () => {
  const anterior = organizarCapturaCurso(capturaRdc(), "RDC PMPE");
  anterior.materias[0].modulos[0].aulas[0].concluida = true;

  const nova = organizarCapturaCurso(
    capturaRdc([
      {
        nome: "Resumo de Direitos Humanos.pdf",
        tipo: "pdf",
        url: "https://cdn.exemplo.test/dh/resumo.pdf",
      },
      {
        nome: "Material de apoio",
        tipo: "material",
        url: "https://drive.exemplo.test/apoio",
      },
    ]),
    "RDC PMPE"
  );

  const mesclado = mesclarCursoRecebido([anterior], nova);
  const aula = mesclado.materias[0].modulos[0].aulas[0];

  assert.equal(aula.concluida, true);
  assert.equal(aula.materiais?.length, 2);
  assert.deepEqual(
    aula.materiais?.map((item) => item.url).sort(),
    [
      "https://cdn.exemplo.test/dh/resumo.pdf",
      "https://drive.exemplo.test/apoio",
    ].sort()
  );
});

test("Capturador RDC V4 é um bookmarklet válido e procura as fontes de materiais", () => {
  const codigo = criarCodigoCapturadorRdc();
  assert.match(codigo, /^javascript:/);
  assert.match(codigo, /content_files/);
  assert.match(codigo, /support_files/);
  assert.match(codigo, /useful_links/);
  assert.doesNotThrow(
    () => new Script(codigo.replace(/^javascript:/, ""))
  );
});
