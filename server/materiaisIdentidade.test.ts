import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import type { Materia } from "../src/types";
import type { MaterialEstudo } from "../src/services/materiaisService";
import { agruparMateriaisPorConteudo, materialCorrespondeAssunto, materialCorrespondeMateria, resolverAssuntoMaterial } from "../src/utils/identidadeMateriais";

const materia: Materia = {
  id: "constitucional-atual", nome: "Direito Constitucional", idsLegados: ["constitucional-legado"], assuntos: [],
  modulos: [{ id: "modulo-atual", nome: "Geral", ordem: 1, assuntos: [
    { id: "principios", idsLegados: ["principios-antigo"], referenciasEdital: ["principios-edital"], nome: "Dos princípios fundamentais", concluido: false, prioridade: "media" },
    { id: "direitos", nome: "Direitos fundamentais", concluido: false, prioridade: "media" },
  ] }],
};
const referencia = {
  materia: materia.nome, materiaId: materia.id, idsLegadosMateria: materia.idsLegados,
  modulo: "Geral", moduloId: "modulo-atual", assunto: "Dos princípios fundamentais", assuntoId: "principios",
  idsLegadosAssunto: ["principios-antigo", "principios-edital"],
};

function pdf(id: string, extra: Partial<MaterialEstudo> = {}): MaterialEstudo {
  return { id, nome: `PDF ${id}`, materia: "Constitucional", modulo: "Geral", assunto: "Dos princípios fundamentais", tipo: "arquivo", observacao: "", criadoEm: "2026-10-20T12:00:00Z", mimeType: "application/pdf", ...extra };
}

test("materiais legados continuam no filtro e no grupo da matéria atual", () => {
  const antigo = pdf("antigo");
  const atual = pdf("atual", { materia: materia.nome, materiaId: materia.id, moduloId: "modulo-atual", assuntoId: "principios" });
  assert.equal(materialCorrespondeMateria(antigo, referencia), true);
  assert.equal(materialCorrespondeAssunto(antigo, referencia), true);
  const grupos = agruparMateriaisPorConteudo([antigo, atual], [materia]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].nome, "Direito Constitucional");
  assert.equal(grupos[0].modulos.length, 1);
  assert.deepEqual(grupos[0].modulos[0].assuntos[0].materiais.map((item) => item.id), ["antigo", "atual"]);
  assert.equal(antigo.materia, "Constitucional", "compatibilidade não reescreve dados legados");
});

test("IDs atuais e legados preservam materiais mesmo após renomear ou mover o assunto", () => {
  for (const assuntoId of ["principios", "principios-antigo", "principios-edital"]) {
    assert.equal(materialCorrespondeAssunto(pdf(assuntoId, {
      materia: "Nome anterior", materiaId: "constitucional-legado", modulo: "Módulo anterior", moduloId: "modulo-antigo", assunto: "Nome anterior do assunto", assuntoId,
    }), referencia), true);
  }
});

test("compatibilidade não mistura matérias, IDs de assunto nem assuntos parecidos", () => {
  assert.equal(materialCorrespondeAssunto(pdf("outra-materia", { materiaId: "outra-materia" }), referencia), false);
  assert.equal(materialCorrespondeAssunto(pdf("outro-id", { assuntoId: "outro-assunto" }), referencia), false);
  assert.equal(materialCorrespondeAssunto(pdf("parecido", { assunto: "Dos direitos fundamentais" }), referencia), false);
  assert.equal(materialCorrespondeAssunto(pdf("outro-modulo", { modulo: "Outro módulo" }), referencia), false);
  assert.equal(materialCorrespondeMateria({ materia: "Direito Penal Militar" }, { materia: "Direito Penal" }), false);
});

test("grupos mantêm assuntos homônimos com identidades diferentes separados", () => {
  const grupos = agruparMateriaisPorConteudo([
    pdf("um", { assuntoId: "homonimo-1" }),
    pdf("dois", { assuntoId: "homonimo-2" }),
  ], [materia]);
  assert.equal(grupos[0].modulos[0].assuntos.length, 2);
});

