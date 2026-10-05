import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("busca fica no header global e dashboard não duplica sino/data", async () => {
  const header = await readFile("src/components/Header/Header.tsx", "utf8");
  const dashboard = await readFile("src/pages/Dashboard/Dashboard.tsx", "utf8");

  assert.match(header, /className="header-search"/);
  assert.match(header, /navigate\("\/buscar", \{ state: \{ focoBusca: true \} \}\)/);
  assert.match(header, /className="header-notification-button"/);

  assert.doesNotMatch(dashboard, /dashboard-pro-search/);
  assert.doesNotMatch(dashboard, /dashboard-pro-date/);
  assert.doesNotMatch(
    dashboard,
    /dashboard-pro-icon" aria-label="Notificações"/
  );
});

test("aviso de armazenamento some quando a nuvem confirma os dados", async () => {
  const codigo = await readFile(
    "src/components/AvisoArmazenamento/AvisoArmazenamento.tsx",
    "utf8"
  );

  assert.match(
    codigo,
    /const pendente = destino !== "local" && statusNuvem !== "sincronizado"/
  );
  assert.match(codigo, /if \(!pendente\) return null/);
  assert.match(
    codigo,
    /statusNuvem !== "sincronizado"\) return;[\s\S]*repetirGravacoesLocais\(usuarioId\)/
  );
});
