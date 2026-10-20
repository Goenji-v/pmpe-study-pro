import type { Assunto, Materia, Modulo, RegistroQuestao, Revisao, SessaoEstudo } from "../types";
import { chaveDaMateria } from "./desempenhoMaterias";
import { calcularMetricasConsolidadas } from "./metricasConsolidadas";

type ReferenciaHistorico = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
};

type AlvoAssunto = { materia: Materia; modulo: Modulo; assunto: Assunto };

const normalizar = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

/** IDs conhecidos sobrevivem a renomeações e movimentações. IDs conflitantes
 * nunca são substituídos por uma aproximação de nomes. Legados sem ID exigem
 * nomes exatos normalizados e um escopo de módulo não ambíguo. */
export function historicoPertenceAoAssunto(registro: ReferenciaHistorico, { materia, modulo, assunto }: AlvoAssunto) {
  if (registro.materiaId && ![materia.id, ...(materia.idsLegados ?? [])].includes(registro.materiaId)) return false;
  if (registro.assuntoId) {
    return [assunto.id, ...(assunto.idsLegados ?? []), ...(assunto.referenciasEdital ?? []), assunto.origemEditalId].includes(registro.assuntoId);
  }
  if (!registro.materiaId && chaveDaMateria(registro.materia) !== chaveDaMateria(materia.nome)) return false;
  if (normalizar(registro.assunto) !== normalizar(assunto.nome)) return false;
  if (registro.moduloId) return registro.moduloId === modulo.id;
  if (registro.modulo && normalizar(registro.modulo) !== normalizar(modulo.nome)) return false;

  // Sem módulo, um nome repetido em outro assunto não identifica este conteúdo.
  const idsAceitos = new Set([assunto.id, ...(assunto.idsLegados ?? []), ...(assunto.referenciasEdital ?? [])]);
  const modulosEscopo = (materia.modulos ?? [modulo]).filter(m => !registro.modulo || normalizar(m.nome) === normalizar(registro.modulo));
  return !modulosEscopo.some(m => m.assuntos.some(a => normalizar(a.nome) === normalizar(assunto.nome) && !idsAceitos.has(a.id)));
}

/** Fonte única do cartão e do perfil: histórico integral do mesmo assunto,
 * tempo consolidado e contagens separadas por estado de revisão. */
export function calcularMetricasAssunto(entrada: AlvoAssunto & {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
}) {
  const corresponde = (registro: ReferenciaHistorico) => historicoPertenceAoAssunto(registro, entrada);
  const sessoes = entrada.sessoes.filter(corresponde);
  const questoes = entrada.questoes.filter(corresponde);
  const revisoes = entrada.revisoes.filter(corresponde);
  // A identidade já foi resolvida: registros antigos renomeados devem deduplicar
  // com sessões atuais, sem modificar os dados originais.
  const canonizar = <T extends ReferenciaHistorico>(r: T): T => ({ ...r, materia: entrada.materia.nome, materiaId: entrada.materia.id, modulo: entrada.modulo.nome, moduloId: entrada.modulo.id, assunto: entrada.assunto.nome, assuntoId: entrada.assunto.id });
  const metricas = calcularMetricasConsolidadas({ sessoes: sessoes.map(canonizar), questoes: questoes.map(canonizar), revisoes, simulados: [] });
  return {
    ...metricas,
    // Aqui o escopo é todo o histórico; o estado concluído também vale para
    // revisões legadas que não guardaram dataConclusao.
    revisoesConcluidas: revisoes.filter(r => r.concluida).length,
    revisoesPendentes: revisoes.filter(r => !r.concluida).length,
    sessoesDoAssunto: sessoes,
  };
}
