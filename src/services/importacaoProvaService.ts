import {
  SUPABASE_PUBLIC_KEY,
  supabase,
} from "../lib/supabase";

import { criarUrlApi } from "../config/api";

import type {
  AlternativaQuestao,
  CompatibilidadeEdital,
  ConfiancaClassificacao,
  Dificuldade,
} from "../types";

export type ItemMapaEdital = {
  materiaId: string;
  materia: string;
  moduloId: string;
  modulo: string;
  assuntoId: string;
  assunto: string;
};

export type MetadadosImportacaoProva = {
  concursoAlvo: string;
  editalAlvo: string;
  concursoOrigem: string;
  cargoOrigem: string;
  anoOrigem: number;
  banca: string;
  fonteNome: string;
};

export type QuestaoAnalisadaIA = {
  numeroOriginal: number;
  materiaId: string;
  materia: string;
  moduloId: string;
  modulo: string;
  assuntoId: string;
  assunto: string;
  subassunto: string;
  dificuldade: Dificuldade;
  enunciado: string;
  alternativas: AlternativaQuestao[];
  respostaCorretaId: string;
  explicacao: string;
  compatibilidadeEdital: CompatibilidadeEdital;
  confiancaClassificacao: ConfiancaClassificacao;
  statusSugerido: "pendente" | "anulada" | "desatualizada" | "duvidosa";
  norma: string;
  dispositivo: string;
  motivoStatus: string;
};

export type ResultadoAnaliseProva = {
  diagnosticoId: string;
  totalEsperadas: number;
  totalDetectadas: number;
  totalComGabarito: number;
  anuladasDetectadas: number;
  foraDoEdital: number;
  alertas: string[];
  questoes: QuestaoAnalisadaIA[];
};

type RespostaApi =
  | {
      sucesso: true;
      diagnosticoId: string;
      analise: Omit<ResultadoAnaliseProva, "diagnosticoId">;
    }
  | {
      sucesso: false;
      diagnosticoId?: string;
      erro: string;
    };

export class ErroImportacaoProva extends Error {
  diagnosticoId: string;

  constructor(mensagem: string, diagnosticoId: string) {
    super(mensagem);
    this.name = "ErroImportacaoProva";
    this.diagnosticoId = diagnosticoId;
  }
}

const LIMITE_ARQUIVO_BYTES = 12 * 1024 * 1024;

export async function analisarProvaPdf({
  prova,
  gabarito,
  metadados,
  mapaEdital,
}: {
  prova: File;
  gabarito?: File | null;
  metadados: MetadadosImportacaoProva;
  mapaEdital: ItemMapaEdital[];
}): Promise<ResultadoAnaliseProva> {
  const diagnosticoId = crypto.randomUUID();

  validarArquivoPdf(prova, "prova");
  if (gabarito) validarArquivoPdf(gabarito, "gabarito");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Sua sessão expirou. Entre novamente antes de importar a prova.");
  }

  const [provaBase64, gabaritoBase64] = await Promise.all([
    arquivoParaBase64(prova),
    gabarito ? arquivoParaBase64(gabarito) : Promise.resolve(null),
  ]);

  let resposta: Response;

  try {
    resposta = await fetch(criarUrlApi("/api/analisar-prova"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Supabase-Anon-Key": SUPABASE_PUBLIC_KEY,
        "X-Importacao-Id": diagnosticoId,
      },
      body: JSON.stringify({
        prova: {
          nome: prova.name,
          mimeType: "application/pdf",
          base64: provaBase64,
        },
        gabarito: gabarito && gabaritoBase64
          ? {
              nome: gabarito.name,
              mimeType: "application/pdf",
              base64: gabaritoBase64,
            }
          : null,
        metadados,
        mapaEdital: mapaEdital.slice(0, 600),
      }),
    });
  } catch {
    throw new ErroImportacaoProva(
      "A conexão com a análise foi interrompida antes da resposta.",
      diagnosticoId
    );
  }

  let dados: RespostaApi;

  try {
    dados = (await resposta.json()) as RespostaApi;
  } catch {
    throw new ErroImportacaoProva(
      `A API retornou uma resposta inválida (HTTP ${resposta.status}).`,
      diagnosticoId
    );
  }

  if (!resposta.ok || !dados.sucesso) {
    throw new ErroImportacaoProva(
      "erro" in dados ? dados.erro : `Erro HTTP ${resposta.status}`,
      dados.diagnosticoId || diagnosticoId
    );
  }

  if (!Array.isArray(dados.analise.questoes)) {
    throw new ErroImportacaoProva(
      "A IA não devolveu uma lista válida de questões.",
      dados.diagnosticoId || diagnosticoId
    );
  }

  if (
    !Number.isInteger(dados.analise.totalEsperadas) ||
    dados.analise.totalEsperadas < 1
  ) {
    throw new ErroImportacaoProva(
      "A API ainda não confirmou a quantidade total da prova. Aguarde a atualização e tente novamente.",
      dados.diagnosticoId || diagnosticoId
    );
  }

  if (dados.analise.totalDetectadas !== dados.analise.totalEsperadas) {
    throw new ErroImportacaoProva(
      `A análise ficou incompleta (${dados.analise.totalDetectadas}/${dados.analise.totalEsperadas}). Nenhuma questão foi liberada.`,
      dados.diagnosticoId || diagnosticoId
    );
  }

  return {
    ...dados.analise,
    diagnosticoId: dados.diagnosticoId || diagnosticoId,
  };
}

function validarArquivoPdf(arquivo: File, rotulo: string) {
  const ehPdf =
    arquivo.type === "application/pdf" ||
    arquivo.name.toLowerCase().endsWith(".pdf");

  if (!ehPdf) {
    throw new Error(`O arquivo de ${rotulo} precisa estar em PDF.`);
  }

  if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
    throw new Error(`O PDF de ${rotulo} ultrapassa o limite de 12 MB.`);
  }
}

function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onerror = () => reject(new Error(`Não foi possível ler ${arquivo.name}.`));
    leitor.onload = () => {
      const resultado = String(leitor.result ?? "");
      const separador = resultado.indexOf(",");
      resolve(separador >= 0 ? resultado.slice(separador + 1) : resultado);
    };

    leitor.readAsDataURL(arquivo);
  });
}
