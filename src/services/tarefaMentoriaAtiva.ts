import { armazenamentoSessaoDaConta as sessionStorage } from "./armazenamentoConta";

const CHAVE_TAREFA_MENTORIA_ATIVA = "mentoria:tarefa-ativa";

export type TarefaMentoriaAtiva = {
  id: string;
  materia: string;
  assunto: string;
  iniciadaEm: string;
};

export function registrarTarefaMentoriaAtiva(tarefa: TarefaMentoriaAtiva) {
  sessionStorage.setItem(CHAVE_TAREFA_MENTORIA_ATIVA, JSON.stringify(tarefa));
}

export function limparTarefaMentoriaAtiva() {
  sessionStorage.removeItem(CHAVE_TAREFA_MENTORIA_ATIVA);
}

export function lerTarefaMentoriaAtiva(): TarefaMentoriaAtiva | null {
  const salvo = sessionStorage.getItem(CHAVE_TAREFA_MENTORIA_ATIVA);
  if (!salvo) return null;

  try {
    const valor = JSON.parse(salvo) as Partial<TarefaMentoriaAtiva>;
    if (!valor.id) return null;
    return {
      id: valor.id,
      materia: valor.materia ?? "",
      assunto: valor.assunto ?? "",
      iniciadaEm: valor.iniciadaEm ?? new Date().toISOString(),
    };
  } catch {
    limparTarefaMentoriaAtiva();
    return null;
  }
}
