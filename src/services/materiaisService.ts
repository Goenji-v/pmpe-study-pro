import {
  supabase,
} from "../lib/supabase";

export type TipoMaterial =
  | "arquivo"
  | "link";

export type MaterialEstudo = {
  id: string;
  tipo: TipoMaterial;

  nome: string;
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  observacao: string;

  criadoEm: string;

  nomeArquivo?: string;
  mimeType?: string;
  tamanhoBytes?: number;

  url?: string;
  storagePath?: string;
};

type MaterialBanco = {
  id: string;
  user_id: string;
  local_id: string | null;
  nome: string;
  materia: string;
  assunto: string;
  tipo: TipoMaterial;
  observacao: string | null;
  url_externa: string | null;
  storage_path: string | null;
  nome_arquivo: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
  dados: {
    materiaId?: string;
    modulo?: string;
    moduloId?: string;
    assuntoId?: string;
    [chave: string]: unknown;
  } | null;
};

type RegistroMaterialLocal =
  MaterialEstudo & {
    arquivo?: Blob;
  };

const BUCKET_MATERIAIS =
  "materiais";

const NOME_BANCO_LOCAL =
  "pmpe_study_pro";

const VERSAO_BANCO_LOCAL = 1;

const LOJA_MATERIAIS_LOCAL =
  "materiais";

const CHAVE_MIGRACAO_LOCAL =
  "pmpe_materiais_indexeddb_migrados_v1";

export async function listarMateriais():
  Promise<MaterialEstudo[]> {
  const usuario =
    await exigirUsuario();

  await migrarMateriaisLocais(
    usuario.id
  );

  const {
    data,
    error,
  } = await supabase
    .from("materiais")
    .select(
      [
        "id",
        "user_id",
        "local_id",
        "nome",
        "materia",
        "assunto",
        "tipo",
        "observacao",
        "url_externa",
        "storage_path",
        "nome_arquivo",
        "mime_type",
        "tamanho_bytes",
        "created_at",
        "dados",
      ].join(",")
    )
    .eq(
      "user_id",
      usuario.id
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Não foi possível listar os materiais: ${error.message}`
    );
  }

  return (
  (data ?? []) as unknown as MaterialBanco[]
).map(
  converterMaterialBanco
);
}

export async function listarMateriaisPorAssunto(
  materia: string,
  assunto: string,
  modulo?: string
): Promise<MaterialEstudo[]> {
  const usuario =
    await exigirUsuario();

  const {
    data,
    error,
  } = await supabase
    .from("materiais")
    .select(
      [
        "id",
        "user_id",
        "local_id",
        "nome",
        "materia",
        "assunto",
        "tipo",
        "observacao",
        "url_externa",
        "storage_path",
        "nome_arquivo",
        "mime_type",
        "tamanho_bytes",
        "created_at",
        "dados",
      ].join(",")
    )
    .eq(
      "user_id",
      usuario.id
    )
    .eq(
      "materia",
      materia.trim()
    )
    .eq(
      "assunto",
      assunto.trim()
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Não foi possível listar os materiais: ${error.message}`
    );
  }

  return (
    (data ?? []) as unknown as MaterialBanco[]
  )
    .map(converterMaterialBanco)
    .filter(
      (material) =>
        !modulo?.trim() ||
        material.modulo === modulo.trim() ||
        (!material.modulo && modulo.trim() === "Geral")
    );
}

