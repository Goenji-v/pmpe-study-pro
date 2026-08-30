export type ModalidadeRedacao =
  | "treino"
  | "completa";

export function rotuloModalidadeRedacao(
  modalidade: ModalidadeRedacao
) {
  return modalidade === "treino"
    ? "Treino de redação"
    : "Redação completa";
}

export function montarObservacaoRedacao(
  observacao: string | undefined,
  modalidade: ModalidadeRedacao,
  nota?: number
) {
  const linhasBase = (observacao ?? "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .filter(
      (linha) =>
        !linha.startsWith("Modalidade: ") &&
        !linha.startsWith("Nota da redação: ")
    );

  const linhas = [
    `Modalidade: ${rotuloModalidadeRedacao(modalidade)}`,
    ...linhasBase,
  ];

  if (
    modalidade === "completa" &&
    nota !== undefined
  ) {
    linhas.push(`Nota da redação: ${nota}`);
  }

  return linhas.join("\n");
}
