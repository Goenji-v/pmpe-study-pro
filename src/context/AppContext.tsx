import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  useLocalStorage,
} from "../hooks/useLocalStorage";

import {
  gerarMateriasDoPlano,
} from "../utils/materiasDoPlano";

import {
  useAuth,
} from "./AuthContext";

import {
  carregarEstadoDaNuvem,
  confirmarDonoDosDadosLocais,
  marcarMigracaoConcluida,
  migracaoJaConcluida,
  montarEstadoNuvem,
  salvarEstadoNaNuvem,
  type EstadoAppNuvem,
} from "../services/sincronizacaoService";

import type {
  ConfiguracoesApp,
  Materia,
  QuestaoBanco,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
  SimuladoGerado,
} from "../types/index";

export type StatusNuvem =
  | "carregando"
  | "sincronizado"
  | "salvando"
  | "erro";

type AppContextType = {
  materias: Materia[];
  setMaterias: Dispatch<
    SetStateAction<Materia[]>
  >;

  questoes: RegistroQuestao[];
  setQuestoes: Dispatch<
    SetStateAction<RegistroQuestao[]>
  >;

  sessoes: SessaoEstudo[];
  setSessoes: Dispatch<
    SetStateAction<SessaoEstudo[]>
  >;

  revisoes: Revisao[];
  setRevisoes: Dispatch<
    SetStateAction<Revisao[]>
  >;

  simulados: Simulado[];
  setSimulados: Dispatch<
    SetStateAction<Simulado[]>
  >;

  bancoQuestoes: QuestaoBanco[];
  setBancoQuestoes: Dispatch<
    SetStateAction<QuestaoBanco[]>
  >;

  simuladosGerados: SimuladoGerado[];
  setSimuladosGerados: Dispatch<
    SetStateAction<SimuladoGerado[]>
  >;

  configuracoes: ConfiguracoesApp;
  setConfiguracoes: Dispatch<
    SetStateAction<ConfiguracoesApp>
  >;

  missoesConcluidas: string[];
  setMissoesConcluidas: Dispatch<
    SetStateAction<string[]>
  >;

  statusNuvem: StatusNuvem;
  erroNuvem: string;

  sincronizarAgora: () => Promise<void>;
};

const AppContext =
  createContext<
    AppContextType | undefined
  >(undefined);

type AppProviderProps = {
  children: ReactNode;
};

const configuracoesPadrao:
  ConfiguracoesApp = {
    nomeUsuario: "Leandro",
    concurso: "PMPE",
    bancaPadrao: "AOCP",
    metaQuestoesDiaria: 100,
    metaMinutosDiaria: 120,
    metaRevisoesDiaria: 5,
    tema: "escuro",
  };

const materiasGeradasDoPlano =
  gerarMateriasDoPlano();