export async function salvarArquivoMaterial(
  dados: {
    nome: string;
    materia: string;
    materiaId?: string;
    modulo?: string;
    moduloId?: string;
    assunto: string;
    assuntoId?: string;
    observacao: string;
    arquivo: File;
  }
): Promise<MaterialEstudo> {
  const usuario =
    await exigirUsuario();

  validarArquivo(
    dados.arquivo
  );

  const id =
    crypto.randomUUID();

  const storagePath =
    criarCaminhoArquivo(
      usuario.id,
      id,
      dados.arquivo.name
    );

  const {
    error:
      erroUpload,
  } = await supabase.storage
    .from(
      BUCKET_MATERIAIS
    )
    .upload(
      storagePath,
      dados.arquivo,
      {
        cacheControl:
          "3600",

        contentType:
          dados.arquivo.type ||
          "application/octet-stream",

        upsert: false,
      }
    );

  if (erroUpload) {
    throw new Error(
      `Não foi possível enviar o arquivo: ${erroUpload.message}`
    );
  }

  const criadoEm =
    new Date().toISOString();

  const {
    data,
    error:
      erroBanco,
  } = await supabase
    .from("materiais")
    .insert({
      id,
      user_id:
        usuario.id,
      local_id:
        id,
      nome:
        dados.nome.trim(),
      materia:
        dados.materia.trim(),
      assunto:
        dados.assunto.trim(),
      tipo:
        "arquivo",
      observacao:
        dados.observacao.trim(),
      storage_path:
        storagePath,
      nome_arquivo:
        dados.arquivo.name,
      mime_type:
        dados.arquivo.type ||
        "application/octet-stream",
      tamanho_bytes:
        dados.arquivo.size,
      created_at:
        criadoEm,
      dados: {
        materiaId: dados.materiaId,
        modulo: dados.modulo?.trim() || "Geral",
        moduloId: dados.moduloId,
        assuntoId: dados.assuntoId,
      },
    })
    .select(
      [
        "id",
        "user_id",
        "local_id",
        "nome",
        "materia",
        "assunto",
        "tipo",
        "observacao",
        "url_externa",
        "storage_path",
        "nome_arquivo",
        "mime_type",
        "tamanho_bytes",
        "created_at",
        "dados",
      ].join(",")
    )
    .single();

  if (erroBanco) {
    await supabase.storage
      .from(
        BUCKET_MATERIAIS
      )
      .remove([
        storagePath,
      ]);

    throw new Error(
      `O arquivo foi enviado, mas o material não pôde ser salvo: ${erroBanco.message}`
    );
  }

  return converterMaterialBanco(
  data as unknown as MaterialBanco
);
}

export async function salvarLinkMaterial(
  dados: {
    nome: string;
    materia: string;
    materiaId?: string;
    modulo?: string;
    moduloId?: string;
    assunto: string;
    assuntoId?: string;
    observacao: string;
    url: string;
  }
): Promise<MaterialEstudo> {
  const usuario =
    await exigirUsuario();

  const id =
    crypto.randomUUID();

  const {
    data,
    error,
  } = await supabase
    .from("materiais")
    .insert({
      id,
      user_id:
        usuario.id,
      local_id:
        id,
      nome:
        dados.nome.trim(),
      materia:
        dados.materia.trim(),
      assunto:
        dados.assunto.trim(),
      tipo:
        "link",
      observacao:
        dados.observacao.trim(),
      url_externa:
        normalizarUrl(
          dados.url
        ),
      created_at:
        new Date()
          .toISOString(),
      dados: {
        materiaId: dados.materiaId,
        modulo: dados.modulo?.trim() || "Geral",
        moduloId: dados.moduloId,
        assuntoId: dados.assuntoId,
      },
    })
    .select(
      [
        "id",
        "user_id",
        "local_id",
        "nome",
        "materia",
        "assunto",
        "tipo",
        "observacao",
        "url_externa",
        "storage_path",
        "nome_arquivo",
        "mime_type",
        "tamanho_bytes",
        "created_at",
        "dados",
      ].join(",")
    )
    .single();

  if (error) {
    throw new Error(
      `Não foi possível salvar o link: ${error.message}`
    );
  }

  return converterMaterialBanco(
  data as unknown as MaterialBanco
);
}

export async function excluirMaterial(
  id: string
): Promise<void> {
  const usuario =
    await exigirUsuario();

  const {
    data,
    error:
      erroBusca,
  } = await supabase
    .from("materiais")
    .select(
      "id, storage_path"
    )
    .eq(
      "id",
      id
    )
    .eq(
      "user_id",
      usuario.id
    )
    .maybeSingle();

  if (erroBusca) {
    throw new Error(
      `Não foi possível localizar o material: ${erroBusca.message}`
    );
  }

  const registro =
    data as {
      id: string;
      storage_path:
        string | null;
    } | null;

  if (!registro) {
    throw new Error(
      "Material não encontrado."
    );
  }

  if (
    registro.storage_path
  ) {
    const {
      error:
        erroStorage,
    } = await supabase.storage
      .from(
        BUCKET_MATERIAIS
      )
      .remove([
        registro.storage_path,
      ]);

    if (erroStorage) {
      throw new Error(
        `Não foi possível excluir o arquivo: ${erroStorage.message}`
      );
    }
  }

  const {
    error:
      erroBanco,
  } = await supabase
    .from("materiais")
    .delete()
    .eq(
      "id",
      id
    )
    .eq(
      "user_id",
      usuario.id
    );

  if (erroBanco) {
    throw new Error(
      `Não foi possível excluir o material: ${erroBanco.message}`
    );
  }
}

