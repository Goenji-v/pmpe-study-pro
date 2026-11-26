import { chaveEscopoFsrs, decidirGravacao, type TransporteFsrs, type RegistroFsrs } from "./checkpoint";

export const nomeBancoFsrs = "estude-pro-fsrs-local";
const store = "checkpoints";
export const filaFsrsStore = "sync";

function abrir() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const pedido = indexedDB.open(nomeBancoFsrs, 2);
    pedido.onupgradeneeded = () => {
      for (const nome of [store, filaFsrsStore]) {
        if (!pedido.result.objectStoreNames.contains(nome)) pedido.result.createObjectStore(nome);
      }
    };
    pedido.onblocked = () => reject(new Error("Outra aba bloqueou a atualização da base local FSRS."));
    pedido.onsuccess = () => {
      pedido.result.onversionchange = () => pedido.result.close();
      resolve(pedido.result);
    };
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function transacaoFsrs<Registro, T>(tabela: string, chave: string, modo: IDBTransactionMode, executar: (
  atual: Registro | undefined, objeto: IDBObjectStore,
) => T): Promise<T> {
  const banco = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = banco.transaction(tabela, modo, modo === "readwrite" ? { durability: "strict" } : undefined);
      const objeto = tx.objectStore(tabela);
      let resultado: T;
      let falha: unknown;
      tx.oncomplete = () => resolve(resultado);
      tx.onabort = () => reject(falha ?? tx.error ?? new Error("Transação FSRS interrompida."));
      const leitura = objeto.get(chave);
      leitura.onsuccess = () => {
        try {
          resultado = executar(leitura.result, objeto);
        } catch (erro) {
          falha = erro;
          tx.abort();
        }
      };
    });
  } finally {
    banco.close();
  }
}

export const transporteFsrsLocal: TransporteFsrs = {
  ler: escopo => transacaoFsrs<RegistroFsrs, RegistroFsrs | undefined>(store, chaveEscopoFsrs(escopo), "readonly", atual => atual),
  confirmar: (checkpoint, revisaoEsperada) => {
    const chave = chaveEscopoFsrs(checkpoint.escopo);
    return transacaoFsrs<RegistroFsrs, Awaited<ReturnType<TransporteFsrs["confirmar"]>>>(store, chave, "readwrite", (atual, objeto) => {
      const resultado = decidirGravacao(atual, checkpoint, revisaoEsperada);
      if (resultado.status === "gravado") objeto.put(resultado.registro, chave);
      return resultado;
    });
  },
};
