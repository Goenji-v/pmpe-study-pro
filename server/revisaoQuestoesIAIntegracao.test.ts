import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fonteProcessador = readFileSync(
  new URL("./processarGeracaoPersistente.ts", import.meta.url),
  "utf8"
);

const fonteRevisoes = readFileSync(
  new URL("../src/pages/Revisoes/Revisoes.tsx", import.meta.url),
  "utf8"
);

const fonteGerador = readFileSync(
  new URL("../src/pages/GerarSimuladoIA/GerarSimuladoIA.tsx", import.meta.url),
  "utf8"
);

const fonteCorrecao = readFileSync(
  new URL("../src/pages/RevisaoCadernoIA/RevisaoCadernoIA.tsx", import.meta.url),
  "utf8"
);

const fonteCentralEstudos = readFileSync(
  new URL("../src/pages/CentralEstudos/CentralEstudos.tsx", import.meta.url),
  "utf8"
);

test("job persistente submete o lote a revisão semântica independente", () => {
  assert.match(fonteProcessador, /montarPromptRevisaoQuestoesIA/);
  assert.match(fonteProcessador, /validarLoteRevisado/);
  assert.match(fonteProcessador, /"revisando"/);
  assert.match(fonteProcessador, /"corrigindo"/);
});

test("job só marca concluída depois que o lote revisado passa no validador", () => {
  const indiceValidacao = fonteProcessador.indexOf("validarLoteRevisado(");
  const indiceConcluida = fonteProcessador.indexOf('status: "concluida"');

  assert.ok(indiceValidacao >= 0);
  assert.ok(indiceConcluida > indiceValidacao);
  assert.match(fonteProcessador, /status: "erro"/);
  assert.match(fonteProcessador, /resultado: \{\s*questoes: loteRevisado/s);
});


test("revisão abre Questões IA já preenchidas e vinculadas à pendência", () => {
  assert.match(fonteRevisoes, /className="revisao-questoes-ia"/);
  assert.match(fonteRevisoes, /✨ Questões IA/);
  assert.match(fonteRevisoes, /"pmpe:gerar-ia:modo"/);
  assert.match(fonteRevisoes, /"pmpe:gerar-ia:prefill"/);
  assert.match(fonteRevisoes, /CHAVE_ORIGEM_REVISAO_QUESTOES/);
  assert.match(fonteRevisoes, /revisaoId: revisao\.id/);
  assert.match(fonteRevisoes, /navigate\("\/gerar-simulado-ia"\)/);
});

test("revisão legada resolve a matéria atual mesmo quando o assunto não existe mais na grade", () => {
  assert.match(fonteRevisoes, /materiasEquivalentes/);
  assert.match(fonteRevisoes, /const materiaCanonica/);
  assert.match(fonteRevisoes, /materiaCanonica\?\.nome \?\? revisao\.materia/);
  assert.match(fonteRevisoes, /materiaMudou/);
  assert.match(fonteRevisoes, /assunto: referencia\?\.assunto\.nome \?\? revisao\.assunto/);
});


test("gerador consome matéria, assunto, quantidade e banca vindos do reforço", () => {
  assert.match(fonteGerador, /pmpe:gerar-ia:prefill/);
  assert.match(fonteGerador, /setMateriaSelecionada\(prefill\.materia\)/);
  assert.match(fonteGerador, /QUANTIDADES_DISPONIVEIS\.includes\(prefill\.quantidade\)/);
  assert.match(fonteGerador, /setBanca\(prefill\.banca\.trim\(\)\)/);
});

test("correção oferece próximos passos sem criar revisão duplicada", () => {
  assert.match(fonteCorrecao, /Entender meus erros/);
  assert.match(fonteCorrecao, /Revisar material/);
  assert.match(fonteCorrecao, /Gerar 10 semelhantes/);
  assert.match(fonteCorrecao, /Ver agenda de revisões/);
  assert.match(fonteCorrecao, /"pmpe:gerar-ia:prefill"/);
  assert.match(fonteCorrecao, /quantidade: 10/);
  assert.match(fonteCorrecao, /navigate\("\/gerar-simulado-ia"\)/);
  assert.match(fonteCorrecao, /"pmpe:central-estudos:prefill"/);
  assert.match(fonteCorrecao, /navigate\("\/central-estudos"\)/);
  assert.doesNotMatch(fonteCorrecao, /setRevisoes/);
});


test("revisão mostra a decisão adaptativa e as três datas de retorno", () => {
  assert.match(fonteRevisoes, /preverProximaRevisaoPorDesempenho/);
  assert.match(fonteRevisoes, /Difícil/);
  assert.match(fonteRevisoes, /Médio/);
  assert.match(fonteRevisoes, /Fácil/);
  assert.match(fonteRevisoes, /encerra o ciclo/);
  assert.match(fonteRevisoes, /Rever teoria/);
  assert.match(fonteRevisoes, /Fazer questões/);
});

test("trocar para Questões dentro de revisão vinculada preserva o vínculo", () => {
  assert.match(
    fonteCentralEstudos,
    /estado\.revisaoId &&[\s\S]*estado\.tipo === "revisao"/
  );
  assert.match(
    fonteCentralEstudos,
    /tipo === "questoes"[\s\S]*formatoRevisao: "questoes"/
  );
  assert.match(
    fonteCentralEstudos,
    /Revisão vinculada preservada\. Formato alterado para Questões\./
  );
});

