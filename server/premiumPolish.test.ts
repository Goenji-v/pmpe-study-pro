import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const header = readFileSync(
  new URL("../src/components/Header/Header.tsx", import.meta.url),
  "utf8"
);
const premium = readFileSync(
  new URL("../src/styles/premium-polish-final.css", import.meta.url),
  "utf8"
);

test("acabamento premium é carregado depois das camadas visuais existentes", () => {
  const hero = main.indexOf("./pages/Dashboard/DashboardHeroPremium.css");
  const polish = main.indexOf("./styles/premium-polish-final.css");

  assert.ok(hero >= 0);
  assert.ok(polish > hero);
});

test("topo usa ícone vetorial de notificações", () => {
  assert.match(header, /import \{ Bell \} from "lucide-react"/);
  assert.match(header, /<Bell size=\{18\}/);
  assert.doesNotMatch(header, />\s*🔔\s*</);
});

test("acabamento preserva mobile, acessibilidade e tema claro", () => {
  assert.match(premium, /@media \(max-width: 600px\)/);
  assert.match(premium, /prefers-reduced-motion: reduce/);
  assert.match(premium, /data-study-base-theme="claro"/);
  assert.match(premium, /:focus-visible/);
});

test("layout premium mantém sidebar e conteúdo alinhados no desktop", () => {
  assert.match(premium, /width: 248px !important/);
  assert.match(premium, /margin-left: 248px !important/);
  assert.match(premium, /width: min\(100%, 1540px\)/);
});
