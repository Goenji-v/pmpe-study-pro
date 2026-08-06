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

import { planoPMPE } from "../data/planoPMPE";
import { criarPrimeiraRevisao } from "../utils/revisoes";

import {
  atualizarAssuntoNaArvore,
  migrarMateriasParaModulos,
} from "../services/conteudos/migrarEstruturaConteudos";

import {
  encontrarAssunto,
  listarAssuntosDaMateria,
  listarModulosDaMateria,
} from "../services/conteudos/navegarConteudos";

import {
  useAuth,
} from "./AuthContext";

import {
  carregarEstadoDaNuvem,
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
  setMaterias: Dispatch<SetStateAction<Materia[]>>;

  questoes: RegistroQuestao[];
  setQuestoes: Dispatch<SetStateAction<RegistroQuestao[]>>;

  sessoes: SessaoEstudo[];
  setSessoes: Dispatch<SetStateAction<SessaoEstudo[]>>;

  revisoes: Revisao[];
  setRevisoes: Dispatch<SetStateAction<Revisao[]>>;

  simulados: Simulado[];
  setSimulados: Dispatch<SetStateAction<Simulado[]>>;

  bancoQuestoes: QuestaoBanco[];
  setBancoQuestoes: Dispatch<SetStateAction<QuestaoBanco[]>>;

  simuladosGerados: SimuladoGerado[];
  setSimuladosGerados: Dispatch<SetStateAction<SimuladoGerado[]>>;

  configuracoes: ConfiguracoesApp;
  setConfiguracoes: Dispatch<SetStateAction<ConfiguracoesApp>>;

  missoesConcluidas: string[];
  setMissoesConcluidas: Dispatch<SetStateAction<string[]>>;

  statusNuvem: StatusNuvem;
  erroNuvem: string;
  sincronizarAgora: () => Promise<void>;

  definirConclusaoAssunto: (
    materiaId: string,
    assuntoId: string,
    concluido: boolean,
    moduloId?: string
  ) => void;
};

const AppContext =
  createContext<AppContextType | undefined>(
    undefined
  );

type AppProviderProps = {
  children: ReactNode;
};

const configuracoesPadrao: ConfiguracoesApp = {
  nomeUsuario: "Leandro",
  concurso: "PMPE",
  bancaPadrao: "AOCP",
  metaQuestoesDiaria: 100,
  metaMinutosDiaria: 120,
  metaRevisoesDiaria: 5,
  tema: "escuro",
};

function clonar<T>(valor: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(valor);
  }

  return JSON.parse(JSON.stringify(valor)) as T;
}

function criarEstadoInicialDaConta():
  EstadoAppNuvem {
  return montarEstadoNuvem({
    materias: clonar(
      gerarMateriasDoPlano()
    ),
    questoes: [],
    sessoes: [],
    revisoes: [],
    simulados: [],
    bancoQuestoes: [],
    simuladosGerados: [],
    configuracoes: clonar(
      configuracoesPadrao
    ),
    missoesConcluidas: [],
  });
}

