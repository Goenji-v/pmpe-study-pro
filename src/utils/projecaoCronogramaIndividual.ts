import type { MissaoPlano, SemanaPlano } from "../data/planoPMPE";

/**
 * Projeção SOMENTE DE LEITURA para um aluno já afetado pela troca de edital.
 * Não altera IDs, conclusões, histórico ou o array original.
 * Sem uma verificação de equivalência canônica, não infere conclusões novas.
 * Somente segunda a sábado são compactados. Domingo é preservado integralmente.
 * Revisões e atividades especiais não entram na régua das matérias.
 *
 * A ativação deve ser individual, depois de validar a prévia com o aluno.
 * AVISO: isto reorganiza apenas a apresentação; não garante pré-requisitos pedagógicos
 * e não deve ser usado como plano ativo antes do mapeamento canônico.
 */
export function projetarPlanoCompactado(
  plano: SemanaPlano[],
  idsConcluidos: readonly string[],
): SemanaPlano[] {
  const concluidas = new Set(idsConcluidos);
  const slots: { semana: number; dia: number; indice: number }[] = [];
  const conteudos: MissaoPlano[] = [];

  plano.forEach((semana, s) => semana.dias.forEach((dia, d) =>
    dia.missoes.forEach((missao, i) => {
      if (dia.numero === 7) return; // Domingo é intocável.
      if (missao.tipo !== "conteudo" && missao.tipo !== "questoes") return;
      if (/revis[aã]o|erros dos simulados/i.test(missao.materia + " " + missao.assunto)) return;
      slots.push({ semana: s, dia: d, indice: i });
      conteudos.push(missao);
    })
  ));

  // Stable partition: preservar a ordem relativa de cada grupo e os IDs originais.
  const ordenados = [
    ...conteudos.filter((missao) => concluidas.has(missao.id)),
    ...conteudos.filter((missao) => !concluidas.has(missao.id)),
  ];
  const resultado = plano.map((semana) => ({
    ...semana,
    dias: semana.dias.map((dia) => ({ ...dia, missoes: [...dia.missoes] })),
  }));
  slots.forEach(({ semana, dia, indice }, i) => {
    resultado[semana].dias[dia].missoes[indice] = ordenados[i];
  });
  return resultado;
}
