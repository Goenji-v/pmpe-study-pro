import { supabase } from "../lib/supabase";

import type {
  AlternativaQuestao,
  CompatibilidadeEdital,
  ConfiancaClassificacao,
  Dificuldade,
  QuestaoBanco,
  StatusEditorialQuestao,
} from "../types";

import type {
  MetadadosImportacaoProva,
  QuestaoAnalisadaIA,
} from "./importacaoProvaService";
import {
  encontrarNumerosDuplicados,
  type IdentidadeProvaOficial,
} from "./curadoriaQuestoesUtils";

type LinhaQuestaoCatalogo = {
  id: string;
  concurso_alvo: string;
  edital_alvo: string;
  concurso_origem: string | null;
  cargo_origem: string | null;
  ano_origem: number | null;
  banca: string;
  numero_original: number | null;
  materia_id: string | null;
  materia: string;
  modulo_id: string | null;
  modulo: string | null;
  assunto_id: string | null;
  assunto: string;
  subassunto: string | null;
  dificuldade: Dificuldade;
  enunciado: string;
  alternativas: AlternativaQuestao[];
  resposta_correta_id: string | null;
  explicacao: string | null;
  status: StatusEditorialQuestao;
  compatibilidade_edital: CompatibilidadeEdital;
  confianca_classificacao: ConfiancaClassificacao;
  norma: string | null;
  dispositivo: string | null;
  motivo_status: string | null;
  fonte_nome: string | null;
  origem: "prova_oficial" | "ia";
  created_at: string;
  revisada_em: string | null;
};

export type AtualizacaoCuradoria = {
  materiaId?: string;
  materia?: string;
  moduloId?: string;
  modulo?: string;
  assuntoId?: string;
  assunto?: string;
  subassunto?: string;
  dificuldade?: Dificuldade;
  respostaCorretaId?: string;
  explicacao?: string;
  statusEditorial?: StatusEditorialQuestao;
  compatibilidadeEdital?: CompatibilidadeEdital;
  confiancaClassificacao?: ConfiancaClassificacao;
  norma?: string;
  dispositivo?: string;
  motivoStatus?: string;
};

export type ResultadoPublicacaoLote = {
  publicadas: QuestaoBanco[];
  ignoradas: number;
};

export async function listarQuestoesPublicadas(
  concursoAlvo: string
): Promise<QuestaoBanco[]> {
  const { data, error } = await supabase
    .from("questoes_catalogo")
    .select("*")
    .eq("status", "ativa")
    .eq("concurso_alvo", concursoAlvo)
    .in("compatibilidade_edital", ["direta", "implicita"])
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Erro ao carregar questões oficiais: ${error.message}`);
  }

  return ((data ?? []) as LinhaQuestaoCatalogo[]).map(converterLinhaQuestao);
}

export async function listarQuestoesCuradoria(): Promise<QuestaoBanco[]> {
  const { data, error } = await supabase
    .from("questoes_catalogo")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Erro ao carregar a fila de curadoria: ${error.message}`);
  }

  return ((data ?? []) as LinhaQuestaoCatalogo[]).map(converterLinhaQuestao);
}

export async function salvarLoteNaCuradoria(
  questoes: QuestaoAnalisadaIA[],
  metadados: MetadadosImportacaoProva
): Promise<number> {
  if (questoes.length === 0) return 0;

  await impedirImportacaoDuplicada(questoes, metadados);

  const linhas = questoes.map((questao) => ({
    concurso_alvo: metadados.concursoAlvo.trim(),
    edital_alvo: metadados.editalAlvo.trim(),
    concurso_origem: metadados.concursoOrigem.trim(),
    cargo_origem: metadados.cargoOrigem.trim(),
    ano_origem: metadados.anoOrigem,
    banca: metadados.banca.trim(),
    numero_original: questao.numeroOriginal,
    materia_id: vazioParaNulo(questao.materiaId),
    materia: questao.materia.trim(),
    modulo_id: vazioParaNulo(questao.moduloId),
    modulo: vazioParaNulo(questao.modulo),
    assunto_id: vazioParaNulo(questao.assuntoId),
    assunto: questao.assunto.trim(),
    subassunto: vazioParaNulo(questao.subassunto),
    dificuldade: questao.dificuldade,
    enunciado: questao.enunciado.trim(),
    alternativas: questao.alternativas,
    resposta_correta_id: vazioParaNulo(questao.respostaCorretaId),
    explicacao: vazioParaNulo(questao.explicacao),
    status: normalizarStatusInicial(questao.statusSugerido),
    compatibilidade_edital: questao.compatibilidadeEdital,
    confianca_classificacao: questao.confiancaClassificacao,
    norma: vazioParaNulo(questao.norma),
    dispositivo: vazioParaNulo(questao.dispositivo),
    motivo_status: vazioParaNulo(questao.motivoStatus),
    fonte_nome: metadados.fonteNome.trim(),
    origem: "prova_oficial",
  }));

  const { data, error } = await supabase
    .from("questoes_catalogo")
    .insert(linhas)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Importação cancelada: esta prova já existe na fila editorial. Nenhuma questão foi duplicada."
      );
    }

    throw new Error(`Erro ao salvar a prova para curadoria: ${error.message}`);
  }

  return data?.length ?? 0;
}

