import type { DiaSemanaId } from "../types/editalInteligente";

type RitmoSemanal = Partial<Record<DiaSemanaId, number>>;

type ComRitmoSemanal = {
  materiasPorDiaSemana?: RitmoSemanal;
};

/**
 * O formulário pode permanecer aberto enquanto moedas, conquistas e dados do
 * aluno mudam em outra tela. Só campos explicitamente editados devem ser
 * aplicados ao estado mais recente, dentro de um setState funcional.
 *
 * Alterações de dias individuais não substituem outros dias da semana.
 * null significa uma escolha explícita de voltar ao padrão semanal.
 */
export function mesclarConfiguracoesEditadas<T extends ComRitmoSemanal>(
  atuais: T,
  camposEditados: Partial<T>,
  diasEditados?: RitmoSemanal | null
): T {
  const resultado = { ...atuais, ...camposEditados };
  if (diasEditados === null) {
    resultado.materiasPorDiaSemana = undefined;
  } else if (diasEditados) {
    resultado.materiasPorDiaSemana = {
      ...atuais.materiasPorDiaSemana,
      ...diasEditados,
    };
  }
  return resultado;
}