test("cadastro por ID preserva o segundo assunto homônimo e não adivinha o ID pelo nome", () => {
  const primeiro = materia.modulos![0].assuntos[0];
  const segundo = { ...primeiro, id: "segundo-principios" };
  const assuntos = [primeiro, segundo];
  assert.equal(resolverAssuntoMaterial(assuntos, segundo.id).assunto?.id, "segundo-principios");
  assert.equal(resolverAssuntoMaterial(assuntos, primeiro.nome).ambiguo, true);
  assert.equal(resolverAssuntoMaterial(assuntos, primeiro.nome).assunto, undefined);
  assert.equal(resolverAssuntoMaterial([primeiro], primeiro.nome).assunto?.id, primeiro.id);
  assert.deepEqual(resolverAssuntoMaterial(assuntos, "Assunto novo"), { assunto: undefined, ambiguo: false });
});

test("material legado sem ID não é vinculado a dois assuntos homônimos do catálogo", () => {
  const catalogo: Materia = {
    ...materia,
    modulos: [
      materia.modulos![0],
      { ...materia.modulos![0], id: "outro-modulo", assuntos: [{ ...materia.modulos![0].assuntos[0], id: "outro-principios", idsLegados: [], referenciasEdital: [] }] },
    ],
  };
  assert.equal(materialCorrespondeAssunto(pdf("ambiguo"), { ...referencia, materiaCatalogo: catalogo }), false);
  assert.equal(materialCorrespondeAssunto(pdf("com-id", { assuntoId: "principios" }), { ...referencia, materiaCatalogo: catalogo }), true);
});

test("consulta de materiais usa apenas o usuário e filtra aliases/IDs sem gravar nem migrar", async () => {
  const registros = [
    pdf("legado"),
    pdf("renomeado", { materia: "Nome anterior", materiaId: "constitucional-legado", assuntoId: "principios-antigo", assunto: "Nome antigo" }),
    pdf("outro-assunto", { assunto: "Direitos fundamentais", assuntoId: "direitos" }),
    pdf("outra-materia", { materia: "Direito Penal" }),
  ];
  const filtros: Array<[string, string]> = [];
  const paginas: Array<[number, number]> = [];
  const query = {
    select() { return query; },
    eq(campo: string, valor: string) { filtros.push([campo, valor]); return query; },
    order() { return query; },
    range(inicio: number, fim: number) { paginas.push([inicio, fim]); return Promise.resolve({ error: null, data: registros.filter((item) => filtros.every(([campo, valor]) => campo === "user_id" || item[campo as keyof MaterialEstudo] === valor)).slice(inicio, fim + 1).map((item) => ({
      id: item.id, nome: item.nome, materia: item.materia, assunto: item.assunto, tipo: item.tipo,
      observacao: "", created_at: item.criadoEm, dados: { materiaId: item.materiaId, assuntoId: item.assuntoId, moduloId: item.moduloId, modulo: item.modulo },
    })) }); },
  };
  const globals = globalThis as typeof globalThis & { __materiaisIdentidade?: unknown };
  globals.__materiaisIdentidade = {
    auth: { getUser: async () => ({ data: { user: { id: "aluno-sintetico" } }, error: null }) },
    from(tabela: string) { assert.equal(tabela, "materiais"); return query; },
  };
  try {
    const bundle = await build({
      stdin: { contents: 'export { listarMateriais, listarMateriaisPorAssunto } from "./src/services/materiaisService";', resolveDir: process.cwd(), loader: "ts" },
      bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
      plugins: [{ name: "supabase-em-memoria", setup(builder) {
        builder.onLoad({ filter: /\/src\/lib\/supabase\.ts$/ }, () => ({ contents: "export const supabase = globalThis.__materiaisIdentidade;", loader: "ts" }));
        builder.onLoad({ filter: /\/src\/services\/armazenamentoConta\.ts$/ }, () => ({ contents: "export const permiteMigracaoLegada = () => false; export const armazenamentoLocalDaConta = {};", loader: "ts" }));
      } }],
    });
    const modulo = { exports: {} as { listarMateriais: () => Promise<MaterialEstudo[]>; listarMateriaisPorAssunto: (materia: string, assunto: string, modulo: string, identidade?: typeof referencia) => Promise<MaterialEstudo[]> } };
    runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
    const lista = await modulo.exports.listarMateriaisPorAssunto(materia.nome, referencia.assunto, "Geral", referencia);
    assert.deepEqual(lista.map((item) => item.id), ["legado", "renomeado"]);
    assert.deepEqual(filtros, [["user_id", "aluno-sintetico"]]);
    filtros.length = 0;
    const antigaAssinatura = await modulo.exports.listarMateriaisPorAssunto(materia.nome, referencia.assunto, "Geral");
    assert.deepEqual(antigaAssinatura.map((item) => item.id), ["legado"]);
    registros.unshift(...Array.from({ length: 1000 }, (_, indice) => pdf(`penal-${indice}`, { materia: "Penal" })));
    paginas.length = 0;
    filtros.length = 0;
    const antigaPagina = await modulo.exports.listarMateriaisPorAssunto(materia.nome, referencia.assunto, "Geral", referencia);
    assert.deepEqual(antigaPagina.map((item) => item.id), ["legado", "renomeado"]);
    assert.deepEqual(paginas, [[0, 999], [1000, 1999]]);
    paginas.length = 0;
    filtros.length = 0;
    const biblioteca = await modulo.exports.listarMateriais();
    assert.equal(biblioteca.length, 1004, "CentroMateriais recebe também os materiais além da primeira página");
    assert.deepEqual(paginas, [[0, 999], [1000, 1999]]);
    const constitucional = agruparMateriaisPorConteudo(biblioteca, [materia]).find((grupo) => grupo.chave === materia.id);
    assert.equal(constitucional?.modulos.flatMap((modulo) => modulo.assuntos.flatMap((assunto) => assunto.materiais)).some((material) => material.id === "legado"), true);
  } finally {
    delete globals.__materiaisIdentidade;
  }
});

