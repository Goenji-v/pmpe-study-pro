import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./CentralEstudos.css";

import MateriaisDoAssunto from "../../components/MateriaisDoAssunto/MateriaisDoAssunto";

import { useApp } from "../../context/AppContext";

import type {
  SessaoEstudo,
  TipoSessao,
} from "../../types/index";

type EstadoCronometro = {
  ativo: boolean;
  pausado: boolean;

  tipo: TipoSessao;

  materia: string;
  assunto: string;

  objetivo: string;
  observacao: string;

  iniciadaEm: string | null;
  pausadaEm: string | null;

  segundosPausados: number;

  missaoId?: string;
  semana?: number;
  dia?: number;

  urlAula?: string;
  urlQuestoes?: string;
};

const CHAVE_CRONOMETRO =
  "pmpe_cronometro_estudo";

const CHAVE_MISSOES_CONCLUIDAS =
  "pmpe_plano_missoes_concluidas";

const estadoInicial: EstadoCronometro = {
  ativo: false,
  pausado: false,

  tipo: "aula",

  materia: "",
  assunto: "",

  objetivo: "",
  observacao: "",

  iniciadaEm: null,
  pausadaEm: null,

  segundosPausados: 0,

  missaoId: undefined,
  semana: undefined,
  dia: undefined,

  urlAula: undefined,
  urlQuestoes: undefined,
};

