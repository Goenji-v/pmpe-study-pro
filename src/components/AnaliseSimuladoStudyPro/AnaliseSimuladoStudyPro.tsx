import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";

import { useApp } from "../../context/AppContext";
import {
  listarAnalisesSimulados,
  salvarAnaliseSimulado,
  salvarAnaliseSimuladoLocal,
  type OrigemAnaliseSimulado,
} from "../../services/analisesSimuladosService";
import {
  analisarSimuladoStudyPro,
  resumirAnaliseParaHistorico,
  rotuloMotivoErro,
  type HistoricoAnaliseSimulado,
  type MarcacaoQuestaoSimulado,
  type MotivoErroSimulado,
  type QuestaoAnaliseSimulado,
} from "../../utils/analiseSimuladoStudyPro";
import { adicionarErrosSimuladoARevisao } from "../../utils/revisaoSimuladoStudyPro";
import "./AnaliseSimuladoStudyPro.css";

const MOTIVOS: Array<{ id: MotivoErroSimulado; texto: string }> = [
  { id: "nao_sabia", texto: "Não sabia" },
  { id: "confundi_regra", texto: "Confundi a regra" },
  { id: "interpretei_errado", texto: "Interpretei errado" },
  { id: "falta_atencao", texto: "Falta de atenção" },
  { id: "chutei", texto: "Chutei" },
];

