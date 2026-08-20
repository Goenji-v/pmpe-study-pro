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

type ContextoFallbackGemini = {
  rotulo: string;
  modelos: string[];
  tentativasPorModelo?: number[];
  atrasosMs?: number[];
  esperar?: (milissegundos: number) => Promise<void>;
  aoTentarNovamente?: (dados: {
    modelo: string;
    tentativaAtual: number;
    proximaTentativa: number;
    maxTentativas: number;
    status: number;
    esperaMs: number;
    rotulo: string;
  }) => void;
  aoTrocarModelo?: (dados: {
    modeloAnterior: string;
    modeloSeguinte: string;
    status: number;
    rotulo: string;
  }) => void;
};

const STATUS_TEMPORARIOS = new Set([500, 502, 503, 504]);
const ATRASOS_PADRAO_MS = [2_000, 5_000, 10_000];

export async function executarComFallbackGemini<T>(
  executar: (modelo: string) => Promise<T>,
  contexto: ContextoFallbackGemini
): Promise<T> {
  const modelos = Array.from(new Set(
    contexto.modelos.map((modelo) => modelo.trim()).filter(Boolean)
  ));

  if (modelos.length === 0) {
    throw new Error("Nenhum modelo do Gemini foi configurado.");
  }

  let ultimoErro: unknown;

  for (let indice = 0; indice < modelos.length; indice += 1) {
    const modeloAtual = modelos[indice];
    const modeloSeguinte = modelos[indice + 1];
    const maxTentativas = contexto.tentativasPorModelo?.[indice] ?? 3;

    try {
      return await executarComRetryGemini(
        () => executar(modeloAtual),
        {
          rotulo: `${contexto.rotulo} com ${modeloAtual}`,
          maxTentativas,
          atrasosMs: contexto.atrasosMs,
          esperar: contexto.esperar,
          aoTentarNovamente: (dados) => {
            contexto.aoTentarNovamente?.({
              ...dados,
              modelo: modeloAtual,
              rotulo: contexto.rotulo,
            });
          },
        }
      );
    } catch (erro) {
      ultimoErro = erro;
      const status = obterStatusErro(erro);
      const podeTrocar = Boolean(modeloSeguinte) &&
        status !== null &&
        STATUS_TEMPORARIOS.has(status);

      if (!podeTrocar || status === null) throw erro;

      contexto.aoTrocarModelo?.({
        modeloAnterior: modeloAtual,
        modeloSeguinte,
        status,
        rotulo: contexto.rotulo,
      });
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error("A análise do Gemini não foi concluída.");
}

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
    return criarErroComStatus(
      `O Gemini está com alta demanda e não respondeu após ${maxTentativas} tentativas. Aguarde alguns minutos e tente novamente.`,
      status,
      erro
    );
  }

  if (status === 429) {
    return criarErroComStatus(
      "O limite de uso do Gemini foi atingido ou há solicitações demais no momento. Aguarde a renovação do limite e tente novamente.",
      status,
      erro
    );
  }

  if (status !== null && STATUS_TEMPORARIOS.has(status)) {
    return criarErroComStatus(
      `O serviço do Gemini ficou temporariamente indisponível após ${maxTentativas} tentativas. Tente novamente em alguns minutos.`,
      status,
      erro
    );
  }

  return erro instanceof Error ? erro : new Error(String(erro));
}

function criarErroComStatus(mensagem: string, status: number, causa: unknown) {
  return Object.assign(new Error(mensagem, { cause: causa }), { status });
}

function aguardar(milissegundos: number) {
  return new Promise<void>((resolver) => {
    setTimeout(resolver, milissegundos);
  });
}
