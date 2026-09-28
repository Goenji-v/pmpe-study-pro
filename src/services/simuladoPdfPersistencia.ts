import { armazenamentoLocalDaConta as localStorage } from "./armazenamentoConta";
import type { AnaliseSimuladoPdf } from "./simuladoPdfAnaliseService";

export type ProcessoSimuladoPdfPersistido = {
  id: string;
  nome: string;
  totalQuestoes: number;
  semana?: number;
  dia?: number;
  respostas: Record<string, string>;
  questaoAtual: number;
  segundos: number;
  pausado: boolean;
  finalizado: boolean;
  finalizarQuandoPronto: boolean;
  estadoAnalise: "analisando" | "concluida" | "erro";
  progressoAnalise: number;
  erroAnalise?: string;
  criadoEm: string;
  atualizadoEm: string;
};

type ArquivoPersistido = {
  nome: string;
  tipo: string;
  atualizadoEm: number;
  blob: Blob;
};

const CHAVE_PROCESSO = "pmpe:simulado-pdf:processo";
const BANCO = "study-pro-simulado-pdf";
const VERSAO_BANCO = 1;
const STORE = "itens";

export function carregarProcessoSimuladoPdf(): ProcessoSimuladoPdfPersistido | null {
  const bruto = localStorage.getItem(CHAVE_PROCESSO);
  if (!bruto) return null;

  try {
    const item = JSON.parse(bruto) as Partial<ProcessoSimuladoPdfPersistido>;

    if (
      typeof item.id !== "string" ||
      typeof item.nome !== "string" ||
      !Number.isInteger(item.totalQuestoes) ||
      Number(item.totalQuestoes) < 1
    ) {
      localStorage.removeItem(CHAVE_PROCESSO);
      return null;
    }

    return {
      id: item.id,
      nome: item.nome,
      totalQuestoes: Math.max(1, Math.min(200, Number(item.totalQuestoes))),
      semana: numeroOpcional(item.semana),
      dia: numeroOpcional(item.dia),
      respostas:
        item.respostas && typeof item.respostas === "object"
          ? (item.respostas as Record<string, string>)
          : {},
      questaoAtual: Math.max(1, Number(item.questaoAtual) || 1),
      segundos: Math.max(0, Math.round(Number(item.segundos) || 0)),
      pausado: item.pausado === true,
      finalizado: item.finalizado === true,
      finalizarQuandoPronto: item.finalizarQuandoPronto === true,
      estadoAnalise:
        item.estadoAnalise === "concluida" || item.estadoAnalise === "erro"
          ? item.estadoAnalise
          : "analisando",
      progressoAnalise: Math.max(
        0,
        Math.min(100, Math.round(Number(item.progressoAnalise) || 0))
      ),
      erroAnalise:
        typeof item.erroAnalise === "string" ? item.erroAnalise : undefined,
      criadoEm:
        typeof item.criadoEm === "string"
          ? item.criadoEm
          : new Date().toISOString(),
      atualizadoEm:
        typeof item.atualizadoEm === "string"
          ? item.atualizadoEm
          : new Date().toISOString(),
    };
  } catch {
    localStorage.removeItem(CHAVE_PROCESSO);
    return null;
  }
}

export function salvarProcessoSimuladoPdf(
  processo: Omit<ProcessoSimuladoPdfPersistido, "atualizadoEm">
) {
  localStorage.setItem(
    CHAVE_PROCESSO,
    JSON.stringify({
      ...processo,
      atualizadoEm: new Date().toISOString(),
    })
  );
}

export async function salvarArquivosSimuladoPdf(params: {
  processoId: string;
  caderno: File;
  comentado?: File | null;
}) {
  await gravar(
    chave(params.processoId, "caderno"),
    arquivoPersistido(params.caderno)
  );

  if (params.comentado) {
    await gravar(
      chave(params.processoId, "comentado"),
      arquivoPersistido(params.comentado)
    );
  } else {
    await remover(chave(params.processoId, "comentado"));
  }
}

