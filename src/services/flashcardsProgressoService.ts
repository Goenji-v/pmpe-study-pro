import { supabase } from "../lib/supabase";

import type {
  EstatisticasFlashcards,
  ModoEstudoFlashcard,
  ProgressoQuestaoFlashcard,
} from "../types/flashcards";

type RegistroFlashcardBanco = {
  questao_id: string;
  materia: string;
  topico: string;
  tentativas: number;
  acertos: number;
  erros: number;
  ultima_acertou: boolean;
  ultima_modalidade: ModoEstudoFlashcard | null;
  ultima_resposta_em: string;
};

async function exigirUsuario() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error) {
    throw new Error(
      `Não foi possível identificar o usuário: ${error.message}`
    );
  }

  if (!data.user) {
    throw new Error(
      "Faça login para salvar o progresso dos flashcards."
    );
  }

  return data.user;
}

function converterRegistro(
  registro: RegistroFlashcardBanco
): ProgressoQuestaoFlashcard {
  return {
    questaoId: registro.questao_id,
    materia: registro.materia,
    topico: registro.topico,
    tentativas: registro.tentativas,
    acertos: registro.acertos,
    erros: registro.erros,
    ultimaAcertou: registro.ultima_acertou,
    ultimaModalidade:
      registro.ultima_modalidade ?? undefined,
    ultimaRespostaEm: registro.ultima_resposta_em,
  };
}

export async function listarProgressoFlashcards() {
  const usuario = await exigirUsuario();

  const { data, error } = await supabase
    .from("flashcards_progresso")
    .select(
      [
        "questao_id",
        "materia",
        "topico",
        "tentativas",
        "acertos",
        "erros",
        "ultima_acertou",
        "ultima_modalidade",
        "ultima_resposta_em",
      ].join(",")
    )
    .eq("user_id", usuario.id)
    .order("ultima_resposta_em", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Não foi possível carregar o progresso dos flashcards: ${error.message}`
    );
  }

  return (
    (data ?? []) as unknown as RegistroFlashcardBanco[]
  ).map(converterRegistro);
}

export async function registrarRespostaFlashcard(
  dados: {
    questaoId: string;
    materia: string;
    topico: string;
    acertou: boolean;
    modalidade: ModoEstudoFlashcard;
  }
) {
  const usuario = await exigirUsuario();

  const { data: existente, error: erroBusca } =
    await supabase
      .from("flashcards_progresso")
      .select(
        [
          "questao_id",
          "materia",
          "topico",
          "tentativas",
          "acertos",
          "erros",
          "ultima_acertou",
          "ultima_modalidade",
          "ultima_resposta_em",
        ].join(",")
      )
      .eq("user_id", usuario.id)
      .eq("questao_id", dados.questaoId)
      .maybeSingle();

  if (erroBusca) {
    throw new Error(
      `Não foi possível localizar o progresso da questão: ${erroBusca.message}`
    );
  }

  const agora = new Date().toISOString();
  const atual =
    existente as unknown as RegistroFlashcardBanco | null;

  const registro = {
    user_id: usuario.id,
    questao_id: dados.questaoId,
    materia: dados.materia,
    topico: dados.topico,
    tentativas: (atual?.tentativas ?? 0) + 1,
    acertos:
      (atual?.acertos ?? 0) + (dados.acertou ? 1 : 0),
    erros:
      (atual?.erros ?? 0) + (dados.acertou ? 0 : 1),
    ultima_acertou: dados.acertou,
    ultima_modalidade: dados.modalidade,
    ultima_resposta_em: agora,
    updated_at: agora,
  };

  const consulta = atual
    ? supabase
        .from("flashcards_progresso")
        .update(registro)
        .eq("user_id", usuario.id)
        .eq("questao_id", dados.questaoId)
    : supabase
        .from("flashcards_progresso")
        .insert({
          ...registro,
          created_at: agora,
        });

  const { data, error } = await consulta
    .select(
      [
        "questao_id",
        "materia",
        "topico",
        "tentativas",
        "acertos",
        "erros",
        "ultima_acertou",
        "ultima_modalidade",
        "ultima_resposta_em",
      ].join(",")
    )
    .single();

  if (error) {
    throw new Error(
      `Não foi possível salvar o progresso da questão: ${error.message}`
    );
  }

  return converterRegistro(
    data as unknown as RegistroFlashcardBanco
  );
}

export function calcularEstatisticasFlashcards(
  progresso: ProgressoQuestaoFlashcard[]
): EstatisticasFlashcards {
  const totalRespondidas = progresso.filter(
    (item) => item.tentativas > 0
  ).length;
  const totalTentativas = progresso.reduce(
    (total, item) => total + item.tentativas,
    0
  );
  const totalAcertos = progresso.reduce(
    (total, item) => total + item.acertos,
    0
  );
  const totalErros = progresso.reduce(
    (total, item) => total + item.erros,
    0
  );
  const percentualAcertos = totalTentativas
    ? Math.round((totalAcertos / totalTentativas) * 100)
    : 0;

  return {
    totalRespondidas,
    totalTentativas,
    totalAcertos,
    totalErros,
    percentualAcertos,
  };
}
