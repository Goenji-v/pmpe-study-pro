import { EDITAIS_PREDEFINIDOS_SISTEMA } from "../data/editaisPredefinidos";
import { supabase } from "../lib/supabase";
import type {
  EditalCatalogo,
  NovoEditalCatalogo,
  StatusEditalCatalogo,
} from "../types/catalogoEditais";
import type { AnaliseEdital } from "../types/editalInteligente";

const BUCKET_EDITAIS = "materiais";

type LinhaEditalCatalogo = {
  id: string;
  slug: string;
  organizacao: string;
  nome: string;
  uf: string;
  ano: number;
  carreira: string;
  grupo_cargo: string;
  cargo: string;
  codigo_cargo: string | null;
  banca: string | null;
  fonte_url: string | null;
  pdf_path: string | null;
  analise: unknown;
  opcoes: unknown;
  status: string;
  destaque: boolean;
  ordem: number;
};

export async function carregarEditaisCatalogo(): Promise<EditalCatalogo[]> {
  const { data, error } = await supabase
    .from("editais_catalogo")
    .select(
      "id,slug,organizacao,nome,uf,ano,carreira,grupo_cargo,cargo,codigo_cargo,banca,fonte_url,pdf_path,analise,opcoes,status,destaque,ordem"
    )
    .order("carreira", { ascending: true })
    .order("grupo_cargo", { ascending: true })
    .order("ordem", { ascending: true })
    .order("ano", { ascending: false });

  if (error) {
    console.warn(
      "Não foi possível carregar editais administrativos; usando os editais embarcados:",
      error.message
    );
    return ordenarCatalogo(EDITAIS_PREDEFINIDOS_SISTEMA.map(clonarEdital));
  }

  const administrativos = ((data ?? []) as LinhaEditalCatalogo[]).map(
    mapearLinha
  );
  const porSlug = new Map<string, EditalCatalogo>();

  for (const edital of EDITAIS_PREDEFINIDOS_SISTEMA) {
    porSlug.set(edital.slug, clonarEdital(edital));
  }
  for (const edital of administrativos) {
    porSlug.set(edital.slug, edital);
  }

  return ordenarCatalogo(Array.from(porSlug.values()));
}

export function prepararAnaliseCatalogo(
  edital: EditalCatalogo,
  opcoes?: { idioma?: string }
): AnaliseEdital {
  const idioma = opcoes?.idioma?.trim();
  const idiomas = edital.opcoes.idiomas ?? [];
  const nomesIdiomas = new Set(
    idiomas.map((item) => normalizar("Língua Estrangeira - " + item))
  );

  const materias = edital.analise.materias
    .filter((materia) => {
      if (!idiomas.length || !idioma) return true;

      const chave = normalizar(materia.nome);
      if (!nomesIdiomas.has(chave)) return true;

      return chave === normalizar("Língua Estrangeira - " + idioma);
    })
    .map((materia) => ({
      ...materia,
      assuntos: materia.assuntos.map((assunto) => ({ ...assunto })),
    }));

  return {
    ...edital.analise,
    cargoDetectado: edital.cargo,
    bancaDetectada: edital.banca ?? edital.analise.bancaDetectada,
    materias,
    analisadoEm: new Date().toISOString(),
  };
}

export function contarAssuntosCatalogo(edital: EditalCatalogo) {
  return edital.analise.materias.reduce(
    (total, materia) => total + materia.assuntos.length,
    0
  );
}

