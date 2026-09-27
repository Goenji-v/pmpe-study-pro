import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927232500_final_security_admin_hardening.sql",
    import.meta.url
  ),
  "utf8"
).toLowerCase();

test("hardening revoga privilégios que ignoram a granularidade do RLS", () => {
  assert.match(migration, /revoke truncate, references, trigger/);
  assert.match(migration, /from anon, authenticated/);
  assert.match(migration, /alter default privileges/);
});

test("superfície administrativa não fica executável por anon", () => {
  assert.match(migration, /public\.sou_admin\(\).*from public, anon/s);
  assert.match(migration, /proname like 'admin\\_%'/);
  assert.match(migration, /proname like 'moderar\\_%'/);
  assert.match(migration, /revoke execute on function/);
});

test("tabela de administradores permanece somente leitura para autenticados", () => {
  assert.match(migration, /revoke all privileges on table public\.administradores from anon/);
  assert.match(migration, /grant select on table public\.administradores to authenticated/);
});