export default function CentralEstudos() {
  const {
    materias,
    sessoes,
    setSessoes,
  } = useApp();

  const [estado, setEstado] =
    useState<EstadoCronometro>(
      carregarCronometro
    );

  const [
    segundosDecorridos,
    setSegundosDecorridos,
  ] = useState(0);

  const [mensagem, setMensagem] =
    useState("");

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

  useEffect(() => {
    salvarCronometro(estado);
  }, [estado]);

  useEffect(() => {
    function atualizarCronometro() {
      setEstado(
        carregarCronometro()
      );
    }

    window.addEventListener(
      "pmpe-cronometro-atualizado",
      atualizarCronometro
    );

    window.addEventListener(
      "storage",
      atualizarCronometro
    );

    window.addEventListener(
      "focus",
      atualizarCronometro
    );

    return () => {
      window.removeEventListener(
        "pmpe-cronometro-atualizado",
        atualizarCronometro
      );

      window.removeEventListener(
        "storage",
        atualizarCronometro
      );

      window.removeEventListener(
        "focus",
        atualizarCronometro
      );
    };
  }, []);

  useEffect(() => {
    function recalcularTempo() {
      setSegundosDecorridos(
        calcularSegundosDecorridos(
          estado
        )
      );
    }

    recalcularTempo();

    if (
      !estado.ativo ||
      estado.pausado
    ) {
      return;
    }

    const intervalo =
      window.setInterval(
        recalcularTempo,
        1000
      );

    return () => {
      window.clearInterval(
        intervalo
      );
    };
  }, [estado]);

  function alterarCampo<
    K extends keyof EstadoCronometro,
  >(
    campo: K,
    valor: EstadoCronometro[K]
  ) {
    setEstado((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function alterarTipo(
    tipo: TipoSessao
  ) {
    if (estado.ativo) {
      return;
    }

    setMensagem("");

    setEstado((anterior) => ({
      ...anterior,

      tipo,

      materia:
        tipo === "revisao" ||
        tipo === "simulado"
          ? ""
          : anterior.materia,

      assunto: "",

      urlAula:
        tipo === "aula"
          ? anterior.urlAula
          : undefined,

      urlQuestoes:
        tipo === "questoes"
          ? anterior.urlQuestoes
          : undefined,
    }));
  }

  function selecionarMateria(
    materia: string
  ) {
    if (estado.ativo) {
      return;
    }

    setEstado((anterior) => ({
      ...anterior,
      materia,
      assunto: "",
    }));
  }

  function iniciarSessao() {
    setMensagem("");

    if (
      materiaObrigatoria &&
      !estado.materia.trim()
    ) {
      setMensagem(
        "Selecione uma matéria."
      );

      return;
    }

    if (!estado.assunto.trim()) {
      setMensagem(
        assuntoLivre
          ? "Informe o nome da atividade."
          : "Selecione ou informe o assunto."
      );

      return;
    }

    const agora =
      new Date().toISOString();

    setEstado((anterior) => ({
      ...anterior,

      ativo: true,
      pausado: false,

      iniciadaEm: agora,
      pausadaEm: null,

      segundosPausados: 0,
    }));
  }

  function pausarSessao() {
    if (
      !estado.ativo ||
      estado.pausado
    ) {
      return;
    }

    setEstado((anterior) => ({
      ...anterior,

      pausado: true,

      pausadaEm:
        new Date().toISOString(),
    }));
  }

  function continuarSessao() {
    if (
      !estado.ativo ||
      !estado.pausado ||
      !estado.pausadaEm
    ) {
      return;
    }

    const segundosDaPausa =
      Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(
              estado.pausadaEm
            ).getTime()) /
            1000
        )
      );

    setEstado((anterior) => ({
      ...anterior,

      pausado: false,
      pausadaEm: null,

      segundosPausados:
        anterior.segundosPausados +
        segundosDaPausa,
    }));
  }

  function cancelarSessao() {
    if (
      estado.ativo &&
      !window.confirm(
        "Deseja cancelar esta sessão? O tempo não será salvo."
      )
    ) {
      return;
    }

    limparCronometro();
  }

  function finalizarSessao() {
    if (
    !estado.ativo ||
    !estado.iniciadaEm
    ) {
      return;
    }

    const segundosTotais =
    calcularSegundosDecorridos(
    estado
    );

    const minutosCronometro =
    Math.max(
    1,
    Math.round(
    segundosTotais / 60
    )
    );

    const resposta =
    window.prompt(
    [
    "Confirme o tempo real estudado.",
    "",
    `Cronômetro: ${formatarMinutos(
      minutosCronometro
      )}`,
    "",
    "Digite o tempo real em minutos:",
    ].join("\n"),
    String(
    minutosCronometro
    )
    );

    if (resposta === null) {
      return;
    }

    const minutosReais =
    Number(
    resposta
    .trim()
    .replace(",", ".")
    );

    if (
    !Number.isFinite(
    minutosReais
    ) ||
    minutosReais < 1 ||
    minutosReais > 1440
    ) {
      window.alert(
      "Informe um tempo válido entre 1 e 1440 minutos."
      );

      return;
    }

    const minutosSalvos =
    Math.round(
    minutosReais
    );

    const agora =
    new Date().toISOString();

    const novaSessao:
    SessaoEstudo = {
      id: crypto.randomUUID(),

      data: agora,

      tipo: estado.tipo,

      materia:
      estado.materia.trim() ||
      materiaPadraoPorTipo(
      estado.tipo
      ),

      assunto:
      estado.assunto.trim(),

      objetivo:
      estado.objetivo.trim() ||
      undefined,

      observacao:
      estado.observacao.trim() ||
      undefined,

      minutos:
      minutosSalvos,

      iniciadaEm:
      estado.iniciadaEm,

      finalizadaEm: agora,

      missaoId:
      estado.missaoId,

      semana:
      estado.semana,

      dia:
      estado.dia,
    };

    setSessoes(
    (
    anteriores:
    SessaoEstudo[]
    ) => [
    novaSessao,
    ...anteriores,
    ]
    );

    if (estado.missaoId) {
      concluirMissao(
      estado.missaoId
      );
    }

    localStorage.removeItem(
    CHAVE_CRONOMETRO
    );

    window.dispatchEvent(
    new Event(
    "pmpe-sessoes-atualizadas"
    )
    );

    window.dispatchEvent(
    new Event(
    "pmpe-plano-atualizado"
    )
    );

    window.dispatchEvent(
    new Event(
    "pmpe-dashboard-atualizado"
    )
    );

    setEstado({
      ...estadoInicial,
    });

    setSegundosDecorridos(0);

    setMensagem(
    `Sessão salva: ${formatarMinutos(
      minutosSalvos
      )}.`
    );
  }
  function limparCronometro() {
    localStorage.removeItem(
      CHAVE_CRONOMETRO
    );

    setEstado({
      ...estadoInicial,
    });

    setSegundosDecorridos(0);
    setMensagem("");
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
                  finalizarSessao
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

function carregarCronometro():
  EstadoCronometro {
  const salvo =
    localStorage.getItem(
      CHAVE_CRONOMETRO
    );

  if (!salvo) {
    return {
      ...estadoInicial,
    };
  }

  try {
    const valor =
      JSON.parse(
        salvo
      ) as Partial<EstadoCronometro>;

    return {
      ...estadoInicial,
      ...valor,

      tipo:
        normalizarTipo(
          valor.tipo
        ),
    };
  } catch {
    return {
      ...estadoInicial,
    };
  }
}

function salvarCronometro(
  estado: EstadoCronometro
) {
  if (!estado.ativo) {
    return;
  }

  localStorage.setItem(
    CHAVE_CRONOMETRO,
    JSON.stringify(estado)
  );
}

function calcularSegundosDecorridos(
  estado: EstadoCronometro
) {
  if (
    !estado.ativo ||
    !estado.iniciadaEm
  ) {
    return 0;
  }

  const fim =
    estado.pausado &&
    estado.pausadaEm
      ? new Date(
          estado.pausadaEm
        ).getTime()
      : Date.now();

  const inicio =
    new Date(
      estado.iniciadaEm
    ).getTime();

  return Math.max(
    0,
    Math.floor(
      (fim - inicio) / 1000
    ) -
      estado.segundosPausados
  );
}

function concluirMissao(
  missaoId: string
) {
  const salvo =
    localStorage.getItem(
      CHAVE_MISSOES_CONCLUIDAS
    );

  let ids: string[] = [];

  if (salvo) {
    try {
      const valor: unknown =
        JSON.parse(salvo);

      if (Array.isArray(valor)) {
        ids = valor.filter(
          (item): item is string =>
            typeof item ===
            "string"
        );
      }
    } catch {
      ids = [];
    }
  }

  if (!ids.includes(missaoId)) {
    localStorage.setItem(
      CHAVE_MISSOES_CONCLUIDAS,
      JSON.stringify([
        ...ids,
        missaoId,
      ])
    );
  }
}

function normalizarTipo(
  tipo?: TipoSessao
): TipoSessao {
  if (
    tipo === "videoaula" ||
    tipo === "leitura" ||
    tipo === "estudo"
  ) {
    return "aula";
  }

  return tipo || "aula";
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

function formatarMinutos(
  minutosTotais: number
) {
  const horas =
    Math.floor(
      minutosTotais / 60
    );

  const minutos =
    minutosTotais % 60;

  if (horas === 0) {
    return `${minutos}min`;
  }

  return `${horas}h ${minutos}min`;
}