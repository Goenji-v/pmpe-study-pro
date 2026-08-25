import type {
  QuestaoIA,
} from "../types/index";

import { criarUrlApi } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";

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
  questoes: unknown[];
};

type RespostaErro = {
  sucesso: false;
  erro: string;
  resposta?: string;
};

const API_URL = criarUrlApi("/api/gerar");
const LETRAS = ["A", "B", "C", "D", "E"] as const;

export async function gerarQuestoesIA(
  parametros: ParametrosGeracaoIA
): Promise<{ sucesso: true; questoes: QuestaoIA[] }> {
  const assuntoCompleto = montarContextoGeracao(parametros);

  let resposta: Response;

  try {
    resposta = await fetchApiAutenticada(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assunto: assuntoCompleto,
        quantidade: parametros.quantidade,
        banca: parametros.banca,
        enunciadosEvitar: parametros.enunciadosEvitar ?? [],
      }),
    });
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("sessão")) {
      throw erro;
    }

    throw new Error(
      "Não foi possível conectar à IA. Verifique se a API está online e tente novamente."
    );
  }

  let dados: RespostaSucesso | RespostaErro;

  try {
    dados = (await resposta.json()) as RespostaSucesso | RespostaErro;
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!resposta.ok || !dados.sucesso) {
    throw new Error(
      "erro" in dados
        ? dados.erro
        : `Erro HTTP ${resposta.status}`
    );
  }

  if (!Array.isArray(dados.questoes)) {
    throw new Error("A API não retornou uma lista válida de questões.");
  }

  const questoes = normalizarQuestoes(dados.questoes, parametros);

  if (questoes.length !== parametros.quantidade) {
    throw new Error(
      `A IA retornou ${questoes.length} questão(ões) válidas, mas eram esperadas ${parametros.quantidade}. Tente gerar novamente.`
    );
  }

  return {
    sucesso: true,
    questoes,
  };
}

function montarContextoGeracao(
  parametros: ParametrosGeracaoIA
) {
  if (parametros.origem === "semana") {
    const conteudos = parametros.conteudosSemana ?? [];

    if (conteudos.length === 0) {
      throw new Error("A semana selecionada não possui conteúdos válidos.");
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
  questoes: unknown[],
  parametros: ParametrosGeracaoIA
): QuestaoIA[] {
  const vistos = new Set<string>();

  return questoes.map((valor, indice) => {
    const questao = objetoSeguro(valor);
    const enunciado = textoObrigatorio(
      questao.enunciado,
      `Questão ${indice + 1}: enunciado ausente.`
    );
    const chaveEnunciado = normalizarTexto(enunciado);

    if (vistos.has(chaveEnunciado)) {
      throw new Error(`A IA repetiu o enunciado da questão ${indice + 1}.`);
    }
    vistos.add(chaveEnunciado);

    const alternativasBrutas = objetoSeguro(questao.alternativas);
    const alternativas = Object.fromEntries(
      LETRAS.map((letra) => [
        letra,
        textoObrigatorio(
          alternativasBrutas[letra],
          `Questão ${indice + 1}: alternativa ${letra} ausente.`
        ),
      ])
    ) as QuestaoIA["alternativas"];

    const alternativasNormalizadas = LETRAS.map((letra) =>
      normalizarTexto(alternativas[letra])
    );
    if (new Set(alternativasNormalizadas).size !== LETRAS.length) {
      throw new Error(`Questão ${indice + 1}: existem alternativas duplicadas.`);
    }

    const respostaCorreta = validarResposta(
      questao.respostaCorreta,
      indice + 1
    );

    const explicacao = textoObrigatorio(
      questao.explicacao,
      `Questão ${indice + 1}: explicação ausente.`
    );

    const dificuldade = normalizarDificuldade(
      questao.dificuldade,
      parametros.dificuldade
    );

    return {
      id: crypto.randomUUID(),
      materia:
        parametros.origem === "assunto"
          ? parametros.materia || "Conteúdo selecionado"
          : textoObrigatorio(
              questao.materia,
              `Questão ${indice + 1}: matéria ausente.`
            ),
      modulo:
        parametros.origem === "assunto"
          ? parametros.modulo || "Geral"
          : textoOpcional(questao.modulo),
      moduloId:
        parametros.origem === "assunto"
          ? parametros.moduloId
          : textoOpcional(questao.moduloId),
      assunto:
        parametros.origem === "assunto"
          ? parametros.assunto || "Assunto selecionado"
          : textoObrigatorio(
              questao.assunto,
              `Questão ${indice + 1}: assunto ausente.`
            ),
      banca: parametros.banca,
      dificuldade,
      enunciado,
      alternativas,
      respostaCorreta,
      explicacao,
    };
  });
}

function validarResposta(
  valor: unknown,
  numeroQuestao: number
): QuestaoIA["respostaCorreta"] {
  const resposta = String(valor ?? "").trim().toUpperCase();

  if (LETRAS.includes(resposta as (typeof LETRAS)[number])) {
    return resposta as QuestaoIA["respostaCorreta"];
  }

  throw new Error(
    `Questão ${numeroQuestao}: gabarito inválido. A questão foi rejeitada em vez de assumir uma alternativa.`
  );
}

function normalizarDificuldade(
  valor: unknown,
  padrao: DificuldadeIA
): QuestaoIA["dificuldade"] {
  if (valor === "Fácil" || valor === "Média" || valor === "Difícil") {
    return valor;
  }

  return padrao === "Fácil" || padrao === "Difícil"
    ? padrao
    : "Média";
}

function objetoSeguro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : {};
}

function textoObrigatorio(
  valor: unknown,
  erro: string
) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) throw new Error(erro);
  return texto;
}

function textoOpcional(valor: unknown) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto || undefined;
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