export function AppProvider({
  children,
}: AppProviderProps) {
  const { usuario } =
    useAuth();

  const [
    materias,
    setMaterias,
  ] = useLocalStorage<Materia[]>(
    "pmpe_materias",
    materiasGeradasDoPlano
  );

  const [
    questoes,
    setQuestoes,
  ] =
    useLocalStorage<
      RegistroQuestao[]
    >(
      "pmpe_questoes",
      []
    );

  const [
    sessoes,
    setSessoes,
  ] =
    useLocalStorage<
      SessaoEstudo[]
    >(
      "pmpe_sessoes",
      []
    );

  const [
    revisoes,
    setRevisoes,
  ] =
    useLocalStorage<
      Revisao[]
    >(
      "pmpe_revisoes",
      []
    );

  const [
    simulados,
    setSimulados,
  ] =
    useLocalStorage<
      Simulado[]
    >(
      "pmpe_simulados",
      []
    );

  const [
    bancoQuestoes,
    setBancoQuestoes,
  ] =
    useLocalStorage<
      QuestaoBanco[]
    >(
      "pmpe_banco_questoes",
      []
    );

  const [
    simuladosGerados,
    setSimuladosGerados,
  ] =
    useLocalStorage<
      SimuladoGerado[]
    >(
      "pmpe_simulados_gerados",
      []
    );

  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useLocalStorage<
      ConfiguracoesApp
    >(
      "pmpe_configuracoes",
      configuracoesPadrao
    );

  const [
    missoesConcluidas,
    setMissoesConcluidas,
  ] =
    useLocalStorage<string[]>(
      "pmpe_plano_missoes_concluidas",
      []
    );

  const [
    statusNuvem,
    setStatusNuvem,
  ] =
    useState<StatusNuvem>(
      usuario
        ? "carregando"
        : "sincronizado"
    );

  const [
    erroNuvem,
    setErroNuvem,
  ] = useState("");

  const nuvemInicializadaRef =
    useRef(false);

  const hidratandoRef =
    useRef(false);

  const timerSalvarRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const ultimoEstadoSalvoRef =
    useRef("");

  const dadosAtuaisRef =
    useRef({
      materias,
      questoes,
      sessoes,
      revisoes,
      simulados,
      bancoQuestoes,
      simuladosGerados,
      configuracoes,
      missoesConcluidas,
    });

  useEffect(() => {
    dadosAtuaisRef.current = {
      materias,
      questoes,
      sessoes,
      revisoes,
      simulados,
      bancoQuestoes,
      simuladosGerados,
      configuracoes,
      missoesConcluidas,
    };
  }, [
    materias,
    questoes,
    sessoes,
    revisoes,
    simulados,
    bancoQuestoes,
    simuladosGerados,
    configuracoes,
    missoesConcluidas,
  ]);

  const aplicarEstadoDaNuvem =
    useCallback(
      (
        estado:
          EstadoAppNuvem
      ) => {
        hidratandoRef.current =
          true;

        setMaterias(
          estado.materias
        );

        setQuestoes(
          estado.questoes
        );

        setSessoes(
          estado.sessoes
        );

        setRevisoes(
          estado.revisoes
        );

        setSimulados(
          estado.simulados
        );

        setBancoQuestoes(
          estado.bancoQuestoes
        );

        setSimuladosGerados(
          estado.simuladosGerados
        );

        setConfiguracoes(
          estado.configuracoes
        );

        setMissoesConcluidas(
          estado.missoesConcluidas
        );

        ultimoEstadoSalvoRef.current =
          assinaturaEstado(
            estado
          );

        window.setTimeout(
          () => {
            hidratandoRef.current =
              false;
          },
          0
        );
      },
      [
        setMaterias,
        setQuestoes,
        setSessoes,
        setRevisoes,
        setSimulados,
        setBancoQuestoes,
        setSimuladosGerados,
        setConfiguracoes,
        setMissoesConcluidas,
      ]
    );

  useEffect(() => {
    if (!usuario) {
      nuvemInicializadaRef.current =
        false;

      hidratandoRef.current =
        false;

      ultimoEstadoSalvoRef.current =
        "";

      setErroNuvem("");

      setStatusNuvem(
        "sincronizado"
      );

      return;
    }

   const userId =
  usuario.id;

    let ativo = true;

    async function iniciarNuvem() {
      try {
        setStatusNuvem(
          "carregando"
        );

        setErroNuvem("");

        confirmarDonoDosDadosLocais(
          userId
        );

        const estadoNuvem =
          await carregarEstadoDaNuvem(
            userId
          );

        if (!ativo) {
          return;
        }

        if (estadoNuvem) {
          aplicarEstadoDaNuvem(
            estadoNuvem
          );
        } else {
          const migrada =
            await migracaoJaConcluida(
              userId
            );

          if (!ativo) {
            return;
          }

          const estadoLocal =
            montarEstadoNuvem(
              dadosAtuaisRef.current
            );

          await salvarEstadoNaNuvem(
            userId,
            estadoLocal
          );

          if (!migrada) {
            await marcarMigracaoConcluida(
              userId
            );
          }

          ultimoEstadoSalvoRef.current =
            assinaturaEstado(
              estadoLocal
            );
        }

        if (!ativo) {
          return;
        }

        nuvemInicializadaRef.current =
          true;

        setStatusNuvem(
          "sincronizado"
        );

        window.dispatchEvent(
          new Event(
            "pmpe-nuvem-sincronizada"
          )
        );
      } catch (erro) {
        if (!ativo) {
          return;
        }

        const mensagem =
          obterMensagemErro(
            erro,
            "Erro desconhecido na sincronização."
          );

        console.error(
          "Erro ao iniciar nuvem:",
          erro
        );

        setErroNuvem(
          mensagem
        );

        setStatusNuvem(
          "erro"
        );
      }
    }

    void iniciarNuvem();

    return () => {
      ativo = false;

      if (
        timerSalvarRef.current
      ) {
        clearTimeout(
          timerSalvarRef.current
        );

        timerSalvarRef.current =
          null;
      }
    };
  }, [
    usuario?.id,
    aplicarEstadoDaNuvem,
  ]);

  const estadoAtual =
    useMemo(
      () =>
        montarEstadoNuvem({
          materias,
          questoes,
          sessoes,
          revisoes,
          simulados,
          bancoQuestoes,
          simuladosGerados,
          configuracoes,
          missoesConcluidas,
        }),
      [
        materias,
        questoes,
        sessoes,
        revisoes,
        simulados,
        bancoQuestoes,
        simuladosGerados,
        configuracoes,
        missoesConcluidas,
      ]
    );

  useEffect(() => {
    if (
      !usuario ||
      !nuvemInicializadaRef.current ||
      hidratandoRef.current
    ) {
      return;
    }

    const assinatura =
      assinaturaEstado(
        estadoAtual
      );

    if (
      assinatura ===
      ultimoEstadoSalvoRef.current
    ) {
      return;
    }

    if (
      timerSalvarRef.current
    ) {
      clearTimeout(
        timerSalvarRef.current
      );
    }

    setStatusNuvem(
      "salvando"
    );

    const userId =
      usuario.id;

    timerSalvarRef.current =
      setTimeout(
        () => {
          void salvarAlteracao(
            userId,
            estadoAtual,
            assinatura
          );
        },
        1200
      );

    return () => {
      if (
        timerSalvarRef.current
      ) {
        clearTimeout(
          timerSalvarRef.current
        );

        timerSalvarRef.current =
          null;
      }
    };
  }, [
    estadoAtual,
    usuario?.id,
  ]);

  async function salvarAlteracao(
    userId: string,
    estado: EstadoAppNuvem,
    assinatura: string
  ) {
    try {
      await salvarEstadoNaNuvem(
        userId,
        estado
      );

      ultimoEstadoSalvoRef.current =
        assinatura;

      setErroNuvem("");

      setStatusNuvem(
        "sincronizado"
      );

      window.dispatchEvent(
        new Event(
          "pmpe-nuvem-sincronizada"
        )
      );
    } catch (erro) {
      const mensagem =
        obterMensagemErro(
          erro,
          "Erro ao salvar na nuvem."
        );

      console.error(
        "Erro ao salvar na nuvem:",
        erro
      );

      setErroNuvem(
        mensagem
      );

      setStatusNuvem(
        "erro"
      );
    }
  }

  async function sincronizarAgora() {
    if (!usuario) {
      throw new Error(
        "Nenhum usuário autenticado."
      );
    }

    try {
      setStatusNuvem(
        "salvando"
      );

      const estado =
        montarEstadoNuvem(
          dadosAtuaisRef.current
        );

      await salvarEstadoNaNuvem(
        usuario.id,
        estado
      );

      ultimoEstadoSalvoRef.current =
        assinaturaEstado(
          estado
        );

      setErroNuvem("");

      setStatusNuvem(
        "sincronizado"
      );

      window.dispatchEvent(
        new Event(
          "pmpe-nuvem-sincronizada"
        )
      );
    } catch (erro) {
      const mensagem =
        obterMensagemErro(
          erro,
          "Erro ao sincronizar."
        );

      setErroNuvem(
        mensagem
      );

      setStatusNuvem(
        "erro"
      );

      throw erro;
    }
  }

  return (
    <AppContext.Provider
      value={{
        materias,
        setMaterias,

        questoes,
        setQuestoes,

        sessoes,
        setSessoes,

        revisoes,
        setRevisoes,

        simulados,
        setSimulados,

        bancoQuestoes,
        setBancoQuestoes,

        simuladosGerados,
        setSimuladosGerados,

        configuracoes,
        setConfiguracoes,

        missoesConcluidas,
        setMissoesConcluidas,

        statusNuvem,
        erroNuvem,
        sincronizarAgora,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context =
    useContext(
      AppContext
    );

  if (!context) {
    throw new Error(
      "useApp deve ser utilizado dentro de AppProvider."
    );
  }

  return context;
}

function assinaturaEstado(
  estado: EstadoAppNuvem
) {
  const {
    salvoEm:
      _salvoEm,
    ...dados
  } = estado;

  return JSON.stringify(
    dados
  );
}

function obterMensagemErro(
  erro: unknown,
  padrao: string
) {
  return erro instanceof Error
    ? erro.message
    : padrao;
}