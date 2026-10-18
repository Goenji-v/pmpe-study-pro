import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { armazenamentoSessaoDaConta as storage, obterEscopoArmazenamento } from "../services/armazenamentoConta";

/** Preferências da tela duram pela sessão e usam o armazenamento da conta. */
export function useEstadoNavegacao<T>(chave: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const key = `navegacao:${obterEscopoArmazenamento()?.usuarioId ?? "sem-conta"}:${chave}`;
  const [valor, setValor] = useState<T>(() => {
    try {
      const salvo = storage.getItem(key);
      return salvo === null ? inicial : JSON.parse(salvo) as T;
    } catch { return inicial; }
  });
  useEffect(() => {
    try { storage.setItem(key, JSON.stringify(valor)); } catch { /* Sem espaço: mantém o estado na tela. */ }
  }, [key, valor]);
  return [valor, setValor];
}
