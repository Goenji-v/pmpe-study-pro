import type { EstadoAppNuvem } from "../sincronizacaoService";

export type MetadadosSincronizacaoLocal = {
  usuarioId: string;
  ultimaRevisaoConfirmada: number;
  ultimaSincronizacaoEm: string | null;
};

export type EstadoPendenteSincronizacao = {
  usuarioId: string;
  baseRevision: number;
  criadoEm: string;
  atualizadoEm: string;
  tentativas: number;
  estado: EstadoAppNuvem;
};

const PREFIXO_META = "pmpe:seguranca:sync-meta";
const PREFIXO_PENDENTE = "pmpe:seguranca:sync-pendente";

function chaveMeta(usuarioId: string) {
  return `${PREFIXO_META}:${usuarioId}`;
}

function chavePendente(usuarioId: string) {
  return `${PREFIXO_PENDENTE}:${usuarioId}`;
}

function clonar<T>(valor: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }

  return JSON.parse(JSON.stringify(valor)) as T;
}

export function obterMetadadosSincronizacaoLocal(
  usuarioId: string
): MetadadosSincronizacaoLocal {
  const padrao: MetadadosSincronizacaoLocal = {
    usuarioId,
    ultimaRevisaoConfirmada: 0,
    ultimaSincronizacaoEm: null,
  };

  if (typeof window === "undefined") return padrao;

  const bruto = window.localStorage.getItem(chaveMeta(usuarioId));
  if (!bruto) return padrao;

  try {
    const valor = JSON.parse(bruto) as Partial<MetadadosSincronizacaoLocal>;

    return {
      usuarioId,
      ultimaRevisaoConfirmada:
        typeof valor.ultimaRevisaoConfirmada === "number" &&
        Number.isFinite(valor.ultimaRevisaoConfirmada)
          ? Math.max(0, Math.floor(valor.ultimaRevisaoConfirmada))
          : 0,
      ultimaSincronizacaoEm:
        typeof valor.ultimaSincronizacaoEm === "string"
          ? valor.ultimaSincronizacaoEm
          : null,
    };
  } catch {
    return padrao;
  }
}

export function registrarSincronizacaoConfirmada(
  usuarioId: string,
  estado: EstadoAppNuvem
) {
  if (typeof window === "undefined") return;

  const agora = new Date().toISOString();
  const revisao = Math.max(
    0,
    Math.floor(estado.syncRevision ?? 0)
  );

  const metadados: MetadadosSincronizacaoLocal = {
    usuarioId,
    ultimaRevisaoConfirmada: revisao,
    ultimaSincronizacaoEm: estado.atualizadoEm ?? estado.salvoEm ?? agora,
  };

  window.localStorage.setItem(
    chaveMeta(usuarioId),
    JSON.stringify(metadados)
  );
}

export function obterEstadoPendenteSincronizacao(
  usuarioId: string
): EstadoPendenteSincronizacao | null {
  if (typeof window === "undefined") return null;

  const bruto = window.localStorage.getItem(chavePendente(usuarioId));
  if (!bruto) return null;

  try {
    const valor = JSON.parse(bruto) as Partial<EstadoPendenteSincronizacao>;

    if (
      valor.usuarioId !== usuarioId ||
      typeof valor.baseRevision !== "number" ||
      typeof valor.criadoEm !== "string" ||
      typeof valor.atualizadoEm !== "string" ||
      typeof valor.tentativas !== "number" ||
      !valor.estado ||
      typeof valor.estado !== "object"
    ) {
      return null;
    }

    return valor as EstadoPendenteSincronizacao;
  } catch {
    return null;
  }
}

export function registrarEstadoPendenteSincronizacao(
  usuarioId: string,
  estado: EstadoAppNuvem,
  baseRevision: number
): EstadoPendenteSincronizacao {
  if (typeof window === "undefined") {
    return {
      usuarioId,
      baseRevision,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      tentativas: 0,
      estado: clonar(estado),
    };
  }

  const existente = obterEstadoPendenteSincronizacao(usuarioId);
  const agora = new Date().toISOString();

  const pendente: EstadoPendenteSincronizacao = {
    usuarioId,
    // A revisão-base nunca muda enquanto a fila não for confirmada. Assim um
    // aparelho offline não pode "pular" uma alteração feita em outro aparelho.
    baseRevision: existente?.baseRevision ?? Math.max(0, Math.floor(baseRevision)),
    criadoEm: existente?.criadoEm ?? agora,
    atualizadoEm: agora,
    tentativas: existente?.tentativas ?? 0,
    estado: clonar(estado),
  };

  window.localStorage.setItem(
    chavePendente(usuarioId),
    JSON.stringify(pendente)
  );

  return pendente;
}

export function registrarTentativaPendente(usuarioId: string) {
  if (typeof window === "undefined") return;

  const atual = obterEstadoPendenteSincronizacao(usuarioId);
  if (!atual) return;

  const proximo: EstadoPendenteSincronizacao = {
    ...atual,
    tentativas: atual.tentativas + 1,
    atualizadoEm: new Date().toISOString(),
  };

  window.localStorage.setItem(
    chavePendente(usuarioId),
    JSON.stringify(proximo)
  );
}

export function limparEstadoPendenteSincronizacao(usuarioId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(chavePendente(usuarioId));
}

export function navegadorEstaOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
