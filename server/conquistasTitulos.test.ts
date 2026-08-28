import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularTitulosConquista,
  TITULO_DISCIPLINADO,
  TITULO_MESTRE_REVISAO,
} from "../src/services/conquistasTitulos.ts";
import { CATALOGO_LOJA } from "../src/services/lojaGamificacao.ts";
import { migrarTitulosRetiradosDaLoja } from "../src/services/migracaoTitulosLoja.ts";
import type {
  ConfiguracoesApp,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
} from "../src/types/index.ts";
import type { EstadoEconomia } from "../src/services/economiaGamificacao.ts";

const configuracoes: ConfiguracoesApp = {
  nomeUsuario: "Teste",
  concurso: "PMPE",
  bancaPadrao: "AOCP",
  metaQuestoesDiaria: 20,
  metaMinutosDiaria: 120,
  metaRevisoesDiaria: 2,
  missoesPorDia: 1,
  tema: "escuro",
};

function economiaBase(recompensasRecebidas: string[] = []): EstadoEconomia {
  return {
    moedas: 0,
    recompensasRecebidas,
    inventario: [],
    compras: [],
  };
}

function iso(ano: number, mesZero: number, dia: number, hora = 12) {
  return new Date(ano, mesZero, dia, hora, 0, 0, 0).toISOString();
}

test("Disciplinado exige 30 dias consecutivos com login e todas as metas", () => {
  const agora = new Date(2026, 7, 30, 20, 0, 0, 0);
  const sessoes: SessaoEstudo[] = [];
  const questoes: RegistroQuestao[] = [];
  const revisoes: Revisao[] = [];
  const acessos: string[] = [];

  for (let i = 0; i < 30; i += 1) {
    const data = new Date(2026, 7, 30 - i, 12, 0, 0, 0);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    acessos.push(`acesso:${chave}`);
    sessoes.push({
      id: `sessao-${i}`,
      data: data.toISOString(),
      tipo: "estudo",
      materia: "Português",
      assunto: "Treino",
      minutos: 120,
    });
    questoes.push({
      id: `questoes-${i}`,
      data: data.toISOString(),
      materia: "Português",
      assunto: "Treino",
      banca: "AOCP",
      certas: 20,
      erradas: 0,
      minutos: 0,
    });
    for (let r = 0; r < 2; r += 1) {
      revisoes.push({
        id: `rev-${i}-${r}`,
        materiaId: "portugues",
        assuntoId: "treino",
        materia: "Português",
        assunto: "Treino",
        etapa: 1,
        dataCriacao: data.toISOString(),
        dataPrevista: data.toISOString(),
        concluida: true,
        dataConclusao: data.toISOString(),
      });
    }
  }

  const titulos = calcularTitulosConquista({
    questoes,
    sessoes,
    revisoes,
    simulados: [],
    missoesConcluidas: [],
    configuracoes,
    economia: economiaBase(acessos),
    agora,
  });

  assert.equal(
    titulos.find((titulo) => titulo.id === TITULO_DISCIPLINADO)?.desbloqueada,
    true
  );

  const semUmaMeta = calcularTitulosConquista({
    questoes: questoes.filter((item) => item.id !== "questoes-15"),
    sessoes,
    revisoes,
    simulados: [],
    missoesConcluidas: [],
    configuracoes,
    economia: economiaBase(acessos),
    agora,
  });

  assert.equal(
    semUmaMeta.find((titulo) => titulo.id === TITULO_DISCIPLINADO)?.desbloqueada,
    false
  );
});

test("Mestre da Revisão depende de 100 revisões no mês corrente", () => {
  const revisoes: Revisao[] = Array.from({ length: 100 }, (_, indice) => ({
    id: `rev-mes-${indice}`,
    materiaId: "dir",
    assuntoId: "assunto",
    materia: "Direito",
    assunto: "Assunto",
    etapa: 1 as const,
    dataCriacao: iso(2026, 7, 10),
    dataPrevista: iso(2026, 7, 10),
    concluida: true,
    dataConclusao: iso(2026, 7, 10),
  }));

  const agosto = calcularTitulosConquista({
    questoes: [],
    sessoes: [],
    revisoes,
    simulados: [],
    missoesConcluidas: [],
    configuracoes,
    economia: economiaBase(),
    agora: new Date(2026, 7, 28, 12),
  });
  assert.equal(
    agosto.find((titulo) => titulo.id === TITULO_MESTRE_REVISAO)?.desbloqueada,
    true
  );

  const setembro = calcularTitulosConquista({
    questoes: [],
    sessoes: [],
    revisoes,
    simulados: [],
    missoesConcluidas: [],
    configuracoes,
    economia: economiaBase(),
    agora: new Date(2026, 8, 1, 12),
  });
  assert.equal(
    setembro.find((titulo) => titulo.id === TITULO_MESTRE_REVISAO)?.desbloqueada,
    false
  );
});

test("Loja não vende títulos de mérito", () => {
  assert.equal(CATALOGO_LOJA.some((item) => item.id.startsWith("titulo-")), false);
});

test("títulos comprados antes da mudança são removidos e reembolsados uma única vez", () => {
  const estado: EstadoEconomia = {
    moedas: 20,
    recompensasRecebidas: [],
    inventario: ["titulo-mestre-revisao", "moldura-aco"],
    tituloEquipado: "titulo-mestre-revisao",
    compras: [
      {
        id: "compra:titulo-mestre-revisao:antiga",
        itemId: "titulo-mestre-revisao",
        preco: 180,
        compradoEm: iso(2026, 7, 20),
      },
    ],
  };

  const primeira = migrarTitulosRetiradosDaLoja(estado, new Date(2026, 7, 28, 12));
  assert.equal(primeira.estado.moedas, 200);
  assert.deepEqual(primeira.estado.inventario, ["moldura-aco"]);
  assert.equal(primeira.estado.tituloEquipado, undefined);
  assert.equal(primeira.moedasReembolsadas, 180);

  const segunda = migrarTitulosRetiradosDaLoja(primeira.estado, new Date(2026, 7, 28, 13));
  assert.equal(segunda.estado.moedas, 200);
  assert.equal(segunda.moedasReembolsadas, 0);
});
