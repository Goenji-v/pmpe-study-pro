import type {
  QuestaoIA,
} from "../types/index";

import { criarUrlApi } from "../config/api";
import {
  SUPABASE_PUBLIC_KEY,
  supabase,
} from "../lib/supabase";

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

  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;

  if (!token) {
    throw new Error("Sua sessão expirou. Entre novamente para gerar questões.");
  }

  let resposta: Response;

  try {
    resposta = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${token}`,
          "X-Supabase-Anon-Key": SUPABASE_PUBLIC_KEY,
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

  if (dados.questoes.length !== parametros.quantidade) {
    throw new Error(
      `A IA retornou ${dados.questoes.length} questão(ões), mas eram esperadas ${parametros.quantidade}. Tente gerar novamente.`
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
  const regrasBanca = montarRegrasDaBanca(parametros.banca);

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
      "Não invente dispositivo legal, jurisprudência, dado histórico ou regra gramatical.",
      "Cada questão deve ter exatamente uma resposta defensável e cinco alternativas não vazias e semanticamente distintas.",
      "Os distratores devem ser plausíveis, sem pistas artificiais de tamanho, gramática ou formatação.",
      "A explicação deve justificar a correta e, quando necessário, apontar objetivamente por que as principais alternativas estão erradas.",
      "",
      regrasBanca,
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
    "Não invente dispositivo legal, jurisprudência, dado histórico ou regra gramatical.",
    "Crie exatamente cinco alternativas não vazias, semanticamente distintas e com apenas uma resposta defensável.",
    "Evite pistas artificiais na alternativa correta e use distratores plausíveis dentro do mesmo conteúdo.",
    "A explicação deve ser objetiva e suficiente para conferir o gabarito.",
    regrasBanca,
  ].join("\n");
}

function montarRegrasDaBanca(banca: string) {
  const nome = banca.trim().toUpperCase();

  if (nome.includes("AOCP")) {
    return [
      "PADRÃO AOCP:",
      "- prefira comandos objetivos e cobrança aplicada do conteúdo, sem transformar a questão em trivia;",
      "- use alternativas próximas entre si, com erros conceituais discretos e plausíveis;",
      "- quando usar texto-base, a resposta deve depender do texto e do conteúdo cobrado, não de opinião;",
      "- em legislação, diferencie literalidade, exceções e aplicação do dispositivo sem criar redação inexistente;",
      "- não copie questão real nem parafraseie enunciados informados na lista de repetição.",
    ].join("\n");
  }

  return [
    `PADRÃO DA BANCA ${banca.trim() || "informada"}:`,
    "- reproduza o nível de precisão e o tipo de raciocínio normalmente exigidos pela banca, sem copiar questões reais;",
    "- mantenha comando inequívoco e somente uma alternativa correta.",
  ].join("\n");
}

function normalizarQuestoes(
  questoes: QuestaoIA[],
  parametros: ParametrosGeracaoIA
): QuestaoIA[] {
  return questoes.map(
    (questao, indice) => {
      const respostaCorreta = validarResposta(
        questao?.respostaCorreta,
        indice
      );
      const alternativas = validarAlternativas(
        questao?.alternativas,
        indice
      );
      const enunciado = textoObrigatorio(
        questao?.enunciado,
        `enunciado da questão ${indice + 1}`,
        10
      );
      const explicacao = textoObrigatorio(
        questao?.explicacao,
        `explicação da questão ${indice + 1}`,
        8
      );

      return {
        ...questao,

        id:
          crypto.randomUUID(),

        materia:
          parametros.origem === "assunto"
            ? parametros.materia || "Conteúdo selecionado"
            : textoObrigatorio(
                questao?.materia,
                `matéria da questão ${indice + 1}`,
                2
              ),

        modulo:
          parametros.origem === "assunto"
            ? parametros.modulo || "Geral"
            : questao?.modulo?.trim() || undefined,

        moduloId:
          parametros.origem === "assunto"
            ? parametros.moduloId
            : questao?.moduloId,

        assunto:
          parametros.origem === "assunto"
            ? parametros.assunto || "Assunto selecionado"
            : textoObrigatorio(
                questao?.assunto,
                `assunto da questão ${indice + 1}`,
                2
              ),

        banca:
          parametros.banca,

        dificuldade:
          normalizarDificuldade(
            questao?.dificuldade,
            parametros.dificuldade
          ),

        respostaCorreta,
        alternativas,
        enunciado,
        explicacao,
      };
    }
  );
}

function validarResposta(
  resposta: unknown,
  indice: number
): "A" | "B" | "C" | "D" | "E" {
  const valor = String(resposta ?? "")
    .trim()
    .toUpperCase();

  if (
    valor === "A" ||
    valor === "B" ||
    valor === "C" ||
    valor === "D" ||
    valor === "E"
  ) {
    return valor;
  }

  const alternativa = valor.match(/^ALTERNATIVA\s+([A-E])$/)?.[1];
  if (alternativa) {
    return alternativa as "A" | "B" | "C" | "D" | "E";
  }

  throw new Error(
    `A IA retornou um gabarito inválido na questão ${indice + 1}. Nenhuma resposta foi presumida automaticamente.`
  );
}

function validarAlternativas(
  alternativas: QuestaoIA["alternativas"] | undefined,
  indice: number
): QuestaoIA["alternativas"] {
  const resultado = {
    A: String(alternativas?.A ?? "").trim(),
    B: String(alternativas?.B ?? "").trim(),
    C: String(alternativas?.C ?? "").trim(),
    D: String(alternativas?.D ?? "").trim(),
    E: String(alternativas?.E ?? "").trim(),
  };

  const valores = Object.values(resultado);
  if (valores.some((texto) => texto.length < 1)) {
    throw new Error(
      `A IA retornou alternativa vazia na questão ${indice + 1}. A questão foi rejeitada.`
    );
  }

  const normalizadas = valores.map((texto) =>
    texto.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim()
  );
  if (new Set(normalizadas).size !== 5) {
    throw new Error(
      `A IA retornou alternativas duplicadas na questão ${indice + 1}. A questão foi rejeitada.`
    );
  }

  return resultado;
}

function textoObrigatorio(
  valor: unknown,
  campo: string,
  minimo: number
) {
  const texto = String(valor ?? "").trim();
  if (texto.length < minimo) {
    throw new Error(
      `A IA retornou ${campo} incompleto. A geração foi rejeitada para não salvar conteúdo duvidoso.`
    );
  }
  return texto;
}

function normalizarDificuldade(
  dificuldade: unknown,
  solicitada: DificuldadeIA
): QuestaoIA["dificuldade"] {
  if (
    dificuldade === "Fácil" ||
    dificuldade === "Média" ||
    dificuldade === "Difícil"
  ) {
    return dificuldade;
  }

  return solicitada === "Mista"
    ? "Média"
    : solicitada;
}
