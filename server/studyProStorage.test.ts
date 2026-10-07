import assert from "node:assert/strict";
import test from "node:test";

import {
  chavePertenceAoUsuario,
  criarChavePrivada,
  obterConfiguracaoStudyStorage,
  validarPedidoUpload,
} from "./studyProStorage.ts";

const USER_A =
  "11111111-1111-4111-8111-111111111111";
const USER_B =
  "22222222-2222-4222-8222-222222222222";

test(
  "Study Pro Storage fica desativado sem Worker configurado",
  () => {
    const config =
      obterConfiguracaoStudyStorage(
        {} as NodeJS.ProcessEnv
      );

    assert.equal(
      config.configured,
      false
    );
    assert.equal(
      config.provider,
      "cloudflare-worker-r2"
    );
    assert.equal(
      config.maxFileBytes,
      5 * 1024 * 1024 * 1024
    );
    assert.equal(
      config.chunkSizeBytes,
      32 * 1024 * 1024
    );
  }
);

test(
  "validação aceita vídeo de 3 GB e rejeita arquivo acima de 5 GiB",
  () => {
    const config =
      obterConfiguracaoStudyStorage(
        {} as NodeJS.ProcessEnv
      );

    const video =
      validarPedidoUpload(
        {
          fileName:
            "live-direitos-humanos.mp4",
          mimeType:
            "video/mp4",
          sizeBytes:
            3 *
            1024 *
            1024 *
            1024,
        },
        config
      );

    assert.equal(
      video.kind,
      "video"
    );

    assert.throws(
      () =>
        validarPedidoUpload(
          {
            fileName:
              "gigante.mp4",
            mimeType:
              "video/mp4",
            sizeBytes:
              5 *
                1024 *
                1024 *
                1024 +
              1,
          },
          config
        ),
      /ultrapassa o limite/i
    );
  }
);

test(
  "validação bloqueia formatos fora da lista segura",
  () => {
    const config =
      obterConfiguracaoStudyStorage(
        {} as NodeJS.ProcessEnv
      );

    assert.throws(
      () =>
        validarPedidoUpload(
          {
            fileName:
              "programa.exe",
            mimeType:
              "application/x-msdownload",
            sizeBytes: 1024,
          },
          config
        ),
      /formato não permitido/i
    );
  }
);

test(
  "chave privada pertence apenas ao UUID do dono",
  () => {
    const chave =
      criarChavePrivada(
        USER_A,
        "Minha Live 01.mp4",
        new Date(
          "2026-10-07T08:00:00Z"
        )
      );

    assert.match(
      chave,
      /^11111111-1111-4111-8111-111111111111\/private\/2026\/10\//
    );
    assert.equal(
      chavePertenceAoUsuario(
        USER_A,
        chave
      ),
      true
    );
    assert.equal(
      chavePertenceAoUsuario(
        USER_B,
        chave
      ),
      false
    );
    assert.doesNotMatch(
      chave,
      /Minha Live/
    );
  }
);
