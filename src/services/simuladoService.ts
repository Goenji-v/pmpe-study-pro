import {
  supabase,
} from "../lib/supabase";

const BUCKET_SIMULADOS = "materiais";
const LIMITE_PDF_BYTES = 50 * 1024 * 1024;

export type PdfSimuladoArmazenado = {
  storagePath: string;
  nomeArquivo: string;
};

export async function enviarPdfSimulado(
  arquivo: File,
  simuladoId: string,
  tipo: "caderno" | "comentado"
): Promise<PdfSimuladoArmazenado> {
  await validarPdf(arquivo);

  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();

  if (erroUsuario || !user) {
    throw new Error(
      "Sua sessão expirou. Entre novamente para enviar o PDF."
    );
  }

  const nomeSeguro = sanitizarNomeArquivo(arquivo.name);
  const storagePath = [
    user.id,
    "simulados",
    simuladoId,
    tipo,
    `${crypto.randomUUID()}-${nomeSeguro}`,
  ].join("/");

  const { error } = await supabase.storage
    .from(BUCKET_SIMULADOS)
    .upload(storagePath, arquivo, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Não foi possível enviar ${tipo === "caderno" ? "o caderno" : "o simulado comentado"}: ${error.message}`
    );
  }

  return {
    storagePath,
    nomeArquivo: arquivo.name,
  };
}

export async function removerPdfSimulado(
  storagePath?: string
): Promise<void> {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(BUCKET_SIMULADOS)
    .remove([storagePath]);

  if (error) {
    console.warn(
      "Não foi possível remover um PDF órfão do simulado:",
      error
    );
  }
}

export async function abrirPdfSimulado(
  storagePath: string
): Promise<void> {
  const novaAba = window.open("about:blank", "_blank");

  if (novaAba) {
    novaAba.opener = null;
    novaAba.document.title = "Abrindo PDF...";
    novaAba.document.body.textContent = "Abrindo PDF...";
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_SIMULADOS)
      .createSignedUrl(storagePath, 300);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Não foi possível abrir o PDF: ${error?.message ?? "URL indisponível"}`
      );
    }

    if (novaAba) {
      novaAba.location.replace(data.signedUrl);
      return;
    }

    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  } catch (erro) {
    novaAba?.close();
    throw erro;
  }
}

async function validarPdf(
  arquivo: File
): Promise<void> {
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecione um arquivo PDF válido.");
  }

  if (arquivo.size <= 0) {
    throw new Error("O PDF selecionado está vazio.");
  }

  if (arquivo.size > LIMITE_PDF_BYTES) {
    throw new Error("O PDF deve ter no máximo 50 MB.");
  }

  const cabecalho = new TextDecoder("ascii").decode(
    await arquivo.slice(0, 5).arrayBuffer()
  );

  if (cabecalho !== "%PDF-") {
    throw new Error("O arquivo selecionado não é um PDF válido.");
  }
}

function sanitizarNomeArquivo(
  nome: string
): string {
  const seguro = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return seguro || "simulado.pdf";
}
