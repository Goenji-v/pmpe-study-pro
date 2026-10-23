import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sidebar = readFileSync("src/components/Sidebar/Sidebar.tsx", "utf8");
const css = readFileSync("src/components/Sidebar/Sidebar.css", "utf8");
const profile = readFileSync("src/components/UserProfileMenu/UserProfileMenu.tsx", "utf8");
const mobile = readFileSync("e2e/mobile-navigation.spec.ts", "utf8");

test("menu mobile tem região rolável própria, mantendo body travado e rodapé", () => {
  assert.match(css, /body\.menu-mobile-aberto\s*\{\s*overflow: hidden/);
  assert.match(css, /\.sidebar\.sidebar-mobile-aberta \.sidebar-menu\s*\{/);
  assert.match(css, /\.sidebar\.sidebar-mobile-aberta \.sidebar-menu\s*\{[^}]*min-height: 0/);
  assert.match(css, /\.sidebar\.sidebar-mobile-aberta \.sidebar-menu\s*\{[^}]*overflow-y: auto !important/);
  assert.match(css, /\.sidebar\.sidebar-mobile-aberta \.sidebar-menu > \*\s*\{[^}]*flex: 0 0 auto/);
  assert.match(css, /\.sidebar\.sidebar-mobile-aberta \.sidebar-rodape-acoes\s*\{[^}]*flex: 0 0 auto/);
  assert.match(css, /\.sidebar\.sidebar-mobile-aberta \.sidebar-logo\s*\{[^}]*flex: 0 0 auto/);
  assert.match(sidebar, /aria-controls="sidebar-principal"/);
  assert.match(sidebar, /titulo="Prática"/);
  assert.match(sidebar, /texto="Simulados"/);
});

test("navegação testa rolagem real do drawer e fechamento com Escape", () => {
  assert.match(mobile, /toHaveCSS\("overflow-y", "auto"\)/);
  assert.match(mobile, /botaoGrupo\.scrollIntoViewIfNeeded\(\)/);
  assert.match(mobile, /toBeInViewport\(\)/);
  assert.match(mobile, /page\.keyboard\.press\("Escape"\)/);
  assert.match(mobile, /not\.toHaveClass\(\/menu-mobile-aberto\/\)/);
});

test("menu do perfil fecha antes da nova rota e mantém abertura explícita", () => {
  assert.match(profile, /useLayoutEffect\(\(\) => \{\s*setAberto\(false\);/);
  assert.match(profile, /\[location\.pathname\]/);
  assert.match(profile, /className="user-profile-dropdown" role="menu"/);
  assert.match(mobile, /toHaveAttribute\("aria-expanded", "true"\)/);
});
