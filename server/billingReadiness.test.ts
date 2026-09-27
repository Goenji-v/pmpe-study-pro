import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927234500_billing_provider_neutral_base.sql",
    import.meta.url
  ),
  "utf8"
).toLowerCase();

const denyMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260927235000_billing_events_explicit_deny.sql",
    import.meta.url
  ),
  "utf8"
).toLowerCase();

const recursos = readFileSync(
  new URL("../src/config/recursos.ts", import.meta.url),
  "utf8"
);

test("pagamentos ficam desativados enquanto não há provedor configurado", () => {
  assert.match(recursos, /export const PAGAMENTOS_ATIVOS = false/);
});

test("assinaturas e pagamentos só permitem leitura do próprio usuário", () => {
  assert.match(migration, /alter table public\.assinaturas_usuario enable row level security/);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger[\s\S]*from authenticated/);
  assert.match(migration, /grant select on table public\.assinaturas_usuario to authenticated/);
  assert.match(migration, /grant select on table public\.pagamentos_usuario to authenticated/);
});

test("eventos de webhook não ficam expostos ao cliente", () => {
  assert.match(
    migration,
    /revoke all privileges on table public\.eventos_pagamento from anon, authenticated/
  );
  assert.match(migration, /unique \(provedor, provedor_evento_id\)/);
  assert.match(denyMigration, /create policy eventos_pagamento_bloqueio_cliente/);
  assert.match(denyMigration, /to anon, authenticated/);
  assert.match(denyMigration, /using \(false\)/);
  assert.match(denyMigration, /with check \(false\)/);
});
