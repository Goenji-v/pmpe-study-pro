import assert from "node:assert/strict";
import test from "node:test";
import {
  envelopePertenceAoDsn,
  interpretarDsnSentry,
  origemPermitidaNoTunnel,
} from "./sentryTunnel.ts";

const DSN =
  "https://abc123@o123.ingest.us.sentry.io/456789";

test("interpreta DSN do Sentry para encaminhamento seguro", () => {
  assert.deepEqual(interpretarDsnSentry(DSN), {
    host: "o123.ingest.us.sentry.io",
    publicKey: "abc123",
    projectId: "456789",
  });
});

test("aceita somente envelopes do projeto configurado", () => {
  const valido = Buffer.from(
    JSON.stringify({ dsn: DSN }) + "\n" + JSON.stringify({ type: "event" })
  );
  const outroProjeto = Buffer.from(
    JSON.stringify({
      dsn: "https://abc123@o123.ingest.us.sentry.io/999999",
    }) + "\n"
  );

  assert.equal(envelopePertenceAoDsn(valido, DSN), true);
  assert.equal(envelopePertenceAoDsn(outroProjeto, DSN), false);
});

test("rejeita envelope inválido e origem externa", () => {
  assert.equal(envelopePertenceAoDsn(Buffer.from("invalido"), DSN), false);
  assert.equal(
    origemPermitidaNoTunnel("https://pmpe-study-pro-two.vercel.app"),
    true
  );
  assert.equal(
    origemPermitidaNoTunnel(
      "https://pmpe-study-abc123-pmpe-study-pro.vercel.app"
    ),
    true
  );
  assert.equal(origemPermitidaNoTunnel("https://site-externo.com"), false);
});