export async function carregarArquivosSimuladoPdf(processoId: string) {
  const [caderno, comentado] = await Promise.all([
    ler<ArquivoPersistido>(chave(processoId, "caderno")),
    ler<ArquivoPersistido>(chave(processoId, "comentado")),
  ]);

  if (!caderno?.blob) return null;

  return {
    caderno: new File([caderno.blob], caderno.nome, {
      type: caderno.tipo || "application/pdf",
      lastModified: caderno.atualizadoEm,
    }),
    comentado: comentado?.blob
      ? new File([comentado.blob], comentado.nome, {
          type: comentado.tipo || "application/pdf",
          lastModified: comentado.atualizadoEm,
        })
      : null,
  };
}

export async function salvarAnotacoesSimuladoPdf(
  processoId: string,
  anotacoes: unknown
) {
  await gravar(chave(processoId, "anotacoes"), anotacoes);
}

export async function carregarAnotacoesSimuladoPdf<T = unknown>(
  processoId: string
) {
  return ler<T>(chave(processoId, "anotacoes"));
}

export async function salvarAnalisePersistida(
  processoId: string,
  analise: AnaliseSimuladoPdf
) {
  await gravar(chave(processoId, "analise"), analise);
}

export async function carregarAnalisePersistida(processoId: string) {
  return ler<AnaliseSimuladoPdf>(chave(processoId, "analise"));
}

export async function excluirProcessoSimuladoPdf(processoId?: string) {
  const atual = carregarProcessoSimuladoPdf();
  const id = processoId || atual?.id;

  localStorage.removeItem(CHAVE_PROCESSO);

  if (!id) return;

  await Promise.all([
    remover(chave(id, "caderno")),
    remover(chave(id, "comentado")),
    remover(chave(id, "analise")),
    remover(chave(id, "anotacoes")),
  ]);
}

function arquivoPersistido(arquivo: File): ArquivoPersistido {
  return {
    nome: arquivo.name,
    tipo: arquivo.type || "application/pdf",
    atualizadoEm: arquivo.lastModified || Date.now(),
    blob: arquivo,
  };
}

function chave(
  processoId: string,
  tipo: "caderno" | "comentado" | "analise" | "anotacoes"
) {
  return processoId + ":" + tipo;
}

function numeroOpcional(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

function abrirBanco() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const requisicao = indexedDB.open(BANCO, VERSAO_BANCO);

    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(STORE)) {
        banco.createObjectStore(STORE);
      }
    };

    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () =>
      reject(requisicao.error || new Error("Não foi possível abrir o armazenamento do simulado."));
  });
}

async function gravar(chaveItem: string, valor: unknown) {
  const banco = await abrirBanco();

  await new Promise<void>((resolve, reject) => {
    const transacao = banco.transaction(STORE, "readwrite");
    transacao.objectStore(STORE).put(valor, chaveItem);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () =>
      reject(transacao.error || new Error("Não foi possível salvar o simulado."));
  });

  banco.close();
}

async function ler<T>(chaveItem: string): Promise<T | null> {
  const banco = await abrirBanco();

  const resultado = await new Promise<T | null>((resolve, reject) => {
    const transacao = banco.transaction(STORE, "readonly");
    const requisicao = transacao.objectStore(STORE).get(chaveItem);

    requisicao.onsuccess = () =>
      resolve((requisicao.result as T | undefined) ?? null);
    requisicao.onerror = () =>
      reject(requisicao.error || new Error("Não foi possível recuperar o simulado."));
  });

  banco.close();
  return resultado;
}

async function remover(chaveItem: string) {
  const banco = await abrirBanco();

  await new Promise<void>((resolve, reject) => {
    const transacao = banco.transaction(STORE, "readwrite");
    transacao.objectStore(STORE).delete(chaveItem);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () =>
      reject(transacao.error || new Error("Não foi possível limpar o simulado."));
  });

  banco.close();
}
