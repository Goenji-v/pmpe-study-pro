import { supabase } from "../lib/supabase";

export type TurmaCursoParceiro = { id: string; nome: string; ativa: boolean };
export type AulaCursoParceiro = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "video" | "material" | "link" | "texto";
  url: string;
  duracaoMinutos: number;
  ordem: number;
  ativo: boolean;
  concluida?: boolean;
  concluidaEm?: string | null;
};
export type ModuloCursoParceiro = { id: string; titulo: string; descricao: string; ordem: number; ativo: boolean; aulas: AulaCursoParceiro[] };
export type DisciplinaCursoParceiro = { id: string; titulo: string; descricao: string; ordem: number; ativo: boolean; modulos: ModuloCursoParceiro[] };
export type ProgressoAlunoCurso = { userId: string; nome: string; turma: string; concluidas: number; totalAulas: number; percentual: number };
export type CursoParceiro = {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  turmaIds: string[];
  disciplinas: DisciplinaCursoParceiro[];
  progresso: ProgressoAlunoCurso[];
};
export type PainelCursosParceiro = { parceiroId: string; turmas: TurmaCursoParceiro[]; cursos: CursoParceiro[] };
export type CursoMentoriaAluno = Omit<CursoParceiro, "turmaIds" | "progresso" | "ativo">;

export async function carregarPainelCursosParceiro(): Promise<PainelCursosParceiro> {
  const { data, error } = await supabase.rpc("painel_cursos_meu_parceiro");
  if (error) throw new Error(`Não foi possível carregar os cursos: ${error.message}`);
  const valor = objeto(data);
  return {
    parceiroId: texto(valor.parceiro_id),
    turmas: lista(valor.turmas).map((item) => ({ id: texto(item.id), nome: texto(item.nome), ativa: item.ativa !== false })),
    cursos: lista(valor.cursos).map(normalizarCursoParceiro),
  };
}

export async function carregarMeusCursosMentoria(): Promise<CursoMentoriaAluno[]> {
  const { data, error } = await supabase.rpc("meus_cursos_mentoria");
  if (error) throw new Error(`Não foi possível carregar seu curso: ${error.message}`);
  return lista(data).map((item) => {
    const curso = normalizarCursoParceiro(item);
    return { id: curso.id, nome: curso.nome, descricao: curso.descricao, disciplinas: curso.disciplinas };
  });
}

export async function criarCursoParceiro(parceiroId: string, nome: string, descricao: string) {
  const userId = await usuarioAtual();
  const { error } = await supabase.from("curso_parceiro_cursos").insert({
    parceiro_id: parceiroId,
    nome: nome.trim(),
    descricao: descricao.trim() || null,
    criado_por: userId,
  });
  if (error) throw new Error(`Não foi possível criar o curso: ${error.message}`);
}

export async function criarDisciplinaCurso(cursoId: string, titulo: string, descricao: string, ordem: number) {
  const { error } = await supabase.from("curso_parceiro_disciplinas").insert({
    curso_id: cursoId,
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    ordem,
  });
  if (error) throw new Error(`Não foi possível criar a disciplina: ${error.message}`);
}

export async function criarModuloCurso(parceiroId: string, disciplinaId: string, titulo: string, descricao: string, ordem: number) {
  const userId = await usuarioAtual();
  const { error } = await supabase.from("curso_parceiro_modulos").insert({
    parceiro_id: parceiroId,
    disciplina_id: disciplinaId,
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    ordem,
    criado_por: userId,
  });
  if (error) throw new Error(`Não foi possível criar o módulo: ${error.message}`);
}

export async function criarAulaCurso(
  moduloId: string,
  titulo: string,
  descricao: string,
  tipo: AulaCursoParceiro["tipo"],
  url: string,
  duracaoMinutos: number,
  ordem: number,
) {
  const { error } = await supabase.from("curso_parceiro_aulas").insert({
    modulo_id: moduloId,
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    tipo,
    url: url.trim() || null,
    duracao_minutos: Math.max(0, duracaoMinutos || 0),
    ordem,
  });
  if (error) throw new Error(`Não foi possível criar a aula/material: ${error.message}`);
}

