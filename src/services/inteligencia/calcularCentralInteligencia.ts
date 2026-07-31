import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";

import type {
  DadosCentral,
  DesempenhoAssunto,
  DesempenhoBanca,
  DesempenhoMateria,
  MissaoDia,
} from "./types";

export function calcularCentralInteligencia({
  questoes,
  sessoes,
  revisoes,
  simulados,
  metaMinutos,
  metaQuestoes,
  metaRevisoes,
}: {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  metaMinutos: number;
  metaQuestoes: number;
  metaRevisoes: number;
}): DadosCentral {
  const agora =
    new Date();

  const inicioHoje =
    inicioDoDia(agora);

  const inicioSemana =
    new Date(inicioHoje);

  inicioSemana.setDate(
    inicioSemana.getDate() - 6
  );

  const sessoesHoje =
    sessoes.filter(
      (sessao) =>
        novaDataSegura(
          sessao.data
        ) >= inicioHoje
    );

  const sessoesSemana =
    sessoes.filter(
      (sessao) =>
        novaDataSegura(
          sessao.data
        ) >= inicioSemana
    );

  const questoesHoje =
    questoes.filter(
      (registro) =>
        novaDataSegura(
          registro.data
        ) >= inicioHoje
    );

  const questoesSemana =
    questoes.filter(
      (registro) =>
        novaDataSegura(
          registro.data
        ) >= inicioSemana
    );

  const revisoesConcluidasHoje =
    revisoes.filter(
      (revisao) =>
        revisao.concluida &&
        revisao.dataConclusao &&
        novaDataSegura(
          revisao.dataConclusao
        ) >= inicioHoje
    );

  const revisoesAtrasadas =
    revisoes
      .filter(
        (revisao) =>
          !revisao.concluida &&
          novaDataSegura(
            revisao.dataPrevista
          ) < inicioHoje
      )
      .sort(
        (a, b) =>
          novaDataSegura(
            a.dataPrevista
          ).getTime() -
          novaDataSegura(
            b.dataPrevista
          ).getTime()
      );

  const fimHoje =
    new Date(inicioHoje);

  fimHoje.setDate(
    fimHoje.getDate() + 1
  );

  const revisoesHoje =
    revisoes.filter(
      (revisao) => {
        if (revisao.concluida) {
          return false;
        }

        const data =
          novaDataSegura(
            revisao.dataPrevista
          );

        return (
          data >= inicioHoje &&
          data < fimHoje
        );
      }
    );

  const resumoHoje =
    calcularResumoQuestoes(
      questoesHoje
    );

  const resumoSemana =
    calcularResumoQuestoes(
      questoesSemana
    );

  const resumoTotal =
    calcularResumoQuestoes(
      questoes
    );

  const minutosHoje =
    somarMinutos(
      sessoesHoje
    );

  const minutosSemana =
    somarMinutos(
      sessoesSemana
    );

  const minutosTotal =
    somarMinutos(
      sessoes
    );

  const diasAtivosSemana =
    new Set(
      sessoesSemana.map(
        (sessao) =>
          chaveData(
            sessao.data
          )
      )
    ).size;

  const materias =
    calcularDesempenhoMaterias(
      questoes,
      sessoes
    );

  const assuntos =
    calcularDesempenhoAssuntos(
      questoes
    );

  const bancas =
    calcularDesempenhoBancas(
      questoes
    );

  const materiasComQuestoes =
    materias.filter(
      (materia) =>
        materia.total >= 3
    );

  const melhorMateria =
    materiasComQuestoes.length >
    0
      ? [...materiasComQuestoes].sort(
          (a, b) =>
            b.percentual -
            a.percentual
        )[0]
      : null;

  const piorMateria =
    materiasComQuestoes.length >
    0
      ? [...materiasComQuestoes].sort(
          (a, b) =>
            a.percentual -
            b.percentual
        )[0]
      : null;

  const materiaEsquecida =
    materias.length > 0
      ? [...materias].sort(
          (a, b) =>
            b.diasSemEstudar -
            a.diasSemEstudar
        )[0]
      : null;

  const assuntosCriticos =
    assuntos
      .filter(
        (assunto) =>
          assunto.total >= 3 &&
          assunto.percentual < 70
      )
      .sort(
        (a, b) =>
          a.percentual -
          b.percentual
      )
      .slice(0, 5);

  const assuntosDominados =
    assuntos
      .filter(
        (assunto) =>
          assunto.total >= 5 &&
          assunto.percentual >= 80
      )
      .sort(
        (a, b) =>
          b.percentual -
          a.percentual
      )
      .slice(0, 5);

  const desempenhoSimulados =
    calcularDesempenhoSimulados(
      simulados
    );

  const indiceProntidao =
    calcularIndiceProntidao({
      aproveitamentoQuestoes:
        resumoTotal.percentual,
      aproveitamentoSimulados:
        desempenhoSimulados.percentual,
      minutosSemana,
      diasAtivosSemana,
      revisoesAtrasadas:
        revisoesAtrasadas.length,
      totalQuestoes:
        resumoTotal.total,
      metaMinutos,
    });

  const previsaoNota =
    calcularPrevisaoNota({
      aproveitamentoQuestoes:
        resumoTotal.percentual,
      aproveitamentoSimulados:
        desempenhoSimulados.percentual,
      indiceProntidao,
    });

  const chanceAprovacao =
    calcularChanceAprovacao({
      previsaoNota,
      indiceProntidao,
      revisoesAtrasadas:
        revisoesAtrasadas.length,
    });

  const maiorRisco =
    piorMateria?.materia ||
    materiaEsquecida?.materia ||
    "Sem dados suficientes";

  const missoes =
    gerarMissoes({
      revisoesAtrasadas,
      revisoesHoje,
      assuntosCriticos,
      piorMateria,
      materiaEsquecida,
      metaMinutos,
      metaQuestoes,
      metaRevisoes,
    });

  return {
    indiceProntidao,
    classificacao:
      classificarProntidao(
        indiceProntidao
      ),

    hoje: {
      minutos: minutosHoje,
      questoes:
        resumoHoje.total,
      certas:
        resumoHoje.certas,
      erradas:
        resumoHoje.erradas,
      percentual:
        resumoHoje.percentual,
      revisoesConcluidas:
        revisoesConcluidasHoje.length,
    },

    semana: {
      minutos: minutosSemana,
      questoes:
        resumoSemana.total,
      certas:
        resumoSemana.certas,
      erradas:
        resumoSemana.erradas,
      percentual:
        resumoSemana.percentual,
      sessoes:
        sessoesSemana.length,
      diasAtivos:
        diasAtivosSemana,
    },

    total: {
      minutos: minutosTotal,
      questoes:
        resumoTotal.total,
      percentual:
        resumoTotal.percentual,
      simulados:
        simulados.length,
      revisoesConcluidas:
        revisoes.filter(
          (revisao) =>
            revisao.concluida
        ).length,
    },

    revisoesAtrasadas,
    revisoesHoje,

    materias,
    assuntosCriticos,
    assuntosDominados,
    bancas,

    melhorMateria,
    piorMateria,
    materiaEsquecida,

    previsaoNota,
    chanceAprovacao,
    maiorRisco,

    missoes,
    tempoMissao:
      missoes.reduce(
        (total, missao) =>
          total + missao.minutos,
        0
      ),
  };
}

