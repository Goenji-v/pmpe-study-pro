import { supabase } from "../lib/supabase";
import type { Dificuldade, QuestaoIA } from "../types/index";
import {
  fingerprintQuestaoIA,
  reconciliarQuestoesComCatalogo,
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
  concursoAlvo?: string;
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
  const idsRespondidos =
    filtros.preferencia === "nao_respondidas"
      ? await listarIdsRespondidos()
      : new Set<string>();

  return selecionarQuestoesParaReuso(
    questoes,
    idsRespondidos,
    filtros.quantidade,
    filtros.preferencia
  );
}

export async function atualizarQuestoesAntesDoTreino(questoes: QuestaoIA[]) {
  if (questoes.length === 0) return [];
  const ids = [...new Set(questoes.map((q) => q.id).filter(ehUuid))];
  const ativas: QuestaoIA[] = [];
  for (let inicio = 0; inicio < ids.length; inicio += 100) {
    const { data, error } = await supabase.from("questoes_catalogo")
      .select("id,materia_id,materia,modulo_id,modulo,assunto_id,assunto,banca,dificuldade,enunciado,alternativas,resposta_correta_id,explicacao,fingerprint")
      .in("id", ids.slice(inicio, inicio + 100))
      .eq("origem", "ia")
      .eq("status", "ativa");
    if (error) throw new Error("Não foi possível verificar a validade das questões. Conecte-se e tente novamente.");
    ativas.push(...((data ?? []) as LinhaCatalogoIA[]).filter(ehQuestaoValida).map(converterLinha));
  }
  return reconciliarQuestoesComCatalogo(questoes, ativas);
}

export async function salvarQuestoesGeradasNoCatalogo(
  questoes: QuestaoIA[],
  contexto: ContextoPublicacaoIA
): Promise<QuestaoIA[]> {
  if (questoes.length === 0) return [];

  questoes.forEach((questao, indice) =>
    validarQuestaoAntesDePublicar(questao, indice + 1)
  );

  const fingerprints = await Promise.all(
    questoes.map((questao) => fingerprintQuestaoIA(questao))
  );

  const { data, error } = await supabase.functions.invoke(
    "publicar-questoes-ia",
    {
      body: {
        questoes,
        contexto: {
          concursoAlvo: contexto.concursoAlvo.trim() || "PMPE",
          editalAlvo:
            contexto.editalAlvo.trim() ||
            contexto.concursoAlvo.trim() ||
            "PMPE",
          materiaId: contexto.materiaId,
          assuntoId: contexto.assuntoId,
        },
      },
    }
  );

  if (error) {
    throw new Error(
      `Não foi possível publicar as questões no catálogo seguro: ${error.message}`
    );
  }

  const linhas =
    data && typeof data === "object" && Array.isArray(data.questoes)
      ? (data.questoes as LinhaCatalogoIA[])
      : [];

  const validas = linhas.filter(ehQuestaoValida);
  const porFingerprint = new Map(
    validas.map((linha) => [linha.fingerprint, converterLinha(linha)])
  );

  return fingerprints.map((fingerprint, indice) => {
    const publicada = porFingerprint.get(fingerprint);
    if (!publicada) {
      throw new Error(
        `A questão ${indice + 1} não pôde ser confirmada no catálogo após a publicação.`
      );
    }
    return publicada;
  });
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
    throw new Error(
      `O resultado foi salvo no aparelho, mas o histórico online falhou: ${error.message}`
    );
  }
}

async function buscarCandidatas(filtros: FiltrosCatalogoIA) {
  let consulta = supabase
    .from("questoes_catalogo")
    .select(
      "id,materia_id,materia,modulo_id,modulo,assunto_id,assunto,banca,dificuldade,enunciado,alternativas,resposta_correta_id,explicacao,fingerprint"
    )
    .eq("origem", "ia")
    .eq("status", "ativa")
    .eq("compatibilidade_edital", "direta")
    .eq("concurso_alvo", filtros.concursoAlvo?.trim() || "PMPE")
    .eq("materia_chave", normalizarChaveIA(filtros.materia))
    .eq("assunto_chave", normalizarChaveIA(filtros.assunto))
    .eq("banca_chave", normalizarChaveIA(filtros.banca))
    .limit(1000);

  if (filtros.modulo?.trim()) {
    consulta = consulta.eq("modulo", filtros.modulo.trim());
  }

  if (filtros.dificuldade !== "Mista") {
    consulta = consulta.eq(
      "dificuldade",
      converterDificuldade(filtros.dificuldade)
    );
  }

  const { data, error } = await consulta;
  if (error) {
    throw new Error(
      `Não foi possível consultar o banco compartilhado: ${error.message}`
    );
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
    throw new Error(
      `Não foi possível consultar seu histórico de questões: ${error.message}`
    );
  }

  return new Set((data ?? []).map((linha) => String(linha.questao_id)));
}

function converterLinha(linha: LinhaCatalogoIA): QuestaoIA {
  const alternativas = Object.fromEntries(
    (Array.isArray(linha.alternativas) ? linha.alternativas : []).map(
      (alternativa) => [alternativa.id, alternativa.texto]
    )
  );

  return {
    id: linha.id,
    materia: linha.materia,
    materiaId: linha.materia_id ?? undefined,
    modulo: linha.modulo ?? undefined,
    moduloId: linha.modulo_id ?? undefined,
    assunto: linha.assunto,
    assuntoId: linha.assunto_id ?? undefined,
    banca: linha.banca,
    dificuldade:
      linha.dificuldade === "facil"
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
  const alternativas = Array.isArray(linha.alternativas)
    ? linha.alternativas
    : [];
  const ids = alternativas.map((item) => item.id);
  const textos = alternativas.map((item) => item.texto?.trim());

  return (
    ["A", "B", "C", "D", "E"].includes(linha.resposta_correta_id ?? "") &&
    alternativas.length === 5 &&
    new Set(ids).size === 5 &&
    ["A", "B", "C", "D", "E"].every((letra) => ids.includes(letra)) &&
    textos.every(Boolean) &&
    new Set(textos.map(normalizarChaveIA)).size === 5 &&
    Boolean(linha.enunciado.trim()) &&
    Boolean(linha.explicacao?.trim())
  );
}

function validarQuestaoAntesDePublicar(
  questao: QuestaoIA,
  numero: number
) {
  const alternativaTextos = Object.values(questao.alternativas).map((texto) =>
    texto.trim()
  );

  if (
    !questao.enunciado.trim() ||
    !questao.explicacao.trim() ||
    !["A", "B", "C", "D", "E"].includes(questao.respostaCorreta) ||
    alternativaTextos.length !== 5 ||
    alternativaTextos.some((texto) => !texto) ||
    new Set(alternativaTextos.map(normalizarChaveIA)).size !== 5
  ) {
    throw new Error(
      `A questão ${numero} falhou na validação e não foi publicada no catálogo.`
    );
  }
}

function converterDificuldade(
  dificuldade: QuestaoIA["dificuldade"]
): Dificuldade {
  if (dificuldade === "Fácil") return "facil";
  if (dificuldade === "Difícil") return "dificil";
  return "media";
}

function ehUuid(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}
