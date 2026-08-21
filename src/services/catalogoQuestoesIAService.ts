import { supabase } from "../lib/supabase";
import type { Dificuldade, QuestaoIA } from "../types/index";
import {
  fingerprintQuestaoIA,
  normalizarChaveIA,
  selecionarQuestoesParaReuso,
  type PreferenciaReusoIA,
} from "./catalogoQuestoesIAUtils";

type LinhaCatalogoIA = {
  id: string;
  materia_id: string | null;
  materia: string;
  modulo_id: string | null;
  modulo: string | null;
  assunto_id: string | null;
  assunto: string;
  banca: string;
  dificuldade: Dificuldade;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  resposta_correta_id: string | null;
  explicacao: string | null;
  fingerprint: string | null;
};

export type FiltrosCatalogoIA = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  banca: string;
  dificuldade: "Fácil" | "Média" | "Difícil" | "Mista";
  quantidade: number;
  preferencia: PreferenciaReusoIA;
};

export type ContextoPublicacaoIA = {
  concursoAlvo: string;
  editalAlvo: string;
  materiaId?: string;
  assuntoId?: string;
};

export async function selecionarDoCatalogoIA(
  filtros: FiltrosCatalogoIA
) {
  const questoes = await buscarCandidatas(filtros);
  const idsRespondidos = filtros.preferencia === "nao_respondidas"
    ? await listarIdsRespondidos()
    : new Set<string>();

  return selecionarQuestoesParaReuso(
    questoes,
    idsRespondidos,
    filtros.quantidade,
    filtros.preferencia
  );
}

export async function salvarQuestoesGeradasNoCatalogo(
  questoes: QuestaoIA[],
  contexto: ContextoPublicacaoIA
): Promise<QuestaoIA[]> {
  if (questoes.length === 0) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sua sessão expirou. Entre novamente para salvar as questões no banco compartilhado.");
  }

  const preparadas = await Promise.all(
    questoes.map(async (questao) => ({
      id: questao.id,
      concurso_alvo: contexto.concursoAlvo.trim() || "Geral",
      edital_alvo: contexto.editalAlvo.trim() || contexto.concursoAlvo.trim() || "Geral",
      banca: questao.banca.trim(),
      materia_id: contexto.materiaId || null,
      materia: questao.materia.trim(),
      materia_chave: normalizarChaveIA(questao.materia),
      modulo_id: questao.moduloId || null,
      modulo: questao.modulo?.trim() || null,
      assunto_id: contexto.assuntoId || null,
      assunto: questao.assunto.trim(),
      assunto_chave: normalizarChaveIA(questao.assunto),
      dificuldade: converterDificuldade(questao.dificuldade),
      enunciado: questao.enunciado.trim(),
      alternativas: Object.entries(questao.alternativas).map(([id, texto]) => ({
        id,
        texto: texto.trim(),
      })),
      resposta_correta_id: questao.respostaCorreta,
      explicacao: questao.explicacao.trim() || null,
      status: "ativa",
      compatibilidade_edital: "direta",
      confianca_classificacao: "alta",
      fonte_nome: "Gerada pela IA do Study Pro",
      origem: "ia",
      banca_chave: normalizarChaveIA(questao.banca),
      criado_por: authData.user.id,
      fingerprint: await fingerprintQuestaoIA(questao),
    }))
  );

  const { error } = await supabase
    .from("questoes_catalogo")
    .upsert(preparadas, {
      onConflict: "fingerprint",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`Não foi possível salvar as questões no banco compartilhado: ${error.message}`);
  }

  const fingerprints = preparadas.map((item) => item.fingerprint);
  const { data, error: erroLeitura } = await supabase
    .from("questoes_catalogo")
    .select("id,materia_id,materia,modulo_id,modulo,assunto_id,assunto,banca,dificuldade,enunciado,alternativas,resposta_correta_id,explicacao,fingerprint")
    .eq("origem", "ia")
    .in("fingerprint", fingerprints);

  if (erroLeitura) {
    throw new Error(`As questões foram salvas, mas não puderam ser recarregadas: ${erroLeitura.message}`);
  }

  const porFingerprint = new Map(
    ((data ?? []) as LinhaCatalogoIA[]).map((linha) => [linha.fingerprint, converterLinha(linha)])
  );

  return preparadas.map((item, indice) =>
    porFingerprint.get(item.fingerprint) ?? questoes[indice]
  );
}

