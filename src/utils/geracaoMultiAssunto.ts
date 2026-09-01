export const LIMITE_QUESTOES_SESSAO = 60;

export function calcularTotalQuestoesMultiAssunto(
  quantidadeAssuntos: number,
  quantidadePorAssunto: number
) {
  const assuntos = Math.max(0, Math.floor(quantidadeAssuntos));
  const porAssunto = Math.max(0, Math.floor(quantidadePorAssunto));
  return assuntos * porAssunto;
}

export function validarGeracaoMultiAssunto(
  quantidadeAssuntos: number,
  quantidadePorAssunto: number,
  limite = LIMITE_QUESTOES_SESSAO
) {
  const total = calcularTotalQuestoesMultiAssunto(
    quantidadeAssuntos,
    quantidadePorAssunto
  );

  if (quantidadeAssuntos < 1) {
    return {
      valida: false,
      total,
      mensagem: "Selecione pelo menos um subassunto.",
    } as const;
  }

  if (quantidadePorAssunto < 5) {
    return {
      valida: false,
      total,
      mensagem: "A quantidade mínima é de 5 questões por subassunto.",
    } as const;
  }

  if (total > limite) {
    return {
      valida: false,
      total,
      mensagem: `A sessão ficaria com ${total} questões. O limite é ${limite}. Reduza a quantidade por subassunto ou desmarque algum tópico.`,
    } as const;
  }

  return {
    valida: true,
    total,
    mensagem: "",
  } as const;
}

export function consolidarBlocosMultiAssunto<T>(
  blocos: T[][],
  quantidadePorAssunto: number
) {
  const blocoIncompleto = blocos.find(
    (bloco) => bloco.length !== quantidadePorAssunto
  );

  if (blocoIncompleto) {
    throw new Error(
      `Um dos subassuntos não atingiu as ${quantidadePorAssunto} questões esperadas.`
    );
  }

  return blocos.flat();
}