export async function publicarQuestoesCuradoriaEmLote(
  ids: string[]
): Promise<ResultadoPublicacaoLote> {
  const idsUnicos = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (idsUnicos.length === 0) {
    return { publicadas: [], ignoradas: 0 };
  }

  if (idsUnicos.length > 500) {
    throw new Error("O lote não pode ultrapassar 500 questões.");
  }

  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("questoes_catalogo")
    .update({
      status: "ativa",
      revisada_em: agora,
      updated_at: agora,
    })
    .in("id", idsUnicos)
    .eq("status", "pendente")
    .eq("confianca_classificacao", "alta")
    .in("compatibilidade_edital", ["direta", "implicita"])
    .in("resposta_correta_id", ["A", "B", "C", "D", "E"])
    .select("*");

  if (error) {
    throw new Error(
      `Nenhuma questão foi publicada. Revise o lote: ${error.message}`
    );
  }

  const publicadas = ((data ?? []) as LinhaQuestaoCatalogo[])
    .map(converterLinhaQuestao);

  return {
    publicadas,
    ignoradas: Math.max(0, idsUnicos.length - publicadas.length),
  };
}

export async function atualizarQuestaoCuradoria(
  id: string,
  alteracoes: AtualizacaoCuradoria
): Promise<QuestaoBanco> {
  const linha = {
    ...(alteracoes.materiaId !== undefined && {
      materia_id: vazioParaNulo(alteracoes.materiaId),
    }),
    ...(alteracoes.materia !== undefined && { materia: alteracoes.materia.trim() }),
    ...(alteracoes.moduloId !== undefined && {
      modulo_id: vazioParaNulo(alteracoes.moduloId),
    }),
    ...(alteracoes.modulo !== undefined && { modulo: vazioParaNulo(alteracoes.modulo) }),
    ...(alteracoes.assuntoId !== undefined && {
      assunto_id: vazioParaNulo(alteracoes.assuntoId),
    }),
    ...(alteracoes.assunto !== undefined && { assunto: alteracoes.assunto.trim() }),
    ...(alteracoes.subassunto !== undefined && {
      subassunto: vazioParaNulo(alteracoes.subassunto),
    }),
    ...(alteracoes.dificuldade !== undefined && {
      dificuldade: alteracoes.dificuldade,
    }),
    ...(alteracoes.respostaCorretaId !== undefined && {
      resposta_correta_id: vazioParaNulo(alteracoes.respostaCorretaId.toUpperCase()),
    }),
    ...(alteracoes.explicacao !== undefined && {
      explicacao: vazioParaNulo(alteracoes.explicacao),
    }),
    ...(alteracoes.statusEditorial !== undefined && {
      status: alteracoes.statusEditorial,
      revisada_em: new Date().toISOString(),
    }),
    ...(alteracoes.compatibilidadeEdital !== undefined && {
      compatibilidade_edital: alteracoes.compatibilidadeEdital,
    }),
    ...(alteracoes.confiancaClassificacao !== undefined && {
      confianca_classificacao: alteracoes.confiancaClassificacao,
    }),
    ...(alteracoes.norma !== undefined && { norma: vazioParaNulo(alteracoes.norma) }),
    ...(alteracoes.dispositivo !== undefined && {
      dispositivo: vazioParaNulo(alteracoes.dispositivo),
    }),
    ...(alteracoes.motivoStatus !== undefined && {
      motivo_status: vazioParaNulo(alteracoes.motivoStatus),
    }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("questoes_catalogo")
    .update(linha)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar a questão: ${error.message}`);
  }

  return converterLinhaQuestao(data as LinhaQuestaoCatalogo);
}

function converterLinhaQuestao(linha: LinhaQuestaoCatalogo): QuestaoBanco {
  return {
    id: linha.id,
    materiaId: linha.materia_id ?? "",
    materia: linha.materia,
    moduloId: linha.modulo_id ?? undefined,
    modulo: linha.modulo ?? undefined,
    assuntoId: linha.assunto_id ?? "",
    assunto: linha.assunto,
    subassunto: linha.subassunto ?? undefined,
    banca: linha.banca,
    dificuldade: linha.dificuldade,
    enunciado: linha.enunciado,
    alternativas: Array.isArray(linha.alternativas) ? linha.alternativas : [],
    respostaCorretaId: linha.resposta_correta_id ?? "",
    explicacao: linha.explicacao ?? undefined,
    dataCriacao: linha.created_at,
    concursoAlvo: linha.concurso_alvo,
    editalAlvo: linha.edital_alvo,
    concursoOrigem: linha.concurso_origem ?? undefined,
    cargoOrigem: linha.cargo_origem ?? undefined,
    anoOrigem: linha.ano_origem ?? undefined,
    numeroOriginal: linha.numero_original ?? undefined,
    fonteNome: linha.fonte_nome ?? undefined,
    norma: linha.norma ?? undefined,
    dispositivo: linha.dispositivo ?? undefined,
    motivoStatus: linha.motivo_status ?? undefined,
    statusEditorial: linha.status,
    compatibilidadeEdital: linha.compatibilidade_edital,
    confiancaClassificacao: linha.confianca_classificacao,
    origem: linha.origem,
    global: true,
    revisadaEm: linha.revisada_em ?? undefined,
  };
}

function normalizarStatusInicial(
  status: QuestaoAnalisadaIA["statusSugerido"]
): StatusEditorialQuestao {
  if (status === "anulada" || status === "desatualizada" || status === "duvidosa") {
    return status;
  }

  return "pendente";
}

async function impedirImportacaoDuplicada(
  questoes: QuestaoAnalisadaIA[],
  metadados: MetadadosImportacaoProva
) {
  const numerosImportados = [...new Set(
    questoes
      .map((questao) => questao.numeroOriginal)
      .filter((numero): numero is number => Number.isInteger(numero))
  )];

  if (numerosImportados.length === 0) return;

  const { data, error } = await supabase
    .from("questoes_catalogo")
    .select("concurso_alvo,edital_alvo,concurso_origem,cargo_origem,ano_origem,banca,numero_original")
    .eq("origem", "prova_oficial")
    .eq("ano_origem", metadados.anoOrigem)
    .in("numero_original", numerosImportados)
    .limit(500);

  if (error) {
    throw new Error(
      `Não foi possível verificar duplicidade antes da importação: ${error.message}`
    );
  }

  const identidade: IdentidadeProvaOficial = {
    concursoAlvo: metadados.concursoAlvo,
    editalAlvo: metadados.editalAlvo,
    concursoOrigem: metadados.concursoOrigem,
    cargoOrigem: metadados.cargoOrigem,
    anoOrigem: metadados.anoOrigem,
    banca: metadados.banca,
  };
  const registros = ((data ?? []) as Array<{
    concurso_alvo: string;
    edital_alvo: string;
    concurso_origem: string | null;
    cargo_origem: string | null;
    ano_origem: number | null;
    banca: string;
    numero_original: number | null;
  }>).map((linha) => ({
    concursoAlvo: linha.concurso_alvo,
    editalAlvo: linha.edital_alvo,
    concursoOrigem: linha.concurso_origem ?? "",
    cargoOrigem: linha.cargo_origem ?? "",
    anoOrigem: linha.ano_origem ?? undefined,
    banca: linha.banca,
    numeroOriginal: linha.numero_original,
  }));
  const duplicados = encontrarNumerosDuplicados(
    registros,
    identidade,
    numerosImportados
  );

  if (duplicados.length === 0) return;

  const amostra = duplicados.slice(0, 12).join(", ");
  const restante = duplicados.length > 12
    ? ` e mais ${duplicados.length - 12}`
    : "";

  throw new Error(
    `Importação cancelada: ${duplicados.length} questão${duplicados.length === 1 ? "" : "ões"} desta prova já existe${duplicados.length === 1 ? "" : "m"} na fila (${amostra}${restante}). Nenhuma questão foi duplicada.`
  );
}

function vazioParaNulo(valor?: string) {
  const texto = valor?.trim();
  return texto ? texto : null;
}
