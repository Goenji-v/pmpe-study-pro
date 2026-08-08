import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useApp } from "./AppContext";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { criarPrimeiraRevisao } from "../utils/revisoes";
import {
  listarModulosDaMateria,
  sincronizarEspelhoAssuntos,
} from "../services/conteudos/navegarConteudos";

import type {
  Dificuldade,
  SessaoEstudo,
  TipoSessao,
} from "../types/index";

type StatusCronometro =
  | "parado"
  | "rodando"
  | "pausado";

export type SessaoAtiva = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  tipo: TipoSessao;
  objetivo: string;
  observacao: string;
  status: StatusCronometro;
  iniciadoEm: string | null;
  pausadoEm: string | null;
  segundosPausados: number;
  missaoId?: string;
  semana?: number;
  dia?: number;
  urlAula?: string;
  urlQuestoes?: string;
};

export type DadosIniciarSessao = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  tipo: TipoSessao;
  objetivo?: string;
  observacao?: string;
  missaoId?: string;
  semana?: number;
  dia?: number;
  urlAula?: string;
  urlQuestoes?: string;
};

export type DadosFinalizacaoSessao = {
  minutosReais: number;
  observacao?: string;

  quantidadeQuestoes?: number;
  quantidadeAcertos?: number;
  quantidadeErros?: number;
  banca?: string;
  dificuldade?: Dificuldade;

  avaliacaoRevisao?:
    | "facil"
    | "media"
    | "dificil";
};

type ResultadoFinalizacao = {
  sessao: SessaoEstudo;
  revisaoCriada: boolean;
};

type CronometroContextType = {
  sessaoAtiva: SessaoAtiva;
  segundosDecorridos: number;
  cronometroAtivo: boolean;
  iniciar: (dados: DadosIniciarSessao) => boolean;
  atualizarDados: (
    dados: Partial<
      Pick<
        SessaoAtiva,
        "materia" | "materiaId" | "modulo" | "moduloId" |
        "assunto" | "assuntoId" | "tipo" |
        "objetivo" | "observacao" |
        "missaoId" | "semana" | "dia" |
        "urlAula" | "urlQuestoes"
      >
    >
  ) => void;
  prepararSessao: (
    dados: DadosIniciarSessao
  ) => void;
  pausar: () => void;
  continuar: () => void;
  finalizar: (
    dados: DadosFinalizacaoSessao
  ) => ResultadoFinalizacao | null;
  cancelar: (
    pedirConfirmacao?: boolean
  ) => void;
};

const sessaoInicial: SessaoAtiva = {
  materia: "",
  assunto: "",
  tipo: "aula",
  objetivo: "",
  observacao: "",
  status: "parado",
  iniciadoEm: null,
  pausadoEm: null,
  segundosPausados: 0,
};

const CronometroContext =
  createContext<CronometroContextType | null>(
    null
  );

function chaveSessao(
  userId: string
) {
  return `pmpe:${userId}:cronometro-sessao-ativa`;
}

