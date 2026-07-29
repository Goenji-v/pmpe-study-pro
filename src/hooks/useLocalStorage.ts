import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

function clonarValor<T>(valor: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }

  return JSON.parse(JSON.stringify(valor)) as T;
}

function carregarValor<T>(
  key: string,
  initialValue: T
): T {
  const saved = localStorage.getItem(key);

  if (!saved) {
    return clonarValor(initialValue);
  }

  try {
    return JSON.parse(saved) as T;
  } catch {
    return clonarValor(initialValue);
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): readonly [
  T,
  Dispatch<SetStateAction<T>>,
] {
  const [value, setValue] = useState<T>(
    () => carregarValor(key, initialValue)
  );

  useEffect(() => {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }, [key, value]);

  return [value, setValue] as const;
}