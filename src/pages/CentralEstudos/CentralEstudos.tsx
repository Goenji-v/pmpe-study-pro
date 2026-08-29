import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

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

import type {
  DadosIniciarSessao,
} from "../../context/CronometroContext";

import {
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";
import { localizarProximaAula } from "../../services/conteudos/localizarConteudo";
import { criarDadosSessaoDaMissao } from "../../services/conteudos/sincronizacaoCanonica";
import { obterReferenciasDaMissao, planoPMPE } from "../../data/planoPMPE";

type EstadoNavegacaoCentral = {
  origem?: "dashboard" | "plano";
  prefillSessao?: DadosIniciarSessao;
};

export default function CentralEstudos() {
  const location = useLocation();
  const navigate = useNavigate();

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
    prepararSessao,
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

  const missaoPlanoAtual = useMemo(
    () =>
      estado.missaoId
        ? planoPMPE
            .flatMap((semana) => semana.dias)
            .flatMap((dia) => dia.missoes)
            .find((missao) => missao.id === estado.missaoId)
        : undefined,
    [estado.missaoId]
  );

  const sessaoVinculadaAConteudo = Boolean(
    missaoPlanoAtual?.conteudo
  );

  const sessaoVinculadaAAula = Boolean(
    estado.aulaId
  );

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

const [
  concluirAssunto,
  setConcluirAssunto,
] = useState(false);

  const prefillAplicadoRef = useRef(false);

  useEffect(() => {
    if (prefillAplicadoRef.current || materias.length === 0) {
      return;
    }

    const estadoNavegacao =
      location.state as EstadoNavegacaoCentral | null;

    let prefill = estadoNavegacao?.prefillSessao;

    if (!prefill) {
      const prefillSalvo = sessionStorage.getItem(
        "pmpe:central-estudos:prefill"
      );

      if (prefillSalvo) {
        try {
          prefill = JSON.parse(prefillSalvo) as DadosIniciarSessao;
        } catch {
          sessionStorage.removeItem(
            "pmpe:central-estudos:prefill"
          );
        }
      }
    }

    if (!prefill) {
      return;
    }

    // Conteúdo canônico pode ser reconstruído com segurança. Missões livres
    // podem ter sido adaptadas pelo diagnóstico; nesses casos preservamos a
    // matéria/assunto recebidos do Plano em vez de voltar ao texto estático.
    if (prefill.missaoId) {
      const missao = planoPMPE
        .flatMap((semana) => semana.dias)
        .flatMap((dia) => dia.missoes)
        .find((item) => item.id === prefill?.missaoId);

      if (missao && obterReferenciasDaMissao(missao).length > 0) {
        const objetivoRecebido = prefill.objetivo;
        const canonica = criarDadosSessaoDaMissao(
          materias,
          missao,
          prefill.semana ?? 1,
          prefill.dia ?? 1
        );

        prefill = {
          ...prefill,
          ...canonica,
          objetivo: objetivoRecebido ?? canonica.objetivo,
        };
      }
    }

    const materia =
      materias.find((item) => item.id === prefill.materiaId) ??
      materias.find((item) => item.nome === prefill.materia);

    const modulos = materia
      ? listarModulosDaMateria(materia)
      : [];

    const modulo =
      modulos.find((item) => item.id === prefill.moduloId) ??
      modulos.find((item) => item.nome === prefill.modulo) ??
      modulos.find((item) =>
        item.assuntos.some((assunto) =>
          assunto.id === prefill.assuntoId ||
          assunto.nome === prefill.assunto
        )
      ) ??
      modulos[0];

    const assunto =
      modulo?.assuntos.find((item) => item.id === prefill.assuntoId) ??
      modulo?.assuntos.find((item) => item.nome === prefill.assunto);

    prefillAplicadoRef.current = true;

    prepararSessao({
      materia: materia?.nome ?? prefill.materia,
      materiaId: materia?.id ?? prefill.materiaId,
      modulo: modulo?.nome ?? prefill.modulo,
      moduloId: modulo?.id ?? prefill.moduloId,
      assunto: assunto?.nome ?? prefill.assunto,
      assuntoId: assunto?.id ?? prefill.assuntoId,
      tipo:
        prefill.tipo === "estudo"
          ? "aula"
          : prefill.tipo,
      objetivo: prefill.objetivo ?? "",
      observacao: prefill.observacao ?? "",
      missaoId: prefill.missaoId,
      semana: prefill.semana,
      dia: prefill.dia,
      urlAula: prefill.urlAula,
      urlQuestoes: prefill.urlQuestoes,
    });

    sessionStorage.removeItem(
      "pmpe:central-estudos:prefill"
    );

    if (location.state) {
      navigate(location.pathname, {
        replace: true,
        state: null,
      });
    }
  }, [
    location.pathname,
    location.state,
    materias,
    navigate,
    prepararSessao,
  ]);

  const materiaSelecionada =
    useMemo(
      () =>
        materias.find(
          (materia) =>
            materia.id === estado.materiaId ||
            materia.nome === estado.materia
        ),
      [materias, estado.materia, estado.materiaId]
    );

  const modulosDisponiveis = useMemo(
    () =>
      materiaSelecionada
        ? listarModulosDaMateria(materiaSelecionada)
        : [],
    [materiaSelecionada]
  );

  const moduloSelecionado = useMemo(
    () =>
      modulosDisponiveis.find(
        (modulo) => modulo.id === estado.moduloId
      ) ?? modulosDisponiveis[0],
    [modulosDisponiveis, estado.moduloId]
  );

  const assuntosDisponiveis = useMemo(
    () => moduloSelecionado?.assuntos ?? [],
    [moduloSelecionado]
  );

  const assuntoSelecionado = useMemo(
    () =>
      assuntosDisponiveis.find(
        (assunto) =>
          assunto.id === estado.assuntoId ||
          assunto.nome === estado.assunto
      ),
    [assuntosDisponiveis, estado.assunto, estado.assuntoId]
  );

  const aulasDisponiveis = useMemo(
    () =>
      [...(assuntoSelecionado?.aulas ?? [])]
        .sort((aulaA, aulaB) => aulaA.ordem - aulaB.ordem),
    [assuntoSelecionado]
  );

  const aulaSelecionada = useMemo(
    () =>
      aulasDisponiveis.find(
        (aula) => aula.id === estado.aulaId
      ) ??
      (assuntoSelecionado
        ? localizarProximaAula(assuntoSelecionado)
        : undefined),
    [aulasDisponiveis, assuntoSelecionado, estado.aulaId]
  );

  const materiaObrigatoria =
    estado.tipo === "aula" ||
    estado.tipo === "questoes" ||
    estado.tipo === "revisao";

  const assuntoLivre =
    estado.tipo === "simulado";

  const formatoRevisao = estado.formatoRevisao ?? "teoria";

  function alterarCampo(
    campo:
      | "materiaId"
      | "modulo"
      | "moduloId"
      | "assunto"
      | "assuntoId"
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

    if (tipo !== "simulado") {
      atualizarDados({
        tipo,
        formatoRevisao:
          tipo === "revisao"
            ? estado.formatoRevisao ?? "teoria"
            : undefined,
      });

      return;
    }

    atualizarDados({
      tipo,
      formatoRevisao: undefined,
      materia: "",
      materiaId: undefined,
      modulo: undefined,
      moduloId: undefined,
      assunto: "",
      assuntoId: undefined,
      aulaId: undefined,
      urlAula: undefined,
      urlQuestoes: undefined,
    });
  }

  function selecionarMateria(
    materiaId: string
  ) {
    if (cronometroAtivo) {
      return;
    }

    const materia = materias.find(
      (item) => item.id === materiaId
    );

    const primeiroModulo = materia
      ? listarModulosDaMateria(materia)[0]
      : undefined;

    atualizarDados({
      materia: materia?.nome ?? "",
      materiaId: materia?.id,
      modulo: primeiroModulo?.nome,
      moduloId: primeiroModulo?.id,
      assunto: "",
      assuntoId: undefined,
      aulaId: undefined,
      urlAula: undefined,
      urlQuestoes: undefined,
    });
  }

  function selecionarModulo(
    moduloId: string
  ) {
    if (cronometroAtivo) {
      return;
    }

    const modulo = modulosDisponiveis.find(
      (item) => item.id === moduloId
    );

    atualizarDados({
      modulo: modulo?.nome,
      moduloId: modulo?.id,
      assunto: "",
      assuntoId: undefined,
      aulaId: undefined,
      urlAula: undefined,
      urlQuestoes: undefined,
    });
  }

  function selecionarAssunto(
    assuntoId: string
  ) {
    const assunto = assuntosDisponiveis.find(
      (item) => item.id === assuntoId
    );

    atualizarDados({
      assunto: assunto?.nome ?? "",
      assuntoId: assunto?.id,
      aulaId: assunto ? localizarProximaAula(assunto)?.id : undefined,
      urlAula: assunto ? (localizarProximaAula(assunto)?.url ?? assunto.aula) : undefined,
      urlQuestoes: assunto?.questoes,
    });
  }

  function selecionarAula(
    aulaId: string
  ) {
    const aula = aulasDisponiveis.find(
      (item) => item.id === aulaId
    );

    atualizarDados({
      aulaId: aula?.id,
      urlAula: aula?.url ?? assuntoSelecionado?.aula,
    });
  }

  function iniciarSessao() {
    setMensagem("");

    const iniciada =
      iniciar({
        materia:
          estado.materia,

        materiaId:
          estado.materiaId,

        modulo:
          estado.modulo,

        moduloId:
          estado.moduloId,

        assunto:
          estado.assunto,

        assuntoId:
          estado.assuntoId,

        aulaId:
          estado.aulaId,

        tipo:
          estado.tipo,

        formatoRevisao:
          estado.tipo === "revisao" ? formatoRevisao : undefined,

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
    setConcluirAssunto(false);

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
      estado.tipo === "questoes" ||
      estado.tipo === "simulado" ||
      (estado.tipo === "revisao" && formatoRevisao === "questoes");

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

        formatoRevisao:
          estado.tipo === "revisao"
            ? formatoRevisao
            : undefined,

        concluirAssunto:
          concluirAssunto &&
          (estado.tipo === "aula" ||
            estado.tipo === "questoes"),
      });

    if (!resultado) {
      return;
    }

    setModalFinalizacaoAberto(
      false
    );

    setMensagem(
      estado.tipo === "simulado"
        ? "Simulado salvo no histórico."
        : resultado.revisaoCriada
          ? "Sessão salva. Assunto concluído e revisão programada."
          : "Sessão salva sem duplicar o tempo."
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
            Uma sessão, um único tempo.
            Teoria, questões e revisão ficam
            vinculadas ao conteúdo correto.
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
                  materiaSelecionada?.id ?? ""
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
                        materia.id
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

            {!assuntoLivre && (
              <div className="central-estudos-campo">
                <label>Módulo</label>

                <select
                  value={moduloSelecionado?.id ?? ""}
                  onChange={(evento) =>
                    selecionarModulo(evento.target.value)
                  }
                  disabled={estado.ativo || !materiaSelecionada}
                >
                  <option value="">
                    {materiaSelecionada
                      ? "Selecione o módulo"
                      : "Selecione primeiro a matéria"}
                  </option>

                  {modulosDisponiveis.map((modulo) => (
                    <option key={modulo.id} value={modulo.id}>
                      {modulo.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="central-estudos-campo">
              <label>
                {estado.tipo === "simulado"
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
                    atualizarDados({
                      assunto: evento.target.value,
                      assuntoId: undefined,
                    })
                  }
                  disabled={
                    estado.ativo
                  }
                  placeholder="Digite o nome do simulado"
                />
              ) : (
                <>
                  <select
                    value={
                      estado.assuntoId ?? ""
                    }
                    onChange={(
                      evento
                    ) =>
                      selecionarAssunto(
                        evento.target.value
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
                            assunto.id
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

            {estado.tipo === "aula" &&
              assuntoSelecionado &&
              aulasDisponiveis.length > 0 && (
                <div className="central-estudos-campo">
                  <label>Aula</label>

                  <select
                    value={aulaSelecionada?.id ?? ""}
                    onChange={(evento) =>
                      selecionarAula(evento.target.value)
                    }
                    disabled={estado.ativo}
                  >
                    {aulasDisponiveis.map((aula) => (
                      <option key={aula.id} value={aula.id}>
                        {aula.concluida ? "✓ " : ""}
                        {aula.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {estado.tipo === "revisao" && (
              <div className="central-estudos-campo central-estudos-revisao-formato">
                <label>Formato da revisão</label>
                <div className="central-revisao-opcoes">
                  <button
                    type="button"
                    className={formatoRevisao === "teoria" ? "ativo" : ""}
                    onClick={() => atualizarDados({ formatoRevisao: "teoria" })}
                    disabled={estado.ativo}
                  >
                    📖 Teoria
                  </button>
                  <button
                    type="button"
                    className={formatoRevisao === "questoes" ? "ativo" : ""}
                    onClick={() => atualizarDados({ formatoRevisao: "questoes" })}
                    disabled={estado.ativo}
                  >
                    📝 Questões
                  </button>
                </div>
                <small>
                  {formatoRevisao === "teoria"
                    ? "Releitura, resumo, anotações ou revisão do material."
                    : "Ao finalizar, informe total, acertos, banca e dificuldade. O desempenho entra nas estatísticas do assunto."}
                </small>
              </div>
            )}

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

            {estado.modulo && (
              <small>Módulo: {estado.modulo}</small>
            )}

            <p>
              {estado.assunto ||
                "Nenhum assunto informado"}
            </p>

            {estado.tipo === "revisao" && (
              <small>Formato: {formatoRevisao === "questoes" ? "Questões" : "Teoria"}</small>
            )}

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

              {(estado.tipo === "questoes" ||
                estado.tipo === "simulado" ||
                (estado.tipo === "revisao" && formatoRevisao === "questoes")) && (
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

              {(estado.tipo === "aula" ||
                estado.tipo === "questoes") &&
                !sessaoVinculadaAConteudo && (
                <label className="finalizacao-concluir finalizacao-campo-largo">
                  <input
                    type="checkbox"
                    checked={concluirAssunto}
                    onChange={(evento) =>
                      setConcluirAssunto(evento.target.checked)
                    }
                  />

                  <span>
                    <strong>Concluir este assunto</strong>
                    <small>
                      Marque apenas quando terminar o conteúdo. A revisão 1–7–15
                      será criada uma única vez.
                    </small>
                  </span>
                </label>
              )}

              {(estado.tipo === "aula" || estado.tipo === "questoes") &&
                sessaoVinculadaAConteudo && (
                  <div className="finalizacao-concluir finalizacao-campo-largo">
                    <span>
                      <strong>Conteúdo vinculado ao Plano</strong>
                      <small>
                        {sessaoVinculadaAAula
                          ? "Ao finalizar, esta aula será marcada como concluída. O assunto só fecha quando todas as aulas dele forem concluídas."
                          : "Ao finalizar, este assunto será marcado como concluído e o Plano será atualizado junto com Conteúdos."}
                      </small>
                    </span>
                  </div>
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
    redacao: "Redação",
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
    redacao: "✍️",
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
