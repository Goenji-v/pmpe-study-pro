import {
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import CentralEstudos from "./CentralEstudos";
import "./CentralEstudosGateway.css";

import { useApp } from "../../context/AppContext";
import {
  useCronometro,
  type DadosIniciarSessao,
} from "../../context/CronometroContext";
import {
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";
import type {
  TipoSessao,
} from "../../types";

type EstadoNavegacaoCentral = {
  origem?: "dashboard" | "plano" | "livre";
  prefillSessao?: DadosIniciarSessao;
};

type TipoLivre =
  | "aula"
  | "questoes"
  | "revisao";

export default function CentralEstudosGateway() {
  const location = useLocation();
  const navigate = useNavigate();
  const { materias } = useApp();
  const {
    sessaoAtiva,
    cronometroAtivo,
    prepararSessao,
  } = useCronometro();

  const estadoNavegacao =
    location.state as EstadoNavegacaoCentral | null;

  const temPrefillExterno = Boolean(
    estadoNavegacao?.prefillSessao ||
      sessionStorage.getItem(
        "pmpe:central-estudos:prefill"
      )
  );

  const temSessaoPreparada = Boolean(
    cronometroAtivo ||
      sessaoAtiva.materia ||
      sessaoAtiva.assunto ||
      sessaoAtiva.missaoId
  );

  if (
    temPrefillExterno ||
    temSessaoPreparada
  ) {
    return <CentralEstudos />;
  }

  return (
    <CentralEstudosLivre
      materias={materias}
      onPreparar={prepararSessao}
      onAbrirQuestoes={() =>
        navigate("/questoes")
      }
      onAbrirSimulados={() =>
        navigate("/simulados")
      }
    />
  );
}

function CentralEstudosLivre({
  materias,
  onPreparar,
  onAbrirQuestoes,
  onAbrirSimulados,
}: {
  materias: ReturnType<typeof useApp>["materias"];
  onPreparar: (
    dados: DadosIniciarSessao
  ) => void;
  onAbrirQuestoes: () => void;
  onAbrirSimulados: () => void;
}) {
  const [tipo, setTipo] =
    useState<TipoLivre>("aula");
  const [materiaId, setMateriaId] =
    useState("");
  const [moduloId, setModuloId] =
    useState("");
  const [assuntoId, setAssuntoId] =
    useState("");
  const [aulaId, setAulaId] =
    useState("");
  const [mensagem, setMensagem] =
    useState("");

  const materiaSelecionada = useMemo(
    () =>
      materias.find(
        (item) => item.id === materiaId
      ),
    [materias, materiaId]
  );

  const modulosDisponiveis = useMemo(
    () =>
      materiaSelecionada
        ? listarModulosDaMateria(
            materiaSelecionada
          )
        : [],
    [materiaSelecionada]
  );

  const moduloSelecionado = useMemo(
    () =>
      modulosDisponiveis.find(
        (item) => item.id === moduloId
      ),
    [modulosDisponiveis, moduloId]
  );

  const assuntosDisponiveis =
    moduloSelecionado?.assuntos ?? [];

  const assuntoSelecionado = useMemo(
    () =>
      assuntosDisponiveis.find(
        (item) => item.id === assuntoId
      ),
    [assuntosDisponiveis, assuntoId]
  );

  const aulasDisponiveis = useMemo(
    () =>
      [...(assuntoSelecionado?.aulas ?? [])]
        .sort((a, b) => a.ordem - b.ordem),
    [assuntoSelecionado]
  );

  const aulaSelecionada = useMemo(
    () =>
      aulasDisponiveis.find(
        (item) => item.id === aulaId
      ) ?? aulasDisponiveis[0],
    [aulasDisponiveis, aulaId]
  );

  function selecionarMateria(
    novoMateriaId: string
  ) {
    setMateriaId(novoMateriaId);
    setAssuntoId("");
    setAulaId("");
    setMensagem("");

    const materia = materias.find(
      (item) => item.id === novoMateriaId
    );
    const primeiroModulo = materia
      ? listarModulosDaMateria(materia)[0]
      : undefined;

    setModuloId(primeiroModulo?.id ?? "");
  }

  function selecionarModulo(
    novoModuloId: string
  ) {
    setModuloId(novoModuloId);
    setAssuntoId("");
    setAulaId("");
    setMensagem("");
  }

  function selecionarAssunto(
    novoAssuntoId: string
  ) {
    setAssuntoId(novoAssuntoId);
    setMensagem("");

    const assunto =
      assuntosDisponiveis.find(
        (item) => item.id === novoAssuntoId
      );
    const primeiraAula =
      [...(assunto?.aulas ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .find((aula) => !aula.concluida) ??
      [...(assunto?.aulas ?? [])]
        .sort((a, b) => a.ordem - b.ordem)[0];

    setAulaId(primeiraAula?.id ?? "");
  }

  function preparar() {
    if (
      !materiaSelecionada ||
      !moduloSelecionado ||
      !assuntoSelecionado
    ) {
      setMensagem(
        "Selecione matéria, módulo e assunto para continuar."
      );
      return;
    }

    const tipoSessao: TipoSessao = tipo;

    onPreparar({
      materia: materiaSelecionada.nome,
      materiaId: materiaSelecionada.id,
      modulo: moduloSelecionado.nome,
      moduloId: moduloSelecionado.id,
      assunto: assuntoSelecionado.nome,
      assuntoId: assuntoSelecionado.id,
      aulaId:
        tipo === "aula"
          ? aulaSelecionada?.id
          : undefined,
      tipo: tipoSessao,
      formatoRevisao:
        tipo === "revisao"
          ? "teoria"
          : undefined,
      objetivo: "",
      observacao: "",
      urlAula:
        tipo === "aula"
          ? aulaSelecionada?.url ??
            assuntoSelecionado.aula
          : undefined,
      urlQuestoes:
        tipo === "questoes"
          ? assuntoSelecionado.questoes
          : undefined,
    });
  }

  const temLinkDaAtividade =
    tipo === "aula"
      ? Boolean(
          aulaSelecionada?.url ||
            assuntoSelecionado?.aula
        )
      : tipo === "questoes"
        ? Boolean(
            assuntoSelecionado?.questoes
          )
        : true;

  return (
    <section className="central-livre-container">
      <header className="central-livre-topo">
        <div>
          <span className="central-livre-kicker">
            MODO LIVRE
          </span>
          <h1>⏱ Central de Estudos</h1>
          <p>
            Entre direto pelo menu e escolha o que quer estudar. Você não precisa iniciar pelo Plano de Estudos.
          </p>
        </div>

        <div className="central-livre-selo">
          Estudo independente
        </div>
      </header>

      <div className="central-livre-layout">
        <div className="central-livre-card central-livre-selecao">
          <div className="central-livre-card-topo">
            <div>
              <span>1</span>
              <div>
                <strong>Escolha a atividade</strong>
                <small>Aula, questões ou revisão.</small>
              </div>
            </div>
          </div>

          <div className="central-livre-tipos">
            <TipoLivreButton
              ativo={tipo === "aula"}
              icone="🎥"
              titulo="Aula"
              onClick={() => setTipo("aula")}
            />
            <TipoLivreButton
              ativo={tipo === "questoes"}
              icone="📝"
              titulo="Questões"
              onClick={() => setTipo("questoes")}
            />
            <TipoLivreButton
              ativo={tipo === "revisao"}
              icone="🔁"
              titulo="Revisão"
              onClick={() => setTipo("revisao")}
            />
          </div>

          <div className="central-livre-card-topo central-livre-etapa-conteudo">
            <div>
              <span>2</span>
              <div>
                <strong>Escolha o conteúdo</strong>
                <small>Matéria → módulo → assunto{tipo === "aula" ? " → aula" : ""}.</small>
              </div>
            </div>
          </div>

          <div className="central-livre-form">
            <label>
              Matéria
              <select
                value={materiaId}
                onChange={(evento) =>
                  selecionarMateria(
                    evento.target.value
                  )
                }
              >
                <option value="">
                  Selecione a matéria
                </option>
                {materias.map((materia) => (
                  <option
                    key={materia.id}
                    value={materia.id}
                  >
                    {materia.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Módulo
              <select
                value={moduloId}
                onChange={(evento) =>
                  selecionarModulo(
                    evento.target.value
                  )
                }
                disabled={!materiaSelecionada}
              >
                <option value="">
                  {materiaSelecionada
                    ? "Selecione o módulo"
                    : "Selecione primeiro a matéria"}
                </option>
                {modulosDisponiveis.map((modulo) => (
                  <option
                    key={modulo.id}
                    value={modulo.id}
                  >
                    {modulo.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assunto
              <select
                value={assuntoId}
                onChange={(evento) =>
                  selecionarAssunto(
                    evento.target.value
                  )
                }
                disabled={!moduloSelecionado}
              >
                <option value="">
                  {moduloSelecionado
                    ? "Selecione o assunto"
                    : "Selecione primeiro o módulo"}
                </option>
                {assuntosDisponiveis.map((assunto) => (
                  <option
                    key={assunto.id}
                    value={assunto.id}
                  >
                    {assunto.nome}
                  </option>
                ))}
              </select>
            </label>

            {tipo === "aula" &&
              assuntoSelecionado &&
              aulasDisponiveis.length > 0 && (
                <label>
                  Aula
                  <select
                    value={
                      aulaSelecionada?.id ?? ""
                    }
                    onChange={(evento) =>
                      setAulaId(
                        evento.target.value
                      )
                    }
                  >
                    {aulasDisponiveis.map((aula) => (
                      <option
                        key={aula.id}
                        value={aula.id}
                      >
                        {aula.concluida ? "✓ " : ""}
                        {aula.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
          </div>

          {mensagem && (
            <div className="central-livre-aviso">
              {mensagem}
            </div>
          )}

          {assuntoSelecionado &&
            !temLinkDaAtividade &&
            tipo !== "revisao" && (
              <div className="central-livre-info">
                <strong>
                  {tipo === "aula"
                    ? "Esta aula não possui link externo cadastrado."
                    : "Este assunto não possui link externo de questões cadastrado."}
                </strong>
                <span>
                  A sessão ainda pode ser iniciada normalmente e registrada no seu histórico.
                </span>
              </div>
            )}

          <button
            type="button"
            className="central-livre-continuar"
            onClick={preparar}
          >
            Continuar para a Central →
          </button>
        </div>

        <aside className="central-livre-card central-livre-atalhos">
          <span className="central-livre-kicker">
            ATALHOS
          </span>
          <h2>Quer praticar direto?</h2>
          <p>
            Você também pode usar as ferramentas de questões e simulados sem passar pelo cronograma.
          </p>

          <button
            type="button"
            onClick={onAbrirQuestoes}
          >
            📝 Central de Questões
            <small>Banco, registro e desempenho</small>
          </button>

          <button
            type="button"
            onClick={onAbrirSimulados}
          >
            🎯 Simulados
            <small>Gerar, escolher e resolver</small>
          </button>

          <div className="central-livre-explicacao">
            <strong>Como funciona</strong>
            <p>
              Pelo Plano, a missão continua abrindo tudo preenchido automaticamente. Pelo menu, você escolhe livremente o conteúdo e inicia uma sessão independente.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TipoLivreButton({
  ativo,
  icone,
  titulo,
  onClick,
}: {
  ativo: boolean;
  icone: string;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        ativo
          ? "central-livre-tipo ativo"
          : "central-livre-tipo"
      }
      onClick={onClick}
    >
      <span>{icone}</span>
      <strong>{titulo}</strong>
    </button>
  );
}
