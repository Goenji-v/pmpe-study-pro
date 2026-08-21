import type {
  QuestaoIA,
} from "../types/index";

import { criarUrlApi } from "../config/api";

export type DificuldadeIA =
  | "Fácil"
  | "Média"
  | "Difícil"
  | "Mista";

export type ConteudoGeracaoIA = {
  materia: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
};

export type ParametrosGeracaoIA = {
  origem: "assunto" | "semana";

  materia?: string;
  modulo?: string;
  moduloId?: string;
  assunto?: string;

  semana?: number;
  conteudosSemana?: ConteudoGeracaoIA[];

  banca: string;
  dificuldade: DificuldadeIA;
  quantidade: number;
  enunciadosEvitar?: string[];
};

type RespostaSucesso = {
  sucesso: true;
  questoes: QuestaoIA[];
};

type RespostaErro = {
  sucesso: false;
  erro: string;
  resposta?: string;
};

const API_URL = criarUrlApi("/api/gerar");

export async function gerarQuestoesIA(
  parametros: ParametrosGeracaoIA
): Promise<RespostaSucesso> {
  const assuntoCompleto =
    montarContextoGeracao(parametros);

  let resposta: Response;

  try {
    resposta = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          assunto: assuntoCompleto,
          quantidade:
            parametros.quantidade,
          banca: parametros.banca,
          enunciadosEvitar:
            parametros.enunciadosEvitar ?? [],
        }),
      }
    );
  } catch {
    throw new Error(
      "Não foi possível conectar à IA. Verifique se a API está online e tente novamente."
    );
  }

  let dados:
    | RespostaSucesso
    | RespostaErro;

  try {
    dados =
      (await resposta.json()) as
        | RespostaSucesso
        | RespostaErro;
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !resposta.ok ||
    !dados.sucesso
  ) {
    throw new Error(
      "erro" in dados
        ? dados.erro
        : `Erro HTTP ${resposta.status}`
    );
  }

  if (
    !Array.isArray(
      dados.questoes
    )
  ) {
    throw new Error(
      "A API não retornou uma lista válida de questões."
    );
  }

  return {
    sucesso: true,
    questoes:
      normalizarQuestoes(
        dados.questoes,
        parametros
      ),
  };
}

function montarContextoGeracao(
  parametros: ParametrosGeracaoIA
) {
  if (
    parametros.origem ===
    "semana"
  ) {
    const conteudos =
      parametros.conteudosSemana ??
      [];

    if (conteudos.length === 0) {
      throw new Error(
        "A semana selecionada não possui conteúdos válidos."
      );
    }

    const lista = conteudos
      .map(
        (item, indice) =>
          `${indice + 1}. ${item.materia}${item.modulo ? ` → ${item.modulo}` : ""} → ${item.assunto}`
      )
      .join("\n");

    return [
      `Origem: Semana ${parametros.semana}`,
      "",
      "Gere as questões exclusivamente com base nos conteúdos abaixo.",
      "Distribua as questões de forma equilibrada entre matérias e assuntos.",
      "Não crie questões de conteúdos fora desta lista.",
      "",
      lista,
      "",
      `Dificuldade: ${parametros.dificuldade}`,
    ].join("\n");
  }

  return [
    `Matéria: ${parametros.materia}`,
    `Módulo: ${parametros.modulo || "Geral"}`,
    `Assunto: ${parametros.assunto}`,
    `Dificuldade: ${parametros.dificuldade}`,
  ].join("\n");
}

function normalizarQuestoes(
  questoes: QuestaoIA[],
  parametros: ParametrosGeracaoIA
): QuestaoIA[] {
  return questoes.map(
    (questao, indice) => ({
      ...questao,

      id:
        crypto.randomUUID(),

      materia:
        parametros.origem === "assunto"
          ? parametros.materia || "Conteúdo selecionado"
          : questao.materia || "Conteúdo da semana",

      modulo:
        parametros.origem === "assunto"
          ? parametros.modulo || "Geral"
          : questao.modulo,

      moduloId:
        parametros.origem === "assunto"
          ? parametros.moduloId
          : questao.moduloId,

      assunto:
        parametros.origem === "assunto"
          ? parametros.assunto || "Assunto selecionado"
          : questao.assunto || `Semana ${parametros.semana}`,

      banca:
        parametros.banca,

      dificuldade:
        questao.dificuldade ===
          "Fácil" ||
        questao.dificuldade ===
          "Média" ||
        questao.dificuldade ===
          "Difícil"
          ? questao.dificuldade
          : parametros.dificuldade ===
              "Mista"
            ? "Média"
            : parametros.dificuldade,

      respostaCorreta:
        normalizarResposta(
          questao.respostaCorreta
        ),

      alternativas: {
        A:
          questao.alternativas?.A ??
          "",
        B:
          questao.alternativas?.B ??
          "",
        C:
          questao.alternativas?.C ??
          "",
        D:
          questao.alternativas?.D ??
          "",
        E:
          questao.alternativas?.E ??
          "",
      },

      enunciado:
        questao.enunciado ||
        `Questão ${indice + 1}`,

      explicacao:
        questao.explicacao ||
        "Explicação não informada.",
    })
  );
}

function normalizarResposta(
  resposta: string
): "A" | "B" | "C" | "D" | "E" {
  const letra =
    String(resposta)
      .trim()
      .toUpperCase()
      .charAt(0);

  if (
    letra === "A" ||
    letra === "B" ||
    letra === "C" ||
    letra === "D" ||
    letra === "E"
  ) {
    return letra;
  }

  return "A";
}