export async function abrirMaterial(
  material: MaterialEstudo
): Promise<void> {
  if (
    material.tipo ===
    "link"
  ) {
    if (!material.url) {
      throw new Error(
        "O link não possui endereço válido."
      );
    }

    window.open(
      material.url,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }

  if (
    !material.storagePath
  ) {
    throw new Error(
      "Este material não possui arquivo na nuvem."
    );
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      BUCKET_MATERIAIS
    )
    .createSignedUrl(
      material.storagePath,
      300
    );

  if (error) {
    throw new Error(
      `Não foi possível abrir o arquivo: ${error.message}`
    );
  }

  const novaAba =
    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer"
    );

  if (!novaAba) {
    throw new Error(
      "O navegador bloqueou a abertura do arquivo."
    );
  }
}

export async function baixarMaterial(
  material: MaterialEstudo
): Promise<void> {
  if (
    material.tipo ===
    "link"
  ) {
    await abrirMaterial(
      material
    );

    return;
  }

  if (
    !material.storagePath
  ) {
    throw new Error(
      "Este material não possui arquivo na nuvem."
    );
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      BUCKET_MATERIAIS
    )
    .download(
      material.storagePath
    );

  if (error) {
    throw new Error(
      `Não foi possível baixar o arquivo: ${error.message}`
    );
  }

  const urlTemporaria =
    URL.createObjectURL(data);

  const ancora =
    document.createElement(
      "a"
    );

  ancora.href =
    urlTemporaria;

  ancora.download =
    material.nomeArquivo ||
    material.nome;

  document.body.appendChild(
    ancora
  );

  ancora.click();
  ancora.remove();

  URL.revokeObjectURL(
    urlTemporaria
  );
}

async function migrarMateriaisLocais(
  userId: string
): Promise<void> {
  const chaveUsuario =
    `${CHAVE_MIGRACAO_LOCAL}_${userId}`;

  if (
    localStorage.getItem(
      chaveUsuario
    ) === "1"
  ) {
    return;
  }

  let locais:
    RegistroMaterialLocal[] =
    [];

  try {
    locais =
      await listarRegistrosLocais();
  } catch (erro) {
    console.warn(
      "Não foi possível verificar os materiais antigos:",
      erro
    );

    return;
  }

  if (
    locais.length === 0
  ) {
    localStorage.setItem(
      chaveUsuario,
      "1"
    );

    return;
  }

  for (
    const material of locais
  ) {
    try {
      await migrarMaterialLocal(
        userId,
        material
      );
    } catch (erro) {
      console.error(
        `Falha ao migrar o material "${material.nome}":`,
        erro
      );

      return;
    }
  }

  localStorage.setItem(
    chaveUsuario,
    "1"
  );
}

async function migrarMaterialLocal(
  userId: string,
  material:
    RegistroMaterialLocal
): Promise<void> {
  const {
    data:
      existente,
    error:
      erroBusca,
  } = await supabase
    .from("materiais")
    .select(
      "id"
    )
    .eq(
      "user_id",
      userId
    )
    .eq(
      "local_id",
      material.id
    )
    .maybeSingle();

  if (erroBusca) {
    throw erroBusca;
  }

  if (existente) {
    return;
  }

  let storagePath:
    string | null =
    null;

  if (
    material.tipo ===
      "arquivo" &&
    material.arquivo
  ) {
    const nomeArquivo =
      material.nomeArquivo ||
      material.nome;

    storagePath =
      criarCaminhoArquivo(
        userId,
        material.id,
        nomeArquivo
      );

    const {
      error:
        erroUpload,
    } = await supabase.storage
      .from(
        BUCKET_MATERIAIS
      )
      .upload(
        storagePath,
        material.arquivo,
        {
          cacheControl:
            "3600",

          contentType:
            material.mimeType ||
            material.arquivo.type ||
            "application/octet-stream",

          upsert: true,
        }
      );

    if (erroUpload) {
      throw erroUpload;
    }
  }

  const {
    error,
  } = await supabase
    .from("materiais")
    .insert({
      id:
        validarUuid(
          material.id
        )
          ? material.id
          : crypto.randomUUID(),

      user_id:
        userId,

      local_id:
        material.id,

      nome:
        material.nome,

      materia:
        material.materia,

      assunto:
        material.assunto,

      tipo:
        material.tipo,

      observacao:
        material.observacao ||
        "",

      url_externa:
        material.tipo ===
          "link"
          ? material.url ||
            null
          : null,

      storage_path:
        storagePath,

      nome_arquivo:
        material.nomeArquivo ||
        null,

      mime_type:
        material.mimeType ||
        null,

      tamanho_bytes:
        material.tamanhoBytes ??
        material.arquivo?.size ??
        null,

      created_at:
        material.criadoEm,

      dados: {
        migradoDoIndexedDB: true,
        materiaId: material.materiaId,
        modulo: material.modulo || "Geral",
        moduloId: material.moduloId,
        assuntoId: material.assuntoId,
      },
    });

  if (error) {
    if (storagePath) {
      await supabase.storage
        .from(
          BUCKET_MATERIAIS
        )
        .remove([
          storagePath,
        ]);
    }

    throw error;
  }
}

