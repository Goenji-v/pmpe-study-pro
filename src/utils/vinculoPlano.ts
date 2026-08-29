import {
  obterReferenciasDaMissao,
  type MissaoPlano,
} from "../data/planoPMPE";

export type EstadoVinculoPlano = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  aulaId?: string;
  tipo: string;
  formatoRevisao?: string;
  objetivo?: string;
  observacao?: string;
  missaoId?: string;
  semana?: number;
  dia?: number;
  urlAula?: string;
  urlQuestoes?: string;
};

const CAMPOS_QUE_DESVINCULAM = [
  "materia",
  "materiaId",
  "modulo",
  "moduloId",
  "assunto",
  "assuntoId",
  "aulaId",
  "tipo",
] as const;

export function aplicarAlteracoesComVinculoSeguro<T extends EstadoVinculoPlano>(
  anterior: T,
  alteracoes: Partial<EstadoVinculoPlano>
): T {
  const deveDesvincular = Boolean(
    anterior.missaoId &&
      CAMPOS_QUE_DESVINCULAM.some((campo) => {
        if (!Object.prototype.hasOwnProperty.call(alteracoes, campo)) {
          return false;
        }

        return anterior[campo] !== alteracoes[campo];
      })
  );

  return {
    ...anterior,
    ...alteracoes,
    ...(deveDesvincular
      ? {
          missaoId: undefined,
          semana: undefined,
          dia: undefined,
        }
      : {}),
  };
}

export function missaoPossuiReferenciaCanonica(
  missao: MissaoPlano | undefined
): missao is MissaoPlano {
  return Boolean(
    missao && obterReferenciasDaMissao(missao).length > 0
  );
}

export function obterMateriaEfetivaDaSessao(
  tipo: string,
  materia: string
): string {
  const valor = materia.trim();

  if (tipo === "simulado" && !valor) {
    return "Simulados";
  }

  return valor;
}
