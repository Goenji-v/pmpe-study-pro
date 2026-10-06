export type PayloadGeracaoPersistente = {
  assunto: string;
  quantidade: number;
  banca: string;
  enunciadosEvitar: string[];
};

export function validarPayloadGeracaoIA(
  valor: Record<string, unknown>
): PayloadGeracaoPersistente {
  const assunto =
    typeof valor.assunto === "string"
      ? valor.assunto.trim()
      : "";
  const banca =
    typeof valor.banca === "string"
      ? valor.banca.trim()
      : "AOCP";
  const quantidade = Math.max(
    1,
    Math.min(60, Number(valor.quantidade) || 5)
  );
  const enunciadosEvitar = Array.isArray(valor.enunciadosEvitar)
    ? valor.enunciadosEvitar
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 120)
    : [];

  if (!assunto) {
    throw new Error("O assunto da geração está vazio.");
  }

  return {
    assunto,
    quantidade,
    banca,
    enunciadosEvitar,
  };
}
