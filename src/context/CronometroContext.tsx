import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  useApp,
} from "./AppContext";

import {
  useToast,
} from "./ToastContext";

import type {
  TipoSessao,
} from "../types/index";

type StatusCronometro =
  | "parado"
  | "rodando"
  | "pausado";

type SessaoAtiva = {
  materia: string;
  assunto: string;
  tipo: TipoSessao;
  objetivo: string;

  status: StatusCronometro;

  iniciadoEm: string | null;
  segundosAcumulados: number;
};

type DadosIniciarSessao = {
  materia: string;
  assunto: string;
  tipo: TipoSessao;
  objetivo: string;
};

type CronometroContextType = {
  sessaoAtiva: SessaoAtiva;
  segundosDecorridos: number;
  cronometroAtivo: boolean;

  iniciar: (
    dados: DadosIniciarSessao
  ) => void;

  pausar: () => void;
  continuar: () => void;
  finalizar: () => void;
  cancelar: () => void;
};

const CHAVE_SESSAO_ATIVA =
  "pmpe_cronometro_sessao_ativa";

const sessaoInicial: SessaoAtiva = {
  materia: "",
  assunto: "",
  tipo: "estudo",
  objetivo: "",
  status: "parado",
  iniciadoEm: null,
  segundosAcumulados: 0,
};

const CronometroContext =
  createContext<CronometroContextType | null>(
    null
  );

export function CronometroProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    setSessoes,
  } = useApp();

  const {
    showToast,
  } = useToast();

  const [
    sessaoAtiva,
    setSessaoAtiva,
  ] = useState<SessaoAtiva>(
    () => {
      try {
        const salvo =
          localStorage.getItem(
            CHAVE_SESSAO_ATIVA
          );

        if (!salvo) {
          return sessaoInicial;
        }

        const dados =
          JSON.parse(
            salvo
          ) as Partial<SessaoAtiva>;

        return {
          ...sessaoInicial,
          ...dados,
          tipo:
            normalizarTipoSessao(
              dados.tipo
            ),
        };
      } catch {
        return sessaoInicial;
      }
    }
  );

  const [
    agora,
    setAgora,
  ] = useState(
    Date.now()
  );

  useEffect(() => {
    localStorage.setItem(
      CHAVE_SESSAO_ATIVA,
      JSON.stringify(
        sessaoAtiva
      )
    );
  }, [sessaoAtiva]);

  useEffect(() => {
    if (
      sessaoAtiva.status !==
      "rodando"
    ) {
      return;
    }

    const intervalo =
      window.setInterval(
        () => {
          setAgora(
            Date.now()
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        intervalo
      );
    };
  }, [sessaoAtiva.status]);

  const segundosDecorridos =
    useMemo(
      () =>
        calcularSegundosDecorridos(
          sessaoAtiva,
          agora
        ),
      [
        sessaoAtiva,
        agora,
      ]
    );

  const cronometroAtivo =
    sessaoAtiva.status !==
    "parado";

  function iniciar(
    dados: DadosIniciarSessao
  ) {
    if (cronometroAtivo) {
      showToast(
        "Já existe uma sessão em andamento.",
        "warning"
      );

      return;
    }

    if (!dados.materia) {
      showToast(
        "Selecione uma matéria.",
        "warning"
      );

      return;
    }

    if (!dados.assunto) {
      showToast(
        "Selecione um assunto.",
        "warning"
      );

      return;
    }

    const novaSessao:
      SessaoAtiva = {
      materia:
        dados.materia,
      assunto:
        dados.assunto,
      tipo:
        dados.tipo,
      objetivo:
        dados.objetivo.trim(),

      status:
        "rodando",

      iniciadoEm:
        new Date()
          .toISOString(),

      segundosAcumulados:
        0,
    };

    setSessaoAtiva(
      novaSessao
    );

    setAgora(
      Date.now()
    );

    showToast(
      "Sessão de estudo iniciada.",
      "success"
    );
  }

  function pausar() {
    if (
      sessaoAtiva.status !==
      "rodando"
    ) {
      return;
    }

    const totalAtual =
      calcularSegundosDecorridos(
        sessaoAtiva,
        Date.now()
      );

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        status:
          "pausado",
        iniciadoEm:
          null,
        segundosAcumulados:
          totalAtual,
      })
    );

    showToast(
      "Cronômetro pausado.",
      "info"
    );
  }

  function continuar() {
    if (
      sessaoAtiva.status !==
      "pausado"
    ) {
      return;
    }

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        status:
          "rodando",
        iniciadoEm:
          new Date()
            .toISOString(),
      })
    );

    setAgora(
      Date.now()
    );

    showToast(
      "Sessão retomada.",
      "success"
    );
  }

  function finalizar() {
    if (!cronometroAtivo) {
      return;
    }

    const totalSegundos =
      calcularSegundosDecorridos(
        sessaoAtiva,
        Date.now()
      );

    if (
      totalSegundos < 60
    ) {
      showToast(
        "A sessão precisa ter pelo menos 1 minuto para ser salva.",
        "warning"
      );

      return;
    }

    const minutos =
      Math.max(
        1,
        Math.round(
          totalSegundos / 60
        )
      );

    const finalizadaEm =
      new Date()
        .toISOString();

    const iniciadaEm =
      sessaoAtiva.iniciadoEm ??
      new Date(
        Date.now() -
        totalSegundos * 1000
      ).toISOString();

    setSessoes(
      (anteriores) => [
        {
          id:
            crypto.randomUUID(),

          tipo:
            sessaoAtiva.tipo,

          materia:
            sessaoAtiva.materia,

          assunto:
            sessaoAtiva.assunto,

          objetivo:
            sessaoAtiva.objetivo ||
            undefined,

          observacao:
            criarObservacaoSessao(
              sessaoAtiva.tipo,
              sessaoAtiva.objetivo
            ),

          minutos,

          data:
            finalizadaEm,

          iniciadaEm,
          finalizadaEm,
        },

        ...anteriores,
      ]
    );

    setSessaoAtiva(
      sessaoInicial
    );

    localStorage.removeItem(
      CHAVE_SESSAO_ATIVA
    );

    showToast(
      `Sessão finalizada: ${formatarTempo(
        totalSegundos
      )}.`,
      "success"
    );
  }

  function cancelar() {
    if (!cronometroAtivo) {
      return;
    }

    const confirmar =
      window.confirm(
        "Deseja cancelar esta sessão? O tempo não será salvo."
      );

    if (!confirmar) {
      return;
    }

    setSessaoAtiva(
      sessaoInicial
    );

    localStorage.removeItem(
      CHAVE_SESSAO_ATIVA
    );

    showToast(
      "Sessão cancelada.",
      "info"
    );
  }

  return (
    <CronometroContext.Provider
      value={{
        sessaoAtiva,
        segundosDecorridos,
        cronometroAtivo,
        iniciar,
        pausar,
        continuar,
        finalizar,
        cancelar,
      }}
    >
      {children}
    </CronometroContext.Provider>
  );
}

