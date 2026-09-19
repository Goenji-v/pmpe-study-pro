import { supabase } from "../lib/supabase";

export type TurmaCursoParceiro = { id: string; nome: string; ativa: boolean };
export type CursoStatusParceiro = "rascunho" | "publicado" | "arquivado";
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
export type ResumoProgressoCurso = {
  alunosLiberados: number;
  alunosComAtividade: number;
  mediaPercentual: number;
  conclusoesTotal: number;
  aulasTotal: number;
};
export type CursoParceiro = {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  status: CursoStatusParceiro;
  publicadoEm: string | null;
  arquivadoEm: string | null;
  possuiProgresso: boolean;
  turmaIds: string[];
  disciplinas: DisciplinaCursoParceiro[];
  resumoProgresso: ResumoProgressoCurso;
};
export type PainelCursosParceiro = { parceiroId: string; turmas: TurmaCursoParceiro[]; cursos: CursoParceiro[] };
export type CursoMentoriaAluno = Pick<CursoParceiro, "id" | "nome" | "descricao" | "disciplinas">;

export type AulaImportacaoCurso = {
  titulo: string;
  descricao?: string;
  tipo?: AulaCursoParceiro["tipo"];
  url: string;
  duracaoMinutos?: number | null;
};
export type ModuloImportacaoCurso = {
  titulo: string;
  descricao?: string;
  aulas: AulaImportacaoCurso[];
};
export type DisciplinaImportacaoCurso = {
  titulo: string;
  descricao?: string;
  modulos: ModuloImportacaoCurso[];
};
export type RascunhoImportacaoCurso = {
  nome: string;
  descricao?: string;
  disciplinas: DisciplinaImportacaoCurso[];
};

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
  const { data, error } = await supabase.from("curso_parceiro_cursos").insert({
    parceiro_id: parceiroId,
    nome: nome.trim(),
    descricao: descricao.trim() || null,
    status: "rascunho",
    ativo: true,
    criado_por: userId,
  }).select("id").single();
  if (error) throw new Error(`Não foi possível criar o curso: ${error.message}`);
  return String(data.id);
}

export async function alterarStatusCursoParceiro(cursoId: string, status: CursoStatusParceiro) {
  const { error } = await supabase.rpc("alterar_status_curso_parceiro", {
    p_curso_id: cursoId,
    p_status: status,
  });
  if (error) throw new Error(`Não foi possível alterar o status do curso: ${error.message}`);
}

export async function duplicarCursoParceiro(cursoId: string) {
  const { data, error } = await supabase.rpc("duplicar_curso_parceiro", {
    p_curso_id: cursoId,
  });
  if (error) throw new Error(`Não foi possível duplicar o curso: ${error.message}`);
  if (!data) throw new Error("A cópia do curso não retornou um identificador.");
  return String(data);
}

export async function criarDisciplinaCurso(cursoId: string, titulo: string, descricao: string, ordem: number) {
  const { data, error } = await supabase.from("curso_parceiro_disciplinas").insert({
    curso_id: cursoId,
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    ordem,
  }).select("id").single();
  if (error) throw new Error(`Não foi possível criar a disciplina: ${error.message}`);
  return String(data.id);
}

export async function criarModuloCurso(parceiroId: string, disciplinaId: string, titulo: string, descricao: string, ordem: number) {
  const userId = await usuarioAtual();
  const { data, error } = await supabase.from("curso_parceiro_modulos").insert({
    parceiro_id: parceiroId,
    disciplina_id: disciplinaId,
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    ordem,
    criado_por: userId,
  }).select("id").single();
  if (error) throw new Error(`Não foi possível criar o módulo: ${error.message}`);
  return String(data.id);
}

