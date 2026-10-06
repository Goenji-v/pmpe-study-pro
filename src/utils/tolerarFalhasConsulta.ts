export async function executarComToleranciaDeFalhas<T>(
  executar: () => Promise<T>,
  opcoes: {
    esperar: (milissegundos: number) => Promise<void>;
    maxTentativas?: number;
    atrasoBaseMs?: number;
  }
): Promise<T> {
  const maxTentativas = Math.max(1, opcoes.maxTentativas ?? 4);
  const atrasoBaseMs = opcoes.atrasoBaseMs ?? 2_000;
  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      return await executar();
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < maxTentativas) {
        await opcoes.esperar(atrasoBaseMs * tentativa);
      }
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error("Não foi possível consultar a geração.");
}