test("CentroMateriais mantém o PDF antigo visível ao filtrar pelo nome atual", async () => {
  const globals = globalThis as Record<string, any>;
  const restaurar = new Map(["window", "document", "IS_REACT_ACT_ENVIRONMENT", "fetch"].map((chave) => [chave, Object.getOwnPropertyDescriptor(globals, chave)]));
  const fixture = {
    materias: [materia],
    materiais: [pdf("antigo"), pdf("atual", { materia: materia.nome, materiaId: materia.id }), pdf("penal", { materia: "Direito Penal" })],
    prefill: JSON.stringify({ materia: materia.nome }),
  };
  globals.__centroMateriaisTeste = fixture;
  const bundle = await build({
    stdin: { contents: 'export { default } from "./src/pages/CentroMateriais/CentroMateriais";', resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "centro-sem-rede", setup(builder) {
      builder.onLoad({ filter: /\/src\/context\/AppContext\.tsx$/ }, () => ({ contents: "export const useApp = () => globalThis.__centroMateriaisTeste;", loader: "ts" }));
      builder.onLoad({ filter: /\/src\/services\/materiaisService\.ts$/ }, () => ({ contents: `
        export const listarMateriais = async () => globalThis.__centroMateriaisTeste.materiais;
        export const abrirMaterial = () => { throw new Error('Operação inesperada'); };
        export const baixarMaterial = abrirMaterial, excluirMaterial = abrirMaterial, salvarArquivoMaterial = abrirMaterial, salvarLinkMaterial = abrirMaterial;
      `, loader: "ts" }));
      builder.onLoad({ filter: /\/src\/services\/armazenamentoConta\.ts$/ }, () => ({ contents: `
        export const armazenamentoSessaoDaConta = {
          getItem: () => globalThis.__centroMateriaisTeste.prefill,
          removeItem: () => { globalThis.__centroMateriaisTeste.prefill = null; }
        };
      `, loader: "ts" }));
    } }],
  });
  const modulo = { exports: {} as { default: () => any } };
  runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
  const { window, document } = parseHTML('<html><body><main id="root"></main></body></html>');
  Object.assign(globals, { window, document, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => { throw new Error("Teste não pode acessar serviços externos"); } });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => { root.render(createElement(modulo.exports.default)); });
    assert.deepEqual([...document.querySelectorAll(".materiais-materia h2")].map((item) => item.textContent), ["📘 Direito Constitucional"]);
    assert.deepEqual([...document.querySelectorAll(".material-card strong")].map((item) => item.textContent), ["PDF antigo", "PDF atual"]);
    assert.equal(fixture.materiais[0].materia, "Constitucional");
  } finally {
    await act(async () => root.unmount());
    for (const [chave, descricao] of restaurar) {
      if (descricao) Object.defineProperty(globals, chave, descricao);
      else Reflect.deleteProperty(globals, chave);
    }
    Reflect.deleteProperty(globals, "__centroMateriaisTeste");
  }
});