export async function registrarRespostasQuestoesIA(
  questoes: QuestaoIA[],
  respostas: Record<string, string>
) {
  const respondidas = questoes.filter(
    (questao) => respostas[questao.id] && ehUuid(questao.id)
  );

  if (respondidas.length === 0) return;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;

  const linhas = respondidas.map((questao) => ({
    user_id: authData.user.id,
    questao_id: questao.id,
    resposta: respostas[questao.id],
    correta: respostas[questao.id] === questao.respostaCorreta,
  }));

  const { error } = await supabase
    .from("respostas_questoes_ia")
    .insert(linhas);

  if (error) {
    throw new Error(`O resultado foi salvo no aparelho, mas o histórico online falhou: ${error.message}`);
  }
}

async function buscarCandidatas(filtros: FiltrosCatalogoIA) {
  let consulta = supabase
    .from("questoes_catalogo")
    .select("id,materia_id,materia,modulo_id,modulo,assunto_id,assunto,banca,dificuldade,enunciado,alternativas,resposta_correta_id,explicacao,fingerprint")
    .eq("origem", "ia")
    .eq("status", "ativa")
    .eq("compatibilidade_edital", "direta")
    .limit(1000);

  consulta = consulta
    .eq("materia_chave", normalizarChaveIA(filtros.materia))
    .eq("assunto_chave", normalizarChaveIA(filtros.assunto))
    .eq("banca_chave", normalizarChaveIA(filtros.banca));

  if (filtros.dificuldade !== "Mista") {
    consulta = consulta.eq("dificuldade", converterDificuldade(filtros.dificuldade));
  }

  const { data, error } = await consulta;
  if (error) {
    throw new Error(`Não foi possível consultar o banco compartilhado: ${error.message}`);
  }

  return ((data ?? []) as LinhaCatalogoIA[])
    .filter((linha) => ehQuestaoValida(linha))
    .map(converterLinha);
}

async function listarIdsRespondidos() {
  const { data, error } = await supabase
    .from("respostas_questoes_ia")
    .select("questao_id")
    .limit(10000);

  if (error) {
    throw new Error(`Não foi possível consultar seu histórico de questões: ${error.message}`);
  }

  return new Set(
    (data ?? []).map((linha) => String(linha.questao_id))
  );
}

function converterLinha(linha: LinhaCatalogoIA): QuestaoIA {
  const alternativas = Object.fromEntries(
    (Array.isArray(linha.alternativas) ? linha.alternativas : [])
      .map((alternativa) => [alternativa.id, alternativa.texto])
  );

  return {
    id: linha.id,
    materia: linha.materia,
    modulo: linha.modulo ?? undefined,
    moduloId: linha.modulo_id ?? undefined,
    assunto: linha.assunto,
    banca: linha.banca,
    dificuldade: linha.dificuldade === "facil"
      ? "Fácil"
      : linha.dificuldade === "dificil"
        ? "Difícil"
        : "Média",
    enunciado: linha.enunciado,
    alternativas: {
      A: alternativas.A ?? "",
      B: alternativas.B ?? "",
      C: alternativas.C ?? "",
      D: alternativas.D ?? "",
      E: alternativas.E ?? "",
    },
    respostaCorreta: linha.resposta_correta_id as QuestaoIA["respostaCorreta"],
    explicacao: linha.explicacao ?? "",
  };
}

function ehQuestaoValida(linha: LinhaCatalogoIA) {
  return (
    ["A", "B", "C", "D", "E"].includes(linha.resposta_correta_id ?? "")
    && Array.isArray(linha.alternativas)
    && linha.alternativas.length === 5
  );
}

function converterDificuldade(
  dificuldade: QuestaoIA["dificuldade"]
): Dificuldade {
  if (dificuldade === "Fácil") return "facil";
  if (dificuldade === "Difícil") return "dificil";
  return "media";
}

function ehUuid(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}
