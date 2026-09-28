import type { SemanaPlano, MissaoPlano } from "../data/planoPMPE";
import type { DiaSemanaId } from "../types/editalInteligente";

const DIA_NUMERO: Record<DiaSemanaId, number> = {
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
  dom: 7,
};

export function numeroDiaSemana(dia?: DiaSemanaId) {
  return DIA_NUMERO[dia ?? "dom"] ?? 7;
}

export function aplicarDiasAtividadesSemanais(
  plano: SemanaPlano[],
  configuracao?: {
    diaRedacaoSemanal?: DiaSemanaId;
    diaSimuladoSemanal?: DiaSemanaId;
  }
): SemanaPlano[] {
  const diaRedacao = numeroDiaSemana(configuracao?.diaRedacaoSemanal);
  const diaSimulado = numeroDiaSemana(configuracao?.diaSimuladoSemanal);

  return plano.map((semana) => {
    const dias = semana.dias.map((dia) => ({
      ...dia,
      missoes: dia.missoes.filter(
        (missao) => missao.tipo !== "redacao" && missao.tipo !== "simulado"
      ),
    }));

    const originais = semana.dias.flatMap((dia) => dia.missoes);
    const redacao =
      originais.find((missao) => missao.tipo === "redacao") ??
      criarAtividade(semana.numero, "redacao");
    const simulado =
      originais.find((missao) => missao.tipo === "simulado") ??
      criarAtividade(semana.numero, "simulado");

    adicionarMissao(dias, diaRedacao, redacao);
    adicionarMissao(dias, diaSimulado, simulado);

    return { ...semana, dias };
  });
}

function adicionarMissao(
  dias: SemanaPlano["dias"],
  numeroDia: number,
  missao: MissaoPlano
) {
  const dia = dias.find((item) => item.numero === numeroDia);
  if (!dia) return;

  const maiorNumero = dia.missoes.reduce(
    (maior, item) => Math.max(maior, item.numero),
    0
  );

  dia.missoes.push({
    ...missao,
    numero: maiorNumero + 1,
  });
}

function criarAtividade(
  semana: number,
  tipo: "redacao" | "simulado"
): MissaoPlano {
  const redacao = tipo === "redacao";

  return {
    id: `s${semana}-atividade-${tipo}`,
    numero: 1,
    materia: redacao ? "Redação" : "Simulado",
    assunto: redacao ? "Redação semanal" : "Simulado semanal",
    tipo,
  };
}