test("MateriaisDoAssunto não repete consultas por arrays equivalentes nem exibe resposta do assunto anterior", async () => {
  const globals = globalThis as Record<string, any>;
  const restaurar = new Map(["window", "document", "IS_REACT_ACT_ENVIRONMENT", "fetch"].map((chave) => [chave, Object.getOwnPropertyDescriptor(globals, chave)]));
  const consultas: Array<{ assunto: string; resolver: (materiais: MaterialEstudo[]) => void }> = [];
  globals.__materiaisAssuntoTeste = {
    consultar(_materia: string, assunto: string) {
      return new Promise<MaterialEstudo[]>((resolver) => consultas.push({ assunto, resolver }));
    },
  };
  const bundle = await build({
    stdin: { contents: 'export { default } from "./src/components/MateriaisDoAssunto/MateriaisDoAssunto";', resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "materiais-do-assunto-sem-rede", setup(builder) {
      builder.onLoad({ filter: /\/src\/services\/materiaisService\.ts$/ }, () => ({ contents: `
        export const listarMateriaisPorAssunto = (...args) => globalThis.__materiaisAssuntoTeste.consultar(...args);
        export const abrirMaterial = () => { throw new Error('Operação inesperada'); };
      `, loader: "ts" }));
    } }],
  });
  const modulo = { exports: {} as { default: (props: any) => any } };
  runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
  const { window, document } = parseHTML('<html><body><main id="root"></main></body></html>');
  Object.assign(globals, { window, document, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => { throw new Error("Teste não pode acessar serviços externos"); } });
  const root = createRoot(document.getElementById("root")!);
  async function render(assunto: string) {
    await act(async () => root.render(createElement(modulo.exports.default, {
      materia: materia.nome, assunto, idsLegadosMateria: ["materia-antiga"], idsLegadosAssunto: ["assunto-antigo"],
    })));
  }
  try {
    await render("Princípios");
    await render("Princípios");
    assert.equal(consultas.length, 1, "arrays com conteúdo igual não disparam nova consulta");
    await render("Direitos fundamentais");
    assert.deepEqual(consultas.map((item) => item.assunto), ["Princípios", "Direitos fundamentais"]);
    await act(async () => consultas[1].resolver([pdf("novo")]));
    assert.equal(document.querySelector(".materiais-assunto-info strong")?.textContent, "PDF novo");
    await act(async () => consultas[0].resolver([pdf("antigo")]));
    assert.equal(document.querySelector(".materiais-assunto-info strong")?.textContent, "PDF novo");
  } finally {
    await act(async () => root.unmount());
    for (const [chave, descricao] of restaurar) {
      if (descricao) Object.defineProperty(globals, chave, descricao);
      else Reflect.deleteProperty(globals, chave);
    }
    Reflect.deleteProperty(globals, "__materiaisAssuntoTeste");
  }
});
