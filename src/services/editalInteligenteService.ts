import { API_BASE_URL } from "../config/api";
import { supabase } from "../lib/supabase";
import type { AnaliseEdital } from "../types/editalInteligente";
import { normalizarAnaliseEdital } from "../utils/planoEdital";
import { fetchApiAutenticada } from "./apiAutenticada";

const BUCKET_EDITAIS = "materiais";
const LIMITE_ARMAZENAMENTO = 50 * 1024 * 1024;
const LIMITE_ANALISE = 25 * 1024 * 1024;

export type PdfEditalArmazenado = {
  storagePath: string;
  nomeArquivo: string;
};

type RespostaAnalise = {
  sucesso?: boolean;
  analise?: AnaliseEdital;
  erro?: string;
};

export async function enviarPdfEdital(
  arquivo: File,
  editalId: string
): Promise<PdfEditalArmazenado> {
  await validarPdfEdital(arquivo, LIMITE_ARMAZENAMENTO);

  const { data: { user }, error: erroUsuario } = await supabase.auth.getUser();
  if (erroUsuario || !user) {
    throw new Error("Sua sessão expirou. Entre novamente para enviar o edital.");
  }

  const nomeSeguro = sanitizarNomeArquivo(arquivo.name);
  const storagePath = [
    user.id,
    "editais",
    editalId,
    `${crypto.randomUUID()}-${nomeSeguro}`,
  ].join("/");

  const { error } = await supabase.storage
    .from(BUCKET_EDITAIS)
    .upload(storagePath, arquivo, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(`Não foi possível salvar o edital: ${error.message}`);
  }

  return { storagePath, nomeArquivo: arquivo.name };
}

export async function analisarPdfEdital(
  arquivo: File,
  contexto: { concurso?: string; banca?: string }
): Promise<AnaliseEdital> {
  await validarPdfEdital(arquivo, LIMITE_ANALISE);
  const pdfBase64 = await arquivoParaBase64(arquivo);

  const resposta = await fetchApiAutenticada(
    `${API_BASE_URL}/api/analisar-edital`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfBase64,
        nomeArquivo: arquivo.name,
        concurso: contexto.concurso || "",
        banca: contexto.banca || "",
      }),
    }
  );

  let corpo: RespostaAnalise;
  try {
    corpo = (await resposta.json()) as RespostaAnalise;
  } catch {
    throw new Error("A API retornou uma resposta inválida ao analisar o edital.");
  }

  if (!resposta.ok || !corpo.sucesso || !corpo.analise) {
    throw new Error(corpo.erro || "Não foi possível analisar o edital agora.");
  }

  const analise = normalizarAnaliseEdital(corpo.analise);
  if (analise.materias.length === 0) {
    throw new Error("A análise não encontrou matérias e assuntos confiáveis no PDF.");
  }

  return analise;
}

export async function abrirPdfEdital(storagePath: string): Promise<void> {
  const novaAba = window.open("about:blank", "_blank");
  if (novaAba) {
    novaAba.opener = null;
    novaAba.document.title = "Abrindo edital...";
    novaAba.document.body.textContent = "Abrindo edital...";
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EDITAIS)
      .createSignedUrl(storagePath, 300);

    if (error || !data?.signedUrl) {
      throw new Error(`Não foi possível abrir o edital: ${error?.message ?? "URL indisponível"}`);
    }

    if (novaAba) {
      novaAba.location.replace(data.signedUrl);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (erro) {
    novaAba?.close();
    throw erro;
  }
}

export async function removerPdfEdital(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(BUCKET_EDITAIS).remove([storagePath]);
  if (error) {
    console.warn("Não foi possível remover o PDF antigo do edital:", error);
  }
}

async function validarPdfEdital(arquivo: File, limite: number): Promise<void> {
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecione um edital em PDF.");
  }
  if (arquivo.size <= 0) {
    throw new Error("O PDF selecionado está vazio.");
  }
  if (arquivo.size > limite) {
    const limiteMb = Math.round(limite / 1024 / 1024);
    throw new Error(`Para esta etapa, o PDF deve ter no máximo ${limiteMb} MB.`);
  }

  const cabecalho = new TextDecoder("ascii").decode(
    await arquivo.slice(0, 5).arrayBuffer()
  );
  if (cabecalho !== "%PDF-") {
    throw new Error("O arquivo selecionado não é um PDF válido.");
  }
}

function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler o PDF selecionado."));
    leitor.onload = () => {
      const resultado = String(leitor.result || "");
      const base64 = resultado.split(",")[1];
      if (!base64) {
        reject(new Error("O PDF não pôde ser preparado para análise."));
        return;
      }
      resolve(base64);
    };
    leitor.readAsDataURL(arquivo);
  });
}

function sanitizarNomeArquivo(nome: string): string {
  const seguro = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return seguro || "edital.pdf";
}