export async function abrirFonteEditalCatalogo(
  edital: EditalCatalogo
): Promise<void> {
  const novaAba = window.open("about:blank", "_blank");

  try {
    if (edital.pdfPath) {
      const { data, error } = await supabase.storage
        .from(BUCKET_EDITAIS)
        .createSignedUrl(edital.pdfPath, 120);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Não foi possível abrir o PDF.");
      }

      if (novaAba) {
        novaAba.location.href = data.signedUrl;
      } else {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (edital.fonteUrl) {
      if (novaAba) {
        novaAba.location.href = edital.fonteUrl;
      } else {
        window.open(edital.fonteUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    throw new Error("Este edital ainda não possui PDF ou fonte vinculada.");
  } catch (erro) {
    novaAba?.close();
    throw erro;
  }
}

export async function criarEditalCatalogo(
  entrada: NovoEditalCatalogo,
  arquivo: File
): Promise<EditalCatalogo> {
  validarArquivoPdf(arquivo);

  const id = crypto.randomUUID();
  const nomeSeguro = sanitizarNomeArquivo(arquivo.name);
  const pdfPath = "editais-catalogo/" + id + "/" + nomeSeguro;
  const slug = gerarSlug(
    entrada.organizacao +
      "-" +
      entrada.ano +
      "-" +
      entrada.cargo +
      "-" +
      id.slice(0, 6)
  );

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_EDITAIS)
    .upload(pdfPath, arquivo, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (erroUpload) {
    throw new Error(
      "Não foi possível enviar o PDF do catálogo: " + erroUpload.message
    );
  }

  const linha = {
    id,
    slug,
    organizacao: entrada.organizacao.trim(),
    nome: entrada.nome.trim(),
    uf: entrada.uf.trim().toUpperCase(),
    ano: entrada.ano,
    carreira: entrada.carreira.trim() || "policia_militar",
    grupo_cargo: entrada.grupoCargo,
    cargo: entrada.cargo.trim(),
    codigo_cargo: entrada.codigoCargo?.trim() || null,
    banca: entrada.banca?.trim() || null,
    fonte_url: entrada.fonteUrl?.trim() || null,
    pdf_path: pdfPath,
    analise: entrada.analise,
    opcoes: entrada.opcoes ?? {},
    status: entrada.publicar === false ? "rascunho" : "publicado",
    destaque: false,
    ordem: 100,
  };

  const { data, error } = await supabase
    .from("editais_catalogo")
    .insert(linha)
    .select(
      "id,slug,organizacao,nome,uf,ano,carreira,grupo_cargo,cargo,codigo_cargo,banca,fonte_url,pdf_path,analise,opcoes,status,destaque,ordem"
    )
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET_EDITAIS).remove([pdfPath]);
    throw new Error(
      "Não foi possível cadastrar o edital no catálogo: " +
        (error?.message || "resposta vazia")
    );
  }

  return mapearLinha(data as LinhaEditalCatalogo);
}

export async function alterarStatusEditalCatalogo(
  id: string,
  status: StatusEditalCatalogo
) {
  if (id.startsWith("sistema-")) {
    throw new Error(
      "Os editais embarcados do sistema são atualizados pelo código. Cadastre uma nova versão para substituí-los."
    );
  }

  const { error } = await supabase
    .from("editais_catalogo")
    .update({
      status,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error("Não foi possível alterar o edital: " + error.message);
  }
}

export async function removerEditalCatalogo(edital: EditalCatalogo) {
  if (edital.origem === "sistema") {
    throw new Error("O edital padrão do sistema não pode ser removido pelo painel.");
  }

  const { error } = await supabase
    .from("editais_catalogo")
    .delete()
    .eq("id", edital.id);

  if (error) {
    throw new Error("Não foi possível remover o edital: " + error.message);
  }

  if (edital.pdfPath) {
    const { error: erroArquivo } = await supabase.storage
      .from(BUCKET_EDITAIS)
      .remove([edital.pdfPath]);

    if (erroArquivo) {
      console.warn(
        "O registro foi removido, mas o PDF do catálogo não pôde ser excluído:",
        erroArquivo.message
      );
    }
  }
}

function mapearLinha(linha: LinhaEditalCatalogo): EditalCatalogo {
  return {
    id: linha.id,
    slug: linha.slug,
    organizacao: linha.organizacao,
    nome: linha.nome,
    uf: linha.uf,
    ano: Number(linha.ano),
    carreira: linha.carreira,
    grupoCargo:
      linha.grupo_cargo === "soldado" || linha.grupo_cargo === "oficial"
        ? linha.grupo_cargo
        : "outro",
    cargo: linha.cargo,
    codigoCargo: linha.codigo_cargo || undefined,
    banca: linha.banca || undefined,
    fonteUrl: linha.fonte_url || undefined,
    pdfPath: linha.pdf_path || undefined,
    analise: linha.analise as AnaliseEdital,
    opcoes:
      linha.opcoes && typeof linha.opcoes === "object"
        ? (linha.opcoes as EditalCatalogo["opcoes"])
        : {},
    status:
      linha.status === "rascunho" || linha.status === "arquivado"
        ? linha.status
        : "publicado",
    destaque: Boolean(linha.destaque),
    ordem: Number(linha.ordem || 0),
    origem: "admin",
  };
}

function ordenarCatalogo(editais: EditalCatalogo[]) {
  const pesoGrupo: Record<EditalCatalogo["grupoCargo"], number> = {
    soldado: 0,
    oficial: 1,
    outro: 2,
  };

  return [...editais].sort(
    (a, b) =>
      pesoGrupo[a.grupoCargo] - pesoGrupo[b.grupoCargo] ||
      a.ordem - b.ordem ||
      b.ano - a.ano ||
      a.organizacao.localeCompare(b.organizacao, "pt-BR")
  );
}

function clonarEdital(edital: EditalCatalogo): EditalCatalogo {
  return {
    ...edital,
    opcoes: { ...edital.opcoes, idiomas: edital.opcoes.idiomas?.slice() },
    analise: {
      ...edital.analise,
      materias: edital.analise.materias.map((materia) => ({
        ...materia,
        assuntos: materia.assuntos.map((assunto) => ({ ...assunto })),
      })),
    },
  };
}

function validarArquivoPdf(arquivo: File) {
  if (
    arquivo.type !== "application/pdf" &&
    !arquivo.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Selecione um arquivo PDF.");
  }

  if (arquivo.size <= 0 || arquivo.size > 25 * 1024 * 1024) {
    throw new Error("O PDF deve ter no máximo 25 MB.");
  }
}

function sanitizarNomeArquivo(nome: string) {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (limpo || "edital.pdf").slice(0, 150);
}

function gerarSlug(valor: string) {
  return normalizar(valor).replace(/\s+/g, "-").slice(0, 180);
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
