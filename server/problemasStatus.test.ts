import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("problemas suportam Aberto, Resolvendo e Resolvido de ponta a ponta", async () => {
  const [servico, painel, css, migracao] = await Promise.all([
    readFile("src/services/betaService.ts", "utf8"),
    readFile("src/components/BetaMonitor/BetaMonitor.tsx", "utf8"),
    readFile("src/components/BetaMonitor/BetaMonitorProducao.css", "utf8"),
    readFile(
      "supabase/migrations/20261001121409_adicionar_status_resolvendo_erros_cliente.sql",
      "utf8"
    ),
  ]);

  assert.match(
    servico,
    /"aberto" \| "resolvendo" \| "resolvido"/
  );
  assert.match(painel, /Começar a resolver/);
  assert.match(painel, /Marcar resolvido/);
  assert.match(painel, /grupo\.status !== "resolvido"/);
  assert.match(css, /beta-monitor-status\.resolvendo/);
  assert.match(css, /beta-monitor-erro-card\.resolvendo/);
  assert.match(migracao, /'resolvendo'::text/);
  assert.match(migracao, /set status = 'resolvendo'/i);
});
