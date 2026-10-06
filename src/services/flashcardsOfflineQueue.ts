import type { AvaliacaoSRS } from "../utils/repeticaoEspacada";
import type { ModoEstudoFlashcard } from "../types/flashcards";

export type RespostaFlashcardPendente = {
  id: string;
  userId: string;
  questaoId: string;
  materia: string;
  topico: string;
  modalidade: ModoEstudoFlashcard;
  avaliacao: AvaliacaoSRS;
  criadaEm: string;
};

const NOME_BANCO = "study-pro-offline";
const VERSAO_BANCO = 1;
const STORE_FLASHCARDS = "flashcards_respostas";

export async function enfileirarRespostaFlashcardOffline(
  item: Omit<RespostaFlashcardPendente, "id" | "criadaEm">
) {
  const registro: RespostaFlashcardPendente = {
    ...item,
    id: crypto.randomUUID(),
    criadaEm: new Date().toISOString(),
  };

  const banco = await abrirBanco();
  await executarTransacao(banco, "readwrite", (store) => store.add(registro));
  return registro;
}

export async function listarRespostasFlashcardOffline(userId: string) {
  const banco = await abrirBanco();
  const todos = await executarTransacao<RespostaFlashcardPendente[]>(
    banco,
    "readonly",
    (store) => store.getAll()
  );
  return todos
    .filter((item) => item.userId === userId)
    .sort((a, b) => Date.parse(a.criadaEm) - Date.parse(b.criadaEm));
}

export async function removerRespostaFlashcardOffline(id: string) {
  const banco = await abrirBanco();
  await executarTransacao(banco, "readwrite", (store) => store.delete(id));
}

export async function contarRespostasFlashcardOffline(userId: string) {
  const itens = await listarRespostasFlashcardOffline(userId);
  return itens.length;
}

function abrirBanco() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB não está disponível neste navegador."));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const requisicao = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(STORE_FLASHCARDS)) {
        banco.createObjectStore(STORE_FLASHCARDS, { keyPath: "id" });
      }
    };

    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () =>
      reject(requisicao.error ?? new Error("Não foi possível abrir o armazenamento offline."));
  });
}

function executarTransacao<T = void>(
  banco: IDBDatabase,
  modo: IDBTransactionMode,
  executar: (store: IDBObjectStore) => IDBRequest
) {
  return new Promise<T>((resolve, reject) => {
    const transacao = banco.transaction(STORE_FLASHCARDS, modo);
    const requisicao = executar(transacao);

    requisicao.onsuccess = () => resolve(requisicao.result as T);
    requisicao.onerror = () =>
      reject(requisicao.error ?? new Error("Falha no armazenamento offline."));
    transacao.oncomplete = () => banco.close();
    transacao.onerror = () => {
      banco.close();
      reject(transacao.error ?? new Error("Falha na transação offline."));
    };
  });
}
