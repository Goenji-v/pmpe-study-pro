/**
 * Acumula anexos de seleções sucessivas do navegador sem perder os arquivos
 * já escolhidos. Uma seleção repetida do mesmo arquivo é ignorada para não
 * gerar uploads duplicados. Não há limite artificial de quantidade.
 */
export function acumularArquivosFinalizacao(
  anteriores: readonly File[],
  selecionados: readonly File[]
): File[] {
  const resultado = [...anteriores];
  const chaves = new Set(anteriores.map(identificarArquivoFinalizacao));

  for (const arquivo of selecionados) {
    const chave = identificarArquivoFinalizacao(arquivo);
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    resultado.push(arquivo);
  }

  return resultado;
}

function identificarArquivoFinalizacao(arquivo: File): string {
  return JSON.stringify([
    arquivo.name,
    arquivo.size,
    arquivo.lastModified,
    arquivo.type,
  ]);
}
