import { criarUrlApi } from "../config/api";
import { supabase } from "../lib/supabase";
import { fetchApiAutenticada } from "./apiAutenticada";

export type StudyStorageKind =
  | "video"
  | "pdf"
  | "image"
  | "document"
  | "other";

export type StudyStorageFile = {
  id: string;
  userId: string;
  provider: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: StudyStorageKind;
  materia?: string;
  assunto?: string;
  durationSeconds?: number;
  status: "pending" | "ready" | "failed" | "deleted";
  createdAt: string;
};

export type StudyStorageProgress = {
  fileId: string;
  positionSeconds: number;
  durationSeconds?: number;
  completed: boolean;
  updatedAt: string;
};

export type StudyStorageStatus = {
  configured: boolean;
  provider: string;
  bucket: string | null;
  maxFileBytes: number;
};

type ApiStorageStatus = {
  sucesso?: boolean;
  configured?: boolean;
  provider?: string;
  bucket?: string | null;
  maxFileBytes?: number;
  erro?: string;
};

type ApiUpload = {
  sucesso?: boolean;
  provider?: string;
  bucket?: string;
  objectKey?: string;
  uploadUrl?: string;
  expiresIn?: number;
  arquivo?: {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    kind?: StudyStorageKind;
  };
  erro?: string;
};

type RegistroArquivo = {
  id: string;
  user_id: string;
  provider: string;
  bucket: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: StudyStorageKind;
  materia: string | null;
  assunto: string | null;
  duration_seconds: number | null;
  status: "pending" | "ready" | "failed" | "deleted";
  created_at: string;
};

type RegistroProgresso = {
  file_id: string;
  position_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  updated_at: string;
};

export async function obterStatusStudyStorage():
  Promise<StudyStorageStatus> {
  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/storage/status")
  );
  const corpo = await lerJson<ApiStorageStatus>(resposta);

  if (!resposta.ok || !corpo.sucesso) {
    throw new Error(
      corpo.erro ||
      "Não foi possível verificar o Study Pro Storage."
    );
  }

  return {
    configured: corpo.configured === true,
    provider: corpo.provider || "s3-compatible",
    bucket: corpo.bucket || null,
    maxFileBytes: Number(corpo.maxFileBytes) || 0,
  };
}

