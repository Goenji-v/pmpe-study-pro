import {
  useMemo,
  useState,
} from "react";

import "./CentralEstudos.css";
import "./CentralEstudosModal.css";

import MateriaisDoAssunto from "../../components/MateriaisDoAssunto/MateriaisDoAssunto";

import { useApp } from "../../context/AppContext";

import {
  useCronometro,
} from "../../context/CronometroContext";

import type {
  Dificuldade,
  TipoSessao,
} from "../../types/index";

export default function CentralEstudos() {
  const {
    materias,
    sessoes,
  } = useApp();

  const {
    sessaoAtiva,
    segundosDecorridos,
    cronometroAtivo,
    iniciar,
    atualizarDados,
    pausar,
    continuar,
    finalizar,
    cancelar,
  } = useCronometro();

  const estado = {
    ...sessaoAtiva,
    ativo:
      cronometroAtivo,
    pausado:
      sessaoAtiva.status ===
      "pausado",
  };

  const [mensagem, setMensagem] =
    useState("");

const [
  modalFinalizacaoAberto,
  setModalFinalizacaoAberto,
] = useState(false);

const [
  minutosFinalizacao,
  setMinutosFinalizacao,
] = useState("");

const [
  quantidadeQuestoes,
  setQuantidadeQuestoes,
] = useState("");

const [
  quantidadeAcertos,
  setQuantidadeAcertos,
] = useState("");

const [
  banca,
  setBanca,
] = useState("");

const [
  dificuldade,
  setDificuldade,
] = useState<Dificuldade>(
  "media"
);

const [
  avaliacaoRevisao,
  setAvaliacaoRevisao,
] = useState<
  "facil" | "media" | "dificil"
>("media");

const [
  observacaoFinalizacao,
  setObservacaoFinalizacao,
] = useState("");

  const materiaSelecionada =
    useMemo(
      () =>
        materias.find(
          (materia) =>
            materia.nome ===
            estado.materia
        ),
      [materias, estado.materia]
    );

  const assuntosDisponiveis =
    materiaSelecionada?.assuntos ?? [];

  const materiaObrigatoria =
    estado.tipo === "aula" ||
    estado.tipo === "questoes";

  const assuntoLivre =
    estado.tipo === "revisao" ||
    estado.tipo === "simulado";

  function alterarCampo(
    campo:
      | "assunto"
      | "objetivo"
      | "observacao",
    valor: string
  ) {
    atualizarDados({
      [campo]:
        valor,
    });
  }

  function alterarTipo(
    tipo: TipoSessao
  ) {
    if (cronometroAtivo) {
      return;
    }

    setMensagem("");

    atualizarDados({
      tipo,

      materia:
        tipo === "revisao" ||
        tipo === "simulado"
          ? ""
          : estado.materia,

      assunto: "",
    });
  }

  function selecionarMateria(
    materia: string
  ) {
    if (cronometroAtivo) {
      return;
    }

    atualizarDados({
      materia,
      assunto: "",
    });
  }

  function iniciarSessao() {
    setMensagem("");

    const iniciada =
      iniciar({
        materia:
          estado.materia,

        assunto:
          estado.assunto,

        tipo:
          estado.tipo,

        objetivo:
          estado.objetivo,

        observacao:
          estado.observacao,

        missaoId:
          estado.missaoId,

        semana:
          estado.semana,

        dia:
          estado.dia,

        urlAula:
          estado.urlAula,

        urlQuestoes:
          estado.urlQuestoes,
      });

    if (iniciada) {
      setMensagem(
        "Sessão iniciada."
      );
    }
  }

  function pausarSessao() {
    pausar();
  }

  function continuarSessao() {
    continuar();
  }

  function cancelarSessao() {
    cancelar(
      cronometroAtivo
    );

    setMensagem("");
  }

  function abrirModalFinalizacao() {
    if (!cronometroAtivo) {
      return;
    }

    const minutosCronometro =
      Math.max(
        1,
        Math.round(
          segundosDecorridos /
          60
        )
      );

    setMinutosFinalizacao(
      String(
        minutosCronometro
      )
    );

    setQuantidadeQuestoes("");
    setQuantidadeAcertos("");
    setBanca("");
    setDificuldade("media");
    setAvaliacaoRevisao("media");

    setObservacaoFinalizacao(
      estado.observacao || ""
    );

    setModalFinalizacaoAberto(
      true
    );
  }

  function confirmarFinalizacao() {
    const minutos =
      Number(
        minutosFinalizacao
          .trim()
          .replace(
            ",",
            "."
          )
      );

    if (
      !Number.isFinite(
        minutos
      ) ||
      minutos < 1 ||
      minutos > 1440
    ) {
      window.alert(
        "Informe um tempo válido entre 1 e 1440 minutos."
      );

      return;
    }

    let totalQuestoes:
      number | undefined;

    let acertos:
      number | undefined;

    let erros:
      number | undefined;

    const exigeQuestoes =
      estado.tipo ===
        "questoes" ||
      estado.tipo ===
        "simulado";

    if (exigeQuestoes) {
      totalQuestoes =
        Number(
          quantidadeQuestoes
        );

      acertos =
        Number(
          quantidadeAcertos
        );

      if (
        !Number.isInteger(
          totalQuestoes
        ) ||
        totalQuestoes < 1
      ) {
        window.alert(
          "Informe a quantidade de questões realizadas."
        );

        return;
      }

      if (
        !Number.isInteger(
          acertos
        ) ||
        acertos < 0 ||
        acertos >
          totalQuestoes
      ) {
        window.alert(
          "Informe uma quantidade válida de acertos."
        );

        return;
      }

      erros =
        totalQuestoes -
        acertos;
    }

    const resultado =
      finalizar({
        minutosReais:
          Math.round(
            minutos
          ),

        observacao:
          observacaoFinalizacao,

        quantidadeQuestoes:
          totalQuestoes,

        quantidadeAcertos:
          acertos,

        quantidadeErros:
          erros,

        banca:
          banca.trim() ||
          undefined,

        dificuldade:
          exigeQuestoes
            ? dificuldade
            : undefined,

        avaliacaoRevisao:
          estado.tipo ===
            "revisao"
              ? avaliacaoRevisao
              : undefined,
      });

    if (!resultado) {
      return;
    }

    setModalFinalizacaoAberto(
      false
    );

    setMensagem(
      resultado.revisaoCriada
        ? "Sessão salva e primeira revisão criada automaticamente."
        : "Sessão salva."
    );
  }

  return (
    <section className="central-estudos-container">
      <div className="central-estudos-cabecalho">
        <div>
          <h1>
            ⏱ Central de Estudos
          </h1>

          <p>
            Registre aulas,
            revisões, questões e
            simulados separadamente.
          </p>
        </div>

        <div className="central-estudos-total">
          <span>
            Sessões registradas
          </span>

          <strong>
            {sessoes.length}
          </strong>
        </div>
      </div>

      {mensagem && (
        <div className="central-estudos-mensagem">
          {mensagem}
        </div>
      )}

      <div className="central-estudos-grid">
        <div className="central-estudos-configuracao">
          <h2>
            Tipo de atividade
          </h2>

          <div className="central-estudos-tipos">
            <BotaoTipo
              ativo={
                estado.tipo ===
                "aula"
              }
              icone="🎥"
              texto="Aula"
              onClick={() =>
                alterarTipo("aula")
              }
            />

            <BotaoTipo
              ativo={
                estado.tipo ===
                "revisao"
              }
              icone="🔁"
              texto="Revisão"
              onClick={() =>
                alterarTipo(
                  "revisao"
                )
              }
            />

            <BotaoTipo
              ativo={
                estado.tipo ===
                "questoes"
              }
              icone="📝"
              texto="Questões"
              onClick={() =>
                alterarTipo(
                  "questoes"
                )
              }
            />

            <BotaoTipo
              ativo={
                estado.tipo ===
                "simulado"
              }
              icone="🎯"
              texto="Simulado"
              onClick={() =>
                alterarTipo(
                  "simulado"
                )
              }
            />
          </div>

          <div className="central-estudos-formulario">
            <div className="central-estudos-campo">
              <label>
                Matéria
                {!materiaObrigatoria && (
                  <small>
                    {" "}
                    (opcional)
                  </small>
                )}
              </label>

              <select
                value={
                  estado.materia
                }
                onChange={(evento) =>
                  selecionarMateria(
                    evento.target
                      .value
                  )
                }
                disabled={
                  estado.ativo
                }
              >
                <option value="">
                  {materiaObrigatoria
                    ? "Selecione a matéria"
                    : "Atividade geral"}
                </option>

                {materias.map(
                  (materia) => (
                    <option
                      key={
                        materia.id
                      }
                      value={
                        materia.nome
                      }
                    >
                      {
                        materia.nome
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="central-estudos-campo">
              <label>
                {estado.tipo ===
                "revisao"
                  ? "Nome da revisão"
                  : estado.tipo ===
                      "simulado"
                    ? "Nome do simulado"
                    : "Assunto"}
              </label>

              {assuntoLivre ? (
                <input
                  value={
                    estado.assunto
                  }
                  onChange={(
                    evento
                  ) =>
                    alterarCampo(
                      "assunto",
                      evento.target
                        .value
                    )
                  }
                  disabled={
                    estado.ativo
                  }
                  placeholder={
                    estado.tipo ===
                    "revisao"
                      ? "Digite o conteúdo revisado"
                      : "Digite o nome do simulado"
                  }
                />
              ) : (
                <>
                  <select
                    value={
                      assuntosDisponiveis.some(
                        (assunto) =>
                          assunto.nome ===
                          estado.assunto
                      )
                        ? estado.assunto
                        : ""
                    }
                    onChange={(
                      evento
                    ) =>
                      alterarCampo(
                        "assunto",
                        evento.target
                          .value
                      )
                    }
                    disabled={
                      estado.ativo ||
                      !estado.materia
                    }
                  >
                    <option value="">
                      {estado.materia
                        ? "Selecione o assunto"
                        : "Selecione primeiro a matéria"}
                    </option>

                    {assuntosDisponiveis.map(
                      (assunto) => (
                        <option
                          key={
                            assunto.id
                          }
                          value={
                            assunto.nome
                          }
                        >
                          {
                            assunto.nome
                          }
                        </option>
                      )
                    )}
                  </select>

                  <input
                    value={
                      estado.assunto
                    }
                    onChange={(
                      evento
                    ) =>
                      alterarCampo(
                        "assunto",
                        evento.target
                          .value
                      )
                    }
                    disabled={
                      estado.ativo
                    }
                    placeholder="Ou digite um assunto personalizado"
                  />
                </>
              )}
            </div>

            <div className="central-estudos-campo">
              <label>
                Objetivo
                <small>
                  {" "}
                  (opcional)
                </small>
              </label>

              <input
                value={
                  estado.objetivo
                }
                onChange={(evento) =>
                  alterarCampo(
                    "objetivo",
                    evento.target
                      .value
                  )
                }
                disabled={
                  estado.ativo
                }
                placeholder="Objetivo da sessão"
              />
            </div>

            <div className="central-estudos-campo">
              <label>
                Observações
                <small>
                  {" "}
                  (opcional)
                </small>
              </label>

              <textarea
                value={
                  estado.observacao
                }
                onChange={(evento) =>
                  alterarCampo(
                    "observacao",
                    evento.target
                      .value
                  )
                }
                placeholder="Anotações sobre a sessão..."
              />
            </div>
          </div>
        </div>

        <div className="central-estudos-cronometro">
          <div className="central-estudos-status">
            <span
              className={
                estado.ativo
                  ? estado.pausado
                    ? "pausado"
                    : "ativo"
                  : "parado"
              }
            />

            <strong>
              {!estado.ativo
                ? "Pronto para iniciar"
                : estado.pausado
                  ? "Sessão pausada"
                  : "Sessão em andamento"}
            </strong>
          </div>

          <div className="central-estudos-tempo">
            {formatarSegundos(
              segundosDecorridos
            )}
          </div>

          <div className="central-estudos-resumo">
            <span>
              {iconePorTipo(
                estado.tipo
              )}{" "}
              {nomePorTipo(
                estado.tipo
              )}
            </span>

            <strong>
              {estado.materia ||
                materiaPadraoPorTipo(
                  estado.tipo
                )}
            </strong>

            <p>
              {estado.assunto ||
                "Nenhum assunto informado"}
            </p>

            {estado.objetivo && (
              <small>
                Objetivo:{" "}
                {estado.objetivo}
              </small>
            )}
          </div>

          <MateriaisDoAssunto
            materia={estado.materia}
            assunto={estado.assunto}
          />

          {(estado.urlAula ||
            estado.urlQuestoes) && (
            <div className="central-estudos-links">
              {estado.urlAula && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      estado.urlAula,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  🎥 Abrir aula
                </button>
              )}

              {estado.urlQuestoes && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      estado.urlQuestoes,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  📝 Abrir questões
                </button>
              )}
            </div>
          )}

          <div className="central-estudos-acoes">
            {!estado.ativo && (
              <button
                type="button"
                className="central-botao-iniciar"
                onClick={
                  iniciarSessao
                }
              >
                ▶ Iniciar sessão
              </button>
            )}

            {estado.ativo &&
              !estado.pausado && (
                <button
                  type="button"
                  className="central-botao-pausar"
                  onClick={
                    pausarSessao
                  }
                >
                  ⏸ Pausar
                </button>
              )}

            {estado.ativo &&
              estado.pausado && (
                <button
                  type="button"
                  className="central-botao-continuar"
                  onClick={
                    continuarSessao
                  }
                >
                  ▶ Continuar
                </button>
              )}

            {estado.ativo && (
              <button
                type="button"
                className="central-botao-finalizar"
                onClick={
                  abrirModalFinalizacao
                }
              >
                ✓ Finalizar e salvar
              </button>
            )}

            <button
              type="button"
              className="central-botao-cancelar"
              onClick={
                cancelarSessao
              }
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    
      {modalFinalizacaoAberto && (
        <div
          className="finalizacao-overlay"
          role="presentation"
          onMouseDown={(evento) => {
            if (
              evento.target ===
              evento.currentTarget
            ) {
              setModalFinalizacaoAberto(
                false
              );
            }
          }}
        >
          <div
            className="finalizacao-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-finalizacao"
          >
            <div className="finalizacao-cabecalho">
              <div>
                <h2 id="titulo-finalizacao">
                  Finalizar sessão
                </h2>

                <p>
                  {estado.materia} —{" "}
                  {estado.assunto}
                </p>
              </div>

              <button
                type="button"
                className="finalizacao-fechar"
                onClick={() =>
                  setModalFinalizacaoAberto(
                    false
                  )
                }
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="finalizacao-grid">
              <label>
                Tempo real em minutos

                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={
                    minutosFinalizacao
                  }
                  onChange={(evento) =>
                    setMinutosFinalizacao(
                      evento.target.value
                    )
                  }
                />
              </label>

              {(estado.tipo ===
                "questoes" ||
                estado.tipo ===
                  "simulado") && (
                <>
                  <label>
                    Questões realizadas

                    <input
                      type="number"
                      min="1"
                      value={
                        quantidadeQuestoes
                      }
                      onChange={(evento) =>
                        setQuantidadeQuestoes(
                          evento.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Acertos

                    <input
                      type="number"
                      min="0"
                      value={
                        quantidadeAcertos
                      }
                      onChange={(evento) =>
                        setQuantidadeAcertos(
                          evento.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Erros calculados

                    <input
                      value={
                        quantidadeQuestoes &&
                        quantidadeAcertos
                          ? Math.max(
                              0,
                              Number(
                                quantidadeQuestoes
                              ) -
                                Number(
                                  quantidadeAcertos
                                )
                            )
                          : ""
                      }
                      readOnly
                    />
                  </label>

                  <label>
                    Banca

                    <input
                      value={banca}
                      onChange={(evento) =>
                        setBanca(
                          evento.target.value
                        )
                      }
                      placeholder="AOCP, Cebraspe..."
                    />
                  </label>

                  <label>
                    Dificuldade

                    <select
                      value={dificuldade}
                      onChange={(evento) =>
                        setDificuldade(
                          evento.target
                            .value as
                            Dificuldade
                        )
                      }
                    >
                      <option value="facil">
                        Fácil
                      </option>

                      <option value="media">
                        Média
                      </option>

                      <option value="dificil">
                        Difícil
                      </option>
                    </select>
                  </label>
                </>
              )}

              {estado.tipo ===
                "revisao" && (
                <label>
                  Como foi a revisão?

                  <select
                    value={
                      avaliacaoRevisao
                    }
                    onChange={(evento) =>
                      setAvaliacaoRevisao(
                        evento.target
                          .value as
                          | "facil"
                          | "media"
                          | "dificil"
                      )
                    }
                  >
                    <option value="facil">
                      Fácil
                    </option>

                    <option value="media">
                      Média
                    </option>

                    <option value="dificil">
                      Difícil
                    </option>
                  </select>
                </label>
              )}

              <label className="finalizacao-campo-largo">
                Observações

                <textarea
                  value={
                    observacaoFinalizacao
                  }
                  onChange={(evento) =>
                    setObservacaoFinalizacao(
                      evento.target.value
                    )
                  }
                  placeholder="O que foi estudado, dificuldades e pontos importantes..."
                />
              </label>
            </div>

            <div className="finalizacao-aviso">
              O envio de PDF, imagem e texto será
              integrado na próxima etapa pelo Centro
              de Materiais.
            </div>

            <div className="finalizacao-acoes">
              <button
                type="button"
                className="finalizacao-cancelar"
                onClick={() =>
                  setModalFinalizacaoAberto(
                    false
                  )
                }
              >
                Voltar
              </button>

              <button
                type="button"
                className="finalizacao-confirmar"
                onClick={
                  confirmarFinalizacao
                }
              >
                Salvar sessão
              </button>
            </div>
          </div>
        </div>
      )}
</section>
  );
}

function BotaoTipo({
  ativo,
  icone,
  texto,
  onClick,
}: {
  ativo: boolean;
  icone: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        ativo
          ? "central-tipo central-tipo-ativo"
          : "central-tipo"
      }
      onClick={onClick}
    >
      <span>{icone}</span>
      <strong>{texto}</strong>
    </button>
  );
}

function nomePorTipo(
  tipo: TipoSessao
) {
  const nomes: Partial<
    Record<TipoSessao, string>
  > = {
    aula: "Aula",
    videoaula: "Aula",
    estudo: "Aula",
    leitura: "Aula",
    revisao: "Revisão",
    questoes: "Questões",
    simulado: "Simulado",
  };

  return nomes[tipo] || "Estudo";
}

function iconePorTipo(
  tipo: TipoSessao
) {
  const icones: Partial<
    Record<TipoSessao, string>
  > = {
    aula: "🎥",
    videoaula: "🎥",
    estudo: "📚",
    leitura: "📄",
    revisao: "🔁",
    questoes: "📝",
    simulado: "🎯",
  };

  return icones[tipo] || "📚";
}

function materiaPadraoPorTipo(
  tipo: TipoSessao
) {
  if (tipo === "revisao") {
    return "Revisões";
  }

  if (tipo === "simulado") {
    return "Simulados";
  }

  return "Estudo geral";
}

function formatarSegundos(
  segundosTotais: number
) {
  const horas =
    Math.floor(
      segundosTotais / 3600
    );

  const minutos =
    Math.floor(
      (segundosTotais % 3600) /
        60
    );

  const segundos =
    segundosTotais % 60;

  return [
    horas,
    minutos,
    segundos,
  ]
    .map((valor) =>
      String(valor).padStart(
        2,
        "0"
      )
    )
    .join(":");
}