export async function definirTurmasCurso(cursoId: string, turmaIds: string[]) {
  const userId = await usuarioAtual();
  const { error: removerErro } = await supabase.from("curso_parceiro_turmas").delete().eq("curso_id", cursoId);
  if (removerErro) throw new Error(`Não foi possível atualizar as turmas: ${removerErro.message}`);
  if (turmaIds.length === 0) return;
  const { error } = await supabase.from("curso_parceiro_turmas").insert(turmaIds.map((turmaId) => ({
    curso_id: cursoId,
    turma_id: turmaId,
    criado_por: userId,
  })));
  if (error) throw new Error(`Não foi possível liberar o curso: ${error.message}`);
}

export async function alternarAtivoCurso(
  entidade: "curso" | "disciplina" | "modulo" | "aula",
  id: string,
  ativo: boolean,
) {
  const tabelas = {
    curso: "curso_parceiro_cursos",
    disciplina: "curso_parceiro_disciplinas",
    modulo: "curso_parceiro_modulos",
    aula: "curso_parceiro_aulas",
  } as const;
  const { error } = await supabase.from(tabelas[entidade]).update({ ativo }).eq("id", id);
  if (error) throw new Error(`Não foi possível atualizar o item: ${error.message}`);
}

export async function marcarAulaMentoria(aulaId: string, concluida: boolean) {
  const userId = await usuarioAtual();
  const agora = new Date().toISOString();
  const { error } = await supabase.from("curso_parceiro_progresso").upsert({
    aula_id: aulaId,
    user_id: userId,
    concluida,
    concluida_em: concluida ? agora : null,
    ultimo_acesso_em: agora,
    atualizado_em: agora,
  }, { onConflict: "aula_id,user_id" });
  if (error) throw new Error(`Não foi possível atualizar o progresso: ${error.message}`);
}

function normalizarCursoParceiro(item: Record<string, unknown>): CursoParceiro {
  return {
    id: texto(item.id),
    nome: texto(item.nome),
    descricao: texto(item.descricao),
    ativo: item.ativo !== false,
    turmaIds: Array.isArray(item.turma_ids) ? item.turma_ids.map(texto).filter(Boolean) : [],
    disciplinas: lista(item.disciplinas).map((d) => ({
      id: texto(d.id),
      titulo: texto(d.titulo),
      descricao: texto(d.descricao),
      ordem: numero(d.ordem),
      ativo: d.ativo !== false,
      modulos: lista(d.modulos).map((m) => ({
        id: texto(m.id),
        titulo: texto(m.titulo),
        descricao: texto(m.descricao),
        ordem: numero(m.ordem),
        ativo: m.ativo !== false,
        aulas: lista(m.aulas).map((a) => ({
          id: texto(a.id),
          titulo: texto(a.titulo),
          descricao: texto(a.descricao),
          tipo: (texto(a.tipo) || "video") as AulaCursoParceiro["tipo"],
          url: texto(a.url),
          duracaoMinutos: numero(a.duracao_minutos),
          ordem: numero(a.ordem),
          ativo: a.ativo !== false,
          concluida: a.concluida === true,
          concluidaEm: texto(a.concluida_em) || null,
        })),
      })),
    })),
    progresso: lista(item.progresso).map((p) => ({
      userId: texto(p.user_id),
      nome: texto(p.nome) || "Aluno",
      turma: texto(p.turma) || "Sem turma",
      concluidas: numero(p.concluidas),
      totalAulas: numero(p.total_aulas),
      percentual: numero(p.percentual),
    })),
  };
}

async function usuarioAtual() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Usuário não autenticado.");
  return data.user.id;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? valor.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];
}
function texto(valor: unknown) { return typeof valor === "string" ? valor : ""; }
function numero(valor: unknown) { const n = Number(valor ?? 0); return Number.isFinite(n) ? n : 0; }
