import test from "node:test";
import assert from "node:assert/strict";
import { urlSegura } from "../src/utils/urlSegura.ts";

test("urlSegura aceita http e https", () => {
  assert.equal(urlSegura("https://exemplo.com/aula"), "https://exemplo.com/aula");
  assert.equal(urlSegura("  http://exemplo.com  "), "http://exemplo.com/");
  assert.equal(urlSegura("/aula/1", "https://exemplo.com/curso/"), "https://exemplo.com/aula/1");
});

test("urlSegura bloqueia esquemas perigosos", () => {
  for (const ruim of ["javascript:alert(1)", "JavaScript:alert(1)", " \tjavascript:alert(1)", "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "https://user:pass@exemplo.com", "", "nada"]) {
    assert.equal(urlSegura(ruim), undefined, ruim);
  }
  assert.equal(urlSegura("javascript:alert(1)", "https://exemplo.com"), undefined);
  assert.equal(urlSegura(undefined), undefined);
});