export default function AnaliseSimuladoStudyPro({
  origem,
  tentativaId,
  simuladoId,
  nome,
  data,
  questoes,
  respostas,
  marcacoes,
  persistir = true,
  agendarAutomaticamente = true,
  somenteLeitura = false,
}: {
  origem: OrigemAnaliseSimulado;
  tentativaId: string;
  simuladoId?: string;
  nome: string;
  data: string;
  questoes: QuestaoAnaliseSimulado[];
  respostas: Record<string, string | undefined>;
  marcacoes: Record<string, MarcacaoQuestaoSimulado | undefined>;
  persistir?: boolean;
  agendarAutomaticamente?: boolean;
  somenteLeitura?: boolean;
}) {
  const navigate = useNavigate();
  const { materias, revisoes, setRevisoes, configuracoes, statusNuvem } = useApp();
  const [historico, setHistorico] = useState<HistoricoAnaliseSimulado[]>([]);
  const [motivosErro, setMotivosErro] = useState<
    Record<string, MotivoErroSimulado | undefined>
  >({});
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [cadernoAberto, setCadernoAberto] = useState(false);
  const [correcaoAberta, setCorrecaoAberta] = useState(false);
  const [evolucaoAberta, setEvolucaoAberta] = useState(false);
  const [todosAssuntosAbertos, setTodosAssuntosAbertos] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [avisoPersistencia, setAvisoPersistencia] = useState("");
  const revisaoAutomaticaRef = useRef("");

  useEffect(() => {
    let ativo = true;

    listarAnalisesSimulados(100)
      .then((itens) => {
        if (!ativo) return;

        const atual = itens.find(
          (item) =>
            item.origem === origem &&
            item.tentativaId === tentativaId
        );

        if (atual) {
          const motivos = Object.fromEntries(
            atual.analise.correcao.flatMap((item) =>
              item.motivoErro ? [[item.id, item.motivoErro]] : []
            )
          ) as Record<string, MotivoErroSimulado>;
          setMotivosErro(motivos);
        }

        setHistorico(
          itens
            .filter(
              (item) =>
                !(
                  item.origem === origem &&
                  item.tentativaId === tentativaId
                )
            )
            .map((item) => resumirAnaliseParaHistorico(item.analise))
        );
      })
      .catch(() => {
        if (ativo) setHistorico([]);
      })
      .finally(() => {
        if (ativo) setHistoricoCarregado(true);
      });

    return () => {
      ativo = false;
    };
  }, [origem, tentativaId]);

  const analise = useMemo(
    () =>
      analisarSimuladoStudyPro({
        tentativaId,
        nome,
        data,
        questoes,
        respostas,
        marcacoes,
        motivosErro,
        historico,
      }),
    [
      data,
      historico,
      marcacoes,
      motivosErro,
      nome,
      questoes,
      respostas,
      tentativaId,
    ]
  );

  useEffect(() => {
    if (!persistir) return;

    // O backup local acontece imediatamente, sem esperar rede nem histórico.
    // Assim, sair da tela logo após finalizar não perde o diagnóstico.
    salvarAnaliseSimuladoLocal({
      origem,
      tentativaId,
      simuladoId,
      nome,
      analise,
    });
  }, [
    analise,
    nome,
    origem,
    persistir,
    simuladoId,
    tentativaId,
  ]);

  useEffect(() => {
    if (!historicoCarregado || !persistir) return;

    let ativo = true;

    setAvisoPersistencia("");

    void salvarAnaliseSimulado({
      origem,
      tentativaId,
      simuladoId,
      nome,
      analise,
    })
      .then(() => {
        if (ativo) setAvisoPersistencia("");
      })
      .catch(() => {
        if (!ativo) return;
        setAvisoPersistencia(
          "Resultado protegido neste aparelho. A sincronização online será tentada novamente ao abrir o diagnóstico."
        );
      });

    return () => {
      ativo = false;
    };
  }, [
    analise,
    historicoCarregado,
    nome,
    origem,
    simuladoId,
    tentativaId,
    persistir,
  ]);

  const assinaturaPlanoRevisao = useMemo(
    () =>
      analise.planoRevisao
        .map(
          (item) =>
            `${item.chave}:${item.prioridadeIndice}:${item.quantidadeQuestoes}`
        )
        .join("|"),
    [analise.planoRevisao]
  );

  useEffect(() => {
    if (
      !historicoCarregado ||
      !agendarAutomaticamente ||
      somenteLeitura ||
      !persistir ||
      statusNuvem !== "sincronizado" ||
      materias.length === 0 ||
      analise.planoRevisao.length === 0
    ) return;

    const chaveExecucao = `${tentativaId}:${assinaturaPlanoRevisao}`;
    if (revisaoAutomaticaRef.current === chaveExecucao) return;
    revisaoAutomaticaRef.current = chaveExecucao;

    setRevisoes((anteriores) => {
      const resultado = adicionarErrosSimuladoARevisao({
        revisoes: anteriores,
        materias,
        analise,
        limiteDiario: configuracoes.metaRevisoesDiaria,
      });
      return resultado.criadas + resultado.atualizadas > 0
        ? resultado.revisoes
        : anteriores;
    });
  }, [
    analise,
    assinaturaPlanoRevisao,
    historicoCarregado,
    materias,
    setRevisoes,
    tentativaId,
    agendarAutomaticamente,
    somenteLeitura,
    persistir,
    statusNuvem,
    configuracoes.metaRevisoesDiaria,
  ]);

  function adicionarARevisao() {
    if (somenteLeitura) {
      setMensagem("Prévia de teste: nenhuma revisão da sua conta foi alterada.");
      return;
    }

    const resultado = adicionarErrosSimuladoARevisao({
      revisoes,
      materias,
      analise,
      limiteDiario: configuracoes.metaRevisoesDiaria,
    });

    setRevisoes((anteriores) => {
      const resultado = adicionarErrosSimuladoARevisao({
        revisoes: anteriores,
        materias,
        analise,
        limiteDiario: configuracoes.metaRevisoesDiaria,
      });
      return resultado.criadas + resultado.atualizadas > 0
        ? resultado.revisoes
        : anteriores;
    });

    const total = resultado.criadas + resultado.atualizadas;
    if (total > 0) {
      setMensagem(
        `${resultado.criadas} revisão(ões) criada(s) e ${resultado.atualizadas} atualizada(s), respeitando a capacidade diária quando houver espaço. ${resultado.semReferencia ? `${resultado.semReferencia} assunto(s) podem ser revisados por questões IA, sem aula vinculada.` : ""} O ciclo segue 1, 5, 7, 14 e 30 dias conforme o desempenho.`
      );
      return;
    }

    if (resultado.semReferencia > 0) {
      setMensagem(
        "As prioridades estão na agenda, mas alguns assuntos não têm aula correspondente na grade. Você pode revisá-los por questões IA."
      );
      return;
    }

    setMensagem("Esses assuntos já estão na sua fila de revisões.");
  }

  function marcarMotivo(
    questaoId: string,
    motivo: MotivoErroSimulado
  ) {
    setMotivosErro((anteriores) => ({
      ...anteriores,
      [questaoId]:
        anteriores[questaoId] === motivo ? undefined : motivo,
    }));
  }

  const prioridades = analise.planoRevisao;
  const assuntosVisiveis = todosAssuntosAbertos
    ? analise.assuntos
    : analise.assuntos.slice(0, 12);
  const acertosPorChute = analise.correcao.filter(
    (item) => item.status === "acerto_chute"
  );

  return (
    <section className="analise-simulado-study">
      <header className="analise-simulado-study__cabecalho">
        <div>
          <span>ANÁLISE STUDY PRO</span>
          <h2>Diagnóstico inteligente do simulado</h2>
          <p>
            O resultado vira um ciclo de diagnóstico → revisão → questões → nova medição,
            sem interromper o seu cronograma normal.
          </p>
        </div>
        <div className="analise-simulado-study__dificuldade">
          <small>Dificuldade geral</small>
          <strong>{analise.dificuldade.geral}</strong>
          <span>
            {analise.dificuldade.facil.percentual}% fáceis ·{" "}
            {analise.dificuldade.media.percentual}% médias ·{" "}
            {analise.dificuldade.dificil.percentual}% difíceis
          </span>
        </div>
      </header>

      {mensagem && (
        <div className="analise-simulado-study__mensagem">{mensagem}</div>
      )}

      {avisoPersistencia && (
        <div className="analise-simulado-study__mensagem">
          {avisoPersistencia}
        </div>
      )}

      {questoes.length === 0 && (
        <div className="analise-simulado-study__mensagem">
          O resultado foi preservado, mas nenhuma questão chegou ao diagnóstico. Reabra o simulado para recuperar os dados antes de iniciar outro.
        </div>
      )}

      {questoes.length > 0 && analise.resumo.totalValidas === 0 && (
        <div className="analise-simulado-study__mensagem">
          Suas respostas foram preservadas, mas ainda não existe gabarito confiável suficiente para calcular o diagnóstico. Nenhuma questão será usada para reduzir seu desempenho até a correção ficar válida.
        </div>
      )}

      <div className="analise-simulado-study__cards">
        <article>
          <Target size={20} aria-hidden="true" />
          <span>Resultado geral</span>
          <strong>{analise.resumo.aproveitamentoGeral}%</strong>
          <small>
            Conteúdo estudado · {analise.resumo.totalAcertos} acertos · {analise.resumo.totalErros} erros
          </small>
        </article>
        <article>
          <BarChart3 size={20} aria-hidden="true" />
          <span>Desempenho por matéria</span>
          <strong>{analise.materias.length}</strong>
          <small>
            {analise.resumo.piorMateria
              ? `Mais fraca: ${analise.resumo.piorMateria.materia}`
              : "Sem matéria avaliada"}
          </small>
        </article>
        <article>
          <AlertTriangle size={20} aria-hidden="true" />
          <span>Prioridades principais</span>
          <strong>{prioridades.length}</strong>
          <small>
            {prioridades[0]
              ? `Primeira: ${prioridades[0].assuntoEspecifico}`
              : "Nenhum reforço extraordinário"}
          </small>
        </article>
        <article>
          <Brain size={20} aria-hidden="true" />
          <span>Acertos por chute</span>
          <strong>{analise.resumo.totalAcertosPorChute}</strong>
          <small>Entram na revisão mesmo tendo pontuado.</small>
        </article>
        <article>
          <BookOpenCheck size={20} aria-hidden="true" />
          <span>Ainda não estudado</span>
          <strong>{analise.resumo.totalNaoEstudadas}</strong>
          <small>Permanece no cronograma normal.</small>
        </article>
        <article>
          <Sparkles size={20} aria-hidden="true" />
          <span>Plano de revisão</span>
          <strong>{analise.planoRevisao.length}</strong>
          <small>Até 8 focos · ciclo 1 · 5 · 7 · 14 · 30 dias.</small>
        </article>
      </div>

      <section className="analise-simulado-study__painel">
        <div className="analise-simulado-study__titulo">
          <div>
            <span>RESUMO GERAL</span>
            <h3>Desempenho por matéria</h3>
          </div>
          <small>
            “Ainda não estudado” não reduz o domínio do conteúdo já estudado.
          </small>
        </div>

        <div className="analise-simulado-study__tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Matéria</th>
                <th>Questões</th>
                <th>Acertos</th>
                <th>Erros</th>
                <th>Não respondidas</th>
                <th>Aproveitamento</th>
              </tr>
            </thead>
            <tbody>
              {analise.materias.map((item) => (
                <tr key={item.materia}>
                  <td>
                    <strong>{item.materia}</strong>
                    {item.naoEstudadas > 0 && (
                      <small>{item.naoEstudadas} ainda não estudada(s)</small>
                    )}
                  </td>
                  <td>{item.total}</td>
                  <td>{item.acertos}</td>
                  <td>{item.erros}</td>
                  <td>{item.naoRespondidas}</td>
                  <td>
                    <b>{item.aproveitamento}%</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="analise-simulado-study__resumo-linhas">
          <div>
            <span>Total de acertos</span>
            <strong>{analise.resumo.totalAcertos}</strong>
          </div>
          <div>
            <span>Total de erros</span>
            <strong>{analise.resumo.totalErros}</strong>
          </div>
          <div>
            <span>Melhor matéria</span>
            <strong>
              {analise.resumo.melhorMateria
                ? `${analise.resumo.melhorMateria.materia} · ${analise.resumo.melhorMateria.aproveitamento}%`
                : "—"}
            </strong>
          </div>
          <div>
            <span>Pior matéria</span>
            <strong>
              {analise.resumo.piorMateria
                ? `${analise.resumo.piorMateria.materia} · ${analise.resumo.piorMateria.aproveitamento}%`
                : "—"}
            </strong>
          </div>
          <div className="analise-simulado-study__derrubaram">
            <span>Matérias que mais derrubaram a nota</span>
            <strong>
              {analise.resumo.materiasMaisDerrubaram.length > 0
                ? analise.resumo.materiasMaisDerrubaram
                    .map(
                      (item) =>
                        `${item.materia} (${item.erros + item.naoRespondidas})`
                    )
                    .join(" · ")
                : "Nenhuma matéria teve erro ou questão não respondida."}
            </strong>
          </div>
        </div>
      </section>

      <section className="analise-simulado-study__painel">
        <div className="analise-simulado-study__titulo">
          <div>
            <span>ANÁLISE POR ASSUNTO</span>
            <h3>Domínio e prioridade automática</h3>
          </div>
          <small>
            Subassuntos semelhantes são consolidados. A correção questão a questão
            continua completa mais abaixo.
          </small>
        </div>

        <div className="analise-simulado-study__assuntos">
          {assuntosVisiveis.map((item) => (
            <article
              key={item.chave}
              className={`prioridade-${item.prioridade}`}
            >
              <div className="analise-simulado-study__assunto-info">
                <strong>{item.materia}</strong>
                <span>
                  {item.modulo ? `${item.modulo} → ` : ""}
                  {item.assunto}
                  {item.subassunto ? ` → ${item.subassunto}` : ""}
                </span>
                <small>{item.dominio}</small>
              </div>
              <div className="analise-simulado-study__assunto-numeros">
                <strong>{item.percentual}%</strong>
                <span>
                  {item.acertos} acertos · {item.erros} erros ·{" "}
                  {item.naoRespondidas} em branco
                </span>
                {item.acertosPorChute > 0 && (
                  <small>{item.acertosPorChute} acerto(s) por chute</small>
                )}
                {item.reincidencias > 0 && (
                  <small className="reincidencia">
                    Reincidência detectada em {item.reincidencias} simulado(s)
                  </small>
                )}
              </div>
              <div className="analise-simulado-study__prioridade">
                <span>Prioridade {rotuloPrioridade(item.prioridade)}</span>
                <strong>{item.prioridadeIndice}/100</strong>
                <small>{item.orientacao}</small>
              </div>
            </article>
          ))}
        </div>

        {analise.assuntos.length > 12 && (
          <button
            type="button"
            className="analise-simulado-study__mostrar-assuntos"
            onClick={() =>
              setTodosAssuntosAbertos((valor) => !valor)
            }
          >
            {todosAssuntosAbertos
              ? "Mostrar só os 12 mais relevantes"
              : `Ver todos os ${analise.assuntos.length} assuntos`}
          </button>
        )}
      </section>

      {acertosPorChute.length > 0 && (
        <section className="analise-simulado-study__painel">
          <div className="analise-simulado-study__titulo">
            <div>
              <span>ACERTOS POR CHUTE</span>
              <h3>Acertou, mas ainda precisa confirmar o domínio</h3>
            </div>
          </div>
          <div className="analise-simulado-study__chips">
            {acertosPorChute.map((item) => (
              <span key={item.id}>
                Q{item.numero} · {item.materia} · {item.assuntoEspecifico}
              </span>
            ))}
          </div>
        </section>
      )}

      {analise.aindaNaoEstudado.length > 0 && (
        <section className="analise-simulado-study__painel nao-estudado">
          <div className="analise-simulado-study__titulo">
            <div>
              <span>AINDA NÃO ESTUDADO</span>
              <h3>Conteúdos que continuam no cronograma normal</h3>
            </div>
            <small>
              O Study Pro não usa essas questões para dizer que você é fraco no assunto.
            </small>
          </div>
          <div className="analise-simulado-study__nao-estudado">
            {analise.aindaNaoEstudado.map((item) => (
              <div key={item.questaoId}>
                <strong>Questão {item.numero}</strong>
                <span>{item.materia}</span>
                <small>{item.assuntoEspecifico}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="analise-simulado-study__painel">
        <div className="analise-simulado-study__titulo">
          <div>
            <span>PLANO DE REVISÃO</span>
            <h3>Top prioridades para corrigir sem parar o edital</h3>
          </div>
          <small>
            O Study Pro seleciona no máximo 8 focos, evitando transformar cada
            questão errada em uma revisão diferente.
          </small>
        </div>

        {analise.planoRevisao.length === 0 ? (
          <div className="analise-simulado-study__vazio">
            Nenhum assunto precisa de reforço extraordinário neste simulado.
          </div>
        ) : (
          <div className="analise-simulado-study__plano">
            {analise.planoRevisao.map((item, indice) => (
              <article key={item.chave}>
                <span>{indice + 1}</span>
                <div>
                  <strong>
                    {item.materia} · {item.assuntoEspecifico}
                  </strong>
                  <p>{item.acao}</p>
                  <small>
                    {item.quantidadeQuestoes > 0
                      ? `Bloco sugerido: ${item.quantidadeQuestoes} questões · `
                      : ""}
                    Revisões em 1, 5, 7, 14 e 30 dias
                    {item.reincidencia ? " · erro reincidente" : ""}
                  </small>
                </div>
                <b className={`nivel-${item.prioridade}`}>
                  {rotuloPrioridade(item.prioridade)}
                </b>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="analise-simulado-study__acoes">
        <button
          type="button"
          onClick={() => setCadernoAberto((valor) => !valor)}
        >
          <ClipboardList size={18} aria-hidden="true" />
          Gerar caderno de erros
        </button>
        <button type="button" onClick={adicionarARevisao}>
          <RefreshCcw size={18} aria-hidden="true" />
          Adicionar erros à revisão
        </button>
        <button type="button" onClick={() => navigate("/revisoes")}>
          <BookOpenCheck size={18} aria-hidden="true" />
          Revisar agora
        </button>
        <button
          type="button"
          onClick={() => setEvolucaoAberta((valor) => !valor)}
        >
          <BarChart3 size={18} aria-hidden="true" />
          Ver evolução
        </button>
        <button
          type="button"
          className="primario"
          onClick={() =>
            navigate(
              origem === "ia"
                ? "/gerar-simulado-ia"
                : origem === "pdf"
                  ? "/plano"
                  : "/simulados"
            )
          }
        >
          <Sparkles size={18} aria-hidden="true" />
          Novo simulado
        </button>
      </div>

      {cadernoAberto && (
        <section className="analise-simulado-study__painel caderno-erros">
          <div className="analise-simulado-study__titulo">
            <div>
              <span>CADERNO DE ERROS</span>
              <h3>Erros e acertos por chute</h3>
            </div>
            <small>{analise.cadernoErros.length} item(ns)</small>
          </div>

          {analise.cadernoErros.length === 0 ? (
            <div className="analise-simulado-study__vazio">
              Nenhum erro ou acerto por chute para registrar.
            </div>
          ) : (
            <div className="analise-simulado-study__caderno-lista">
              {analise.cadernoErros.map((item) => (
                <article key={item.questaoId}>
                  <header>
                    <div>
                      <span>
                        Questão {item.numero} · {item.materia}
                      </span>
                      <strong>{item.assuntoEspecifico}</strong>
                    </div>
                    <b className={item.status}>
                      {item.status === "acerto_chute"
                        ? "Acerto por chute"
                        : "Erro"}
                    </b>
                  </header>

                  <p className="enunciado">{item.enunciado}</p>

                  <div className="alternativas">
                    {item.alternativas.map((alternativa) => (
                      <div
                        key={alternativa.id}
                        className={[
                          alternativa.id === item.gabarito ? "correta" : "",
                          alternativa.id === item.respostaAluno &&
                          alternativa.id !== item.gabarito
                            ? "marcada-errada"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <strong>{alternativa.id}</strong>
                        <span>{alternativa.texto}</span>
                      </div>
                    ))}
                  </div>

                  <div className="respostas">
                    <span>
                      Sua resposta: <b>{item.respostaAluno || "em branco"}</b>
                    </span>
                    <span>
                      Gabarito: <b>{item.gabarito}</b>
                    </span>
                  </div>

                  <div className="explicacoes">
                    <div>
                      <strong>Por que a correta está certa</strong>
                      <p>{item.comentario}</p>
                    </div>
                    <div>
                      <strong>Motivo do erro</strong>
                      <p>{item.motivoProvavel}</p>
                    </div>
                    <div>
                      <strong>Bizu de prova</strong>
                      <p>{item.bizu}</p>
                    </div>
                    {item.mnemonico && (
                      <div>
                        <strong>Mnemônico / macete</strong>
                        <p>{item.mnemonico}</p>
                      </div>
                    )}
                    <div>
                      <strong>O que revisar</strong>
                      <p>{item.oQueRevisar}</p>
                    </div>
                  </div>

                  <div className="motivos">
                    <span>Marque o motivo para deixar o diagnóstico mais preciso:</span>
                    <div>
                      {MOTIVOS.map((motivo) => (
                        <button
                          type="button"
                          key={motivo.id}
                          className={
                            motivosErro[item.questaoId] === motivo.id
                              ? "ativo"
                              : ""
                          }
                          title={rotuloMotivoErro(motivo.id)}
                          onClick={() =>
                            marcarMotivo(item.questaoId, motivo.id)
                          }
                        >
                          {motivo.texto}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="analise-simulado-study__painel correcao">
        <button
          type="button"
          className="analise-simulado-study__abrir"
          onClick={() => setCorrecaoAberta((valor) => !valor)}
          aria-expanded={correcaoAberta}
        >
          <div>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>
              <strong>Correção questão a questão</strong>
              <small>
                Acerto, erro, acerto por chute, não respondida e ainda não estudado
              </small>
            </span>
          </div>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={correcaoAberta ? "aberto" : ""}
          />
        </button>

        {correcaoAberta && (
          <div className="analise-simulado-study__correcao-lista">
            {analise.correcao.map((item) => (
              <div key={item.id}>
                <span>Q{item.numero}</span>
                <strong>
                  {item.materia} · {item.assuntoEspecifico}
                </strong>
                <small>
                  Marcada: {item.respostaAluno || "—"} · Gabarito: {item.gabarito}
                </small>
                <b className={`status-${item.status}`}>
                  {rotuloStatus(item.status)}
                </b>
              </div>
            ))}
          </div>
        )}
      </section>

      {evolucaoAberta && (
        <section className="analise-simulado-study__painel evolucao">
          <div className="analise-simulado-study__titulo">
            <div>
              <span>EVOLUÇÃO</span>
              <h3>Comparação com simulados anteriores</h3>
            </div>
            <small>Variação de nota não é igual a perda automática de conhecimento.</small>
          </div>

          {analise.evolucao.length === 0 ? (
            <div className="analise-simulado-study__vazio">
              Ainda não existe outro simulado comparável por matéria.
            </div>
          ) : (
            <div className="analise-simulado-study__evolucao-lista">
              {analise.evolucao.map((item) => (
                <article key={item.materia}>
                  <strong>{item.materia}</strong>
                  <div>
                    <span>Anterior: {item.anterior}%</span>
                    <ArrowRight size={16} aria-hidden="true" />
                    <span>Atual: {item.atual}%</span>
                  </div>
                  <b
                    className={
                      item.variacaoPp > 0
                        ? "subiu"
                        : item.variacaoPp < 0
                          ? "caiu"
                          : ""
                    }
                  >
                    {item.rotulo}
                  </b>
                  {item.observacao && <small>{item.observacao}</small>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="analise-simulado-study__recomendacao">
        <Sparkles size={22} aria-hidden="true" />
        <div>
          <strong>Recomendação final</strong>
          <p>{analise.recomendacaoFinal}</p>
        </div>
      </footer>
    </section>
  );
}

function rotuloPrioridade(prioridade: "alta" | "media" | "baixa") {
  if (prioridade === "alta") return "alta";
  if (prioridade === "media") return "média";
  return "baixa";
}

function rotuloStatus(status: string) {
  if (status === "acerto") return "Acerto";
  if (status === "erro") return "Erro";
  if (status === "acerto_chute") return "Acerto por chute";
  if (status === "nao_respondida") return "Não respondida";
  if (status === "nao_estudado") return "Ainda não estudado";
  if (status === "anulada") return "Anulada";
  return status;
}
