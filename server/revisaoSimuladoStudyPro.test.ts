import assert from "node:assert/strict";
import test from "node:test";

import type { Materia, Revisao } from "../src/types";
import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro";
import { adicionarErrosSimuladoARevisao } from "../src/utils/revisaoSimuladoStudyPro";

const materias: Materia[] = [
  {
    id: "portugues",
    nome: "Português",
    modulos: [
      {
        id: "gramatica",
        nome: "Gramática",
        ordem: 1,
        assuntos: [
          {
            id: "crase",
            nome: "Crase",
            concluido: true,
            prioridade: "media",
          },
        ],
      },
    ],
    assuntos: [
      {
        id: "crase",
        nome: "Crase",
        concluido: true,
        prioridade: "media",
      },
    ],
  },
];

function criarAnalise() {
  const questoes = Array.from({ length: 5 }, (_, indice) => ({
    id: `q${indice + 1}`,
    numero: indice + 1,
    materia: "Português",
    materiaId: "portugues",
    modulo: "Gramática",
    moduloId: "gramatica",
    assunto: "Crase",
    assuntoId: "crase",
    dificuldade: "Média" as const,
    enunciado: `Questão ${indice + 1}`,
    alternativas: [
      { id: "A", texto: "A" },
      { id: "B", texto: "B" },
      { id: "C", texto: "C" },
      { id: "D", texto: "D" },
      { id: "E", texto: "E" },
    ],
    gabarito: "A",
  }));

  return analisarSimuladoStudyPro({
    tentativaId: "tentativa-1",
    nome: "Simulado",
    data: "2026-09-28T10:00:00.000Z",
    questoes,
    respostas: Object.fromEntries(questoes.map((item) => [item.id, "A"])),
    marcacoes: { q1: "chutei" },
  });
}

test("acerto por chute entra automaticamente como fraqueza na revisão", () => {
  const analise = criarAnalise();
  const agora = new Date("2026-09-28T10:00:00.000Z");

  const resultado = adicionarErrosSimuladoARevisao({
    revisoes: [],
    materias,
    analise,
    agora,
    criarId: () => "revisao-crase",
  });

  assert.equal(resultado.criadas, 1);
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0]?.id, "revisao-crase");
  assert.equal(resultado.revisoes[0]?.certas, 4);
  assert.equal(resultado.revisoes[0]?.erradas, 1);
  assert.equal(resultado.revisoes[0]?.etapa, 1);
  assert.equal(
    resultado.revisoes[0]?.dataPrevista,
    "2026-09-29T12:00:00.000Z"
  );
});

test("não duplica assunto que já possui revisão pendente", () => {
  const analise = criarAnalise();
  const existente: Revisao = {
    id: "existente",
    materiaId: "portugues",
    moduloId: "gramatica",
    assuntoId: "crase",
    materia: "Português",
    modulo: "Gramática",
    assunto: "Crase",
    etapa: 1,
    dataCriacao: "2026-09-20T12:00:00.000Z",
    dataPrevista: "2026-10-10T12:00:00.000Z",
    concluida: false,
  };

  const resultado = adicionarErrosSimuladoARevisao({
    revisoes: [existente],
    materias,
    analise,
    agora: new Date("2026-09-28T10:00:00.000Z"),
  });

  assert.equal(resultado.criadas, 0);
  assert.equal(resultado.atualizadas, 1);
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0]?.id, "existente");
  assert.equal(
    resultado.revisoes[0]?.dataPrevista,
    "2026-09-29T12:00:00.000Z"
  );
});

function gradeDomingo(): Materia[] {
  const grade = [
    ["Direito Constitucional", [
      "Direito de Nacionalidade",
      "Direitos Políticos e partidos políticos",
    ]],
    ["Raciocínio Lógico e Matemática", [
      "Lógica argumentativa",
      "Conectivos lógicos",
    ]],
    ["Informática", [
      "Windows - Parte III: Nomes, símbolos proibidos, painel de controle, novidades do Windows 10",
    ]],
    ["Língua Portuguesa", [
      "Orações subordinadas",
      "Orações subordinadas adverbiais",
    ]],
    ["História", [
      "A presença Holandesa, O governo Nassau e a Insurreição Pernambucana",
      "Confederação do Equador",
      "Guerra dos Mascates",
    ]],
  ] as Array<[string, string[]]>;
  return grade.map(([nome, assuntos], i) => {
    const itens = assuntos.map((assunto, j) => ({
      id: `a-${i}-${j}`,
      nome: assunto,
      concluido: false,
      prioridade: "media" as const,
    }));
    return {
      id: `m-${i}`,
      nome,
      modulos: [{ id: `mod-${i}`, nome: "Curso", ordem: 1, assuntos: itens }],
      assuntos: itens,
    };
  });
}

function analiseDomingo(): ReturnType<typeof criarAnalise> {
  const diagnosticos = [
    ["Direito Constitucional", "Nacionalidade"],
    ["Direito Constitucional", "Elegibilidade"],
    ["Raciocínio Lógico", "Lógica de Argumentação"],
    ["Informática", "Microsoft Windows 10"],
    ["Língua Portuguesa", "Orações subordinadas adverbiais"],
    ["Raciocínio Lógico", "Conectivos Lógicos"],
    ["História de Pernambuco", "Economia Açucareira"],
    ["História de Pernambuco", "Invasões Holandesas"],
  ];
  const assuntos = diagnosticos.map(([materia, assunto], i) => ({
    chave: `prioridade-${i}`, materia, assunto,
    acertos: 0, erros: 2, acertosPorChute: 0, naoRespondidas: 0,
  }));
  const planoRevisao = assuntos.map((item) => ({
    chave: item.chave,
    prioridadeIndice: 90,
    quantidadeQuestoes: 12,
  }));
  return {
    ...criarAnalise(),
    tentativaId: "teste-domingo-60",
    assuntos,
    planoRevisao,
  } as unknown as ReturnType<typeof criarAnalise>;
}