async function listarRegistrosLocais():
  Promise<
    RegistroMaterialLocal[]
  > {
  const banco =
    await abrirBancoLocal();

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const transacao =
        banco.transaction(
          LOJA_MATERIAIS_LOCAL,
          "readonly"
        );

      const loja =
        transacao.objectStore(
          LOJA_MATERIAIS_LOCAL
        );

      const requisicao =
        loja.getAll();

      requisicao.onsuccess =
        () => {
          resolve(
            requisicao.result as
              RegistroMaterialLocal[]
          );
        };

      requisicao.onerror =
        () => {
          reject(
            requisicao.error ??
            new Error(
              "Não foi possível ler os materiais antigos."
            )
          );
        };
    }
  );
}

function abrirBancoLocal():
  Promise<IDBDatabase> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const requisicao =
        indexedDB.open(
          NOME_BANCO_LOCAL,
          VERSAO_BANCO_LOCAL
        );

      requisicao.onsuccess =
        () => {
          resolve(
            requisicao.result
          );
        };

      requisicao.onerror =
        () => {
          reject(
            requisicao.error ??
            new Error(
              "Não foi possível abrir o banco local."
            )
          );
        };

      requisicao.onupgradeneeded =
        () => {
          const banco =
            requisicao.result;

          if (
            !banco.objectStoreNames.contains(
              LOJA_MATERIAIS_LOCAL
            )
          ) {
            banco.createObjectStore(
              LOJA_MATERIAIS_LOCAL,
              {
                keyPath:
                  "id",
              }
            );
          }
        };
    }
  );
}

async function exigirUsuario() {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  if (error) {
    throw new Error(
      `Não foi possível identificar o usuário: ${error.message}`
    );
  }

  if (!data.user) {
    throw new Error(
      "Faça login para acessar os materiais."
    );
  }

  return data.user;
}

function converterMaterialBanco(
  registro:
    MaterialBanco
): MaterialEstudo {
  return {
    id:
      registro.id,

    tipo:
      registro.tipo,

    nome:
      registro.nome,

    materia:
      registro.materia,

    materiaId:
      registro.dados?.materiaId,

    modulo:
      registro.dados?.modulo || "Geral",

    moduloId:
      registro.dados?.moduloId,

    assunto:
      registro.assunto,

    assuntoId:
      registro.dados?.assuntoId,

    observacao:
      registro.observacao ||
      "",

    criadoEm:
      registro.created_at,

    nomeArquivo:
      registro.nome_arquivo ||
      undefined,

    mimeType:
      registro.mime_type ||
      undefined,

    tamanhoBytes:
      registro.tamanho_bytes ??
      undefined,

    url:
      registro.url_externa ||
      undefined,

    storagePath:
      registro.storage_path ||
      undefined,
  };
}

function criarCaminhoArquivo(
  userId: string,
  materialId: string,
  nomeArquivo: string
) {
  return [
    userId,
    materialId,
    sanitizarNomeArquivo(
      nomeArquivo
    ),
  ].join("/");
}

function sanitizarNomeArquivo(
  nome: string
) {
  const partes =
    nome.split(".");

  const extensao =
    partes.length > 1
      ? partes.pop()
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
      ) ||
    "arquivo";

  return extensao
    ? `${base}.${extensao
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        )}`
    : base;
}

function validarArquivo(
  arquivo: File
) {
  const limite =
    50 * 1024 * 1024;

  if (
    arquivo.size >
    limite
  ) {
    throw new Error(
      "O arquivo ultrapassa o limite de 50 MB."
    );
  }
}

function normalizarUrl(
  valor: string
) {
  const texto =
    valor.trim();

  if (
    /^https?:\/\//i.test(
      texto
    )
  ) {
    return texto;
  }

  return `https://${texto}`;
}

function validarUuid(
  valor: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}