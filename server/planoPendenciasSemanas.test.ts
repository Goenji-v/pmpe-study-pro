import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SemanaPlano } from "../src/data/planoPMPE";
import type { Materia } from "../src/types";
import { obterConclusoesPlanoOperacional } from "../src/utils/planoOperacional";
import {
  ampliarPlanoAteSemana,
  getMissaoDoDiaOuProxima,
  getPrimeiraPendenciaUtil,
  getProximaMissao,
  getSemanaAtual,
  getSemanaOperacional,
  listarPendenciasAteSemana,
  semanaPorDataInicio,
} from "../src/utils/planoUtils";

const semanas: SemanaPlano[] = Array.from({length:4}, (_, i) => ({
  numero:i+1, nome:`Semana ${i+1}`,
  dias:[{numero:1, missoes:[{id:`m-${i+1}`,numero:1,materia:"Português",assunto:`Assunto ${i+1}`,tipo:"conteudo"}]}]
}));

test("semana 4 avança para 5 na segunda-feira mesmo sem marcar qualquer missão",()=>{
  // Início na segunda-feira 21/09; semana 5 começa em 19/10.
  assert.equal(semanaPorDataInicio("2026-09-21", new Date(2026,9,18,12)),4);
  assert.equal(semanaPorDataInicio("2026-09-21", new Date(2026,9,19,12)),5);
  assert.equal(getSemanaAtual([],semanas,undefined,"2026-09-21",new Date(2026,9,24,12)),5);
});
test("fuso de verão não deve fazer semana avançar ou atrasar",()=>{
  assert.equal(semanaPorDataInicio("2026-10-01", new Date(2026,9,5,12)),2);
  assert.equal(semanaPorDataInicio("2026-10-01", new Date(2026,9,4,12)),1);
});
test("sem data de início definida, não inventa a idade do plano",()=>{
  assert.equal(semanaPorDataInicio(undefined),null);
  assert.equal(semanaPorDataInicio("2026-99-01"),null);
  assert.equal(semanaPorDataInicio("2026-02-30"),null);
});
test("semanas novas são exibidas vazias; não criam assunto fictício",()=>{
  const a=ampliarPlanoAteSemana(semanas,5);
  assert.equal(a.length,5);
  assert.equal(a[4].numero,5);
  assert.equal(a[4].dias.length,7);
  assert.ok(a[4].dias.every(d=>d.missoes.length===0));
  assert.deepEqual(a.slice(0,4),semanas);
});
test("pendências antigas aparecem antes das novas; semana avançada não diz plano concluído",()=>{
  const feitas=["m-1","m-3"];
  const a=ampliarPlanoAteSemana(semanas,5);
  const atrasadas=listarPendenciasAteSemana(feitas,a,5);
  assert.deepEqual(atrasadas.map(x=>x.missao.id),["m-2","m-4"]);
  assert.equal(getProximaMissao(feitas,a,5)?.missao.id,"m-2");
  assert.equal(getSemanaAtual(feitas,a,undefined,"2026-09-21",new Date(2026,9,24,12)),5);
  assert.deepEqual(feitas,["m-1","m-3"]);
});
test("régua extra e revisões separadas não aparecem no plano",()=>{
  const pagina=readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx","utf8");
  const operacional=readFileSync("src/utils/planoOperacional.ts","utf8");
  assert.doesNotMatch(pagina,/reajuste-visual-individual|Aplicar régua nesta conta|Fila separada de revisões/);
  assert.match(pagina,/criarPlanoOperacional\(/);
  assert.match(operacional,/projetarPlanoCompactado\(base, concluidas\)/);
});


test("plano operacional ignora domingo atrasado e progresso espalhado em semana futura", () => {
  const plano: SemanaPlano[] = [
    {
      numero: 1,
      nome: "Semana 1",
      dias: [
        { numero: 1, missoes: [{ id: "s1-seg", numero: 1, materia: "Português", assunto: "Feita", tipo: "conteudo" }] },
        { numero: 7, missoes: [{ id: "s1-dom", numero: 1, materia: "Simulado", assunto: "Domingo atrasado", tipo: "simulado" }] },
      ],
    },
    {
      numero: 2,
      nome: "Semana 2",
      dias: [
        { numero: 3, missoes: [{ id: "s2-qua", numero: 1, materia: "Informática", assunto: "Primeira pendência útil", tipo: "conteudo" }] },
        { numero: 7, missoes: [{ id: "s2-dom", numero: 1, materia: "Redação", assunto: "Redação semanal", tipo: "redacao" }] },
      ],
    },
    {
      numero: 20,
      nome: "Semana 20",
      dias: [
        { numero: 2, missoes: [{ id: "s20-ter", numero: 1, materia: "História", assunto: "Conclusão antiga espalhada", tipo: "conteudo" }] },
      ],
    },
  ];

  const concluidas = ["s1-seg", "s20-ter"];
  const primeira = getPrimeiraPendenciaUtil(concluidas, plano);

  assert.equal(primeira?.semana, 2);
  assert.equal(primeira?.dia, 3);
  assert.equal(primeira?.missao.id, "s2-qua");

  const atrasadas = listarPendenciasAteSemana(concluidas, plano, primeira!.semana);
  assert.deepEqual(atrasadas.map((item) => item.missao.id), ["s1-dom"]);
});


test("44 conteúdos concluídos compactam o avanço para semana 8 dia 3", async () => {
  const { projetarPlanoCompactado } = await import("../src/utils/projecaoCronogramaIndividual");

  const plano: SemanaPlano[] = Array.from({ length: 24 }, (_, indiceSemana) => ({
    numero: indiceSemana + 1,
    nome: `Semana ${indiceSemana + 1}`,
    dias: [
      ...Array.from({ length: 6 }, (_, indiceDia) => ({
        numero: indiceDia + 1,
        missoes: [{
          id: `conteudo-${indiceSemana * 6 + indiceDia + 1}`,
          numero: 1,
          materia: "PMPE",
          assunto: `Conteúdo ${indiceSemana * 6 + indiceDia + 1}`,
          tipo: "conteudo" as const,
        }],
      })),
      {
        numero: 7,
        missoes: [
          {
            id: `domingo-${indiceSemana + 1}`,
            numero: 1,
            materia: "Redação",
            assunto: "Redação semanal",
            tipo: "redacao" as const,
          },
        ],
      },
    ],
  }));

  // Simula o pós-edital: as 44 conclusões estão espalhadas na grade bruta,
  // inclusive em semanas distantes.
  const concluidas = Array.from({ length: 44 }, (_, i) =>
    `conteudo-${((i * 17) % 144) + 1}`
  );
  const idsUnicos = Array.from(new Set(concluidas));
  while (idsUnicos.length < 44) {
    const candidato = `conteudo-${idsUnicos.length + 1}`;
    if (!idsUnicos.includes(candidato)) idsUnicos.push(candidato);
  }

  const compactado = projetarPlanoCompactado(plano, idsUnicos);
  const primeira = getPrimeiraPendenciaUtil(idsUnicos, compactado);

  assert.equal(idsUnicos.length, 44);
  assert.equal(primeira?.semana, 8);
  assert.equal(primeira?.dia, 3);
  assert.equal(getSemanaOperacional(idsUnicos, compactado), 8);
});

test("terça sem pendência puxa a próxima missão útil em vez de ficar vazia", () => {
  const plano: SemanaPlano[] = [{
    numero: 8,
    nome: "Semana 8",
    dias: [
      { numero: 1, missoes: [{ id: "seg", numero: 1, materia: "A", assunto: "Feita", tipo: "conteudo" }] },
      { numero: 2, missoes: [{ id: "ter", numero: 1, materia: "B", assunto: "Feita", tipo: "conteudo" }] },
      { numero: 3, missoes: [{ id: "qua", numero: 1, materia: "C", assunto: "Próxima", tipo: "conteudo" }] },
      { numero: 7, missoes: [{ id: "dom", numero: 1, materia: "Redação", assunto: "Semanal", tipo: "redacao" }] },
    ],
  }];

  const resultado = getMissaoDoDiaOuProxima(
    ["seg", "ter"],
    plano,
    8,
    2
  );

  assert.equal(resultado?.semana, 8);
  assert.equal(resultado?.dia, 3);
  assert.equal(resultado?.missao.id, "qua");
});

test("domingo não antecipa conteúdo de segunda-feira", () => {
  const plano: SemanaPlano[] = [
    {
      numero: 8,
      nome: "Semana 8",
      dias: [
        { numero: 7, missoes: [{ id: "domingo", numero: 1, materia: "Redação", assunto: "Semanal", tipo: "redacao" }] },
      ],
    },
    {
      numero: 9,
      nome: "Semana 9",
      dias: [
        { numero: 1, missoes: [{ id: "segunda", numero: 1, materia: "RLM", assunto: "Próxima", tipo: "conteudo" }] },
      ],
    },
  ];

  assert.equal(
    getMissaoDoDiaOuProxima(["domingo"], plano, 8, 7),
    null
  );
});

test("Plano, Dashboard e Missão do dia compartilham a mesma grade operacional", () => {
  const plano = readFileSync("src/pages/PlanoEstudos/PlanoEstudos.tsx", "utf8");
  const dashboard = readFileSync("src/pages/Dashboard/Dashboard.tsx", "utf8");
  const missao = readFileSync("src/components/MissaoDoDia/MissaoDoDia.tsx", "utf8");
  const notificacoes = readFileSync("src/components/NotificationCenter/NotificationCenter.tsx", "utf8");

  for (const fonte of [plano, dashboard, missao, notificacoes]) {
    assert.match(fonte, /criarPlanoOperacional\(/);
  }
});


test("assunto concluído antes da troca do edital continua concluído na grade atual", () => {
  const materias = [{
    id: "portugues",
    nome: "Português",
    modulos: [{
      id: "gramatica",
      nome: "Gramática",
      assuntos: [
        {
          id: "crase",
          nome: "Crase",
          concluido: true,
        },
        {
          id: "concordancia",
          nome: "Concordância",
          concluido: false,
        },
      ],
    }],
  }] as unknown as Materia[];

  const concluidas = obterConclusoesPlanoOperacional(
    materias,
    ["missao-legada-que-nao-existe-mais"]
  );

  assert.ok(concluidas.includes("missao-legada-que-nao-existe-mais"));
  assert.ok(concluidas.includes("conteudo-portugues-crase"));
  assert.ok(!concluidas.includes("conteudo-portugues-concordancia"));
});
