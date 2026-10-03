import type { EstadoAppNuvem } from "../services/sincronizacaoService";

type ConfigEstrutural = EstadoAppNuvem["configuracoes"] & {
  editalAtivo?: { id?: string };
  cursosAtivosIds?: string[];
};

function instante(valor: unknown) {
  return typeof valor === "string" ? Date.parse(valor) : Number.NaN;
}

function assinaturaEstrutural(estado: EstadoAppNuvem) {
  const config = estado.configuracoes as ConfigEstrutural;
  const materias = estado.materias
    .map((materia) => ({
      id: materia.id,
      modulos: (materia.modulos ?? [])
        .map((modulo) => ({
          id: modulo.id,
          assuntos: modulo.assuntos.map((assunto) => assunto.id).sort(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({
    editalId: config.editalAtivo?.id ?? null,
    cursosAtivosIds: [...(config.cursosAtivosIds ?? [])].sort(),
    materias,
  });
}

export function deveAplicarMigracaoEstruturalRemota(
  local: EstadoAppNuvem,
  remoto: EstadoAppNuvem
) {
  const remotoEm = instante(remoto.configuracoes.migracaoEstruturalEm);
  if (!Number.isFinite(remotoEm)) return false;

  const localEm = instante(local.configuracoes.migracaoEstruturalEm);

  if (!Number.isFinite(localEm) || remotoEm > localEm) {
    return true;
  }

  if (remotoEm < localEm) {
    return false;
  }

  // Mesmo marcador, mas estrutura diferente = hidratação parcial no aparelho.
  // Nesse caso a nuvem continua sendo a fonte canônica da migração.
  return assinaturaEstrutural(local) !== assinaturaEstrutural(remoto);
}
