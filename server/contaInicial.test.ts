import assert from "node:assert/strict";
import test from "node:test";
import { criarConfiguracoesIniciais, criarDadosIniciaisDaConta, houveReinicioDaConta, usaPlanoPadrao } from "../src/utils/contaInicial";
import { criarPlanoCalendario } from "../src/utils/planoCalendario";
import { armazenamentoLocalDaConta, armazenamentoSessaoDaConta, criarEscopoArmazenamento, definirEscopoArmazenamento, permiteMigracaoLegada } from "../src/services/armazenamentoConta";

test("conta nova não ganha assuntos, plano, curso, histórico ou nome de outra pessoa", () => {
  const estado = criarDadosIniciaisDaConta("  Maria  ");
  for (const [campo, valor] of Object.entries(estado)) if (campo !== "configuracoes") assert.deepEqual(valor, []);
  assert.equal(estado.configuracoes.nomeUsuario, "Maria");
  assert.equal(criarConfiguracoesIniciais().nomeUsuario, "");
  assert.equal(estado.configuracoes.concurso, "");
  assert.equal(estado.configuracoes.bancaPadrao, "");
  assert.equal(usaPlanoPadrao(estado.configuracoes), false);
  assert.deepEqual(criarPlanoCalendario(1, usaPlanoPadrao(estado.configuracoes)), []);
});

test("modelo só é habilitado por escolha explícita; contas antigas mantêm seu plano", () => {
  assert.ok(criarPlanoCalendario(1, usaPlanoPadrao({})).length > 0);
  assert.ok(criarPlanoCalendario(1, usaPlanoPadrao({ planoPadraoAtivo: true })).length > 0);
  assert.deepEqual(criarPlanoCalendario(6, false), []);
});

test("reinício remoto vence cópia antiga, mas não confunde conflito normal com limpeza", () => {
  const remoto = { dadosReiniciadosEm: "2026-09-03T18:00:00Z" };
  assert.equal(houveReinicioDaConta({}, remoto), true);
  assert.equal(houveReinicioDaConta(remoto, remoto), false);
  assert.equal(houveReinicioDaConta(remoto, {}), false);
  assert.equal(houveReinicioDaConta({}, { dadosReiniciadosEm: "inválido" }), false);
  assert.equal(houveReinicioDaConta({}, {}), false);
});

test("cadernos, rascunhos e sessões novos ficam isolados por conta e por reinício", () => {
  function storage() {
    const dados = new Map<string, string>();
    return { getItem: (key: string) => dados.get(key) ?? null, setItem: (key: string, value: string) => { dados.set(key, value); }, removeItem: (key: string) => { dados.delete(key); } };
  }
  const local = storage();
  const sessao = storage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: local, sessionStorage: sessao } });
  local.setItem("caderno", "legado preservado");
  const config = criarConfiguracoesIniciais();
  try {
    definirEscopoArmazenamento(criarEscopoArmazenamento("a", config));
    assert.equal(permiteMigracaoLegada(), false);
    assert.equal(armazenamentoLocalDaConta.getItem("caderno"), null);
    armazenamentoLocalDaConta.setItem("caderno", "dados A");
    armazenamentoSessaoDaConta.setItem("rascunho", "sessão A");
    definirEscopoArmazenamento(criarEscopoArmazenamento("b", config));
    assert.equal(armazenamentoLocalDaConta.getItem("caderno"), null);
    assert.equal(armazenamentoSessaoDaConta.getItem("rascunho"), null);
    armazenamentoLocalDaConta.setItem("caderno", "dados B");
    definirEscopoArmazenamento(criarEscopoArmazenamento("a", { ...config, dadosReiniciadosEm: "2026-09-03T18:00:00Z" }));
    assert.equal(armazenamentoLocalDaConta.getItem("caderno"), null);
    assert.equal(armazenamentoSessaoDaConta.getItem("rascunho"), null);
    armazenamentoLocalDaConta.setItem("caderno", "novo");
    armazenamentoLocalDaConta.removeItem("caderno");
    assert.equal(armazenamentoLocalDaConta.getItem("caderno"), null);
    definirEscopoArmazenamento(criarEscopoArmazenamento("b", config));
    assert.equal(armazenamentoLocalDaConta.getItem("caderno"), "dados B");
    definirEscopoArmazenamento(criarEscopoArmazenamento("antiga", {}));
    assert.equal(armazenamentoLocalDaConta.getItem("caderno"), "legado preservado");
    assert.equal(permiteMigracaoLegada(), true);
  } finally {
    definirEscopoArmazenamento(null);
    Reflect.deleteProperty(globalThis, "window");
  }
});
