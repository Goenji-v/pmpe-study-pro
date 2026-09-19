type EstadoGeracao<T> = {
  status: "processando" | "concluida";
  promessa?: Promise<T>;
  resultado?: T;
  expiraEm: number;
};

const geracoes = new Map<string, EstadoGeracao<unknown>>();
const TTL_MS = 45 * 60 * 1000;

export async function executarGeracaoIdempotente<T>(
  chave: string,
  executar: () => Promise<T>
): Promise<T> {
  limparExpiradas();

  const existente = geracoes.get(chave) as EstadoGeracao<T> | undefined;
  if (existente?.status === "concluida" && existente.resultado !== undefined) {
    return existente.resultado;
  }
  if (existente?.status === "processando" && existente.promessa) {
    return existente.promessa;
  }

  const promessa = executar()
    .then((resultado) => {
      geracoes.set(chave, {
        status: "concluida",
        resultado,
        expiraEm: Date.now() + TTL_MS,
      });
      return resultado;
    })
    .catch((erro) => {
      // Falhas não ficam cacheadas: o mesmo identificador pode ser tentado
      // novamente com segurança sem bloquear a recuperação.
      geracoes.delete(chave);
      throw erro;
    });

  geracoes.set(chave, {
    status: "processando",
    promessa,
    expiraEm: Date.now() + TTL_MS,
  });

  return promessa;
}

export function obterEstadoGeracao<T>(chave: string) {
  limparExpiradas();
  const estado = geracoes.get(chave) as EstadoGeracao<T> | undefined;
  if (!estado) return null;
  if (estado.status === "concluida") {
    return { status: "concluida" as const, resultado: estado.resultado };
  }
  return { status: "processando" as const };
}

function limparExpiradas() {
  const agora = Date.now();
  for (const [chave, estado] of geracoes.entries()) {
    if (estado.expiraEm <= agora) geracoes.delete(chave);
  }
}