function reconciliarMateriasComPlano(
  materiasSalvas: Materia[]
): Materia[] {
  const materiasNormalizadas =
    migrarMateriasParaModulos(materiasSalvas);

  const materiasDoPlano =
    migrarMateriasParaModulos(gerarMateriasDoPlano());

  if (materiasNormalizadas.length === 0) {
    return clonar(materiasDoPlano);
  }

  return materiasNormalizadas.map((materiaSalva) => {
    const materiaPlano = materiasDoPlano.find(
      (materia) =>
        materia.id === materiaSalva.id ||
        normalizarTexto(materia.nome) ===
          normalizarTexto(materiaSalva.nome)
    );

    if (!materiaPlano) {
      return materiaSalva;
    }

    const assuntosDoPlano =
      listarAssuntosDaMateria(materiaPlano);

    const modulos = listarModulosDaMateria(materiaSalva).map(
      (modulo) => ({
        ...modulo,
        assuntos: modulo.assuntos.map(
          (assuntoSalvo) => {
            const assuntoPlano =
              assuntosDoPlano.find(
                (assunto) =>
                  assunto.id === assuntoSalvo.id ||
                  normalizarTexto(assunto.nome) ===
                    normalizarTexto(assuntoSalvo.nome)
              );

            return assuntoPlano
              ? { ...assuntoPlano, ...assuntoSalvo }
              : assuntoSalvo;
          }
        ),
      })
    );

    return migrarMateriasParaModulos([
      {
        ...materiaPlano,
        ...materiaSalva,
        modulos,
      },
    ])[0];
  });
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

function chaveDaConta(
  userId: string,
  nome: string
) {
  return `pmpe:${userId}:${nome}`;
}

export function AppProvider({
  children,
}: AppProviderProps) {
  const { usuario } = useAuth();

  const userId =
    usuario?.id ?? "sem-usuario";

  const [materias, setMaterias] =
    useLocalStorage<Materia[]>(
      chaveDaConta(userId, "materias"),
      gerarMateriasDoPlano()
    );

  useEffect(() => {
    const migradas =
      migrarMateriasParaModulos(materias);

    if (
      JSON.stringify(migradas) !==
      JSON.stringify(materias)
    ) {
      setMaterias(migradas);
    }
  }, [materias, setMaterias]);

  const [questoes, setQuestoes] =
    useLocalStorage<RegistroQuestao[]>(
      chaveDaConta(userId, "questoes"),
      []
    );

  const [sessoes, setSessoes] =
    useLocalStorage<SessaoEstudo[]>(
      chaveDaConta(userId, "sessoes"),
      []
    );

  const [revisoes, setRevisoes] =
    useLocalStorage<Revisao[]>(
      chaveDaConta(userId, "revisoes"),
      []
    );

  const [simulados, setSimulados] =
    useLocalStorage<Simulado[]>(
      chaveDaConta(userId, "simulados"),
      []
    );

  const [bancoQuestoes, setBancoQuestoes] =
    useLocalStorage<QuestaoBanco[]>(
      chaveDaConta(userId, "banco-questoes"),
      []
    );

  const [
    simuladosGerados,
    setSimuladosGerados,
  ] = useLocalStorage<SimuladoGerado[]>(
    chaveDaConta(userId, "simulados-gerados"),
    []
  );

  const [
    configuracoes,
    setConfiguracoes,
  ] = useLocalStorage<ConfiguracoesApp>(
    chaveDaConta(userId, "configuracoes"),
    configuracoesPadrao
  );

  const [
    missoesConcluidas,
    setMissoesConcluidas,
  ] = useLocalStorage<string[]>(
    chaveDaConta(userId, "missoes-concluidas"),
    []
  );

  useEffect(() => {
    localStorage.setItem(
      "pmpe_plano_missoes_concluidas",
      JSON.stringify(missoesConcluidas)
    );

    window.dispatchEvent(new Event("pmpe-plano-atualizado"));
  }, [missoesConcluidas]);

  const [
    statusNuvem,
    setStatusNuvem,
  ] = useState<StatusNuvem>(
    usuario ? "carregando" : "sincronizado"
  );

  const [erroNuvem, setErroNuvem] =
    useState("");

  const nuvemInicializadaRef =
    useRef(false);

  const hidratandoRef =
    useRef(false);

  const timerSalvarRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const ultimoEstadoSalvoRef =
    useRef("");

  const dadosAtuaisRef = useRef({
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
        estado: EstadoAppNuvem
      ) => {
        hidratandoRef.current = true;

        const materiasReconciliadas =
          reconciliarMateriasComPlano(
            estado.materias
          );

        setMaterias(
          materiasReconciliadas
        );

        setQuestoes(estado.questoes);
        setSessoes(estado.sessoes);
        setRevisoes(estado.revisoes);
        setSimulados(estado.simulados);
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

        const estadoReconciliado = {
          ...estado,
          materias:
            materiasReconciliadas,
        };

        ultimoEstadoSalvoRef.current =
          assinaturaEstado(
            estadoReconciliado
          );

        window.setTimeout(() => {
          hidratandoRef.current = false;
        }, 0);
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
      nuvemInicializadaRef.current = false;
      hidratandoRef.current = false;
      ultimoEstadoSalvoRef.current = "";
      setErroNuvem("");
      setStatusNuvem("sincronizado");
      return;
    }

    const idDaConta = usuario.id;
    let ativo = true;

    async function iniciarNuvem() {
      try {
        nuvemInicializadaRef.current = false;
        setStatusNuvem("carregando");
        setErroNuvem("");

        const estadoNuvem =
          await carregarEstadoDaNuvem(
            idDaConta
          );

        if (!ativo) {
          return;
        }

        if (estadoNuvem) {
          const materiasReconciliadas =
            reconciliarMateriasComPlano(
              estadoNuvem.materias
            );

          const estadoCorrigido:
            EstadoAppNuvem = {
            ...estadoNuvem,
            materias:
              materiasReconciliadas,
            salvoEm:
              new Date()
                .toISOString(),
          };

          aplicarEstadoDaNuvem(
            estadoCorrigido
          );

          if (
            assinaturaEstado(
              estadoCorrigido
            ) !==
            assinaturaEstado(
              estadoNuvem
            )
          ) {
            await salvarEstadoNaNuvem(
              idDaConta,
              estadoCorrigido
            );
          }
        } else {
          const estadoInicial =
            criarEstadoInicialDaConta();

          aplicarEstadoDaNuvem(
            estadoInicial
          );

          await salvarEstadoNaNuvem(
            idDaConta,
            estadoInicial
          );

          ultimoEstadoSalvoRef.current =
            assinaturaEstado(
              estadoInicial
            );
        }

        if (!ativo) {
          return;
        }

        nuvemInicializadaRef.current = true;
        setStatusNuvem("sincronizado");

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

        setErroNuvem(mensagem);
        setStatusNuvem("erro");
      }
    }

    void iniciarNuvem();

    return () => {
      ativo = false;

      if (timerSalvarRef.current) {
        clearTimeout(
          timerSalvarRef.current
        );
        timerSalvarRef.current = null;
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

    if (timerSalvarRef.current) {
      clearTimeout(
        timerSalvarRef.current
      );
    }

    setStatusNuvem("salvando");

    const idDaConta = usuario.id;

    timerSalvarRef.current =
      setTimeout(() => {
        void salvarAlteracao(
          idDaConta,
          estadoAtual,
          assinatura
        );
      }, 1200);

    return () => {
      if (timerSalvarRef.current) {
        clearTimeout(
          timerSalvarRef.current
        );
        timerSalvarRef.current = null;
      }
    };
  }, [
    estadoAtual,
    usuario?.id,
  ]);

  async function salvarAlteracao(
    idDaConta: string,
    estado: EstadoAppNuvem,
    assinatura: string
  ) {
    try {
      await salvarEstadoNaNuvem(
        idDaConta,
        estado
      );

      ultimoEstadoSalvoRef.current =
        assinatura;

      setErroNuvem("");
      setStatusNuvem("sincronizado");

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

      setErroNuvem(mensagem);
      setStatusNuvem("erro");
    }
  }

  async function sincronizarAgora() {
    if (!usuario) {
      throw new Error(
        "Nenhum usuário autenticado."
      );
    }

    try {
      setStatusNuvem("salvando");

      const estado =
        montarEstadoNuvem(
          dadosAtuaisRef.current
        );

      await salvarEstadoNaNuvem(
        usuario.id,
        estado
      );

      ultimoEstadoSalvoRef.current =
        assinaturaEstado(estado);

      setErroNuvem("");
      setStatusNuvem("sincronizado");

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

      setErroNuvem(mensagem);
      setStatusNuvem("erro");
      throw erro;
    }
  }

  function definirConclusaoAssunto(
    materiaId: string,
    assuntoId: string,
    concluido: boolean,
    moduloId?: string
  ) {
    const materia = materias.find(
      (item) => item.id === materiaId
    );

    const localizacao = materia
      ? encontrarAssunto(materia, assuntoId, moduloId)
      : null;

    const assunto = localizacao?.assunto;

    if (!materia || !assunto) return;

    setMaterias((anteriores) =>
      anteriores.map((itemMateria) =>
        itemMateria.id !== materiaId
          ? itemMateria
          : atualizarAssuntoNaArvore(
              itemMateria,
              assuntoId,
              (itemAssunto) => ({
                ...itemAssunto,
                concluido,
                atualizadoEm:
                  new Date().toISOString(),
              }),
              localizacao?.modulo.id
            )
      )
    );

    const idsRelacionados = planoPMPE.flatMap((semana) =>
      semana.dias.flatMap((dia) =>
        dia.missoes
          .filter(
            (missao) =>
              normalizarTexto(missao.materia) === normalizarTexto(materia.nome) &&
              normalizarTexto(missao.assunto) === normalizarTexto(assunto.nome)
          )
          .map((missao) => missao.id)
      )
    );

    setMissoesConcluidas((anteriores) =>
      concluido
        ? Array.from(new Set([...anteriores, ...idsRelacionados]))
        : anteriores.filter((id) => !idsRelacionados.includes(id))
    );

    if (concluido) {
      setRevisoes((anteriores) => {
        const jaExiste = anteriores.some(
          (revisao) =>
            !revisao.concluida &&
            normalizarTexto(revisao.materia) === normalizarTexto(materia.nome) &&
            normalizarTexto(revisao.assunto) === normalizarTexto(assunto.nome) &&
            (
              !localizacao?.modulo.id ||
              !revisao.moduloId ||
              revisao.moduloId === localizacao.modulo.id
            )
        );

        if (jaExiste) return anteriores;

        return [
          criarPrimeiraRevisao({
            materiaId: materia.id,
            moduloId: localizacao?.modulo.id,
            assuntoId: assunto.id,
            materia: materia.nome,
            modulo: localizacao?.modulo.nome,
            assunto: assunto.nome,
          }),
          ...anteriores,
        ];
      });
    } else {
      setRevisoes((anteriores) =>
        anteriores.filter(
          (revisao) =>
            !(
              !revisao.concluida &&
              normalizarTexto(revisao.materia) === normalizarTexto(materia.nome) &&
              normalizarTexto(revisao.assunto) === normalizarTexto(assunto.nome) &&
              (
                !localizacao?.modulo.id ||
                !revisao.moduloId ||
                revisao.moduloId === localizacao.modulo.id
              )
            )
        )
      );
    }

    window.dispatchEvent(new Event("pmpe-materias-atualizadas"));
    window.dispatchEvent(new Event("pmpe-dashboard-atualizado"));
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
        definirConclusaoAssunto,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context =
    useContext(AppContext);

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
    salvoEm: _salvoEm,
    ...dados
  } = estado;

  return JSON.stringify(dados);
}

function obterMensagemErro(
  erro: unknown,
  padrao: string
) {
  return erro instanceof Error
    ? erro.message
    : padrao;
}