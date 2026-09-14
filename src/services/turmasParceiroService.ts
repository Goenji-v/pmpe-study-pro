import { supabase } from "../lib/supabase";

export type TurmaGestaoParceiro = {
  id: string;
  nome: string;
  codigo: string | null;
  iniciaEm: string | null;
  encerraEm: string | null;
  ativa: boolean;
  alunosAtivos: number;
};

export type EntradaTurmaParceiro = {
  nome: string;
  codigo?: string;
  iniciaEm?: string;
  encerraEm?: string;
};

export async function listarTurmasMeuParceiro(): Promise<TurmaGestaoParceiro[]> {
  const { data, error } = await supabase.rpc("listar_turmas_meu_parceiro");
  if (error) throw new Error(`Não foi possível carregar as turmas: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    id: texto(item.id),
    nome: texto(item.nome),
    codigo: texto(item.codigo) || null,
    iniciaEm: texto(item.inicia_em) || null,
    encerraEm: texto(item.encerra_em) || null,
    ativa: item.ativa !== false,
    alunosAtivos: numero(item.alunos_ativos),
  }));
}

export async function criarTurmaMeuParceiro(entrada: EntradaTurmaParceiro): Promise<string> {
  validar(entrada);
  const { data, error } = await supabase.rpc("criar_turma_meu_parceiro", {
    p_nome: entrada.nome.trim(),
    p_codigo: entrada.codigo?.trim() || null,
    p_inicia_em: entrada.iniciaEm || null,
    p_encerra_em: entrada.encerraEm || null,
  });
  if (error) throw new Error(`Não foi possível criar a turma: ${error.message}`);
  return texto(data);
}

export async function atualizarTurmaMeuParceiro(
  turmaId: string,
  entrada: EntradaTurmaParceiro,
  ativa: boolean,
): Promise<void> {
  validar(entrada);
  const { error } = await supabase.rpc("atualizar_turma_meu_parceiro", {
    p_turma_id: turmaId,
    p_nome: entrada.nome.trim(),
    p_codigo: entrada.codigo?.trim() || null,
    p_inicia_em: entrada.iniciaEm || null,
    p_encerra_em: entrada.encerraEm || null,
    p_ativa: ativa,
  });
  if (error) throw new Error(`Não foi possível atualizar a turma: ${error.message}`);
}

export async function duplicarTurmaMeuParceiro(turmaId: string, nome: string): Promise<string> {
  const novoNome = nome.trim();
  if (novoNome.length < 2) throw new Error("Informe um nome válido para a nova turma.");

  const { data, error } = await supabase.rpc("duplicar_turma_meu_parceiro", {
    p_turma_id: turmaId,
    p_nome: novoNome,
  });
  if (error) throw new Error(`Não foi possível duplicar a turma: ${error.message}`);
  return texto(data);
}

function validar(entrada: EntradaTurmaParceiro) {
  if (entrada.nome.trim().length < 2) throw new Error("Informe um nome válido para a turma.");
  if (entrada.iniciaEm && entrada.encerraEm && entrada.encerraEm < entrada.iniciaEm) {
    throw new Error("A data de encerramento precisa ser posterior ao início.");
  }
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}
