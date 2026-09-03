import type { EstadoAppNuvem } from "../sincronizacaoService";
import {
  reduzirBackupsAutomaticosLocais,
} from "./backupAutomaticoService";

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

export type EstadoArmazenamentoLocal = "local" | "sessao" | "memoria";
const valoresEmMemoria = new Map<string, string>();
const gravacoesDegradadas = new Map<string, { usuarioId: string; destino: EstadoArmazenamentoLocal }>();
const ouvintesArmazenamento = new Set<() => void>();

export function observarArmazenamentoLocal(ouvinte: () => void) {
  ouvintesArmazenamento.add(ouvinte);
  return () => { ouvintesArmazenamento.delete(ouvinte); };
}

export function obterEstadoArmazenamentoLocal(usuarioId: string): EstadoArmazenamentoLocal {
  const destinos = [...gravacoesDegradadas.values()].filter(item => item.usuarioId === usuarioId);
  if (destinos.some(item => item.destino === "memoria")) return "memoria";
  return destinos.length ? "sessao" : "local";
}

function registrarDestino(chave: string, usuarioId: string, destino: EstadoArmazenamentoLocal) {
  const anterior = gravacoesDegradadas.get(chave)?.destino ?? "local";
  if (destino === "local") gravacoesDegradadas.delete(chave);
  else gravacoesDegradadas.set(chave, { usuarioId, destino });
  if (anterior !== destino) for (const ouvinte of ouvintesArmazenamento) ouvinte();
}

/** A cópia temporária é mais recente que a cópia local que não pôde ser atualizada. */
export function lerTextoLocalProtegido(chave: string) {
  return valoresEmMemoria.get(chave)
    ?? lerStorage(obterSessionStorage(), chave)
    ?? lerStorage(obterLocalStorage(), chave);
}

export function removerTextoLocalProtegido(chave: string) {
  valoresEmMemoria.delete(chave);
  gravacoesDegradadas.delete(chave);
  removerStorage(obterSessionStorage(), chave);
  removerStorage(obterLocalStorage(), chave);
}

export function repetirGravacoesLocais(usuarioId: string) {
  for (const [chave, registro] of [...gravacoesDegradadas]) {
    if (registro.usuarioId !== usuarioId) continue;
    const valor = lerTextoLocalProtegido(chave);
    if (valor !== null) salvarTextoComRecuperacaoDeCota(usuarioId, chave, valor);
  }
}

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

function obterLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function obterSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function lerStorage(storage: Storage | null, chave: string) {
  if (!storage) return null;
  try {
    return storage.getItem(chave);
  } catch {
    return null;
  }
}

function removerStorage(storage: Storage | null, chave: string) {
  if (!storage) return;
  try {
    storage.removeItem(chave);
  } catch {
    // A limpeza é best-effort; não deve derrubar a sincronização.
  }
}

function ehErroDeCota(erro: unknown) {
  if (!erro || typeof erro !== "object") return false;

  const candidato = erro as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
  };

  const nome = typeof candidato.name === "string" ? candidato.name : "";
  const codigo = typeof candidato.code === "number" ? candidato.code : 0;
  const mensagem = typeof candidato.message === "string"
    ? candidato.message.toLowerCase()
    : "";

  return (
    nome === "QuotaExceededError" ||
    nome === "NS_ERROR_DOM_QUOTA_REACHED" ||
    codigo === 22 ||
    codigo === 1014 ||
    mensagem.includes("quota") ||
    mensagem.includes("exceeded")
  );
}

function tentarSalvar(storage: Storage | null, chave: string, valor: string) {
  if (!storage) {
    return { salvou: false, erro: null as unknown };
  }

  try {
    storage.setItem(chave, valor);
    return { salvou: true, erro: null as unknown };
  } catch (erro) {
    return { salvou: false, erro };
  }
}

function parseMetadados(
  bruto: string | null,
  usuarioId: string
): MetadadosSincronizacaoLocal | null {
  if (!bruto) return null;

  try {
    const valor = JSON.parse(bruto) as Partial<MetadadosSincronizacaoLocal>;
    if (valor.usuarioId && valor.usuarioId !== usuarioId) return null;

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
    return null;
  }
}

