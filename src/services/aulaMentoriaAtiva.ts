import { armazenamentoSessaoDaConta as sessionStorage } from "./armazenamentoConta";

const CHAVE_AULA_MENTORIA_ATIVA = "mentoria:aula-ativa";

export type AulaMentoriaAtiva = {
  aulaId: string;
  cursoId: string;
  disciplinaId: string;
  moduloId: string;
  curso: string;
  disciplina: string;
  modulo: string;
  titulo: string;
  iniciadaEm: string;
};

export function registrarAulaMentoriaAtiva(aula: AulaMentoriaAtiva) {
  sessionStorage.setItem(CHAVE_AULA_MENTORIA_ATIVA, JSON.stringify(aula));
}

export function limparAulaMentoriaAtiva() {
  sessionStorage.removeItem(CHAVE_AULA_MENTORIA_ATIVA);
}

export function lerAulaMentoriaAtiva(): AulaMentoriaAtiva | null {
  const salvo = sessionStorage.getItem(CHAVE_AULA_MENTORIA_ATIVA);
  if (!salvo) return null;

  try {
    const valor = JSON.parse(salvo) as Partial<AulaMentoriaAtiva>;
    if (!valor.aulaId) return null;

    return {
      aulaId: valor.aulaId,
      cursoId: valor.cursoId ?? "",
      disciplinaId: valor.disciplinaId ?? "",
      moduloId: valor.moduloId ?? "",
      curso: valor.curso ?? "",
      disciplina: valor.disciplina ?? "",
      modulo: valor.modulo ?? "",
      titulo: valor.titulo ?? "",
      iniciadaEm: valor.iniciadaEm ?? new Date().toISOString(),
    };
  } catch {
    limparAulaMentoriaAtiva();
    return null;
  }
}
