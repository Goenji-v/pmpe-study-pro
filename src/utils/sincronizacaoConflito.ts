import type { EstadoAppNuvem } from "../services/sincronizacaoService";

export function assinaturaConteudoSincronizacao(
  estado: EstadoAppNuvem
) {
  const {
    salvoEm: _salvoEm,
    syncRevision: _syncRevision,
    atualizadoEm: _atualizadoEm,
    ...dados
  } = estado;

  return JSON.stringify(dados);
}

export function estadosEquivalentesParaSincronizacao(
  primeiro: EstadoAppNuvem,
  segundo: EstadoAppNuvem
) {
  return assinaturaConteudoSincronizacao(primeiro) ===
    assinaturaConteudoSincronizacao(segundo);
}
