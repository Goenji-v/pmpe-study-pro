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


export type DiagnosticoRegressaoHistorico = {
  bloqueada: boolean;
  perdas: string[];
};

export function diagnosticarRegressaoHistorico(
  atualNuvem: EstadoAppNuvem,
  candidato: EstadoAppNuvem
): DiagnosticoRegressaoHistorico {
  const reinicioAtual =
    (atualNuvem.configuracoes as { dadosReiniciadosEm?: string })
      .dadosReiniciadosEm ?? "";
  const reinicioCandidato =
    (candidato.configuracoes as { dadosReiniciadosEm?: string })
      .dadosReiniciadosEm ?? "";

  if (reinicioAtual !== reinicioCandidato) {
    return { bloqueada: false, perdas: [] };
  }

  const perdas: string[] = [];
  compararQuantidade(
    "sessões",
    atualNuvem.sessoes.length,
    candidato.sessoes.length,
    perdas
  );
  compararQuantidade(
    "registros de questões",
    atualNuvem.questoes.length,
    candidato.questoes.length,
    perdas
  );
  compararQuantidade(
    "revisões",
    atualNuvem.revisoes.length,
    candidato.revisoes.length,
    perdas
  );
  compararQuantidade(
    "simulados",
    atualNuvem.simulados.length,
    candidato.simulados.length,
    perdas
  );
  compararQuantidade(
    "missões concluídas",
    atualNuvem.missoesConcluidas.length,
    candidato.missoesConcluidas.length,
    perdas
  );

  return {
    bloqueada: perdas.length > 0,
    perdas,
  };
}

function compararQuantidade(
  rotulo: string,
  atual: number,
  candidato: number,
  perdas: string[]
) {
  if (candidato < atual) {
    perdas.push(`${rotulo}: ${atual} → ${candidato}`);
  }
}
