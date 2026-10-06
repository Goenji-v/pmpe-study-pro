import { supabase } from "../lib/supabase";
import { armazenamentoLocalDaConta as localStorage } from "./armazenamentoConta";
import {
  contarRespostasFlashcardOffline,
  enfileirarRespostaFlashcardOffline,
  listarRespostasFlashcardOffline,
  removerRespostaFlashcardOffline,
} from "./flashcardsOfflineQueue";
import {
  calcularProximaRevisaoSRS,
  type AvaliacaoSRS,
} from "../utils/repeticaoEspacada";

import type {
  EstatisticasFlashcards,
  ModoEstudoFlashcard,
  ProgressoQuestaoFlashcard,
} from "../types/flashcards";

const CHAVE_CACHE = "pmpe_flashcards_progresso_cache";

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
  avaliacao_ultima: AvaliacaoSRS | null;
  repeticoes: number | null;
  intervalo_dias: number | null;
  fator_facilidade: number | null;
  proxima_revisao_em: string | null;
};

type DadosResposta = {
  questaoId: string;
  materia: string;
  topico: string;
  modalidade: ModoEstudoFlashcard;
  acertou?: boolean;
  avaliacao?: AvaliacaoSRS;
};

const CAMPOS = [
  "questao_id",
  "materia",
  "topico",
  "tentativas",
  "acertos",
  "erros",
  "ultima_acertou",
  "ultima_modalidade",
  "ultima_resposta_em",
  "avaliacao_ultima",
  "repeticoes",
  "intervalo_dias",
  "fator_facilidade",
  "proxima_revisao_em",
].join(",");

async function exigirUsuario() {
  const sessao = await supabase.auth.getSession();
  if (sessao.data.session?.user) return sessao.data.session.user;

  const { data, error } = await supabase.auth.getUser();

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
    avaliacaoUltima: registro.avaliacao_ultima ?? undefined,
    repeticoes: registro.repeticoes ?? 0,
    intervaloDias: registro.intervalo_dias ?? 0,
    fatorFacilidade: registro.fator_facilidade ?? 2.5,
    proximaRevisaoEm: registro.proxima_revisao_em ?? undefined,
  };
}

function carregarCacheLocal() {
  try {
    const texto = localStorage.getItem(CHAVE_CACHE);
    if (!texto) return [] as ProgressoQuestaoFlashcard[];
    const valor: unknown = JSON.parse(texto);
    return Array.isArray(valor)
      ? valor as ProgressoQuestaoFlashcard[]
      : [];
  } catch {
    return [] as ProgressoQuestaoFlashcard[];
  }
}

function salvarCacheLocal(progresso: ProgressoQuestaoFlashcard[]) {
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(progresso));
  } catch {
    // O cache é auxiliar; a sincronização principal continua no Supabase.
  }
}

function atualizarCache(item: ProgressoQuestaoFlashcard) {
  const atual = carregarCacheLocal();
  const existe = atual.some((registro) => registro.questaoId === item.questaoId);
  const proximo = existe
    ? atual.map((registro) => registro.questaoId === item.questaoId ? item : registro)
    : [item, ...atual];
  salvarCacheLocal(proximo);
  return item;
}

function normalizarAvaliacao(dados: DadosResposta): AvaliacaoSRS {
  if (dados.avaliacao) return dados.avaliacao;
  return dados.acertou === false ? "dificil" : "medio";
}

function respostaFoiAcerto(avaliacao: AvaliacaoSRS, acertou?: boolean) {
  return typeof acertou === "boolean"
    ? acertou
    : avaliacao !== "dificil";
}

function aplicarRespostaLocal(dados: DadosResposta) {
  const avaliacao = normalizarAvaliacao(dados);
  const acertou = respostaFoiAcerto(avaliacao, dados.acertou);
  const atual = carregarCacheLocal().find(
    (item) => item.questaoId === dados.questaoId
  );
  const agora = new Date();
  const srs = calcularProximaRevisaoSRS(atual, avaliacao, agora);

  return atualizarCache({
    questaoId: dados.questaoId,
    materia: dados.materia,
    topico: dados.topico,
    tentativas: (atual?.tentativas ?? 0) + 1,
    acertos: (atual?.acertos ?? 0) + (acertou ? 1 : 0),
    erros: (atual?.erros ?? 0) + (acertou ? 0 : 1),
    ultimaAcertou: acertou,
    ultimaModalidade: dados.modalidade,
    ultimaRespostaEm: agora.toISOString(),
    avaliacaoUltima: avaliacao,
    repeticoes: srs.repeticoes,
    intervaloDias: srs.intervaloDias,
    fatorFacilidade: srs.fatorFacilidade,
    proximaRevisaoEm: srs.proximaRevisaoEm,
  });
}

