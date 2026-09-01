import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import "./ResolverSimuladoIA.css";
import "./ResolverSimuladoIADescartar.css";

import type {
  QuestaoIA,
  RegistroQuestao,
  Simulado,
  TipoSessaoQuestoesIA,
} from "../../types/index";
import { useApp } from "../../context/AppContext";

import {
  registrarRespostasQuestoesIA,
  atualizarQuestoesAntesDoTreino,
} from "../../services/catalogoQuestoesIAService";
import {
  definirTipoSessaoQuestoesIAAtiva,
  limparCadernoSimuladoIAAtivo,
  obterCadernoSimuladoIAAtivoId,
  obterTipoSessaoQuestoesIAAtiva,
  registrarResultadoCadernoSimuladoIA,
} from "../../services/cadernosSimuladosIAService";
import {
  salvarResultadoQuestoesIA,
} from "../../services/resultadosQuestoesIAService";
import {
  aplicarRevisoesDoResultadoIA,
  calcularDiagnosticoQuestoesIA,
  calcularResultadoQuestoesIA,
  criarRegistrosQuestoesIA,
  criarSimuladoIA,
  type DiagnosticoAssuntoIA,
  type LetraAlternativaIA,
  type RespostasQuestoesIA,
  type ResumoRevisoesResultadoIA,
} from "../../utils/resultadoQuestoesIA";

type LetraAlternativa = LetraAlternativaIA;
type RespostasUsuario = RespostasQuestoesIA;

type AlternativasEliminadas = Record<
  string,
  LetraAlternativa[]
>;

type ResultadoSimuladoIA = {
  id: string;
  nome: string;
  data: string;

  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;

  respostas: RespostasUsuario;
  questoes: QuestaoIA[];
  cadernoId?: string;
  tipo: TipoSessaoQuestoesIA;
};

const CHAVE_QUESTOES_IA =
  "pmpe_questoes_ia";

const CHAVE_RESULTADOS_IA =
  "pmpe_resultados_simulados_ia";