function pendenteDomingo(
  id: string, materiaId: string, assuntoId: string,
  materia: string, assunto: string, dia: number
): Revisao {
  return {
    id,
    materiaId,
    assuntoId,
    materia,
    assunto,
    etapa: 1,
    dataCriacao: "2026-10-09T12:00:00.000Z",
    dataPrevista: `2026-10-${String(dia).padStart(2,"0")}T12:00:00.000Z`,
    concluida: false,
  };
}

test("Simulado de domingo: oito prioridades ficam na agenda sem duplicar e respeitando meta diária", () => {
  const grade = gradeDomingo();
  const analise = analiseDomingo();
  const existentes: Revisao[] = [
    pendenteDomingo("nacionalidade", "m-0", "a-0-0", grade[0].nome,
      "Direito de Nacionalidade", 11),
    pendenteDomingo("conectivos", "m-1", "a-1-1", grade[1].nome,
      "Conectivos lógicos", 11),
    pendenteDomingo("logica", "m-1", "a-1-0", grade[1].nome,
      "Lógica argumentativa", 14),
    pendenteDomingo("portugues-generica", "m-3", "a-3-0",
      grade[3].nome, "Orações subordinadas", 11),
    // Outros compromissos do cronograma não devem ser apagados/movidos.
    pendenteDomingo("outro-12a", "outra", "outro-a", "Outra", "Outro A", 12),
    pendenteDomingo("outro-12b", "outra", "outro-b", "Outra", "Outro B", 12),
  ];
  let seq = 0;
  const executar = (revisoes: Revisao[]) => adicionarErrosSimuladoARevisao({
    revisoes,
    materias: grade,
    analise,
    agora: new Date("2026-10-10T09:00:00.000Z"),
    criarId: () => `novo-${++seq}`,
    limiteDiario: 2,
  });
  const primeira = executar(existentes);
  assert.equal(primeira.criadas, 5);
  assert.equal(primeira.semReferencia, 1);
  assert.equal(primeira.revisoes.length, existentes.length + 5);
  for (const antigo of existentes.filter((item) => item.id !== "logica")) {
    assert.ok(primeira.revisoes.some((item) => item.id === antigo.id));
  }
  const novas = primeira.revisoes.filter((item) => item.id.startsWith("novo-"));
  assert.equal(novas.length, 5);
  assert.equal(novas.filter((item) =>
    item.origemSimulado?.vinculo === "sem_conteudo"
  ).length, 1);
  assert.ok(novas.some((item) =>
    item.assunto === "Economia Açucareira" &&
    item.assuntoId.startsWith("simulado-assunto:")
  ));
  assert.ok(novas.some((item) =>
    item.assunto === "Orações subordinadas adverbiais" &&
    item.assuntoId === "a-3-1"
  ));
  assert.ok(novas.some((item) =>
    item.assunto === "Direitos Políticos e partidos políticos"
  ));
  assert.ok(novas.some((item) =>
    item.assunto === "Windows - Parte III: Nomes, símbolos proibidos, painel de controle, novidades do Windows 10"
  ));
  assert.ok(novas.some((item) =>
    item.assunto === "A presença Holandesa, O governo Nassau e a Insurreição Pernambucana"
  ));

  for (const data of new Set(novas.map((item) => item.dataPrevista.slice(0,10)))) {
    const totalDia = primeira.revisoes.filter((item) =>
      !item.concluida && item.dataPrevista.slice(0,10) === data
    ).length;
    assert.ok(totalDia <= 2, `Dia ${data} ultrapassou 2 revisões`);
  }

  const segunda = executar(primeira.revisoes);
  assert.equal(segunda.criadas, 0);
  assert.equal(segunda.atualizadas, 0);
  assert.equal(segunda.revisoes.length, primeira.revisoes.length);
});

test("reabrir a mesma análise não recria etapa que já foi concluída", () => {
  const grade = gradeDomingo();
  const analise = analiseDomingo();
  const primeira = adicionarErrosSimuladoARevisao({
    revisoes: [], materias: grade, analise,
    agora: new Date("2026-10-10T09:00:00.000Z"),
    limiteDiario: 2,
  });
  const concluidas = primeira.revisoes.map((item) => ({
    ...item, concluida: true,
  }));
  const segunda = adicionarErrosSimuladoARevisao({
    revisoes: concluidas, materias: grade, analise,
    agora: new Date("2026-10-10T12:00:00.000Z"),
    limiteDiario: 2,
  });
  assert.equal(segunda.criadas, 0);
  assert.equal(segunda.revisoes.length, concluidas.length);
});

test("recuperação do diagnóstico recente espera a nuvem sincronizar e não repete autosave vazio", async () => {
  const { readFile } = await import("node:fs/promises");
  const contexto = await readFile("src/context/AppContext.tsx", "utf8");
  assert.match(contexto, /listarAnalisesSimulados\(12\)/);
  assert.match(contexto, /statusNuvem !== "sincronizado"/);
  assert.match(contexto, /resultado\.criadas \+ resultado\.atualizadas > 0/);
});