function calcularResumoQuestoes(
  registros: RegistroQuestao[]
) {
  const certas =
    registros.reduce(
      (total, registro) =>
        total +
        numeroSeguro(
          registro.certas
        ),
      0
    );

  const erradas =
    registros.reduce(
      (total, registro) =>
        total +
        numeroSeguro(
          registro.erradas
        ),
      0
    );

  const total =
    certas + erradas;

  const percentual =
    total === 0
      ? 0
      : Math.round(
          (certas / total) *
            100
        );

  return {
    certas,
    erradas,
    total,
    percentual,
  };
}

function calcularDesempenhoMaterias(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[]
): DesempenhoMateria[] {
  const mapa =
    new Map<
      string,
      DesempenhoMateria
    >();

  questoes.forEach(
    (registro) => {
      const materia =
        registro.materia.trim() ||
        "Sem matéria";

      const chave =
        normalizarTexto(
          materia
        );

      const atual =
        mapa.get(chave) || {
          materia,
          certas: 0,
          erradas: 0,
          total: 0,
          percentual: 0,
          minutos: 0,
          ultimaAtividade:
            undefined,
          diasSemEstudar: 999,
        };

      atual.certas +=
        numeroSeguro(
          registro.certas
        );

      atual.erradas +=
        numeroSeguro(
          registro.erradas
        );

      atual.total =
        atual.certas +
        atual.erradas;

      atual.percentual =
        atual.total === 0
          ? 0
          : Math.round(
              (atual.certas /
                atual.total) *
                100
            );

      atual.minutos +=
        numeroSeguro(
          registro.minutos
        );

      if (
        !atual.ultimaAtividade ||
        novaDataSegura(
          registro.data
        ) >
          novaDataSegura(
            atual.ultimaAtividade
          )
      ) {
        atual.ultimaAtividade =
          registro.data;
      }

      mapa.set(
        chave,
        atual
      );
    }
  );

  sessoes.forEach(
    (sessao) => {
      const materia =
        sessao.materia.trim() ||
        "Sem matéria";

      const chave =
        normalizarTexto(
          materia
        );

      const atual =
        mapa.get(chave) || {
          materia,
          certas: 0,
          erradas: 0,
          total: 0,
          percentual: 0,
          minutos: 0,
          ultimaAtividade:
            undefined,
          diasSemEstudar: 999,
        };

      atual.minutos +=
        numeroSeguro(
          sessao.minutos
        );

      if (
        !atual.ultimaAtividade ||
        novaDataSegura(
          sessao.data
        ) >
          novaDataSegura(
            atual.ultimaAtividade
          )
      ) {
        atual.ultimaAtividade =
          sessao.data;
      }

      mapa.set(
        chave,
        atual
      );
    }
  );

  return Array.from(
    mapa.values()
  )
    .map(
      (materia) => ({
        ...materia,
        diasSemEstudar:
          materia.ultimaAtividade
            ? calcularDiasDesde(
                materia.ultimaAtividade
              )
            : 999,
      })
    )
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.minutos - a.minutos
    );
}