function parsePendente(
  bruto: string | null,
  usuarioId: string
): EstadoPendenteSincronizacao | null {
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

export function salvarTextoComRecuperacaoDeCota(
  usuarioId: string,
  chave: string,
  serializado: string
): EstadoArmazenamentoLocal {
  const local = obterLocalStorage();
  const sessao = obterSessionStorage();

  let tentativaLocal = tentarSalvar(local, chave, serializado);
  if (tentativaLocal.salvou) {
    valoresEmMemoria.delete(chave);
    removerStorage(sessao, chave);
    registrarDestino(chave, usuarioId, "local");
    return "local";
  }

  if (ehErroDeCota(tentativaLocal.erro)) {
    // Backups automáticos são cópias de segurança e não podem impedir o dado
    // operacional pendente de ser salvo. Primeiro preservamos apenas o mais
    // recente; se ainda não couber, liberamos esse cache por completo.
    try { reduzirBackupsAutomaticosLocais(usuarioId, 1); } catch { /* Storage pode estar bloqueado. */ }
    tentativaLocal = tentarSalvar(local, chave, serializado);

    if (!tentativaLocal.salvou && ehErroDeCota(tentativaLocal.erro)) {
      try { reduzirBackupsAutomaticosLocais(usuarioId, 0); } catch { /* Não interromper o dado atual. */ }
      tentativaLocal = tentarSalvar(local, chave, serializado);
    }

    if (tentativaLocal.salvou) {
      valoresEmMemoria.delete(chave);
      removerStorage(sessao, chave);
      registrarDestino(chave, usuarioId, "local");
      return "local";
    }
  }

  // Última linha de defesa para a aba atual. Isso evita transformar falta de
  // espaço do localStorage em "Erro na nuvem" enquanto a sincronização ainda
  // pode ser concluída normalmente.
  const tentativaSessao = tentarSalvar(sessao, chave, serializado);
  if (tentativaSessao.salvou) {
    valoresEmMemoria.delete(chave);
    removerStorage(local, chave);
    registrarDestino(chave, usuarioId, "sessao");
    return "sessao";
  }

  // Não derruba o React nem impede o envio online. O aviso de armazenamento
  // deixa explícito que esta última defesa NÃO sobrevive ao recarregamento.
  valoresEmMemoria.set(chave, serializado);
  registrarDestino(chave, usuarioId, "memoria");
  return "memoria";
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

  const chave = chaveMeta(usuarioId);
  const memoria = parseMetadados(valoresEmMemoria.get(chave) ?? null, usuarioId);
  if (memoria) return memoria;
  const local = parseMetadados(
    lerStorage(obterLocalStorage(), chave),
    usuarioId
  );
  const sessao = parseMetadados(
    lerStorage(obterSessionStorage(), chave),
    usuarioId
  );

  if (!local) return sessao ?? padrao;
  if (!sessao) return local;

  const instanteLocal = local.ultimaSincronizacaoEm ?? "";
  const instanteSessao = sessao.ultimaSincronizacaoEm ?? "";
  return instanteSessao > instanteLocal ? sessao : local;
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

  salvarTextoComRecuperacaoDeCota(
    usuarioId,
    chaveMeta(usuarioId),
    JSON.stringify(metadados)
  );
}

export function obterEstadoPendenteSincronizacao(
  usuarioId: string
): EstadoPendenteSincronizacao | null {
  if (typeof window === "undefined") return null;

  const chave = chavePendente(usuarioId);
  const memoria = parsePendente(valoresEmMemoria.get(chave) ?? null, usuarioId);
  if (memoria) return memoria;
  const local = parsePendente(
    lerStorage(obterLocalStorage(), chave),
    usuarioId
  );
  const sessao = parsePendente(
    lerStorage(obterSessionStorage(), chave),
    usuarioId
  );

  if (!local) return sessao;
  if (!sessao) return local;

  return sessao.atualizadoEm > local.atualizadoEm
    ? sessao
    : local;
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

  salvarTextoComRecuperacaoDeCota(
    usuarioId,
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

  salvarTextoComRecuperacaoDeCota(
    usuarioId,
    chavePendente(usuarioId),
    JSON.stringify(proximo)
  );
}

export function limparEstadoPendenteSincronizacao(usuarioId: string) {
  if (typeof window === "undefined") return;
  const chave = chavePendente(usuarioId);
  valoresEmMemoria.delete(chave);
  removerStorage(obterLocalStorage(), chave);
  removerStorage(obterSessionStorage(), chave);
  registrarDestino(chave, usuarioId, "local");
}

export function navegadorEstaOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
