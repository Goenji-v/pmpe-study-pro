import assert from "node:assert/strict";
import test from "node:test";

import { gerarMateriasDoPlano } from "../src/utils/materiasDoPlano";

const URL_SEGURANCA_PDF =
  "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-informatica/lessons/seguranca-da-informacao-pdf-5/";

test("Segurança da informação de Informática possui as 11 aulas do curso", () => {
  const informatica = gerarMateriasDoPlano().find(
    (materia) => materia.nome === "Informática"
  );

  assert.ok(informatica);

  const seguranca = informatica.assuntos.find(
    (assunto) => assunto.nome === "Segurança da informação (PDF)"
  );

  assert.ok(seguranca);
  assert.equal(seguranca.aulas?.length, 11);
  assert.equal(seguranca.aulas?.[0]?.nome, "Segurança da informação (PDF)");
  assert.equal(seguranca.aulas?.[0]?.url, URL_SEGURANCA_PDF);
  assert.equal(
    seguranca.aulas?.[1]?.nome,
    "Parte I: Conceito e princípios da Segurança da Informação"
  );
  assert.equal(
    seguranca.aulas?.[9]?.nome,
    "Parte IX: Conceito de aplicativos de segurança, IDS, IPS, antimalwares, antivirus e firewall"
  );
  assert.equal(
    seguranca.aulas?.[10]?.nome,
    "Bateria de questões | Segurança da informação"
  );

  const ids = seguranca.aulas?.map((aula) => aula.id) ?? [];
  assert.equal(new Set(ids).size, 11);
  assert.deepEqual(
    seguranca.aulas?.map((aula) => aula.ordem),
    Array.from({ length: 11 }, (_, indice) => indice)
  );
});