export function useCronometro() {
  const contexto =
    useContext(
      CronometroContext
    );

  if (!contexto) {
    throw new Error(
      "useCronometro deve ser utilizado dentro de CronometroProvider."
    );
  }

  return contexto;
}

function calcularSegundosDecorridos(
  sessao: SessaoAtiva,
  momentoAtual: number
) {
  if (
    sessao.status !==
      "rodando" ||
    !sessao.iniciadoEm
  ) {
    return sessao.segundosAcumulados;
  }

  const inicioAtual =
    new Date(
      sessao.iniciadoEm
    ).getTime();

  const segundosRodando =
    Math.max(
      0,
      Math.floor(
        (
          momentoAtual -
          inicioAtual
        ) / 1000
      )
    );

  return (
    sessao.segundosAcumulados +
    segundosRodando
  );
}

function criarObservacaoSessao(
  tipo: TipoSessao,
  objetivo: string
) {
  const partes = [
    `Tipo: ${formatarTipoSessao(
      tipo
    )}`,
  ];

  if (objetivo) {
    partes.push(
      `Objetivo: ${objetivo}`
    );
  }

  return partes.join(
    " | "
  );
}

function normalizarTipoSessao(
  valor: unknown
): TipoSessao {
  const tipos:
    TipoSessao[] = [
      "aula",
      "revisao",
      "questoes",
      "simulado",
      "estudo",
      "leitura",
      "videoaula",
    ];

  if (
    typeof valor ===
      "string" &&
    tipos.includes(
      valor as TipoSessao
    )
  ) {
    return valor as TipoSessao;
  }

  return "estudo";
}

function formatarTipoSessao(
  tipo: TipoSessao
) {
  const tipos:
    Record<
      TipoSessao,
      string
    > = {
    aula: "Aula",
    revisao: "Revisão",
    questoes: "Questões",
    simulado: "Simulado",
    estudo: "Estudo",
    leitura: "Leitura",
    videoaula: "Videoaula",
  };

  return tipos[tipo];
}

export function formatarTempo(
  segundos: number
) {
  const horas =
    Math.floor(
      segundos / 3600
    );

  const minutos =
    Math.floor(
      (
        segundos %
        3600
      ) / 60
    );

  const segundosRestantes =
    segundos % 60;

  return [
    String(
      horas
    ).padStart(
      2,
      "0"
    ),

    String(
      minutos
    ).padStart(
      2,
      "0"
    ),

    String(
      segundosRestantes
    ).padStart(
      2,
      "0"
    ),
  ].join(":");
}