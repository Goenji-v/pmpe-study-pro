import {
  createHash,
  createHmac,
  randomUUID,
} from "node:crypto";

export type StudyStorageKind =
  | "video"
  | "pdf"
  | "image"
  | "document"
  | "other";

export type StudyStorageConfig = {
  provider: "s3-compatible";
  configured: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  maxFileBytes: number;
};

const LIMITE_PADRAO_BYTES = 5 * 1024 * 1024 * 1024;
const LIMITE_MAXIMO_SINGLE_PUT_BYTES = 5 * 1024 * 1024 * 1024;

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
  const endpoint = String(env.STUDY_STORAGE_ENDPOINT || "").trim().replace(/\/+$/, "");
  const region = String(env.STUDY_STORAGE_REGION || "auto").trim() || "auto";
  const bucket = String(env.STUDY_STORAGE_BUCKET || "").trim();
  const accessKeyId = String(env.STUDY_STORAGE_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(env.STUDY_STORAGE_SECRET_ACCESS_KEY || "").trim();

  const limiteInformado = Number(env.STUDY_STORAGE_MAX_FILE_BYTES);
  const maxFileBytes =
    Number.isFinite(limiteInformado) && limiteInformado > 0
      ? Math.min(Math.floor(limiteInformado), LIMITE_MAXIMO_SINGLE_PUT_BYTES)
      : LIMITE_PADRAO_BYTES;

  return {
    provider: "s3-compatible",
    configured: Boolean(
      endpoint &&
      bucket &&
      accessKeyId &&
      secretAccessKey
    ),
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    maxFileBytes,
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
  const sizeBytes = Math.floor(Number(dados.sizeBytes));

  if (!fileName || fileName.includes("\0")) {
    throw new Error("Nome do arquivo inválido.");
  }

  if (!MIMES_PERMITIDOS.has(mimeType)) {
    throw new Error(
      "Formato não permitido. Use vídeo MP4/WEBM, PDF, imagem, TXT ou Word."
    );
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("O tamanho do arquivo é inválido.");
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
    throw new Error("Usuário inválido para o armazenamento.");
  }

  const ano = String(agora.getUTCFullYear());
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  const nomeSeguro = sanitizarNomeArquivo(fileName);

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
  if (!uuidValido(userId)) return false;
  return objectKey.startsWith(`${userId}/private/`);
}

export function criarUrlAssinadaS3(
  config: StudyStorageConfig,
  metodo: "GET" | "PUT" | "HEAD" | "DELETE",
  objectKey: string,
  expiresSeconds: number,
  agora = new Date()
) {
  if (!config.configured) {
    throw new Error(
      "O provedor físico do Study Pro Storage ainda não foi configurado."
    );
  }

  const expira = Math.max(60, Math.min(604800, Math.floor(expiresSeconds)));
  const endpoint = new URL(config.endpoint);
  if (endpoint.search || endpoint.hash) {
    throw new Error("STUDY_STORAGE_ENDPOINT não pode conter query ou fragmento.");
  }

  const dataCompleta = formatarAmzDate(agora);
  const dataCurta = dataCompleta.slice(0, 8);
  const escopo = `${dataCurta}/${config.region}/s3/aws4_request`;
  const host = endpoint.host;

  const basePath = endpoint.pathname.replace(/\/+$/, "");
  const canonicalUri = [
    basePath,
    config.bucket,
    ...objectKey.split("/"),
  ]
    .filter(Boolean)
    .map((parte, indice) =>
      indice === 0 && parte.startsWith("/")
        ? parte
        : codificarRfc3986(parte)
    )
    .join("/")
    .replace(/^([^/])/, "/$1");

  const parametros: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${escopo}`],
    ["X-Amz-Date", dataCompleta],
    ["X-Amz-Expires", String(expira)],
    ["X-Amz-SignedHeaders", "host"],
  ];

  const canonicalQuery = parametros
    .map(([chave, valor]) => [
      codificarRfc3986(chave),
      codificarRfc3986(valor),
    ] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, valor]) => `${chave}=${valor}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    metodo,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dataCompleta,
    escopo,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = obterChaveAssinatura(
    config.secretAccessKey,
    dataCurta,
    config.region,
    "s3"
  );
  const assinatura = hmacHex(signingKey, stringToSign);

  endpoint.pathname = canonicalUri;
  endpoint.search = `${canonicalQuery}&X-Amz-Signature=${assinatura}`;

  return endpoint.toString();
}

export async function verificarObjetoStudyStorage(
  config: StudyStorageConfig,
  objectKey: string
) {
  const url = criarUrlAssinadaS3(
    config,
    "HEAD",
    objectKey,
    300
  );
  const resposta = await fetch(url, {
    method: "HEAD",
  });

  if (!resposta.ok) {
    throw new Error(
      `O arquivo não pôde ser confirmado no armazenamento (HTTP ${resposta.status}).`
    );
  }

  const tamanho = Number(
    resposta.headers.get("content-length") || 0
  );

  return {
    sizeBytes:
      Number.isFinite(tamanho) && tamanho >= 0
        ? tamanho
        : null,
    mimeType:
      resposta.headers.get("content-type") || null,
    etag:
      resposta.headers.get("etag") || null,
  };
}

export function inferirTipoArquivo(
  mimeType: string
): StudyStorageKind {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("word")
  ) {
    return "document";
  }
  return "other";
}

function sanitizarNomeArquivo(nome: string) {
  const partes = nome.split(".");
  const extensao =
    partes.length > 1
      ? String(partes.pop() || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 12)
      : "";

  const base =
    partes
      .join(".")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140) || "arquivo";

  return extensao ? `${base}.${extensao}` : base;
}

function uuidValido(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}

function formatarAmzDate(data: Date) {
  return data
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");
}

function codificarRfc3986(valor: string) {
  return encodeURIComponent(valor).replace(
    /[!'()*]/g,
    (caractere) =>
      `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function sha256Hex(valor: string) {
  return createHash("sha256")
    .update(valor, "utf8")
    .digest("hex");
}

function hmac(
  chave: Buffer | string,
  valor: string
) {
  return createHmac("sha256", chave)
    .update(valor, "utf8")
    .digest();
}

function hmacHex(
  chave: Buffer | string,
  valor: string
) {
  return createHmac("sha256", chave)
    .update(valor, "utf8")
    .digest("hex");
}

function obterChaveAssinatura(
  segredo: string,
  data: string,
  region: string,
  servico: string
) {
  const kDate = hmac(`AWS4${segredo}`, data);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, servico);
  return hmac(kService, "aws4_request");
}
