export type ArmazenamentoTentativasLogin = {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
};

type EstadoTentativasLogin = {
  falhas: number;
  primeiraFalhaEm: number;
  bloqueadoAte: number;
};

const CHAVE = "study-pro:login-attempt-guard";
const MAX_FALHAS = 5;
const JANELA_FALHAS_MS = 10 * 60 * 1000;
const BLOQUEIO_MS = 60 * 1000;

function lerEstado(
  armazenamento: ArmazenamentoTentativasLogin
): EstadoTentativasLogin {
  try {
    const bruto = armazenamento.getItem(CHAVE);
    if (!bruto) return { falhas: 0, primeiraFalhaEm: 0, bloqueadoAte: 0 };

    const valor = JSON.parse(bruto) as Partial<EstadoTentativasLogin>;
    return {
      falhas: Math.max(0, Number(valor.falhas) || 0),
      primeiraFalhaEm: Math.max(0, Number(valor.primeiraFalhaEm) || 0),
      bloqueadoAte: Math.max(0, Number(valor.bloqueadoAte) || 0),
    };
  } catch {
    return { falhas: 0, primeiraFalhaEm: 0, bloqueadoAte: 0 };
  }
}

function salvarEstado(
  armazenamento: ArmazenamentoTentativasLogin,
  estado: EstadoTentativasLogin
) {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Se o navegador bloquear storage, o Auth do Supabase continua aplicando
    // os limites do servidor normalmente.
  }
}

export function obterSegundosBloqueioLogin(
  armazenamento: ArmazenamentoTentativasLogin,
  agora = Date.now()
) {
  const estado = lerEstado(armazenamento);

  if (estado.bloqueadoAte <= agora) {
    if (
      estado.bloqueadoAte > 0 ||
      (estado.primeiraFalhaEm > 0 &&
        agora - estado.primeiraFalhaEm > JANELA_FALHAS_MS)
    ) {
      limparTentativasLogin(armazenamento);
    }
    return 0;
  }

  return Math.max(1, Math.ceil((estado.bloqueadoAte - agora) / 1000));
}

export function registrarFalhaLogin(
  armazenamento: ArmazenamentoTentativasLogin,
  agora = Date.now()
) {
  const atual = lerEstado(armazenamento);

  if (atual.bloqueadoAte > agora) {
    return obterSegundosBloqueioLogin(armazenamento, agora);
  }

  const janelaExpirou =
    atual.primeiraFalhaEm === 0 ||
    agora - atual.primeiraFalhaEm > JANELA_FALHAS_MS;

  const falhas = janelaExpirou ? 1 : atual.falhas + 1;
  const primeiraFalhaEm = janelaExpirou ? agora : atual.primeiraFalhaEm;

  if (falhas >= MAX_FALHAS) {
    const bloqueadoAte = agora + BLOQUEIO_MS;
    salvarEstado(armazenamento, {
      falhas: 0,
      primeiraFalhaEm: 0,
      bloqueadoAte,
    });
    return Math.ceil(BLOQUEIO_MS / 1000);
  }

  salvarEstado(armazenamento, {
    falhas,
    primeiraFalhaEm,
    bloqueadoAte: 0,
  });

  return 0;
}

export function limparTentativasLogin(
  armazenamento: ArmazenamentoTentativasLogin
) {
  try {
    armazenamento.removeItem(CHAVE);
  } catch {
    // Sem efeito funcional; apenas remove a proteção local adicional.
  }
}
