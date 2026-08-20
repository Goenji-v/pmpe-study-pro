type ContextoRetryGemini = {
  rotulo: string;
  maxTentativas?: number;
  atrasosMs?: number[];
  esperar?: (milissegundos: number) => Promise<void>;
  aoTentarNovamente?: (dados: {
    tentativaAtual: number;
    proximaTentativa: number;
    maxTentativas: number;
    status: number;
    esperaMs: number;
    rotulo: string;
  }) => void;
};

const STATUS_TEMPORARIOS = new Set([500, 502, 503, 504]);
const ATRASOS_PADRAO_MS = [2_000, 5_000, 10_000];

export async function executarComRetryGemini<T>(
  executar: () => Promise<T>,
  contexto: ContextoRetryGemini
): Promise<T> {
  const maxTentativas = Math.max(1, contexto.maxTentativas ?? 4);
  const atrasosMs = contexto.atrasosMs?.length
    ? contexto.atrasosMs
    : ATRASOS_PADRAO_MS;
  const esperar = contexto.esperar ?? aguardar;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      return await executar();
    } catch (erro) {
      const status = obterStatusErro(erro);
      const podeTentarNovamente = status !== null &&
        STATUS_TEMPORARIOS.has(status) &&
        tentativa < maxTentativas;

      if (!podeTentarNovamente) {
        throw traduzirErroGemini(erro, maxTentativas);
      }

      const esperaMs = atrasosMs[Math.min(
        tentativa - 1,
        atrasosMs.length - 1
      )];

      contexto.aoTentarNovamente?.({
        tentativaAtual: tentativa,
        proximaTentativa: tentativa + 1,
        maxTentativas,
        status,
        esperaMs,
        rotulo: contexto.rotulo,
      });

      await esperar(esperaMs);
    }
  }

  throw new Error("A análise do Gemini não foi concluída.");
}

export function obterStatusErro(erro: unknown) {
  if (!erro || typeof erro !== "object" || !("status" in erro)) return null;

  const status = Number((erro as { status?: unknown }).status);
  return Number.isInteger(status) ? status : null;
}

function traduzirErroGemini(erro: unknown, maxTentativas: number) {
  const status = obterStatusErro(erro);

  if (status === 503) {
    return new Error(
      `O Gemini está com alta demanda e não respondeu após ${maxTentativas} tentativas. Aguarde alguns minutos e tente novamente.`,
      { cause: erro }
    );
  }

  if (status === 429) {
    return new Error(
      "O limite de uso do Gemini foi atingido ou há solicitações demais no momento. Aguarde a renovação do limite e tente novamente.",
      { cause: erro }
    );
  }

  if (status !== null && STATUS_TEMPORARIOS.has(status)) {
    return new Error(
      `O serviço do Gemini ficou temporariamente indisponível após ${maxTentativas} tentativas. Tente novamente em alguns minutos.`,
      { cause: erro }
    );
  }

  return erro instanceof Error ? erro : new Error(String(erro));
}

function aguardar(milissegundos: number) {
  return new Promise<void>((resolver) => {
    setTimeout(resolver, milissegundos);
  });
}