function calcularDesempenhoAssuntos(
  questoes: RegistroQuestao[]
): DesempenhoAssunto[] {
  const mapa =
    new Map<
      string,
      DesempenhoAssunto
    >();

  questoes.forEach(
    (registro) => {
      const materia =
        registro.materia.trim() ||
        "Sem matéria";

      const assunto =
        registro.assunto.trim() ||
        "Sem assunto";

      const chave =
        `${normalizarTexto(
          materia
        )}::${normalizarTexto(
          assunto
        )}`;

      const atual =
        mapa.get(chave) || {
          chave,
          materia,
          assunto,
          certas: 0,
          erradas: 0,
          total: 0,
          percentual: 0,
        };

      atual.certas +=
        numeroSeguro(
          registro.certas
        );

      atual.erradas +=
        numeroSeguro(
          registro.erradas
        );

      atual.total =
        atual.certas +
        atual.erradas;

      atual.percentual =
        atual.total === 0
          ? 0
          : Math.round(
              (atual.certas /
                atual.total) *
                100
            );

      mapa.set(
        chave,
        atual
      );
    }
  );

  return Array.from(
    mapa.values()
  );
}

function calcularDesempenhoBancas(
  questoes: RegistroQuestao[]
): DesempenhoBanca[] {
  const mapa =
    new Map<
      string,
      DesempenhoBanca
    >();

  questoes.forEach(
    (registro) => {
      const banca =
        registro.banca.trim() ||
        "Não informada";

      const chave =
        normalizarTexto(
          banca
        );

      const atual =
        mapa.get(chave) || {
          banca,
          certas: 0,
          erradas: 0,
          total: 0,
          percentual: 0,
        };

      atual.certas +=
        numeroSeguro(
          registro.certas
        );

      atual.erradas +=
        numeroSeguro(
          registro.erradas
        );

      atual.total =
        atual.certas +
        atual.erradas;

      atual.percentual =
        atual.total === 0
          ? 0
          : Math.round(
              (atual.certas /
                atual.total) *
                100
            );

      mapa.set(
        chave,
        atual
      );
    }
  );

  return Array.from(
    mapa.values()
  ).sort(
    (a, b) =>
      b.total - a.total
  );
}

function calcularDesempenhoSimulados(
  simulados: Simulado[]
) {
  const certas =
    simulados.reduce(
      (total, simulado) =>
        total +
        numeroSeguro(
          simulado.certas
        ),
      0
    );

  const erradas =
    simulados.reduce(
      (total, simulado) =>
        total +
        numeroSeguro(
          simulado.erradas
        ),
      0
    );

  const total =
    certas + erradas;

  return {
    certas,
    erradas,
    total,
    percentual:
      total === 0
        ? 0
        : Math.round(
            (certas / total) *
              100
          ),
  };
}