export async function criarAulaCurso(
  moduloId: string,
  titulo: string,
  descricao: string,
  tipo: AulaCursoParceiro["tipo"],
  url: string,
  duracaoMinutos: number | null,
  ordem: number,
) {
  const duracao = duracaoMinutos && duracaoMinutos >= 1
    ? Math.min(1440, Math.floor(duracaoMinutos))
    : null;
  const { data, error } = await supabase.from("curso_parceiro_aulas").insert({
    modulo_id: moduloId,
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    tipo,
    url: url.trim() || null,
    duracao_minutos: duracao,
    ordem,
  }).select("id").single();
  if (error) throw new Error(`Não foi possível criar a aula/material: ${error.message}`);
  return String(data.id);
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

export async function excluirItemCurso(
  entidade: "curso" | "disciplina" | "modulo" | "aula",
  id: string,
) {
  const tabelas = {
    curso: "curso_parceiro_cursos",
    disciplina: "curso_parceiro_disciplinas",
    modulo: "curso_parceiro_modulos",
    aula: "curso_parceiro_aulas",
  } as const;
  const { error } = await supabase.from(tabelas[entidade]).delete().eq("id", id);
  if (error) {
    const protegida = /progresso dos alunos foi preservado|possui progresso de alunos/i.test(error.message);
    if (protegida) throw new Error(error.message);
    throw new Error(`Não foi possível excluir o item: ${error.message}`);
  }
}

export async function importarEstruturaCurso({
  parceiroId,
  rascunho,
  cursoId,
  ordemDisciplinaInicial = 0,
}: {
  parceiroId: string;
  rascunho: RascunhoImportacaoCurso;
  cursoId?: string;
  ordemDisciplinaInicial?: number;
}) {
  validarRascunhoImportacao(rascunho);
  const destinoId = cursoId || await criarCursoParceiro(
    parceiroId,
    rascunho.nome || "Curso importado",
    rascunho.descricao || "Importado para revisão no Study Pro"
  );

  for (let indiceDisciplina = 0; indiceDisciplina < rascunho.disciplinas.length; indiceDisciplina += 1) {
    const disciplina = rascunho.disciplinas[indiceDisciplina];
    const disciplinaId = await criarDisciplinaCurso(
      destinoId,
      disciplina.titulo,
      disciplina.descricao || "",
      ordemDisciplinaInicial + indiceDisciplina + 1,
    );

    for (let indiceModulo = 0; indiceModulo < disciplina.modulos.length; indiceModulo += 1) {
      const modulo = disciplina.modulos[indiceModulo];
      const moduloId = await criarModuloCurso(
        parceiroId,
        disciplinaId,
        modulo.titulo,
        modulo.descricao || "",
        indiceModulo + 1,
      );

      for (let indiceAula = 0; indiceAula < modulo.aulas.length; indiceAula += 1) {
        const aula = modulo.aulas[indiceAula];
        await criarAulaCurso(
          moduloId,
          aula.titulo,
          aula.descricao || "",
          aula.tipo || "video",
          aula.url,
          aula.duracaoMinutos ?? null,
          indiceAula + 1,
        );
      }
    }
  }

  return destinoId;
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

function validarRascunhoImportacao(rascunho: RascunhoImportacaoCurso) {
  if (!rascunho.disciplinas.length) throw new Error("A importação não possui disciplinas para aprovar.");
  for (const disciplina of rascunho.disciplinas) {
    if (disciplina.titulo.trim().length < 2) throw new Error("Toda disciplina precisa ter um nome.");
    for (const modulo of disciplina.modulos) {
      if (modulo.titulo.trim().length < 2) throw new Error(`A disciplina “${disciplina.titulo}” possui um módulo sem nome.`);
      for (const aula of modulo.aulas) {
        if (aula.titulo.trim().length < 2) throw new Error(`O módulo “${modulo.titulo}” possui uma aula sem título.`);
        if (!/^https:\/\//i.test(aula.url.trim())) {
          throw new Error(`A aula “${aula.titulo}” precisa de um link HTTPS válido.`);
        }
      }
    }
  }
}

function normalizarCursoParceiro(item: Record<string, unknown>): CursoParceiro {
  const statusBruto = texto(item.status);
  const status: CursoStatusParceiro = statusBruto === "rascunho" || statusBruto === "arquivado"
    ? statusBruto
    : "publicado";
  return {
    id: texto(item.id),
    nome: texto(item.nome),
    descricao: texto(item.descricao),
    ativo: item.ativo !== false,
    status,
    publicadoEm: texto(item.publicado_em) || null,
    arquivadoEm: texto(item.arquivado_em) || null,
    possuiProgresso: item.possui_progresso === true,
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
    resumoProgresso: (() => {
      const resumo = objeto(item.resumo_progresso);
      return {
        alunosLiberados: numero(resumo.alunos_liberados),
        alunosComAtividade: numero(resumo.alunos_com_atividade),
        mediaPercentual: numero(resumo.media_percentual),
        conclusoesTotal: numero(resumo.conclusoes_total),
        aulasTotal: numero(resumo.aulas_total),
      };
    })(),
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