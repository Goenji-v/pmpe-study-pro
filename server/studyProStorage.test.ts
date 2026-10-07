import assert from "node:assert/strict";
import test from "node:test";

import {
  chavePertenceAoUsuario,
  criarChavePrivada,
  criarUrlAssinadaS3,
  obterConfiguracaoStudyStorage,
  validarPedidoUpload,
} from "./studyProStorage.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

test("Study Pro Storage fica desativado sem credenciais físicas", () => {
  const config = obterConfiguracaoStudyStorage({} as NodeJS.ProcessEnv);

  assert.equal(config.configured, false);
  assert.equal(config.provider, "s3-compatible");
  assert.equal(config.maxFileBytes, 5 * 1024 * 1024 * 1024);
});

test("validação aceita vídeo de 3 GB e rejeita arquivo acima de 5 GiB", () => {
  const config = obterConfiguracaoStudyStorage({} as NodeJS.ProcessEnv);

  const video = validarPedidoUpload(
    {
      fileName: "live-direitos-humanos.mp4",
      mimeType: "video/mp4",
      sizeBytes: 3 * 1024 * 1024 * 1024,
    },
    config
  );

  assert.equal(video.kind, "video");
  assert.equal(video.sizeBytes, 3 * 1024 * 1024 * 1024);

  assert.throws(
    () =>
      validarPedidoUpload(
        {
          fileName: "gigante.mp4",
          mimeType: "video/mp4",
          sizeBytes: 5 * 1024 * 1024 * 1024 + 1,
        },
        config
      ),
    /ultrapassa o limite/i
  );
});

test("validação bloqueia formatos fora da lista segura", () => {
  const config = obterConfiguracaoStudyStorage({} as NodeJS.ProcessEnv);

  assert.throws(
    () =>
      validarPedidoUpload(
        {
          fileName: "programa.exe",
          mimeType: "application/x-msdownload",
          sizeBytes: 1024,
        },
        config
      ),
    /formato não permitido/i
  );
});

test("chave privada fica sob o UUID do dono e não pertence a outra conta", () => {
  const chave = criarChavePrivada(
    USER_A,
    "Minha Live 01.mp4",
    new Date("2026-10-07T08:00:00Z")
  );

  assert.match(
    chave,
    /^11111111-1111-4111-8111-111111111111\/private\/2026\/10\//
  );
  assert.equal(
    chavePertenceAoUsuario(USER_A, chave),
    true
  );
  assert.equal(
    chavePertenceAoUsuario(USER_B, chave),
    false
  );
  assert.doesNotMatch(chave, /Minha Live/);
});

test("URL S3 assinada não expõe a chave secreta e expira", () => {
  const config = obterConfiguracaoStudyStorage({
    STUDY_STORAGE_ENDPOINT:
      "https://conta.r2.cloudflarestorage.com",
    STUDY_STORAGE_REGION: "auto",
    STUDY_STORAGE_BUCKET: "study-pro-private",
    STUDY_STORAGE_ACCESS_KEY_ID: "ACCESS_TESTE",
    STUDY_STORAGE_SECRET_ACCESS_KEY: "SEGREDO_SUPER_PRIVADO",
  } as NodeJS.ProcessEnv);

  const objectKey =
    `${USER_A}/private/2026/10/video.mp4`;

  const url = criarUrlAssinadaS3(
    config,
    "GET",
    objectKey,
    3600,
    new Date("2026-10-07T08:00:00Z")
  );

  assert.match(url, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
  assert.match(url, /X-Amz-Signature=/);
  assert.match(url, /X-Amz-Expires=3600/);
  assert.match(url, /study-pro-private/);
  assert.match(url, /11111111-1111-4111-8111-111111111111\/private/);
  assert.doesNotMatch(url, /SEGREDO_SUPER_PRIVADO/);
});
