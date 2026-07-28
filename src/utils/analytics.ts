import type { Materia, RegistroQuestao, SessaoEstudo } from "../types";

export type ResumoMateria = {
  materia: string;
  certas: number;
  erradas: number;
  total: number;
  aproveitamento: number;
};

export type ResumoAssunto = {
  materia: string;
  assunto: string;
  certas: number;
  erradas: number;
  total: number;
  aproveitamento: number;
};

export function calcularAproveitamento(certas: number, erradas: number) {
  const total = certas + erradas;

  if (total === 0) return 0;

  return Math.round((certas / total) * 100);
}

export function calcularTotalQuestoes(registros: RegistroQuestao[]) {
  return registros.reduce(
    (total, registro) => total + registro.certas + registro.erradas,
    0
  );
}

export function calcularTotalCertas(registros: RegistroQuestao[]) {
  return registros.reduce(
    (total, registro) => total + registro.certas,
    0
  );
}

export function calcularAproveitamentoGeral(
  registros: RegistroQuestao[]
) {
  const totalQuestoes = calcularTotalQuestoes(registros);
  const totalCertas = calcularTotalCertas(registros);

  if (totalQuestoes === 0) return 0;

  return Math.round((totalCertas / totalQuestoes) * 100);
}

export function calcularResumoPorMateria(
  registros: RegistroQuestao[]
): ResumoMateria[] {
  const mapa = new Map<
    string,
    {
      certas: number;
      erradas: number;
    }
  >();

  registros.forEach((registro) => {
    const atual = mapa.get(registro.materia) || {
      certas: 0,
      erradas: 0,
    };

    mapa.set(registro.materia, {
      certas: atual.certas + registro.certas,
      erradas: atual.erradas + registro.erradas,
    });
  });

  return Array.from(mapa.entries())
    .map(([materia, dados]) => {
      const total = dados.certas + dados.erradas;

      return {
        materia,
        certas: dados.certas,
        erradas: dados.erradas,
        total,
        aproveitamento: calcularAproveitamento(
          dados.certas,
          dados.erradas
        ),
      };
    })
    .sort((a, b) => b.aproveitamento - a.aproveitamento);
}

export function calcularResumoPorAssunto(
  registros: RegistroQuestao[]
): ResumoAssunto[] {
  const mapa = new Map<
    string,
    {
      materia: string;
      assunto: string;
      certas: number;
      erradas: number;
    }
  >();

  registros.forEach((registro) => {
    const chave = `${registro.materia}::${registro.assunto}`;

    const atual = mapa.get(chave) || {
      materia: registro.materia,
      assunto: registro.assunto,
      certas: 0,
      erradas: 0,
    };

    mapa.set(chave, {
      ...atual,
      certas: atual.certas + registro.certas,
      erradas: atual.erradas + registro.erradas,
    });
  });

  return Array.from(mapa.values())
    .map((dados) => {
      const total = dados.certas + dados.erradas;

      return {
        ...dados,
        total,
        aproveitamento: calcularAproveitamento(
          dados.certas,
          dados.erradas
        ),
      };
    })
    .sort((a, b) => b.aproveitamento - a.aproveitamento);
}

export function calcularProgressoEdital(materias: Materia[]) {
  const totalAssuntos = materias.reduce(
    (total, materia) => total + materia.assuntos.length,
    0
  );

  const assuntosConcluidos = materias.reduce(
    (total, materia) =>
      total +
      materia.assuntos.filter((assunto) => assunto.concluido).length,
    0
  );

  const percentual =
    totalAssuntos === 0
      ? 0
      : Math.round((assuntosConcluidos / totalAssuntos) * 100);

  return {
    totalAssuntos,
    assuntosConcluidos,
    percentual,
  };
}

export function calcularMinutosEstudados(
  registros: RegistroQuestao[],
  sessoes: SessaoEstudo[]
) {
  const minutosQuestoes = registros.reduce(
    (total, registro) => total + registro.minutos,
    0
  );

  const minutosSessoes = sessoes.reduce(
    (total, sessao) => total + sessao.minutos,
    0
  );

  return minutosQuestoes + minutosSessoes;
}

export function calcularHorasEstudadas(
  registros: RegistroQuestao[],
  sessoes: SessaoEstudo[]
) {
  const minutos = calcularMinutosEstudados(registros, sessoes);

  return {
    minutos,
    horasInteiras: Math.floor(minutos / 60),
    horasDecimal: Number((minutos / 60).toFixed(1)),
  };
}

export function calcularQuestoesHoje(
  registros: RegistroQuestao[]
) {
  const hoje = new Date().toISOString().slice(0, 10);

  return registros
    .filter((registro) => registro.data.slice(0, 10) === hoje)
    .reduce(
      (total, registro) =>
        total + registro.certas + registro.erradas,
      0
    );
}

export function calcularRegistrosHoje(
  registros: RegistroQuestao[]
) {
  const hoje = new Date().toISOString().slice(0, 10);

  return registros.filter(
    (registro) => registro.data.slice(0, 10) === hoje
  );
}

export function obterMelhorMateria(
  registros: RegistroQuestao[]
) {
  const resumo = calcularResumoPorMateria(registros);

  return resumo.length > 0 ? resumo[0] : null;
}

export function obterPiorMateria(
  registros: RegistroQuestao[]
) {
  const resumo = calcularResumoPorMateria(registros);

  return resumo.length > 0 ? resumo[resumo.length - 1] : null;
}

export function obterPontosFracos(
  registros: RegistroQuestao[],
  limite = 70
) {
  return calcularResumoPorMateria(registros)
    .filter((item) => item.aproveitamento < limite)
    .sort((a, b) => a.aproveitamento - b.aproveitamento);
}

export function gerarRecomendacao(
  registros: RegistroQuestao[]
) {
  const resumo = calcularResumoPorMateria(registros);

  if (resumo.length === 0) {
    return {
      titulo: "Comece registrando questões",
      descricao:
        "Ainda não há dados suficientes para gerar uma recomendação.",
      nivel: "neutro" as const,
    };
  }

  const piorMateria = resumo[resumo.length - 1];

  if (piorMateria.aproveitamento < 60) {
    return {
      titulo: `Prioridade crítica: ${piorMateria.materia}`,
      descricao: `Seu aproveitamento está em ${piorMateria.aproveitamento}%. Revise a teoria e resolva pelo menos 30 questões desse conteúdo.`,
      nivel: "critico" as const,
    };
  }

  if (piorMateria.aproveitamento < 75) {
    return {
      titulo: `Atenção em ${piorMateria.materia}`,
      descricao: `Seu aproveitamento está em ${piorMateria.aproveitamento}%. Faça uma revisão direcionada e um novo bloco de questões.`,
      nivel: "atencao" as const,
    };
  }

  return {
    titulo: "Desempenho consistente",
    descricao:
      "Todas as matérias registradas estão acima de 75%. Mantenha revisões e aumente o volume de questões.",
    nivel: "bom" as const,
  };
}