import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  atualizarJobGeracaoIAComPosse,
  ErroPosseJobPerdida,
  type ContextoSupabaseJob,
} from "./geracaoPersistente.ts";
import { validarPayloadGeracaoIA } from "./payloadGeracaoIA.ts";
import { normalizarRespostaAnaliseEdital } from "./editalInteligente.ts";
import { executarComToleranciaDeFalhas } from "../src/utils/tolerarFalhasConsulta.ts";

const contexto: ContextoSupabaseJob = {
  supabaseUrl: "https://exemplo.supabase.co",
  userId: "usuario-1",
  authorization: "Bearer teste",
  anonKey: "anon-teste",
};

async function comFetchSimulado<T>(
  resposta: () => Response,
  executar: () => Promise<T>
) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => resposta()) as typeof fetch;
  try {
    return await executar();
  } finally {
    globalThis.fetch = original;
  }
}

test("payload: assunto vazio é rejeitado e os limites continuam os mesmos", () => {
  assert.throws(() => validarPayloadGeracaoIA({ assunto: "   " }), /assunto da geração está vazio/);
  const ok = validarPayloadGeracaoIA({ assunto: " Crase ", quantidade: 999, banca: " ", enunciadosEvitar: ["  a  ", 3, ""] });
  assert.equal(ok.assunto, "Crase");
  assert.equal(ok.quantidade, 60);
  assert.equal(ok.banca, "");
  assert.deepEqual(ok.enunciadosEvitar, ["a"]);
  assert.equal(validarPayloadGeracaoIA({ assunto: "x" }).quantidade, 5);
  assert.equal(validarPayloadGeracaoIA({ assunto: "x" }).banca, "AOCP");
});

test("processamento: payload fica dentro do try e salvamento fora da validação", async () => {
  const codigo = await readFile(new URL("./processarGeracaoPersistente.ts", import.meta.url), "utf8");
  const inicio = codigo.indexOf("async function processarJobGeracaoIA(");
  const corpo = codigo.slice(inicio);
  const posTry = corpo.indexOf("try {");
  const posPayload = corpo.indexOf("validarPayloadGeracaoIA(job.payload)");
  assert.ok(posTry >= 0 && posPayload > posTry);
  const posValidar = corpo.indexOf("validarLoteRevisado(");
  const fimCatchInterno = corpo.indexOf("continue;", posValidar);
  const trechoInterno = corpo.slice(posValidar, fimCatchInterno);
  assert.doesNotMatch(trechoInterno, /atualizar\(|atualizarJobGeracaoIA/);
  assert.match(corpo, /ErroPosseJobPerdida/);
  assert.equal((corpo.match(/atualizarJobGeracaoIAComPosse\(/g) ?? []).length >= 2, true);
});

test("posse: atualização vazia lança ErroPosseJobPerdida", async () => {
  await comFetchSimulado(
    () => new Response("[]", { status: 200 }),
    async () => {
      await assert.rejects(
        () => atualizarJobGeracaoIAComPosse(contexto, "job-1", { progresso: 50 }, "execucao-velha"),
        (erro: unknown) => erro instanceof ErroPosseJobPerdida && erro.jobId === "job-1"
      );
    }
  );
});

test("posse: linha atualizada devolve o job", async () => {
  await comFetchSimulado(
    () => new Response(JSON.stringify([{ id: "job-1", progresso: 50 }]), { status: 200 }),
    async () => {
      const job = await atualizarJobGeracaoIAComPosse(contexto, "job-1", { progresso: 50 }, "execucao-atual");
      assert.equal(job.id, "job-1");
    }
  );
});

test("consulta tolerante absorve falhas passageiras", async () => {
  let chamadas = 0;
  const esperas: number[] = [];
  const resultado = await executarComToleranciaDeFalhas(
    async () => {
      chamadas += 1;
      if (chamadas < 3) throw new TypeError("Failed to fetch");
      return "ok";
    },
    { esperar: async (ms) => { esperas.push(ms); } }
  );
  assert.equal(resultado, "ok");
  assert.equal(chamadas, 3);
  assert.deepEqual(esperas, [2000, 4000]);
});

test("edital: matéria repetida é juntada sem perder assuntos", () => {
  const analise = normalizarRespostaAnaliseEdital({
    materias: [
      { nome: "Língua Portuguesa", incidenciaEstimada: 4, assuntos: [{ nome: "Crase" }] },
      { nome: "  língua portuguesa ", incidenciaEstimada: 5, assuntos: [{ nome: "Concordância" }, { nome: "Regência" }, { nome: "crase" }] },
      { nome: "Informática", assuntos: [{ nome: "Segurança" }] },
    ],
  });
  assert.equal(analise.materias.length, 2);
  const portugues = analise.materias[0];
  assert.equal(portugues.nome, "Língua Portuguesa");
  assert.deepEqual(portugues.assuntos.map((a) => a.nome), ["Crase", "Concordância", "Regência"]);
  assert.equal(portugues.incidenciaEstimada, 5);
});