function calcularIndiceProntidao({
  aproveitamentoQuestoes,
  aproveitamentoSimulados,
  minutosSemana,
  diasAtivosSemana,
  revisoesAtrasadas,
  totalQuestoes,
  metaMinutos,
}: {
  aproveitamentoQuestoes: number;
  aproveitamentoSimulados: number;
  minutosSemana: number;
  diasAtivosSemana: number;
  revisoesAtrasadas: number;
  totalQuestoes: number;
  metaMinutos: number;
}) {
  const notaQuestoes =
    totalQuestoes === 0
      ? 0
      : aproveitamentoQuestoes;

  const notaSimulados =
    aproveitamentoSimulados ===
    0
      ? notaQuestoes
      : aproveitamentoSimulados;

  const metaSemanal =
    Math.max(
      metaMinutos * 6,
      1
    );

  const notaTempo =
    limitarNumero(
      Math.round(
        (minutosSemana /
          metaSemanal) *
          100
      ),
      0,
      100
    );

  const notaFrequencia =
    limitarNumero(
      Math.round(
        (diasAtivosSemana / 6) *
          100
      ),
      0,
      100
    );

  const penalidadeRevisoes =
    Math.min(
      revisoesAtrasadas * 2,
      20
    );

  const indice =
    notaQuestoes * 0.4 +
    notaSimulados * 0.2 +
    notaTempo * 0.2 +
    notaFrequencia * 0.2 -
    penalidadeRevisoes;

  return limitarNumero(
    Math.round(indice),
    0,
    100
  );
}

function calcularPrevisaoNota({
  aproveitamentoQuestoes,
  aproveitamentoSimulados,
  indiceProntidao,
}: {
  aproveitamentoQuestoes: number;
  aproveitamentoSimulados: number;
  indiceProntidao: number;
}) {
  const simulados =
    aproveitamentoSimulados > 0
      ? aproveitamentoSimulados
      : aproveitamentoQuestoes;

  return limitarNumero(
    Math.round(
      aproveitamentoQuestoes *
        0.45 +
        simulados * 0.35 +
        indiceProntidao * 0.2
    ),
    0,
    100
  );
}

function calcularChanceAprovacao({
  previsaoNota,
  indiceProntidao,
  revisoesAtrasadas,
}: {
  previsaoNota: number;
  indiceProntidao: number;
  revisoesAtrasadas: number;
}) {
  const penalidade =
    Math.min(
      revisoesAtrasadas,
      10
    );

  return limitarNumero(
    Math.round(
      previsaoNota * 0.65 +
        indiceProntidao *
          0.35 -
        penalidade
    ),
    0,
    100
  );
}