export async function listarArquivosStudyStorage():
  Promise<StudyStorageFile[]> {
  const usuario = await exigirUsuario();

  const { data, error } = await supabase
    .from("study_storage_files")
    .select([
      "id",
      "user_id",
      "provider",
      "bucket",
      "object_key",
      "file_name",
      "mime_type",
      "size_bytes",
      "kind",
      "materia",
      "assunto",
      "duration_seconds",
      "status",
      "created_at",
    ].join(","))
    .eq("user_id", usuario.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Não foi possível listar seus arquivos: ${error.message}`
    );
  }

  return ((data ?? []) as unknown as RegistroArquivo[])
    .map(converterArquivo);
}

export async function listarProgressosStudyStorage():
  Promise<StudyStorageProgress[]> {
  const usuario = await exigirUsuario();

  const { data, error } = await supabase
    .from("study_storage_video_progress")
    .select(
      "file_id,position_seconds,duration_seconds,completed,updated_at"
    )
    .eq("user_id", usuario.id);

  if (error) {
    throw new Error(
      `Não foi possível carregar o progresso dos vídeos: ${error.message}`
    );
  }

  return ((data ?? []) as unknown as RegistroProgresso[])
    .map((item) => ({
      fileId: item.file_id,
      positionSeconds: item.position_seconds,
      durationSeconds: item.duration_seconds ?? undefined,
      completed: item.completed,
      updatedAt: item.updated_at,
    }));
}

export async function enviarArquivoStudyStorage(
  dados: {
    arquivo: File;
    materia?: string;
    assunto?: string;
    onProgress?: (percentual: number) => void;
  }
): Promise<StudyStorageFile> {
  const usuario = await exigirUsuario();

  const preparacaoResposta = await fetchApiAutenticada(
    criarUrlApi("/api/storage/uploads"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: dados.arquivo.name,
        mimeType:
          dados.arquivo.type ||
          "application/octet-stream",
        sizeBytes: dados.arquivo.size,
      }),
    }
  );

  const preparacao =
    await lerJson<ApiUpload>(preparacaoResposta);

  if (
    !preparacaoResposta.ok ||
    !preparacao.sucesso ||
    !preparacao.uploadUrl ||
    !preparacao.objectKey ||
    !preparacao.bucket ||
    !preparacao.provider ||
    !preparacao.arquivo?.kind
  ) {
    throw new Error(
      preparacao.erro ||
      "Não foi possível preparar o envio do arquivo."
    );
  }

  await enviarDiretoAoStorage(
    preparacao.uploadUrl,
    dados.arquivo,
    dados.onProgress
  );

  const confirmacaoResposta =
    await fetchApiAutenticada(
      criarUrlApi("/api/storage/complete"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objectKey: preparacao.objectKey,
          sizeBytes: dados.arquivo.size,
        }),
      }
    );

  const confirmacao = await lerJson<{
    sucesso?: boolean;
    erro?: string;
  }>(confirmacaoResposta);

  if (!confirmacaoResposta.ok || !confirmacao.sucesso) {
    throw new Error(
      confirmacao.erro ||
      "O arquivo foi enviado, mas não pôde ser confirmado."
    );
  }

  const registro = {
    user_id: usuario.id,
    provider: preparacao.provider,
    bucket: preparacao.bucket,
    object_key: preparacao.objectKey,
    file_name: dados.arquivo.name,
    mime_type:
      dados.arquivo.type ||
      "application/octet-stream",
    size_bytes: dados.arquivo.size,
    kind: preparacao.arquivo.kind,
    visibility: "private",
    materia: dados.materia?.trim() || null,
    assunto: dados.assunto?.trim() || null,
    status: "ready",
    metadata: {
      source: "study-pro-storage",
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("study_storage_files")
    .insert(registro)
    .select([
      "id",
      "user_id",
      "provider",
      "bucket",
      "object_key",
      "file_name",
      "mime_type",
      "size_bytes",
      "kind",
      "materia",
      "assunto",
      "duration_seconds",
      "status",
      "created_at",
    ].join(","))
    .single();

  if (error || !data) {
    await tentarRemoverObjeto(preparacao.objectKey);
    throw new Error(
      `O arquivo chegou ao armazenamento, mas não foi registrado: ${error?.message || "erro desconhecido"}`
    );
  }

  dados.onProgress?.(100);
  return converterArquivo(
    data as unknown as RegistroArquivo
  );
}

export async function obterUrlPrivadaStudyStorage(
  arquivo: Pick<StudyStorageFile, "objectKey">
) {
  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/storage/access"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectKey: arquivo.objectKey,
      }),
    }
  );

  const corpo = await lerJson<{
    sucesso?: boolean;
    url?: string;
    erro?: string;
  }>(resposta);

  if (!resposta.ok || !corpo.sucesso || !corpo.url) {
    throw new Error(
      corpo.erro ||
      "Não foi possível abrir o arquivo."
    );
  }

  return corpo.url;
}

export async function excluirArquivoStudyStorage(
  arquivo: StudyStorageFile
) {
  const usuario = await exigirUsuario();

  const resposta = await fetchApiAutenticada(
    criarUrlApi("/api/storage/remove"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectKey: arquivo.objectKey,
      }),
    }
  );

  const corpo = await lerJson<{
    sucesso?: boolean;
    erro?: string;
  }>(resposta);

  if (!resposta.ok || !corpo.sucesso) {
    throw new Error(
      corpo.erro ||
      "Não foi possível remover o arquivo físico."
    );
  }

  const { error } = await supabase
    .from("study_storage_files")
    .delete()
    .eq("id", arquivo.id)
    .eq("user_id", usuario.id);

  if (error) {
    throw new Error(
      `O arquivo físico foi removido, mas o registro não pôde ser apagado: ${error.message}`
    );
  }
}

export async function salvarProgressoVideoStudyStorage(
  arquivoId: string,
  positionSeconds: number,
  durationSeconds?: number
) {
  const usuario = await exigirUsuario();
  const posicao = Math.max(
    0,
    Math.floor(positionSeconds || 0)
  );
  const duracao =
    Number.isFinite(durationSeconds) &&
    Number(durationSeconds) > 0
      ? Math.floor(Number(durationSeconds))
      : null;
  const completed =
    duracao !== null &&
    posicao >= Math.max(0, duracao - 15);

  const { error } = await supabase
    .from("study_storage_video_progress")
    .upsert(
      {
        file_id: arquivoId,
        user_id: usuario.id,
        position_seconds: posicao,
        duration_seconds: duracao,
        completed,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "file_id,user_id",
      }
    );

  if (error) {
    throw new Error(
      `Não foi possível salvar o progresso do vídeo: ${error.message}`
    );
  }
}

export async function atualizarDuracaoVideoStudyStorage(
  arquivoId: string,
  durationSeconds: number
) {
  const usuario = await exigirUsuario();
  const duracao = Math.max(
    0,
    Math.floor(durationSeconds || 0)
  );

  if (!duracao) return;

  const { error } = await supabase
    .from("study_storage_files")
    .update({
      duration_seconds: duracao,
      updated_at: new Date().toISOString(),
    })
    .eq("id", arquivoId)
    .eq("user_id", usuario.id);

  if (error) {
    console.warn(
      "Não foi possível atualizar a duração do vídeo:",
      error
    );
  }
}

function enviarDiretoAoStorage(
  url: string,
  arquivo: File,
  onProgress?: (percentual: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader(
      "Content-Type",
      arquivo.type || "application/octet-stream"
    );

    xhr.upload.onprogress = (evento) => {
      if (!evento.lengthComputable) return;
      const percentual = Math.max(
        0,
        Math.min(
          99,
          Math.round(
            (evento.loaded / evento.total) * 100
          )
        )
      );
      onProgress?.(percentual);
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "A conexão caiu durante o upload. O arquivo não foi registrado."
        )
      );
    };

    xhr.onabort = () => {
      reject(
        new Error("O upload foi cancelado.")
      );
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(
        new Error(
          `O armazenamento recusou o upload (HTTP ${xhr.status}).`
        )
      );
    };

    xhr.send(arquivo);
  });
}

async function tentarRemoverObjeto(
  objectKey: string
) {
  try {
    await fetchApiAutenticada(
      criarUrlApi("/api/storage/remove"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ objectKey }),
      }
    );
  } catch {
    // Limpeza de melhor esforço. O arquivo órfão pode ser removido depois.
  }
}

async function exigirUsuario() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      "Faça login para acessar o Study Pro Storage."
    );
  }

  return data.user;
}

async function lerJson<T>(
  resposta: Response
): Promise<T> {
  try {
    return (await resposta.json()) as T;
  } catch {
    return {} as T;
  }
}

function converterArquivo(
  item: RegistroArquivo
): StudyStorageFile {
  return {
    id: item.id,
    userId: item.user_id,
    provider: item.provider,
    bucket: item.bucket,
    objectKey: item.object_key,
    fileName: item.file_name,
    mimeType: item.mime_type,
    sizeBytes: Number(item.size_bytes) || 0,
    kind: item.kind,
    materia: item.materia || undefined,
    assunto: item.assunto || undefined,
    durationSeconds:
      item.duration_seconds ?? undefined,
    status: item.status,
    createdAt: item.created_at,
  };
}
