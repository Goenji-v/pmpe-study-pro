import { supabase } from "../lib/supabase";

export type PrivateLessonSource =
  | "google_drive"
  | "youtube";

export type PrivateLesson = {
  id: string;
  sourceType: PrivateLessonSource;
  title: string;
  sourceUrl: string;
  materia?: string;
  assunto?: string;
  notes?: string;
  createdAt: string;
};

type PrivateLessonRow = {
  id: string;
  source_type: PrivateLessonSource;
  title: string;
  source_url: string;
  materia: string | null;
  assunto: string | null;
  notes: string | null;
  created_at: string;
};

export async function temAcessoBibliotecaPrivada() {
  const { data: authData } =
    await supabase.auth.getUser();

  const user = authData.user;
  if (!user) return false;

  const { data, error } = await supabase
    .from("study_private_feature_access")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn(
      "Falha ao verificar acesso à biblioteca privada:",
      error
    );
    return false;
  }

  return Boolean(data);
}

export async function listarAulasPrivadas():
  Promise<PrivateLesson[]> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error(
      "Faça login para acessar suas aulas privadas."
    );
  }

  const { data, error } = await supabase
    .from("study_private_lessons")
    .select(
      "id,source_type,title,source_url,materia,assunto,notes,created_at"
    )
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Não foi possível carregar suas aulas: ${error.message}`
    );
  }

  return ((data ?? []) as PrivateLessonRow[])
    .map(converter);
}

export async function adicionarAulaPrivada(input: {
  sourceType: PrivateLessonSource;
  title: string;
  sourceUrl: string;
  materia?: string;
  assunto?: string;
  notes?: string;
}) {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error(
      "Faça login para adicionar uma aula."
    );
  }

  const title = input.title.trim();
  const sourceUrl = input.sourceUrl.trim();

  if (!title) {
    throw new Error("Informe o título da aula.");
  }

  validarFonte(input.sourceType, sourceUrl);

  const { data, error } = await supabase
    .from("study_private_lessons")
    .insert({
      user_id: authData.user.id,
      source_type: input.sourceType,
      title,
      source_url: sourceUrl,
      materia: input.materia?.trim() || null,
      assunto: input.assunto?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id,source_type,title,source_url,materia,assunto,notes,created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(
      `Não foi possível salvar a aula: ${error?.message || "erro desconhecido"}`
    );
  }

  return converter(data as PrivateLessonRow);
}

export async function removerAulaPrivada(id: string) {
  const { data: authData } =
    await supabase.auth.getUser();

  if (!authData.user) {
    throw new Error("Sessão inválida.");
  }

  const { error } = await supabase
    .from("study_private_lessons")
    .delete()
    .eq("id", id)
    .eq("user_id", authData.user.id);

  if (error) {
    throw new Error(
      `Não foi possível remover a aula: ${error.message}`
    );
  }
}

export function obterEmbedUrlAula(
  aula: Pick<PrivateLesson, "sourceType" | "sourceUrl">
) {
  if (aula.sourceType === "google_drive") {
    const id = extrairDriveFileId(aula.sourceUrl);
    if (!id) {
      throw new Error("Link do Google Drive inválido.");
    }
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
  }

  const id = extrairYoutubeVideoId(aula.sourceUrl);
  if (!id) {
    throw new Error("Link do YouTube inválido.");
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
}

function validarFonte(
  sourceType: PrivateLessonSource,
  sourceUrl: string
) {
  if (!/^https:\/\//i.test(sourceUrl)) {
    throw new Error(
      "Use um link HTTPS do Google Drive ou YouTube."
    );
  }

  if (
    sourceType === "google_drive" &&
    !extrairDriveFileId(sourceUrl)
  ) {
    throw new Error(
      "Cole o link de um arquivo de vídeo do Google Drive."
    );
  }

  if (
    sourceType === "youtube" &&
    !extrairYoutubeVideoId(sourceUrl)
  ) {
    throw new Error(
      "Cole um link de vídeo válido do YouTube."
    );
  }
}

function extrairDriveFileId(url: string) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname !== "drive.google.com" &&
      parsed.hostname !== "docs.google.com"
    ) {
      return null;
    }

    const match = parsed.pathname.match(
      /\/file\/d\/([^/]+)/
    );
    if (match?.[1]) return match[1];

    const id = parsed.searchParams.get("id");
    return id || null;
  } catch {
    return null;
  }
}

function extrairYoutubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (
      host !== "youtube.com" &&
      host !== "m.youtube.com"
    ) {
      return null;
    }

    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }

    const match = parsed.pathname.match(
      /^\/(?:embed|shorts|live)\/([^/?#]+)/
    );
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function converter(row: PrivateLessonRow): PrivateLesson {
  return {
    id: row.id,
    sourceType: row.source_type,
    title: row.title,
    sourceUrl: row.source_url,
    materia: row.materia || undefined,
    assunto: row.assunto || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}