async function registrarRespostaOnline(
  userId: string,
  dados: DadosResposta
) {
  const { data: existente, error: erroBusca } =
    await supabase
      .from("flashcards_progresso")
      .select(CAMPOS)
      .eq("user_id", userId)
      .eq("questao_id", dados.questaoId)
      .maybeSingle();

  if (erroBusca) {
    throw new Error(
      `Não foi possível localizar o progresso da questão: ${erroBusca.message}`
    );
  }

  const avaliacao = normalizarAvaliacao(dados);
  const acertou = respostaFoiAcerto(avaliacao, dados.acertou);
  const agora = new Date();
  const atual =
    existente as unknown as RegistroFlashcardBanco | null;
  const srs = calcularProximaRevisaoSRS(
    atual
      ? {
          repeticoes: atual.repeticoes ?? 0,
          intervaloDias: atual.intervalo_dias ?? 0,
          fatorFacilidade: atual.fator_facilidade ?? 2.5,
          proximaRevisaoEm: atual.proxima_revisao_em ?? agora.toISOString(),
        }
      : null,
    avaliacao,
    agora
  );

  const registro = {
    user_id: userId,
    questao_id: dados.questaoId,
    materia: dados.materia,
    topico: dados.topico,
    tentativas: (atual?.tentativas ?? 0) + 1,
    acertos:
      (atual?.acertos ?? 0) + (acertou ? 1 : 0),
    erros:
      (atual?.erros ?? 0) + (acertou ? 0 : 1),
    ultima_acertou: acertou,
    ultima_modalidade: dados.modalidade,
    ultima_resposta_em: agora.toISOString(),
    avaliacao_ultima: avaliacao,
    repeticoes: srs.repeticoes,
    intervalo_dias: srs.intervaloDias,
    fator_facilidade: srs.fatorFacilidade,
    proxima_revisao_em: srs.proximaRevisaoEm,
    updated_at: agora.toISOString(),
  };

  const consulta = atual
    ? supabase
        .from("flashcards_progresso")
        .update(registro)
        .eq("user_id", userId)
        .eq("questao_id", dados.questaoId)
    : supabase
        .from("flashcards_progresso")
        .insert({
          ...registro,
          created_at: agora.toISOString(),
        });

  const { data, error } = await consulta
    .select(CAMPOS)
    .single();

  if (error) {
    throw new Error(
      `Não foi possível salvar o progresso da questão: ${error.message}`
    );
  }

  return atualizarCache(
    converterRegistro(data as unknown as RegistroFlashcardBanco)
  );
}

async function enfileirar(userId: string, dados: DadosResposta) {
  const avaliacao = normalizarAvaliacao(dados);
  await enfileirarRespostaFlashcardOffline({
    userId,
    questaoId: dados.questaoId,
    materia: dados.materia,
    topico: dados.topico,
    modalidade: dados.modalidade,
    avaliacao,
  });
  return aplicarRespostaLocal({ ...dados, avaliacao });
}

function offlineAgora() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function pareceFalhaRede(erro: unknown) {
  const texto = erro instanceof Error ? erro.message.toLowerCase() : String(erro).toLowerCase();
  return (
    erro instanceof TypeError ||
    texto.includes("failed to fetch") ||
    texto.includes("network") ||
    texto.includes("load failed")
  );
}

export async function listarProgressoFlashcards() {
  if (offlineAgora()) return carregarCacheLocal();

  const usuario = await exigirUsuario();

  try {
    const { data, error } = await supabase
      .from("flashcards_progresso")
      .select(CAMPOS)
      .eq("user_id", usuario.id)
      .order("ultima_resposta_em", {
        ascending: false,
      });

    if (error) {
      throw new Error(
        `Não foi possível carregar o progresso dos flashcards: ${error.message}`
      );
    }

    const progresso = (
      (data ?? []) as unknown as RegistroFlashcardBanco[]
    ).map(converterRegistro);
    salvarCacheLocal(progresso);
    return progresso;
  } catch (erro) {
    const cache = carregarCacheLocal();
    if (cache.length > 0 && pareceFalhaRede(erro)) return cache;
    throw erro;
  }
}

export async function registrarRespostaFlashcard(
  dados: DadosResposta
) {
  const usuario = await exigirUsuario();

  if (offlineAgora()) {
    return enfileirar(usuario.id, dados);
  }

  try {
    return await registrarRespostaOnline(usuario.id, dados);
  } catch (erro) {
    if (pareceFalhaRede(erro)) {
      return enfileirar(usuario.id, dados);
    }
    throw erro;
  }
}

export async function sincronizarRespostasFlashcardsOffline() {
  if (offlineAgora()) return [] as ProgressoQuestaoFlashcard[];

  const usuario = await exigirUsuario();
  const pendentes = await listarRespostasFlashcardOffline(usuario.id);
  const atualizados: ProgressoQuestaoFlashcard[] = [];

  for (const pendente of pendentes) {
    const progresso = await registrarRespostaOnline(usuario.id, {
      questaoId: pendente.questaoId,
      materia: pendente.materia,
      topico: pendente.topico,
      modalidade: pendente.modalidade,
      avaliacao: pendente.avaliacao,
    });
    await removerRespostaFlashcardOffline(pendente.id);
    atualizados.push(progresso);
  }

  return atualizados;
}

export async function contarPendenciasFlashcardsOffline() {
  const usuario = await exigirUsuario();
  return contarRespostasFlashcardOffline(usuario.id);
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
  const agora = Date.now();
  const revisoesPendentes = progresso.filter(
    (item) =>
      item.proximaRevisaoEm &&
      Date.parse(item.proximaRevisaoEm) <= agora
  ).length;

  return {
    totalRespondidas,
    totalTentativas,
    totalAcertos,
    totalErros,
    percentualAcertos,
    revisoesPendentes,
  };
}