function gerarMissoes({
  revisoesAtrasadas,
  revisoesHoje,
  assuntosCriticos,
  piorMateria,
  materiaEsquecida,
  metaMinutos,
  metaQuestoes,
  metaRevisoes,
}: {
  revisoesAtrasadas: Revisao[];
  revisoesHoje: Revisao[];
  assuntosCriticos: DesempenhoAssunto[];
  piorMateria: DesempenhoMateria | null;
  materiaEsquecida: DesempenhoMateria | null;
  metaMinutos: number;
  metaQuestoes: number;
  metaRevisoes: number;
}): MissaoDia[] {
  const missoes:
    MissaoDia[] = [];

  const revisaoPrioritaria =
    revisoesAtrasadas[0] ||
    revisoesHoje[0];

  if (revisaoPrioritaria) {
    missoes.push({
      id: `revisao-${revisaoPrioritaria.id}`,
      tipo: "revisao",
      titulo: "Concluir revisão prioritária",
      descricao: `${revisaoPrioritaria.materia} — ${revisaoPrioritaria.assunto}`,
      materia:
        revisaoPrioritaria.materia,
      assunto:
        revisaoPrioritaria.assunto,
      minutos: 20,
      prioridade: "alta",
      rota: "/revisoes",
    });
  }

  const assuntoCritico =
    assuntosCriticos[0];

  if (assuntoCritico) {
    const quantidade =
      limitarNumero(
        Math.round(
          metaQuestoes * 0.3
        ),
        10,
        40
      );

    missoes.push({
      id: `questoes-${assuntoCritico.chave}`,
      tipo: "questoes",
      titulo: `Treino de ${assuntoCritico.assunto}`,
      descricao: `${assuntoCritico.materia} está com ${assuntoCritico.percentual}% de aproveitamento.`,
      materia:
        assuntoCritico.materia,
      assunto:
        assuntoCritico.assunto,
      minutos: Math.max(
        25,
        Math.round(
          quantidade * 1.5
        )
      ),
      quantidadeQuestoes:
        quantidade,
      prioridade: "alta",
      rota: "/gerar-simulado-ia",
    });
  } else if (piorMateria) {
    const quantidade =
      limitarNumero(
        Math.round(
          metaQuestoes * 0.25
        ),
        10,
        30
      );

    missoes.push({
      id: `questoes-${normalizarTexto(
        piorMateria.materia
      )}`,
      tipo: "questoes",
      titulo: `Questões de ${piorMateria.materia}`,
      descricao: `A matéria possui ${piorMateria.percentual}% de aproveitamento.`,
      materia:
        piorMateria.materia,
      minutos: Math.max(
        25,
        Math.round(
          quantidade * 1.5
        )
      ),
      quantidadeQuestoes:
        quantidade,
      prioridade: "media",
      rota: "/gerar-simulado-ia",
    });
  }

  if (
    materiaEsquecida &&
    materiaEsquecida.diasSemEstudar >=
      5
  ) {
    const minutos =
      limitarNumero(
        Math.round(
          metaMinutos * 0.3
        ),
        20,
        45
      );

    missoes.push({
      id: `estudo-${normalizarTexto(
        materiaEsquecida.materia
      )}`,
      tipo: "estudo",
      titulo: `Retomar ${materiaEsquecida.materia}`,
      descricao: `A última atividade foi há ${materiaEsquecida.diasSemEstudar} dias.`,
      materia:
        materiaEsquecida.materia,
      minutos,
      prioridade: "media",
      rota: "/central-estudos",
    });
  }

  if (
    revisoesAtrasadas.length >
    1
  ) {
    const quantidade =
      limitarNumero(
        Math.min(
          revisoesAtrasadas.length,
          metaRevisoes
        ),
        1,
        5
      );

    missoes.push({
      id: "revisoes-pendentes",
      tipo: "revisao",
      titulo: `Concluir mais ${quantidade} revisões`,
      descricao:
        "Reduza a fila de revisões atrasadas antes de adicionar novos conteúdos.",
      minutos:
        quantidade * 12,
      prioridade: "alta",
      rota: "/revisoes",
    });
  }

  if (missoes.length === 0) {
    missoes.push({
      id: "estudo-geral",
      tipo: "estudo",
      titulo:
        "Continuar plano de estudos",
      descricao:
        "Siga a próxima atividade prevista no seu cronograma.",
      minutos:
        limitarNumero(
          metaMinutos,
          30,
          120
        ),
      prioridade: "baixa",
      rota: "/central-estudos",
    });
  }

  return missoes.slice(
    0,
    4
  );
}

function classificarProntidao(
  indice: number
) {
  if (indice >= 85) {
    return "Preparação excelente";
  }

  if (indice >= 70) {
    return "Boa preparação";
  }

  if (indice >= 55) {
    return "Preparação intermediária";
  }

  if (indice >= 35) {
    return "Precisa de reforço";
  }

  return "Início da preparação";
}

function somarMinutos(
  sessoes: SessaoEstudo[]
) {
  return sessoes.reduce(
    (total, sessao) =>
      total +
      numeroSeguro(
        sessao.minutos
      ),
    0
  );
}

function calcularDiasDesde(
  data: string
) {
  const inicio =
    inicioDoDia(
      novaDataSegura(
        data
      )
    );

  const hoje =
    inicioDoDia(
      new Date()
    );

  const diferenca =
    hoje.getTime() -
    inicio.getTime();

  return Math.max(
    0,
    Math.floor(
      diferenca /
        86400000
    )
  );
}

function inicioDoDia(
  data: Date
) {
  const resultado =
    new Date(data);

  resultado.setHours(
    0,
    0,
    0,
    0
  );

  return resultado;
}

function novaDataSegura(
  valor?: string
) {
  if (!valor) {
    return new Date(0);
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return new Date(0);
  }

  return data;
}

function chaveData(
  valor: string
) {
  const data =
    novaDataSegura(
      valor
    );

  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      data.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${ano}-${mes}-${dia}`;
}

function numeroSeguro(
  valor: number
) {
  return Number.isFinite(
    valor
  )
    ? valor
    : 0;
}

function limitarNumero(
  valor: number,
  minimo: number,
  maximo: number
) {
  return Math.min(
    maximo,
    Math.max(
      minimo,
      valor
    )
  );
}

function normalizarTexto(
  texto: string
) {
  return texto
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}