import type { QuestaoBanco } from "../types";

export type IdentidadeProvaOficial = {
  concursoAlvo: string;
  editalAlvo: string;
  concursoOrigem: string;
  cargoOrigem: string;
  anoOrigem: number;
  banca: string;
};

export type RegistroProvaOficial = Partial<IdentidadeProvaOficial> & {
  numeroOriginal?: number | null;
};

export function normalizarIdentificadorEditorial(valor?: string | null) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function pertenceAMesmaProva(
  registro: RegistroProvaOficial,
  metadados: IdentidadeProvaOficial
) {
  return registro.anoOrigem === metadados.anoOrigem
    && normalizarIdentificadorEditorial(registro.concursoAlvo) === normalizarIdentificadorEditorial(metadados.concursoAlvo)
    && normalizarIdentificadorEditorial(registro.editalAlvo) === normalizarIdentificadorEditorial(metadados.editalAlvo)
    && normalizarIdentificadorEditorial(registro.concursoOrigem) === normalizarIdentificadorEditorial(metadados.concursoOrigem)
    && normalizarIdentificadorEditorial(registro.cargoOrigem) === normalizarIdentificadorEditorial(metadados.cargoOrigem)
    && normalizarIdentificadorEditorial(registro.banca) === normalizarIdentificadorEditorial(metadados.banca);
}

export function encontrarNumerosDuplicados(
  registros: RegistroProvaOficial[],
  metadados: IdentidadeProvaOficial,
  numerosImportados: number[]
) {
  const numerosDaImportacao = new Set(numerosImportados);
  const duplicados = new Set<number>();

  for (const registro of registros) {
    const numero = registro.numeroOriginal;
    if (
      typeof numero === "number"
      && numerosDaImportacao.has(numero)
      && pertenceAMesmaProva(registro, metadados)
    ) {
      duplicados.add(numero);
    }
  }

  return [...duplicados].sort((a, b) => a - b);
}

export function motivosImpedimentoPublicacao(
  questao: QuestaoBanco,
  exigirPendente = false,
  exigirConfiancaAlta = false
) {
  const motivos: string[] = [];

  if (exigirPendente && questao.statusEditorial !== "pendente") {
    motivos.push("a questão não está pendente");
  }

  if (exigirConfiancaAlta && questao.confiancaClassificacao !== "alta") {
    motivos.push("confiança da classificação não é alta");
  }

  if (!/^[A-E]$/.test(questao.respostaCorretaId.trim().toUpperCase())) {
    motivos.push("gabarito inválido ou ausente");
  }

  if (!questao.compatibilidadeEdital || !["direta", "implicita"].includes(questao.compatibilidadeEdital)) {
    motivos.push("compatibilidade com o edital não permite publicação");
  }

  if (!questao.materia.trim()) {
    motivos.push("matéria não informada");
  }

  if (!questao.assunto.trim()) {
    motivos.push("assunto não informado");
  }

  if (!questao.enunciado.trim()) {
    motivos.push("enunciado vazio");
  }

  if (questao.alternativas.length < 2) {
    motivos.push("alternativas insuficientes");
  }

  return motivos;
}

export function questaoElegivelParaPublicacao(
  questao: QuestaoBanco,
  exigirPendente = false,
  exigirConfiancaAlta = false
) {
  return motivosImpedimentoPublicacao(
    questao,
    exigirPendente,
    exigirConfiancaAlta
  ).length === 0;
}
