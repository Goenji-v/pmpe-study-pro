import {
  createPrivateKey,
  randomUUID,
  sign as assinar,
} from "node:crypto";

export type StudyStorageKind =
  | "video"
  | "pdf"
  | "image"
  | "document"
  | "other";

export type StudyStorageConfig = {
  provider: "cloudflare-worker-r2";
  configured: boolean;
  workerUrl: string;
  bucket: string;
  privateKeyB64: string;
  maxFileBytes: number;
  chunkSizeBytes: number;
};

const LIMITE_PADRAO_BYTES = 5 * 1024 * 1024 * 1024;
const CHUNK_PADRAO_BYTES = 32 * 1024 * 1024;

const MIMES_PERMITIDOS = new Set([
  "video/mp4",
  "video/webm",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function obterConfiguracaoStudyStorage(
  env: NodeJS.ProcessEnv = process.env
): StudyStorageConfig {
  const workerUrl = String(
    env.STUDY_STORAGE_WORKER_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");
  const bucket = String(
    env.STUDY_STORAGE_BUCKET || "study-pro-private"
  ).trim();
  const privateKeyB64 = String(
    env.STUDY_STORAGE_PRIVATE_KEY_B64 || ""
  ).trim();

  const limiteInformado = Number(
    env.STUDY_STORAGE_MAX_FILE_BYTES
  );
  const maxFileBytes =
    Number.isFinite(limiteInformado) &&
    limiteInformado > 0
      ? Math.floor(limiteInformado)
      : LIMITE_PADRAO_BYTES;

  const chunkInformado = Number(
    env.STUDY_STORAGE_CHUNK_BYTES
  );
  const chunkSizeBytes =
    Number.isFinite(chunkInformado) &&
    chunkInformado >= 8 * 1024 * 1024 &&
    chunkInformado <= 64 * 1024 * 1024
      ? Math.floor(chunkInformado)
      : CHUNK_PADRAO_BYTES;

  return {
    provider: "cloudflare-worker-r2",
    configured: Boolean(
      workerUrl &&
      bucket &&
      privateKeyB64
    ),
    workerUrl,
    bucket,
    privateKeyB64,
    maxFileBytes,
    chunkSizeBytes,
  };
}

export function validarPedidoUpload(
  dados: {
    fileName?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  },
  config: StudyStorageConfig
) {
  const fileName =
    typeof dados.fileName === "string"
      ? dados.fileName.trim().slice(0, 220)
      : "";
  const mimeType =
    typeof dados.mimeType === "string"
      ? dados.mimeType.trim().toLowerCase()
      : "";
  const sizeBytes = Math.floor(
    Number(dados.sizeBytes)
  );

  if (!fileName || fileName.includes("\0")) {
    throw new Error(
      "Nome do arquivo inválido."
    );
  }

  if (!MIMES_PERMITIDOS.has(mimeType)) {
    throw new Error(
      "Formato não permitido. Use vídeo MP4/WEBM, PDF, imagem, TXT ou Word."
    );
  }

  if (
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0
  ) {
    throw new Error(
      "O tamanho do arquivo é inválido."
    );
  }

  if (sizeBytes > config.maxFileBytes) {
    throw new Error(
      "O arquivo ultrapassa o limite atual do Study Pro Storage."
    );
  }

  return {
    fileName,
    mimeType,
    sizeBytes,
    kind: inferirTipoArquivo(mimeType),
  };
}

export function criarChavePrivada(
  userId: string,
  fileName: string,
  agora = new Date()
) {
  if (!uuidValido(userId)) {
    throw new Error(
      "Usuário inválido para o armazenamento."
    );
  }

  const ano = String(
    agora.getUTCFullYear()
  );
  const mes = String(
    agora.getUTCMonth() + 1
  ).padStart(2, "0");
  const nomeSeguro =
    sanitizarNomeArquivo(fileName);

  return [
    userId,
    "private",
    ano,
    mes,
    `${randomUUID()}-${nomeSeguro}`,
  ].join("/");
}

export function chavePertenceAoUsuario(
  userId: string,
  objectKey: string
) {
  if (!uuidValido(userId)) {
    return false;
  }

  return objectKey.startsWith(
    `${userId}/private/`
  );
}

export function criarTokenStudyStorage(
  config: StudyStorageConfig,
  objectKey: string,
  expiresSeconds: number,
  agora = new Date()
) {
  if (!config.configured) {
    throw new Error(
      "O Study Pro Storage ainda não foi configurado."
    );
  }

  const exp = Math.floor(
    agora.getTime() / 1000
  ) + Math.max(
    60,
    Math.min(
      24 * 60 * 60,
      Math.floor(expiresSeconds)
    )
  );

  const payload = Buffer
    .from(
      JSON.stringify({
        key: objectKey,
        exp,
      }),
      "utf8"
    )
    .toString("base64url");

  const privateKey =
    createPrivateKey({
      key: Buffer.from(
        config.privateKeyB64,
        "base64"
      ),
      format: "der",
      type: "pkcs8",
    });

  const signature = assinar(
    "sha256",
    Buffer.from(payload, "utf8"),
    {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }
  ).toString("base64url");

  return `${payload}.${signature}`;
}

export function criarUrlWorkerStudyStorage(
  config: StudyStorageConfig,
  rota: string,
  objectKey: string,
  token: string,
  extras?: Record<string, string | number>
) {
  if (!config.workerUrl) {
    throw new Error(
      "Worker do Study Pro Storage não configurado."
    );
  }

  const url = new URL(
    rota,
    `${config.workerUrl}/`
  );
  url.searchParams.set(
    "key",
    objectKey
  );
  url.searchParams.set(
    "token",
    token
  );

  for (
    const [chave, valor]
    of Object.entries(extras || {})
  ) {
    url.searchParams.set(
      chave,
      String(valor)
    );
  }

  return url.toString();
}

export async function verificarObjetoStudyStorage(
  config: StudyStorageConfig,
  objectKey: string
) {
  const token =
    criarTokenStudyStorage(
      config,
      objectKey,
      300
    );
  const url =
    criarUrlWorkerStudyStorage(
      config,
      "/v1/object",
      objectKey,
      token
    );
  const resposta = await fetch(
    url,
    {
      method: "HEAD",
    }
  );

  if (!resposta.ok) {
    throw new Error(
      `O arquivo não pôde ser confirmado no armazenamento (HTTP ${resposta.status}).`
    );
  }

  const tamanho = Number(
    resposta.headers.get(
      "content-length"
    ) || 0
  );

  return {
    sizeBytes:
      Number.isFinite(tamanho) &&
      tamanho >= 0
        ? tamanho
        : null,
    mimeType:
      resposta.headers.get(
        "content-type"
      ) || null,
    etag:
      resposta.headers.get(
        "etag"
      ) || null,
  };
}

export function inferirTipoArquivo(
  mimeType: string
): StudyStorageKind {
  if (
    mimeType.startsWith("video/")
  ) {
    return "video";
  }
  if (
    mimeType ===
    "application/pdf"
  ) {
    return "pdf";
  }
  if (
    mimeType.startsWith("image/")
  ) {
    return "image";
  }
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("word")
  ) {
    return "document";
  }
  return "other";
}

function sanitizarNomeArquivo(
  nome: string
) {
  const partes = nome.split(".");
  const extensao =
    partes.length > 1
      ? String(
          partes.pop() || ""
        )
          .toLowerCase()
          .replace(
            /[^a-z0-9]/g,
            ""
          )
          .slice(0, 12)
      : "";

  const base =
    partes
      .join(".")
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(0, 140) ||
    "arquivo";

  return extensao
    ? `${base}.${extensao}`
    : base;
}

function uuidValido(
  valor: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}