export function CronometroProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { usuario } = useAuth();

  const {
    materias,
    setMaterias,
    setSessoes,
    setQuestoes,
    setRevisoes,
    setMissoesConcluidas,
  } = useApp();

  const { showToast } = useToast();

  const chaveStorage =
    chaveSessao(
      usuario?.id ?? "sem-usuario"
    );

  const [
    sessaoAtiva,
    setSessaoAtiva,
  ] = useState<SessaoAtiva>(
    () => carregarSessao(chaveStorage)
  );

  const [agora, setAgora] =
    useState(Date.now());

  useEffect(() => {
    setSessaoAtiva(
      carregarSessao(chaveStorage)
    );
  }, [chaveStorage]);

  useEffect(() => {
    if (sessaoAtiva.status === "parado") {
      localStorage.removeItem(chaveStorage);
      return;
    }

    localStorage.setItem(
      chaveStorage,
      JSON.stringify(sessaoAtiva)
    );
  }, [chaveStorage, sessaoAtiva]);

  useEffect(() => {
    if (sessaoAtiva.status !== "rodando") {
      return;
    }

    const intervalo =
      window.setInterval(
        () => setAgora(Date.now()),
        1000
      );

    return () =>
      window.clearInterval(intervalo);
  }, [sessaoAtiva.status]);

  const segundosDecorridos =
    useMemo(
      () =>
        calcularSegundos(
          sessaoAtiva,
          agora
        ),
      [sessaoAtiva, agora]
    );

  const cronometroAtivo =
    sessaoAtiva.status !== "parado";

  function iniciar(
    dados: DadosIniciarSessao
  ) {
    if (cronometroAtivo) {
      const substituir =
        window.confirm(
          "Já existe uma sessão em andamento. Deseja substituí-la?"
        );

      if (!substituir) {
        return false;
      }
    }

    if (!dados.materia.trim()) {
      showToast(
        "Selecione uma matéria.",
        "warning"
      );
      return false;
    }

    if (!dados.assunto.trim()) {
      showToast(
        "Selecione ou informe um assunto.",
        "warning"
      );
      return false;
    }

    setSessaoAtiva({
      materia: dados.materia.trim(),
      materiaId: dados.materiaId,
      modulo: dados.modulo?.trim() || undefined,
      moduloId: dados.moduloId,
      assunto: dados.assunto.trim(),
      assuntoId: dados.assuntoId,
      tipo: dados.tipo,
      objetivo: dados.objetivo?.trim() ?? "",
      observacao: dados.observacao?.trim() ?? "",
      status: "rodando",
      iniciadoEm: new Date().toISOString(),
      pausadoEm: null,
      segundosPausados: 0,
      missaoId: dados.missaoId,
      semana: dados.semana,
      dia: dados.dia,
      urlAula: dados.urlAula,
      urlQuestoes: dados.urlQuestoes,
    });

    setAgora(Date.now());

    showToast(
      "Sessão de estudo iniciada.",
      "success"
    );

    return true;
  }

  function atualizarDados(
    dados: Partial<
      Pick<
        SessaoAtiva,
        "materia" | "materiaId" | "modulo" | "moduloId" |
        "assunto" | "assuntoId" | "tipo" |
        "objetivo" | "observacao" |
        "missaoId" | "semana" | "dia" |
        "urlAula" | "urlQuestoes"
      >
    >
  ) {
    if (cronometroAtivo) {
      return;
    }

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        ...dados,
      })
    );
  }

  function prepararSessao(
    dados: DadosIniciarSessao
  ) {
    const novaSessao: SessaoAtiva = {
      ...sessaoInicial,
      materia: dados.materia.trim(),
      materiaId: dados.materiaId,
      modulo: dados.modulo?.trim() || undefined,
      moduloId: dados.moduloId,
      assunto: dados.assunto.trim(),
      assuntoId: dados.assuntoId,
      tipo: dados.tipo,
      objetivo: dados.objetivo?.trim() ?? "",
      observacao: dados.observacao?.trim() ?? "",
      missaoId: dados.missaoId,
      semana: dados.semana,
      dia: dados.dia,
      urlAula: dados.urlAula,
      urlQuestoes: dados.urlQuestoes,
      status: "parado",
      iniciadoEm: null,
      pausadoEm: null,
      segundosPausados: 0,
    };

    setSessaoAtiva(novaSessao);
    localStorage.removeItem(chaveStorage);
  }

  function pausar() {
    if (sessaoAtiva.status !== "rodando") {
      return;
    }

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        status: "pausado",
        pausadoEm:
          new Date().toISOString(),
      })
    );
  }

  function continuar() {
    if (
      sessaoAtiva.status !== "pausado" ||
      !sessaoAtiva.pausadoEm
    ) {
      return;
    }

    const segundosDaPausa =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            new Date(
              sessaoAtiva.pausadoEm
            ).getTime()
          ) / 1000
        )
      );

    setSessaoAtiva(
      (anterior) => ({
        ...anterior,
        status: "rodando",
        pausadoEm: null,
        segundosPausados:
          anterior.segundosPausados +
          segundosDaPausa,
      })
    );

    setAgora(Date.now());
  }

  function finalizar(
    dados: DadosFinalizacaoSessao
  ): ResultadoFinalizacao | null {
    if (!cronometroAtivo) {
      return null;
    }

    const minutos =
      dados.minutosReais;

    if (
      !Number.isFinite(minutos) ||
      minutos < 1 ||
      minutos > 1440
    ) {
      showToast(
        "Informe um tempo válido entre 1 e 1440 minutos.",
        "warning"
      );
      return null;
    }

    const finalizadaEm =
      new Date().toISOString();

    const novaSessao:
      SessaoEstudo = {
      id: crypto.randomUUID(),
      tipo: sessaoAtiva.tipo,
      materia: sessaoAtiva.materia,
      materiaId: sessaoAtiva.materiaId,
      modulo: sessaoAtiva.modulo,
      moduloId: sessaoAtiva.moduloId,
      assunto: sessaoAtiva.assunto,
      assuntoId: sessaoAtiva.assuntoId,
      objetivo:
        sessaoAtiva.objetivo ||
        undefined,
      observacao:
        dados.observacao?.trim() ||
        sessaoAtiva.observacao ||
        undefined,

      minutos:
        Math.round(minutos),

      quantidadeQuestoes:
        dados.quantidadeQuestoes,

      quantidadeAcertos:
        dados.quantidadeAcertos,

      quantidadeErros:
        dados.quantidadeErros,

      banca:
        dados.banca?.trim() ||
        undefined,

      dificuldade:
        dados.dificuldade,

      avaliacaoRevisao:
        dados.avaliacaoRevisao,
      data: finalizadaEm,
      iniciadaEm:
        sessaoAtiva.iniciadoEm ??
        finalizadaEm,
      finalizadaEm,
      missaoId: sessaoAtiva.missaoId,
      semana: sessaoAtiva.semana,
      dia: sessaoAtiva.dia,
    };

    setSessoes(
      (anteriores) => [
        novaSessao,
        ...anteriores,
      ]
    );

    const quantidadeAcertos =
  dados.quantidadeAcertos;

const quantidadeErros =
  dados.quantidadeErros;

if (
  sessaoAtiva.tipo ===
    "questoes" &&
  typeof quantidadeAcertos ===
    "number" &&
  typeof quantidadeErros ===
    "number"
) {
  
      setQuestoes(
        (anteriores) => [
          {
            id:
              crypto.randomUUID(),

            materia:
              sessaoAtiva.materia,

            materiaId:
              sessaoAtiva.materiaId,

            modulo:
              sessaoAtiva.modulo,

            moduloId:
              sessaoAtiva.moduloId,

            assunto:
              sessaoAtiva.assunto,

            assuntoId:
              sessaoAtiva.assuntoId,

            banca:
              dados.banca?.trim() ||
              "Não informada",

            certas:
              quantidadeAcertos,

            erradas:
              quantidadeErros,

            // O tempo já pertence à Sessão de Estudo criada acima.
            // O RegistroQuestao automático guarda apenas desempenho,
            // evitando duplicar minutos nas estatísticas.
            minutos: 0,

            data:
              finalizadaEm,

            observacao:
              dados.observacao?.trim() ||
              undefined,
          },
          ...anteriores,
        ]
      );
    }

    if (sessaoAtiva.missaoId) {
      setMissoesConcluidas(
        (anteriores) =>
          Array.from(
            new Set([
              ...anteriores,
              sessaoAtiva.missaoId as string,
            ])
          )
      );
    }

    let revisaoCriada = false;

    if (tipoGeraRevisao(sessaoAtiva.tipo)) {
      const referencia =
        localizarMateriaEAssunto(
          materias,
          sessaoAtiva.materia,
          sessaoAtiva.assunto,
          sessaoAtiva.moduloId
        );

      setMaterias(
        (anteriores) =>
          marcarAssuntoConcluido(
            anteriores,
            sessaoAtiva.materia,
            sessaoAtiva.assunto,
            sessaoAtiva.moduloId
          )
      );

      setRevisoes(
        (anteriores) => {
          const jaExiste =
            anteriores.some(
              (revisao) =>
                !revisao.concluida &&
                mesmoTexto(
                  revisao.materia,
                  sessaoAtiva.materia
                ) &&
                mesmoTexto(
                  revisao.assunto,
                  sessaoAtiva.assunto
                ) &&
                (
                  !sessaoAtiva.moduloId ||
                  !revisao.moduloId ||
                  revisao.moduloId === sessaoAtiva.moduloId
                )
            );

          if (jaExiste) {
            return anteriores;
          }

          revisaoCriada = true;

          return [
            criarPrimeiraRevisao({
              materiaId:
                referencia.materiaId,
              moduloId:
                referencia.moduloId,
              assuntoId:
                referencia.assuntoId,
              materia:
                sessaoAtiva.materia,
              modulo:
                referencia.modulo,
              assunto:
                sessaoAtiva.assunto,
            }),
            ...anteriores,
          ];
        }
      );
    }

    setSessaoAtiva({
      ...sessaoInicial,
    });

    localStorage.removeItem(chaveStorage);

    [
      "pmpe-sessoes-atualizadas",
      "pmpe-plano-atualizado",
      "pmpe-materias-atualizadas",
      "pmpe-revisoes-atualizadas",
      "pmpe-dashboard-atualizado",
    ].forEach(
      (nome) =>
        window.dispatchEvent(
          new Event(nome)
        )
    );

    showToast(
      "Sessão finalizada e salva.",
      "success"
    );

    return {
      sessao: novaSessao,
      revisaoCriada,
    };
  }

  function cancelar(
    pedirConfirmacao = true
  ) {
    if (
      cronometroAtivo &&
      pedirConfirmacao &&
      !window.confirm(
        "Deseja cancelar esta sessão? O tempo não será salvo."
      )
    ) {
      return;
    }

    setSessaoAtiva({
      ...sessaoInicial,
    });

    localStorage.removeItem(chaveStorage);
  }

  return (
    <CronometroContext.Provider
      value={{
        sessaoAtiva,
        segundosDecorridos,
        cronometroAtivo,
        iniciar,
        atualizarDados,
        prepararSessao,
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
    useContext(CronometroContext);

  if (!contexto) {
    throw new Error(
      "useCronometro deve ser utilizado dentro de CronometroProvider."
    );
  }

  return contexto;
}

function carregarSessao(
  chave: string
): SessaoAtiva {
  const salvo =
    localStorage.getItem(chave);

  if (!salvo) {
    return {
      ...sessaoInicial,
    };
  }

  try {
    return {
      ...sessaoInicial,
      ...JSON.parse(salvo),
    } as SessaoAtiva;
  } catch {
    return {
      ...sessaoInicial,
    };
  }
}

function calcularSegundos(
  sessao: SessaoAtiva,
  momentoAtual: number
) {
  if (
    sessao.status === "parado" ||
    !sessao.iniciadoEm
  ) {
    return 0;
  }

  const fim =
    sessao.status === "pausado" &&
    sessao.pausadoEm
      ? new Date(
          sessao.pausadoEm
        ).getTime()
      : momentoAtual;

  const inicio =
    new Date(
      sessao.iniciadoEm
    ).getTime();

  return Math.max(
    0,
    Math.floor(
      (fim - inicio) / 1000
    ) -
      sessao.segundosPausados
  );
}

function tipoGeraRevisao(
  tipo: TipoSessao
) {
  return [
    "aula",
    "videoaula",
    "estudo",
    "leitura",
    "questoes",
  ].includes(tipo);
}

function localizarMateriaEAssunto(
  materias: ReturnType<typeof useApp>["materias"],
  nomeMateria: string,
  nomeAssunto: string,
  moduloId?: string
) {
  const materia = materias.find((item) =>
    mesmoTexto(item.nome, nomeMateria)
  );

  if (materia) {
    const modulos = listarModulosDaMateria(materia);
    const moduloPreferido = moduloId
      ? modulos.find((item) => item.id === moduloId)
      : undefined;

    const moduloEncontrado = moduloPreferido ?? modulos.find((item) =>
      item.assuntos.some((assunto) => mesmoTexto(assunto.nome, nomeAssunto))
    );

    const assunto = moduloEncontrado?.assuntos.find((item) =>
      mesmoTexto(item.nome, nomeAssunto)
    );

    if (moduloEncontrado && assunto) {
      return {
        materiaId: materia.id,
        moduloId: moduloEncontrado.id,
        modulo: moduloEncontrado.nome,
        assuntoId: assunto.id,
      };
    }
  }

  return {
    materiaId: materia?.id || criarId(nomeMateria),
    moduloId,
    modulo: undefined,
    assuntoId: criarId(`${nomeMateria}-${nomeAssunto}`),
  };
}

function marcarAssuntoConcluido(
  materias: ReturnType<typeof useApp>["materias"],
  nomeMateria: string,
  nomeAssunto: string,
  moduloId?: string
) {
  return materias.map((materia) => {
    if (!mesmoTexto(materia.nome, nomeMateria)) {
      return materia;
    }

    const modulos = listarModulosDaMateria(materia).map((modulo) => {
      if (moduloId && modulo.id !== moduloId) {
        return modulo;
      }

      return {
        ...modulo,
        assuntos: modulo.assuntos.map((assunto) =>
          mesmoTexto(assunto.nome, nomeAssunto)
            ? { ...assunto, concluido: true }
            : assunto
        ),
      };
    });

    return sincronizarEspelhoAssuntos({
      ...materia,
      modulos,
    });
  });
}

function mesmoTexto(
  a: string,
  b: string
) {
  return normalizar(a) === normalizar(b);
}

function normalizar(
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
    .replace(/\s+/g, " ");
}

function criarId(
  texto: string
) {
  return texto
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(/^-|-$/g, "");
}

export function formatarTempo(
  segundos: number
) {
  const horas =
    Math.floor(segundos / 3600);

  const minutos =
    Math.floor(
      (segundos % 3600) / 60
    );

  const segundosRestantes =
    segundos % 60;

  return [
    horas,
    minutos,
    segundosRestantes,
  ]
    .map(
      (valor) =>
        String(valor).padStart(
          2,
          "0"
        )
    )
    .join(":");
}