export default function ResolverSimuladoIA() {
  const navigate = useNavigate();
  const {
    materias,
    revisoes,
    setQuestoes: setRegistrosQuestoes,
    setRevisoes,
    setSimulados,
  } = useApp();

  const [questoes, setQuestoes] =
    useState<QuestaoIA[]>([]);

  const [
    respostas,
    setRespostas,
  ] = useState<RespostasUsuario>({});

  const [
    alternativasEliminadas,
    setAlternativasEliminadas,
  ] = useState<AlternativasEliminadas>({});

  const [
    questaoAtual,
    setQuestaoAtual,
  ] = useState(0);

  const [
    finalizado,
    setFinalizado,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [finalizando, setFinalizando] =
    useState(false);
  const finalizandoRef = useRef(false);

  const [tipoSessao, setTipoSessao] =
    useState<TipoSessaoQuestoesIA>("questoes");

  const [resumoRevisaoFinal, setResumoRevisaoFinal] =
    useState<ResumoRevisoesResultadoIA | null>(null);

  const [
    mensagem,
    setMensagem,
  ] = useState("");

  useEffect(() => {
    let ativo = true;
    void carregarQuestoes(() => ativo);
    return () => { ativo = false; };
  }, []);

  const resultado = useMemo(() => {
    if (!finalizado) {
      return {
        certas: 0,
        erradas: 0,
        emBranco: 0,
        percentual: 0,
      };
    }

    return calcularResultadoQuestoesIA(
      questoes,
      respostas
    );
  }, [
    finalizado,
    questoes,
    respostas,
  ]);

  const diagnostico = useMemo(
    () =>
      finalizado
        ? calcularDiagnosticoQuestoesIA(
            questoes,
            respostas
          )
        : [],
    [
      finalizado,
      questoes,
      respostas,
    ]
  );

  const statusRevisaoAutomatica = useMemo(() => {
    if (!finalizado || diagnostico.length === 0) return null;

    if (
      resumoRevisaoFinal &&
      resumoRevisaoFinal.criadas + resumoRevisaoFinal.atualizadas > 0
    ) {
      return {
        classe: "agendada",
        texto: "🔁 Revisão adaptativa aplicada automaticamente",
      };
    }

    if (resumoRevisaoFinal?.semReferencia) {
      return {
        classe: "amostra",
        texto: "⚠️ Resultado salvo, mas o assunto não foi localizado no edital",
      };
    }

    if (diagnostico.some((item) => item.total >= 5)) {
      return {
        classe: "dispensada",
        texto: "✅ Bom desempenho — revisão automática não necessária",
      };
    }

    return {
      classe: "amostra",
      texto: "ℹ️ São necessárias 5 questões do mesmo assunto para criar revisão",
    };
  }, [diagnostico, finalizado, resumoRevisaoFinal]);

  const questao =
    questoes[questaoAtual];

  const totalRespondidas =
    Object.keys(respostas).length;

  const percentualRespondido =
    questoes.length === 0
      ? 0
      : Math.round(
          (totalRespondidas /
            questoes.length) *
            100
        );

  async function carregarQuestoes(ativo: () => boolean) {
    const salvo =
      localStorage.getItem(
        CHAVE_QUESTOES_IA
      );

    if (!salvo) {
      setQuestoes([]);
      setCarregando(false);
      return;
    }

    try {
      const valor: unknown =
        JSON.parse(salvo);

      const carregadas = Array.isArray(valor)
        ? (valor as QuestaoIA[])
        : [];

      const verificadas = await atualizarQuestoesAntesDoTreino(carregadas);
      if (!ativo()) return;
      setQuestoes(verificadas);
      if (verificadas.length < carregadas.length) {
        setMensagem(`${carregadas.length - verificadas.length} questão(ões) retirada(s) deste treino por anulação ou indisponibilidade. Elas não entram na sua nota.`);
      }
      setTipoSessao(
        obterTipoSessaoQuestoesIAAtiva(verificadas)
      );
    } catch (erro) {
      if (!ativo()) return;
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível validar este caderno.");
      setQuestoes([]);
    } finally {
      if (ativo()) setCarregando(false);
    }
  }

  function responder(
    questaoId: string,
    letra: LetraAlternativa
  ) {
    if (
      finalizado ||
      alternativasEliminadas[
        questaoId
      ]?.includes(letra)
    ) {
      return;
    }

    setRespostas(
      (anteriores) => ({
        ...anteriores,
        [questaoId]: letra,
      })
    );
  }

  function alternarAlternativaEliminada(
    questaoId: string,
    letra: LetraAlternativa
  ) {
    if (finalizado) {
      return;
    }

    setAlternativasEliminadas(
      (anteriores) => {
        const atuais = new Set(
          anteriores[questaoId] ?? []
        );

        if (atuais.has(letra)) {
          atuais.delete(letra);
        } else {
          atuais.add(letra);
        }

        const proximas = {
          ...anteriores,
        };

        if (atuais.size === 0) {
          delete proximas[questaoId];
        } else {
          proximas[questaoId] =
            Array.from(atuais);
        }

        return proximas;
      }
    );

    setRespostas((anteriores) => {
      if (
        anteriores[questaoId] !==
        letra
      ) {
        return anteriores;
      }

      const proximas = {
        ...anteriores,
      };

      delete proximas[questaoId];
      return proximas;
    });
  }

  function avancar() {
    if (
      questaoAtual <
      questoes.length - 1
    ) {
      setQuestaoAtual(
        (atual) => atual + 1
      );
    }
  }

  function voltar() {
    if (questaoAtual > 0) {
      setQuestaoAtual(
        (atual) => atual - 1
      );
    }
  }

  function irParaQuestao(
    indice: number
  ) {
    setQuestaoAtual(indice);
  }

  async function finalizarSimulado() {
    if (finalizandoRef.current || finalizado) return;

    if (
      totalRespondidas <
      questoes.length
    ) {
      const faltam =
        questoes.length -
        totalRespondidas;

      const confirmar =
        window.confirm(
          `Ainda faltam ${faltam} questão${
            faltam === 1 ? "" : "ões"
          }. Deseja finalizar mesmo assim?`
        );

      if (!confirmar) {
        return;
      }
    }

    finalizandoRef.current = true;
    setFinalizando(true);

    try {
      const novoResultado =
        montarResultadoSalvo(
          questoes,
          respostas,
          tipoSessao,
          obterCadernoSimuladoIAAtivoId() ?? undefined
        );

      let avisoSincronizacao = "";
      const registroApp = registrarDesempenhoNoApp(novoResultado);
      const resumoRevisoes = registroApp.resumo;
      setResumoRevisaoFinal(resumoRevisoes);

      try {
        await salvarResultado(
          novoResultado,
          registroApp.registros,
          registroApp.simulado
        );
      } catch (erroSalvamento) {
        avisoSincronizacao =
          erroSalvamento instanceof Error
            ? erroSalvamento.message
            : "O histórico online não pôde ser atualizado.";
      }

      setFinalizado(true);

      const respondidas = novoResultado.certas + novoResultado.erradas;
      const registroSimulado =
        tipoSessao === "simulado" ? " e 1 simulado registrado" : "";
      const revisaoAutomatica = montarMensagemRevisaoAutomatica(
        resumoRevisoes
      );

      setMensagem(
        `${respondidas} questão${respondidas === 1 ? "" : "ões"} contabilizada${
          respondidas === 1 ? "" : "s"
        } na meta diária${registroSimulado}.${revisaoAutomatica}${
          avisoSincronizacao ? ` ${avisoSincronizacao}` : ""
        }`
      );
    } catch {
      setMensagem(
        "Não foi possível registrar o resultado. Tente finalizar novamente."
      );
    } finally {
      setFinalizando(false);
      finalizandoRef.current = false;
    }
  }

  function registrarDesempenhoNoApp(
    novoResultado: ResultadoSimuladoIA
  ) {
    const registros = criarRegistrosQuestoesIA({
      tentativaId: novoResultado.id,
      tipo: novoResultado.tipo,
      questoes: novoResultado.questoes,
      respostas: novoResultado.respostas,
      materias,
      data: novoResultado.data,
    });

    setRegistrosQuestoes((anteriores) => {
      if (
        anteriores.some(
          (registro) => registro.tentativaId === novoResultado.id
        )
      ) {
        return anteriores;
      }

      return [...registros, ...anteriores];
    });

    let simulado: Simulado | undefined;

    if (novoResultado.tipo === "simulado") {
      const simuladoCriado = criarSimuladoIA({
        tentativaId: novoResultado.id,
        nome: novoResultado.nome,
        data: novoResultado.data,
        resultado: novoResultado,
        totalQuestoes: novoResultado.total,
        banca:
          novoResultado.questoes[0]?.banca || "Não informada",
      });
      simulado = simuladoCriado;

      setSimulados((anteriores) =>
        anteriores.some(
          (item) =>
            item.id === novoResultado.id ||
            item.tentativaId === novoResultado.id
        )
          ? anteriores
          : [simuladoCriado, ...anteriores]
      );
    }

    const diagnosticoAtual = calcularDiagnosticoQuestoesIA(
      novoResultado.questoes,
      novoResultado.respostas
    );
    const resumo = aplicarRevisoesDoResultadoIA({
      revisoes,
      diagnostico: diagnosticoAtual,
      materias,
    });

    setRevisoes((anteriores) =>
      aplicarRevisoesDoResultadoIA({
        revisoes: anteriores,
        diagnostico: diagnosticoAtual,
        materias,
      }).revisoes
    );

    return {
      resumo,
      registros,
      simulado,
    };
  }

  async function salvarResultado(
    novoResultado:
      ResultadoSimuladoIA,
    registros: RegistroQuestao[],
    simulado?: Simulado
  ) {
    const salvo =
      localStorage.getItem(
        CHAVE_RESULTADOS_IA
      );

    let historicoLocal:
      ResultadoSimuladoIA[] = [];

    if (salvo) {
      try {
        const valor: unknown =
          JSON.parse(salvo);

        if (Array.isArray(valor)) {
          historicoLocal =
            valor as ResultadoSimuladoIA[];
        }
      } catch {
        historicoLocal = [];
      }
    }

    localStorage.setItem(
      CHAVE_RESULTADOS_IA,
      JSON.stringify([
        novoResultado,
        ...historicoLocal.filter(
          (resultado) => resultado.id !== novoResultado.id
        ),
      ])
    );

    window.dispatchEvent(
      new Event(
        "pmpe-simulado-ia-finalizado"
      )
    );

    const gravacoes: Promise<unknown>[] = [
      salvarResultadoQuestoesIA({
        id: novoResultado.id,
        nome: novoResultado.nome,
        data: novoResultado.data,
        tipo: novoResultado.tipo,
        total: novoResultado.total,
        certas: novoResultado.certas,
        erradas: novoResultado.erradas,
        emBranco: novoResultado.emBranco,
        percentual: novoResultado.percentual,
        registros,
        simulado,
      }),
      registrarRespostasQuestoesIA(
        questoes,
        respostas
      ),
    ];

    if (novoResultado.cadernoId) {
      gravacoes.push(
        registrarResultadoCadernoSimuladoIA(
          novoResultado.cadernoId,
          {
            acertos: novoResultado.certas,
            erros: novoResultado.erradas,
            emBranco: novoResultado.emBranco,
            aproveitamento: novoResultado.percentual,
            ultimaTentativaEm: novoResultado.data,
          }
        )
      );
    }

    const gravacoesConcluidas = await Promise.allSettled(gravacoes);
    const falhas = gravacoesConcluidas.filter(
      (resultado): resultado is PromiseRejectedResult =>
        resultado.status === "rejected"
    );

    if (gravacoesConcluidas[0]?.status === "fulfilled") {
      window.dispatchEvent(
        new Event("pmpe-resultado-questoes-ia-salvo")
      );
    }

    if (falhas.length > 0) {
      const mensagens = falhas.map((falha) =>
        falha.reason instanceof Error
          ? falha.reason.message
          : "Uma parte do histórico online não pôde ser atualizada."
      );

      throw new Error(Array.from(new Set(mensagens)).join(" "));
    }
  }

  function refazerSimulado() {
    setRespostas({});
    setAlternativasEliminadas({});
    setQuestaoAtual(0);
    setFinalizado(false);
    setMensagem("");
    setResumoRevisaoFinal(null);
  }

  function treinarErros() {
    const questoesParaTreino =
      questoes.filter(
        (item) =>
          respostas[item.id] !==
          item.respostaCorreta
      );

    if (
      questoesParaTreino.length === 0
    ) {
      setMensagem(
        "Você não possui questões erradas ou em branco."
      );

      return;
    }

    limparCadernoSimuladoIAAtivo();
    definirTipoSessaoQuestoesIAAtiva("questoes");
    setTipoSessao("questoes");

    const novasQuestoes =
      questoesParaTreino.map(
        (item) => ({
          ...item,
          id: crypto.randomUUID(),
        })
      );

    localStorage.setItem(
      CHAVE_QUESTOES_IA,
      JSON.stringify(
        novasQuestoes
      )
    );

    setQuestoes(
      novasQuestoes
    );

    setRespostas({});
    setAlternativasEliminadas({});
    setQuestaoAtual(0);
    setFinalizado(false);
    setResumoRevisaoFinal(null);

    setMensagem(
      `Treino criado com ${novasQuestoes.length} questão${
        novasQuestoes.length === 1
          ? ""
          : "ões"
      }.`
    );
  }

  function abrirMateriais(
    item?: DiagnosticoAssuntoIA
  ) {
    if (item) {
      localStorage.setItem(
        "pmpe_filtro_materiais",
        JSON.stringify({
          materia: item.materia,
          modulo: item.modulo,
          assunto: item.assunto,
        })
      );
    }

    navigate("/materiais");
  }

  function excluirQuestoes() {
    const confirmar =
      window.confirm(
        "Deseja excluir as questões geradas por IA?"
      );

    if (!confirmar) {
      return;
    }

    localStorage.removeItem(
      CHAVE_QUESTOES_IA
    );

    setQuestoes([]);
    setRespostas({});
    setAlternativasEliminadas({});
    setFinalizado(false);
    setMensagem("");
    setResumoRevisaoFinal(null);
  }

  if (carregando) {
    return (
      <section className="resolver-ia-container">
        <div className="resolver-ia-vazio">
          Carregando questões...
        </div>
      </section>
    );
  }

  if (questoes.length === 0) {
    return (
      <section className="resolver-ia-container">
        <div className="resolver-ia-vazio">
          <h1>
            Nenhuma questão disponível
          </h1>

          <p>
            {mensagem || "Gere questões antes de iniciar o treino."}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/gerar-simulado-ia"
              )
            }
          >
            Gerar Simulado IA
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="resolver-ia-container">
      <div className="resolver-ia-cabecalho">
        <div>
          <h1>
            {tipoSessao === "simulado"
              ? "🎯 Simulado Inteligente"
              : "📝 Questões por assunto"}
          </h1>

          <p>
            {tipoSessao === "simulado"
              ? "Prova com conteúdos variados e nota geral."
              : "Prática direcionada que conta na meta diária."}
          </p>
        </div>

        <div className="resolver-ia-status">
          <span>
            Respondidas
          </span>

          <strong>
            {totalRespondidas}/
            {questoes.length}
          </strong>
        </div>
      </div>

      {mensagem && (
        <div className="resolver-ia-mensagem">
          {mensagem}
        </div>
      )}

      {!finalizado && (
        <div className="resolver-ia-progresso">
          <div
            style={{
              width:
                `${percentualRespondido}%`,
            }}
          />
        </div>
      )}

      {finalizado && (
        <>
          <div className="resolver-ia-resultado resolver-ia-resultado-cinco">
            <div>
              <span>
                Resultado
              </span>

              <strong>
                {resultado.percentual}%
              </strong>
            </div>

            <div>
              <span>
                Acertos
              </span>

              <strong className="resolver-ia-certas">
                {resultado.certas}
              </strong>
            </div>

            <div>
              <span>
                Erros
              </span>

              <strong className="resolver-ia-erradas">
                {resultado.erradas}
              </strong>
            </div>

            <div>
              <span>
                Em branco
              </span>

              <strong className="resolver-ia-branco">
                {resultado.emBranco}
              </strong>
            </div>

            <div>
              <span>
                Total
              </span>

              <strong>
                {questoes.length}
              </strong>
            </div>
          </div>

          <section className="resolver-ia-diagnostico">
            <div className="resolver-ia-diagnostico-topo">
              <div>
                <span>
                  DIAGNÓSTICO
                </span>

                <h2>
                  Desempenho por assunto
                </h2>

                <p>
                  Os assuntos com menor
                  aproveitamento aparecem
                  primeiro.
                </p>
              </div>

              <div className="resolver-ia-diagnostico-acoes">
                {statusRevisaoAutomatica && (
                  <div
                    className={`resolver-ia-revisao-status ${statusRevisaoAutomatica.classe}`}
                  >
                    {statusRevisaoAutomatica.texto}
                  </div>
                )}

                <button
                  type="button"
                  className="resolver-ia-treinar"
                  onClick={
                    treinarErros
                  }
                >
                  🎯 Treinar erros
                </button>

                <button
                  type="button"
                  className="resolver-ia-materiais"
                  onClick={() =>
                    abrirMateriais()
                  }
                >
                  📚 Centro de Materiais
                </button>
              </div>
            </div>

            <div className="resolver-ia-diagnostico-grid">
              {diagnostico.map(
                (item) => (
                  <article
                    key={item.chave}
                    className={[
                      "resolver-ia-diagnostico-card",

                      item.percentual >= 70
                        ? "bom"
                        : item.percentual < 50
                          ? "fraco"
                          : "medio",
                    ].join(" ")}
                  >
                    <div className="resolver-ia-diagnostico-conteudo">
                      <strong>
                        {item.materia}
                      </strong>

                      <span>
                        {item.modulo
                          ? `${item.modulo} → ${item.assunto}`
                          : item.assunto}
                      </span>

                      <div className="resolver-ia-diagnostico-barra">
                        <div
                          style={{
                            width: `${item.percentual}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="resolver-ia-diagnostico-numeros">
                      <strong>
                        {item.percentual}%
                      </strong>

                      <span>
                        {item.certas} certas
                        {" • "}
                        {item.erradas} erros
                        {" • "}
                        {item.emBranco} em branco
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          abrirMateriais(item)
                        }
                      >
                        Abrir materiais
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        </>
      )}

      <div className="resolver-ia-layout">
        <aside className="resolver-ia-navegacao">
          <h2>
            Questões
          </h2>

          <div className="resolver-ia-numeros">
            {questoes.map(
              (
                item,
                indice
              ) => {
                const respondida =
                  Boolean(
                    respostas[item.id]
                  );

                const correta =
                  finalizado &&
                  respostas[item.id] ===
                    item.respostaCorreta;

                const emBranco =
                  finalizado &&
                  !respostas[item.id];

                const errada =
                  finalizado &&
                  Boolean(
                    respostas[item.id]
                  ) &&
                  respostas[item.id] !==
                    item.respostaCorreta;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      questaoAtual ===
                      indice
                        ? "ativa"
                        : "",

                      respondida &&
                      !finalizado
                        ? "respondida"
                        : "",

                      correta
                        ? "correta"
                        : "",

                      errada
                        ? "errada"
                        : "",

                      emBranco
                        ? "em-branco"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      irParaQuestao(
                        indice
                      )
                    }
                  >
                    {indice + 1}
                  </button>
                );
              }
            )}
          </div>

          <div className="resolver-ia-legenda">
            <span>
              <i className="legenda-atual" />
              Atual
            </span>

            <span>
              <i className="legenda-respondida" />
              Respondida
            </span>

            {finalizado && (
              <>
                <span>
                  <i className="legenda-correta" />
                  Correta
                </span>

                <span>
                  <i className="legenda-errada" />
                  Errada
                </span>

                <span>
                  <i className="legenda-branco" />
                  Em branco
                </span>
              </>
            )}
          </div>
        </aside>

        <main className="resolver-ia-questao-card">
          <div className="resolver-ia-questao-topo">
            <span>
              Questão{" "}
              {questaoAtual + 1}
              de {questoes.length}
            </span>

            <div>
              <span>
                {questao.materia}
              </span>

              <span>
                {questao.dificuldade}
              </span>

              <span>
                {questao.banca}
              </span>
            </div>
          </div>

          <p className="resolver-ia-assunto">
            {questao.modulo
              ? `${questao.modulo} → ${questao.assunto}`
              : questao.assunto}
          </p>

          <h2 className="resolver-ia-enunciado">
            {questao.enunciado}
          </h2>

          <div className="resolver-ia-alternativas">
            {(
              Object.entries(
                questao.alternativas
              ) as [
                LetraAlternativa,
                string
              ][]
            ).map(
              ([
                letra,
                texto,
              ]) => {
                const selecionada =
                  respostas[
                    questao.id
                  ] === letra;

                const eliminada =
                  !finalizado &&
                  Boolean(
                    alternativasEliminadas[
                      questao.id
                    ]?.includes(letra)
                  );

                const alternativaCorreta =
                  finalizado &&
                  letra ===
                    questao.respostaCorreta;

                const alternativaErrada =
                  finalizado &&
                  selecionada &&
                  letra !==
                    questao.respostaCorreta;

                return (
                  <div
                    key={letra}
                    className={[
                      "resolver-ia-alternativa-linha",
                      eliminada
                        ? "eliminada"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {!finalizado && (
                      <button
                        type="button"
                        className={[
                          "resolver-ia-tesoura",
                          eliminada
                            ? "ativa"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() =>
                          alternarAlternativaEliminada(
                            questao.id,
                            letra
                          )
                        }
                        aria-pressed={eliminada}
                        aria-label={
                          eliminada
                            ? `Restaurar alternativa ${letra}`
                            : `Eliminar alternativa ${letra}`
                        }
                        title={
                          eliminada
                            ? "Restaurar alternativa"
                            : "Eliminar alternativa"
                        }
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle
                            cx="6"
                            cy="7"
                            r="3"
                          />
                          <circle
                            cx="6"
                            cy="17"
                            r="3"
                          />
                          <path d="m8.7 8.3 10.8 10.8" />
                          <path d="m8.7 15.7 10.8-10.8" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={
                        finalizado ||
                        eliminada
                      }
                      className={[
                        "resolver-ia-alternativa",

                        selecionada
                          ? "selecionada"
                          : "",

                        alternativaCorreta
                          ? "alternativa-correta"
                          : "",

                        alternativaErrada
                          ? "alternativa-errada"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() =>
                        responder(
                          questao.id,
                          letra
                        )
                      }
                    >
                      <strong>
                        {letra}
                      </strong>

                      <span>
                        {texto}
                      </span>
                    </button>
                  </div>
                );
              }
            )}
          </div>

          {finalizado && (
            <div className="resolver-ia-explicacao">
              <h3>
                Explicação
              </h3>

              <p>
                {
                  questao.explicacao
                }
              </p>

              <strong>
                Gabarito:{" "}
                {
                  questao.respostaCorreta
                }
              </strong>
            </div>
          )}

          <div className="resolver-ia-acoes">
            <button
              type="button"
              onClick={voltar}
              disabled={
                questaoAtual === 0
              }
              className="resolver-ia-secundario"
            >
              ← Anterior
            </button>

            {questaoAtual <
            questoes.length - 1 ? (
              <button
                type="button"
                onClick={avancar}
                className="resolver-ia-primario"
              >
                Próxima →
              </button>
            ) : !finalizado ? (
              <button
                type="button"
                onClick={
                  finalizarSimulado
                }
                className="resolver-ia-finalizar"
                disabled={finalizando}
              >
                {finalizando
                  ? "Salvando..."
                  : tipoSessao === "simulado"
                    ? "Finalizar simulado"
                    : "Finalizar questões"}
              </button>
            ) : (
              <button
                type="button"
                onClick={refazerSimulado}
                className="resolver-ia-primario"
              >
                Refazer simulado
              </button>
            )}
          </div>
        </main>
      </div>

      <div className="resolver-ia-rodape">
        {!finalizado && (
          <button
            type="button"
            onClick={
              finalizarSimulado
            }
            className="resolver-ia-finalizar"
            disabled={finalizando}
          >
            {finalizando ? "Salvando..." : "Finalizar agora"}
          </button>
        )}

        <button
          type="button"
          onClick={
            excluirQuestoes
          }
          className="resolver-ia-excluir"
        >
          Excluir questões
        </button>
      </div>
    </section>
  );
}

function montarResultadoSalvo(
  questoes: QuestaoIA[],
  respostas: RespostasUsuario,
  tipo: TipoSessaoQuestoesIA,
  cadernoId?: string
): ResultadoSimuladoIA {
  const resultado =
    calcularResultadoQuestoesIA(
      questoes,
      respostas
    );

  return {
    id: crypto.randomUUID(),
    nome:
      tipo === "simulado"
        ? "Simulado gerado por IA"
        : "Questões por assunto geradas por IA",
    data:
      new Date().toISOString(),
    total: questoes.length,
    certas:
      resultado.certas,
    erradas:
      resultado.erradas,
    emBranco:
      resultado.emBranco,
    percentual:
      resultado.percentual,
    respostas,
    questoes,
    cadernoId,
    tipo,
  };
}

function montarMensagemRevisaoAutomatica(
  resumo: ResumoRevisoesResultadoIA
) {
  if (resumo.criadas > 0) {
    return ` ${resumo.criadas} revisão${
      resumo.criadas === 1 ? "" : "ões"
    } automática${resumo.criadas === 1 ? "" : "s"} agendada${
      resumo.criadas === 1 ? "" : "s"
    }.`;
  }

  if (resumo.atualizadas > 0) {
    return ` ${resumo.atualizadas} revisão${
      resumo.atualizadas === 1 ? "" : "ões"
    } pendente${resumo.atualizadas === 1 ? "" : "s"} antecipada${
      resumo.atualizadas === 1 ? "" : "s"
    }.`;
  }

  if (resumo.semReferencia > 0) {
    return " O assunto não foi localizado no edital para agendar revisão.";
  }

  return " Nenhuma revisão automática foi necessária.";
}
