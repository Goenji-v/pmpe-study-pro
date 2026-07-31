import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";

export type ResumoInteligencia = {
  hoje: {
    minutos: number;
    questoes: number;
    certas: number;
    erradas: number;
    percentual: number;
    revisoesConcluidas: number;
  };

  semana: {
    minutos: number;
    questoes: number;
    certas: number;
    erradas: number;
    percentual: number;
    sessoes: number;
    diasAtivos: number;
  };

  geral: {
    minutos: number;
    questoes: number;
    certas: number;
    erradas: number;
    percentual: number;
    simulados: number;
    revisoesConcluidas: number;
  };
};

type CalcularResumoProps = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
};

export function calcularResumoInteligencia({
  questoes,
  sessoes,
  revisoes,
  simulados,
}: CalcularResumoProps): ResumoInteligencia {
  const hoje = inicioDoDia(
    new Date()
  );

  const inicioSemana =
    new Date(hoje);

  inicioSemana.setDate(
    inicioSemana.getDate() - 6
  );

  const questoesHoje =
    questoes.filter(
      (registro) =>
        dataSegura(
          registro.data
        ) >= hoje
    );

  const questoesSemana =
    questoes.filter(
      (registro) =>
        dataSegura(
          registro.data
        ) >= inicioSemana
    );

  const sessoesHoje =
    sessoes.filter(
      (sessao) =>
        dataSegura(
          sessao.data
        ) >= hoje
    );

  const sessoesSemana =
    sessoes.filter(
      (sessao) =>
        dataSegura(
          sessao.data
        ) >= inicioSemana
    );

  const revisoesConcluidasHoje =
    revisoes.filter(
      (revisao) =>
        revisao.concluida &&
        Boolean(
          revisao.dataConclusao
        ) &&
        dataSegura(
          revisao.dataConclusao
        ) >= hoje
    );

  const resumoQuestoesHoje =
    calcularResumoQuestoes(
      questoesHoje
    );

  const resumoQuestoesSemana =
    calcularResumoQuestoes(
      questoesSemana
    );

  const resumoQuestoesGeral =
    calcularResumoQuestoes(
      questoes
    );

  const diasAtivos =
    new Set(
      sessoesSemana.map(
        (sessao) =>
          chaveData(
            sessao.data
          )
      )
    ).size;

  return {
    hoje: {
      minutos:
        somarMinutos(
          sessoesHoje
        ),

      questoes:
        resumoQuestoesHoje.total,

      certas:
        resumoQuestoesHoje.certas,

      erradas:
        resumoQuestoesHoje.erradas,

      percentual:
        resumoQuestoesHoje.percentual,

      revisoesConcluidas:
        revisoesConcluidasHoje.length,
    },

    semana: {
      minutos:
        somarMinutos(
          sessoesSemana
        ),

      questoes:
        resumoQuestoesSemana.total,

      certas:
        resumoQuestoesSemana.certas,

      erradas:
        resumoQuestoesSemana.erradas,

      percentual:
        resumoQuestoesSemana.percentual,

      sessoes:
        sessoesSemana.length,

      diasAtivos,
    },

    geral: {
      minutos:
        somarMinutos(
          sessoes
        ),

      questoes:
        resumoQuestoesGeral.total,

      certas:
        resumoQuestoesGeral.certas,

      erradas:
        resumoQuestoesGeral.erradas,

      percentual:
        resumoQuestoesGeral.percentual,

      simulados:
        simulados.length,

      revisoesConcluidas:
        revisoes.filter(
          (revisao) =>
            revisao.concluida
        ).length,
    },
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

function dataSegura(
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
    dataSegura(
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