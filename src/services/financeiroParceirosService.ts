import { supabase } from "../lib/supabase";

export type StatusFinanceiroParceiro = "pendente" | "pago" | "cancelado";

export type FaturamentoOperacionalParceiro = {
  id: string;
  parceiroId: string | null;
  competencia: string;
  alunosAtivos: number;
  valorUnitarioCentavos: number;
  valorBaseCentavos: number;
  ajusteCentavos: number;
  valorDevidoCentavos: number;
  status: StatusFinanceiroParceiro;
  vencimentoEm: string | null;
  pagoEm: string | null;
  observacao: string | null;
  fechadoEm: string;
  atualizadoEm: string;
};

export type FecharCompetenciaParceiro = {
  parceiroId: string;
  competencia: string;
  ajusteCentavos: number;
  vencimentoEm: string | null;
  observacao: string | null;
};

export type AtualizarFaturamentoParceiro = {
  faturamentoId: string;
  status: StatusFinanceiroParceiro;
  ajusteCentavos: number;
  vencimentoEm: string | null;
  observacao: string | null;
};

type Registro = Record<string, unknown>;

export async function listarFaturamentoParceiroAdmin(parceiroId: string) {
  const { data, error } = await supabase.rpc("listar_faturamento_parceiro_admin", {
    p_parceiro_id: parceiroId,
  });
  if (error) throw new Error(`Não foi possível carregar o financeiro: ${error.message}`);
  return normalizarLista(data);
}

export async function listarMeuFaturamentoParceiro() {
  const { data, error } = await supabase.rpc("listar_meu_faturamento_parceiro");
  if (error) throw new Error(`Não foi possível carregar o financeiro da parceria: ${error.message}`);
  return normalizarLista(data);
}

export async function fecharCompetenciaParceiroAdmin(entrada: FecharCompetenciaParceiro) {
  const { error } = await supabase.rpc("fechar_faturamento_parceiro_admin", {
    p_parceiro_id: entrada.parceiroId,
    p_competencia: `${entrada.competencia.slice(0, 7)}-01`,
    p_ajuste_centavos: Math.round(entrada.ajusteCentavos),
    p_vencimento_em: entrada.vencimentoEm || null,
    p_observacao: entrada.observacao?.trim() || null,
  });
  if (error) throw new Error(`Não foi possível fechar a competência: ${error.message}`);
}

export async function atualizarFaturamentoParceiroAdmin(entrada: AtualizarFaturamentoParceiro) {
  const { error } = await supabase.rpc("atualizar_faturamento_parceiro_admin", {
    p_faturamento_id: entrada.faturamentoId,
    p_status: entrada.status,
    p_ajuste_centavos: Math.round(entrada.ajusteCentavos),
    p_vencimento_em: entrada.vencimentoEm || null,
    p_observacao: entrada.observacao?.trim() || null,
  });
  if (error) throw new Error(`Não foi possível atualizar o financeiro: ${error.message}`);
}

function normalizarLista(valor: unknown): FaturamentoOperacionalParceiro[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item): item is Registro => !!item && typeof item === "object")
    .map((item) => ({
      id: texto(item.id),
      parceiroId: texto(item.parceiro_id) || null,
      competencia: texto(item.competencia),
      alunosAtivos: numero(item.alunos_ativos),
      valorUnitarioCentavos: numero(item.valor_unitario_centavos),
      valorBaseCentavos: numero(item.valor_base_centavos),
      ajusteCentavos: numero(item.ajuste_centavos),
      valorDevidoCentavos: numero(item.valor_devido_centavos),
      status: status(item.status),
      vencimentoEm: texto(item.vencimento_em) || null,
      pagoEm: texto(item.pago_em) || null,
      observacao: texto(item.observacao) || null,
      fechadoEm: texto(item.fechado_em),
      atualizadoEm: texto(item.atualizado_em),
    }));
}

function status(valor: unknown): StatusFinanceiroParceiro {
  return valor === "pago" || valor === "cancelado" ? valor : "pendente";
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown) {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}
