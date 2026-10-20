import type { Assunto, Materia, Modulo, RegistroQuestao, Revisao, SessaoEstudo } from "../types";
import { chaveDaMateria } from "./desempenhoMaterias";
import { calcularMetricasConsolidadas } from "./metricasConsolidadas";

type RegistroVinculado = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
};

function nomeExato(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function correspondeAoAssunto(
  registro: RegistroVinculado,
  materia: Materia,
  modulo: Modulo,
  assunto: Assunto
): boolean {
  if (registro.materiaId && registro.materiaId !== materia.id) return false;
  if (registro.moduloId && registro.moduloId !== modulo.id) return false;
  if (registro.assuntoId) {
    return [assunto.id, ...(assunto.idsLegados ?? []), ...(assunto.referenciasEdital ?? [])].includes(registro.assuntoId);
  }
  return chaveDaMateria(registro.materia) === chaveDaMateria(materia.nome) &&
    nomeExato(registro.assunto) === nomeExato(assunto.nome) &&
    (!registro.modulo || nomeExato(registro.modulo) === nomeExato(modulo.nome));
}

/** Uma única regra para o cartão de Estudos e o perfil do subassunto. */
export function calcularMetricasDoAssunto(entrada: {
  materia: Materia;
  modulo: Modulo;
  assunto: Assunto;
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
}) {
  const corresponde = (registro: RegistroVinculado) =>
    correspondeAoAssunto(registro, entrada.materia, entrada.modulo, entrada.assunto);
  const sessoesDoAssunto = entrada.sessoes.filter(corresponde);
  const questoesDoAssunto = entrada.questoes.filter(corresponde);
  const revisoesDoAssunto = entrada.revisoes.filter(corresponde);
  const metricas = calcularMetricasConsolidadas({
    sessoes: sessoesDoAssunto,
    questoes: questoesDoAssunto,
    revisoes: revisoesDoAssunto,
    simulados: [],
  });
  return {
    ...metricas,
    totalQuestoes: metricas.questoes,
    percentual: metricas.aproveitamento,
    aproveitamento: metricas.aproveitamento,
    revisoesPendentes: revisoesDoAssunto.filter((item) => !item.concluida).length,
    sessoesDoAssunto,
  };
}
