import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928001500_analises_simulados_inteligentes.sql",
    import.meta.url
  ),
  "utf8"
).toLowerCase();

test("análises de simulado usam RLS e vínculo com auth.users", () => {
  assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /alter table public\.analises_simulados enable row level security/);
  assert.match(migration, /unique \(user_id, origem, tentativa_id\)/);
});

test("usuário só pode ler e escrever a própria análise", () => {
  assert.match(migration, /for select[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /for insert[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /for update[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /for delete[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/);
});

test("papel anônimo não recebe acesso à tabela de análises", () => {
  assert.match(
    migration,
    /revoke all privileges on table public\.analises_simulados from anon/
  );
  assert.match(
    migration,
    /grant select, insert, update, delete[\s\S]*to authenticated/
  );
});
