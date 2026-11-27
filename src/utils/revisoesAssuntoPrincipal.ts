import type { Revisao } from "../types";
import { identificarGrupoIntegrado, normalizarTopicoIntegrado } from "./catalogoRevisoesIntegradas";
import { chaveDaMateria } from "./desempenhoMaterias";

type Referencia = Pick<Revisao, "materia" | "assunto"> &
  Partial<Pick<Revisao, "escopoGrupo" | "revisaoIndividualDoAssunto" | "origemSimulado" | "id" | "integradaEmId">>;

/**
 * Chave estável do ASSUNTO principal, e não da aula ou do ID do conteúdo.
 * Aplicada somente às famílias curadas. Não considera texto parcial
 * indiscriminadamente, pois assuntos apenas relacionados devem permanecer
 * independentes quando não fizerem parte destas famílias.
 */
export function chaveAssuntoPrincipal(revisao: Referencia): string | null {
  if (revisao.escopoGrupo || revisao.revisaoIndividualDoAssunto || revisao.origemSimulado ||
      revisao.integradaEmId || revisao.id?.startsWith("ia-")) return null;
  const grupo = identificarGrupoIntegrado(revisao);
  if (grupo) return chaveDaMateria(revisao.materia) + ":" + grupo.id;

  // Windows é uma família consolidável: as partes I, II e III continuam
  // como aulas, mas formam um único ciclo de revisão de Windows.
  if (chaveDaMateria(revisao.materia) === "informatica" &&
      /\bwindows\b/.test(normalizarTopicoIntegrado(revisao.assunto))) {
    return "informatica:windows";
  }
  return null;
}

export function tituloAssuntoPrincipal(revisao: Referencia): string {
  const grupo = identificarGrupoIntegrado(revisao);
  if (grupo) return grupo.titulo;
  return chaveAssuntoPrincipal(revisao) === "informatica:windows"
    ? "Windows" : revisao.assunto;
}

export function revisaoAtiva(revisao: Revisao): boolean {
  return !revisao.concluida && !revisao.integradaEmId &&
    !revisao.origemSimulado && !revisao.id.startsWith("ia-");
}

export function revisoesDoMesmoAssunto(
  revisoes: readonly Revisao[], referencia: Revisao
): Revisao[] {
  const chave = chaveAssuntoPrincipal(referencia);
  if (!chave) return [referencia];
  return revisoes.filter((rev) =>
    revisaoAtiva(rev) && chaveAssuntoPrincipal(rev) === chave
  );
}

function prioridade(revisao: Revisao): number {
  const instante = new Date(revisao.dataPrevista).getTime();
  return Number.isFinite(instante) ? instante : Number.POSITIVE_INFINITY;
}

/**
 * Projeção de leitura: um cartão por assunto principal, mesmo se as
 * pendências antigas tiverem IDs, etapas ou DATAS DIFERENTES.
 * Esta função não salva nem altera nenhum registro.
 */
export function pendentesUnicasPorAssunto(revisoes: readonly Revisao[]): Revisao[] {
  const ordenadas = revisoes.filter(revisaoAtiva).sort(
    (a, b) => prioridade(a) - prioridade(b) || a.etapa - b.etapa || a.id.localeCompare(b.id)
  );
  const exibidas: Revisao[] = [];
  const vistos = new Set<string>();
  for (const revisao of ordenadas) {
    const chave = chaveAssuntoPrincipal(revisao);
    if (chave && vistos.has(chave)) continue;
    if (chave) vistos.add(chave);
    exibidas.push(revisao);
  }
  return exibidas;
}

/**
 * As revisões absorvidas permanecem guardadas com ID, data, etapa e status
 * originais. Não são "concluídas" por ficarem ocultas da agenda.
 * Somente a conclusão explícita da revisão representante aplica a união.
 */
export function integrarPendenciasNaConclusao(params: {
  revisoes: Revisao[];
  revisaoPrincipal: Revisao;
  agora: Date;
}): { revisoes: Revisao[]; etapaMaisConservadora: Revisao["etapa"]; quantidadeIntegradas: number } {
  const { revisoes, revisaoPrincipal, agora } = params;
  const grupo = revisoesDoMesmoAssunto(revisoes, revisaoPrincipal);
  const etapaMaisConservadora = grupo.reduce(
    (menor, revisao) => (revisao.etapa < menor ? revisao.etapa : menor),
    revisaoPrincipal.etapa
  );
  const idsIntegradas = new Set(
    grupo.filter((r) => r.id !== revisaoPrincipal.id).map((r) => r.id)
  );
  if (idsIntegradas.size === 0) {
    return { revisoes, etapaMaisConservadora, quantidadeIntegradas: 0 };
  }
  const data = agora.toISOString();
  return {
    revisoes: revisoes.map((revisao) => idsIntegradas.has(revisao.id)
      ? { ...revisao, integradaEmId: revisaoPrincipal.id, integradaEm: data }
      : revisao),
    etapaMaisConservadora,
    quantidadeIntegradas: idsIntegradas.size,
  };
}
