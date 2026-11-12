/** Evita atualizar a aplicação enquanto a pessoa resolve uma prova ou escreve redação.
 * Ao sair da atividade, o verificador periódico aplica a versão nova normalmente.
 */
export function deveAdiarAtualizacaoAutomatica(pathname: string): boolean {
  const rota = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return rota === "/simulado-pdf" ||
    rota === "/resolver-simulado-ia/prova" ||
    rota.startsWith("/simulado-oficial/") ||
    rota === "/inteligencia" ||
    rota === "/central-estudos";
}

/**
 * A atualização automática não deve interromper uma escrita ainda pendente.
 * A fila persistente é a fonte de verdade inclusive após reiniciar a aba.
 */
export function haAlteracoesPendentesAntesDeAtualizar(
  armazenamentos: ReadonlyArray<Pick<Storage, "length" | "key" | "getItem"> | null>
): boolean {
  for (const armazenamento of armazenamentos) {
    if (!armazenamento) continue;
    try {
      for (let i = 0; i < armazenamento.length; i += 1) {
        const chave = armazenamento.key(i);
        if (
          chave?.startsWith("pmpe:seguranca:sync-pendente:") &&
          armazenamento.getItem(chave)
        ) {
          return true;
        }
      }
    } catch {
      // Falha de leitura significa que não podemos confirmar a segurança da recarga.
      return true;
    }
  }
  return false;
}

export function deveAdiarAtualizacaoPorSincronizacao(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return haAlteracoesPendentesAntesDeAtualizar([
      window.localStorage,
      window.sessionStorage,
    ]);
  } catch {
    return true;
  }
}
