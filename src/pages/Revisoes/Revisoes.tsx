import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./Revisoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { buscarPacoteQuestoesFlashcards } from "../../data/questoes";
import {
  calcularDiasDiferenca,
  concluirRevisaoNaLista,
  formatarDataRevisao,
  preverDetalhesProximaRevisaoPorDesempenho,
  statusDaRevisao,
  redistribuirRevisoesPendentes,
  reagendarRevisao,
} from "../../utils/revisoes";
import type { Revisao, SessaoEstudo } from "../../types";
import { localizarReferenciaCanonica } from "../../services/conteudos/sincronizacaoCanonica";
import { materiasEquivalentes } from "../../utils/uniaoGradeEstudos";
import { planejarRevisaoPendente } from "../../utils/revisaoAdaptativa";
import { rotuloOrigemRevisaoSimulado, useNomesSimuladosDeRevisoes } from "../../utils/origemRevisaoSimulado";

type DesempenhoRevisao = "facil" | "media" | "dificil";

const CHAVE_ORIGEM_REVISAO_QUESTOES = "pmpe:questoes-ia:origem-revisao";

export default function Revisoes() {
  const { materias, revisoes, setRevisoes, configuracoes, sessoes } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const revisaoAbertaRef = useRef<string | null>(null);
  const nomesSimulados = useNomesSimuladosDeRevisoes(revisoes);

  const revisoesComModulo = useMemo(
    () =>
      revisoes.map((revisao) => {
        if (revisao.modulo || revisao.moduloId) return revisao;

        const materia = materias.find(
          (item) => item.id === revisao.materiaId || item.nome === revisao.materia
        );
        const modulo = materia?.modulos?.find((item) =>
          item.assuntos.some(
            (assunto) => assunto.id === revisao.assuntoId || assunto.nome === revisao.assunto
          )
        );

        return modulo
          ? { ...revisao, modulo: modulo.nome, moduloId: modulo.id }
          : { ...revisao, modulo: "Geral" };
      }),
    [materias, revisoes]
  );

  const revisoesPendentes = useMemo(
    () =>
      revisoesComModulo
        .filter((revisao) => !revisao.concluida)
        .sort(
          (a, b) => new Date(a.dataPrevista).getTime() - new Date(b.dataPrevista).getTime()
        ),
    [revisoesComModulo]
  );

  const revisoesConcluidas = useMemo(
    () =>
      revisoesComModulo
        .filter((revisao) => revisao.concluida)
        .sort(
          (a, b) =>
            new Date(b.dataConclusao || b.dataPrevista).getTime() -
            new Date(a.dataConclusao || a.dataPrevista).getTime()
        ),
    [revisoesComModulo]
  );

  const atrasadas = useMemo(
    () => revisoesPendentes.filter((revisao) => statusDaRevisao(revisao.dataPrevista) === "atrasada"),
    [revisoesPendentes]
  );
  const paraHoje = useMemo(
    () => revisoesPendentes.filter((revisao) => statusDaRevisao(revisao.dataPrevista) === "hoje"),
    [revisoesPendentes]
  );
  const futuras = useMemo(
    () => revisoesPendentes.filter((revisao) => statusDaRevisao(revisao.dataPrevista) === "futura"),
    [revisoesPendentes]
  );

  function obterDadosCanonicos(revisao: Revisao) {
    const referencia = localizarReferenciaCanonica(materias, {
      materia: revisao.materia,
      materiaId: revisao.materiaId,
      assunto: revisao.assunto,
      assuntoId: revisao.assuntoId,
      modulo: revisao.modulo,
      moduloId: revisao.moduloId,
    });

    const materiaCanonica =
      referencia?.materia ??
      materias.find(
        (item) =>
          item.id === revisao.materiaId ||
          item.idsLegados?.includes(revisao.materiaId) ||
          normalizar(item.nome) === normalizar(revisao.materia) ||
          materiasEquivalentes(item.nome, revisao.materia)
      );

    const materiaMudou =
      Boolean(materiaCanonica) &&
      materiaCanonica?.id !== revisao.materiaId;

    return {
      materia: referencia?.materia.nome ?? materiaCanonica?.nome ?? revisao.materia,
      materiaId: referencia?.materia.id ?? materiaCanonica?.id ?? revisao.materiaId,
      modulo:
        referencia?.modulo.nome ??
        (!materiaMudou && revisao.modulo && revisao.modulo !== "Geral"
          ? revisao.modulo
          : undefined),
      moduloId:
        referencia?.modulo.id ??
        (!materiaMudou ? revisao.moduloId : undefined),
      assunto: referencia?.assunto.nome ?? revisao.assunto,
      assuntoId:
        referencia?.assunto.id ??
        (!materiaMudou ? revisao.assuntoId : undefined),
    };
  }

  /* oxlint-disable react-hooks/exhaustive-deps -- abertura por navegação é protegida por revisaoAbertaRef */
  useEffect(() => {
    const id = (location.state as {revisaoId?: string} | null)?.revisaoId;
    if (!id || revisaoAbertaRef.current === id) return;
    const revisao = revisoesComModulo.find(r => r.id === id);
    if (!revisao) return;
    revisaoAbertaRef.current = id;
    if (revisao.concluida) {showToast('Esta revisão já foi concluída.', 'info'); return;}
    abrirRevisao(revisao);
  }, [location.state, revisoesComModulo]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  function abrirRevisao(revisao: Revisao) {
    if (revisao.origemSimulado?.vinculo === "sem_conteudo") {
      showToast(
        "Esse assunto veio do simulado, mas ainda não possui aula vinculada ao edital. Vou abrir questões IA sem apontar uma aula incorreta.",
        "info"
      );
      abrirQuestoesIA(revisao);
      return;
    }

    const dados = obterDadosCanonicos(revisao);
    const plano = planejarRevisaoPendente(revisao);
    const formatoRecomendado =
      plano.modo === "teoria_questoes"
        ? "teoria"
        : "questoes";

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify({
        ...dados,
        revisaoId: revisao.id,
        tipo: "revisao",
        formatoRevisao: formatoRecomendado,
        objetivo: `Revisar ${dados.assunto}`,
        observacao: `Revisão etapa ${revisao.etapa} · ${plano.titulo}`,
      })
    );

    navigate("/central-estudos");
  }

  function abrirQuestoesIA(revisao: Revisao) {
    const dados = obterDadosCanonicos(revisao);
    const plano = planejarRevisaoPendente(revisao);
    const quantidade = Math.max(5, plano.quantidadeQuestoes || 10);

    sessionStorage.setItem("pmpe:gerar-ia:modo", "questoes");
    sessionStorage.setItem(
      "pmpe:gerar-ia:prefill",
      JSON.stringify({
        materia: dados.materia,
        modulo: dados.modulo,
        assunto: dados.assunto,
        quantidade,
      })
    );
    sessionStorage.setItem(
      CHAVE_ORIGEM_REVISAO_QUESTOES,
      JSON.stringify({
        ...dados,
        revisaoId: revisao.id,
        etapa: revisao.etapa,
        criadoEm: new Date().toISOString(),
      })
    );

    navigate("/gerar-simulado-ia");
  }

  function abrirFlashcardsDaRevisao(revisao: Revisao) {
    const dados = obterDadosCanonicos(revisao);
    const pacote = buscarPacoteQuestoesFlashcards(
      dados.materia,
      dados.assunto
    );

    if (!pacote) {
      showToast(
        "Ainda não há flashcards cadastrados para este assunto.",
        "info"
      );
      return;
    }

    const plano = planejarRevisaoPendente(revisao);
    const modo =
      typeof plano.percentual === "number" &&
      plano.percentual >= 80
        ? "quiz"
        : "flashcards";

    navigate("/estudos", {
      state: {
        flashcards: {
          materia: dados.materia,
          topico: dados.assunto,
          modo,
        },
      },
    });
  }

  function concluirRevisao(revisao: Revisao, desempenho: DesempenhoRevisao) {
    const agora = new Date();
    const proximaId = crypto.randomUUID();
    setRevisoes((anteriores) => concluirRevisaoNaLista({
      revisoes: anteriores, revisaoId: revisao.id, desempenho,
      limiteDiario: configuracoes.metaRevisoesDiaria, agora, proximaId,
    }));

    showToast(
      (desempenho !== "facil" || revisao.etapa < 5)
        ? "Revisão concluída. Próxima revisão agendada conforme seu desempenho."
        : "Ciclo de revisões finalizado.",
      "success"
    );
  }

  function reagendar(revisao: Revisao, dias: number) {
    setRevisoes((anteriores) =>
      anteriores.map((item) => (item.id === revisao.id ? reagendarRevisao(item, dias) : item))
    );
    showToast(`Revisão reagendada para daqui a ${dias} dia(s).`, "success");
  }

  function excluirRevisao(revisaoExcluida: Revisao) {
    if (!window.confirm("Deseja excluir esta revisão?")) return;

    setRevisoes((anteriores) =>
      anteriores.filter((revisao) => revisao.id !== revisaoExcluida.id)
    );

    showToast("Revisão excluída.", "info");
  }

  function reorganizarAgenda() {
    const limite = configuracoes.metaRevisoesDiaria;
    if (limite <= 0) {
      showToast(
        "Defina uma meta de revisões por dia maior que zero nas Configurações.",
        "warning"
      );
      return;
    }

    const reorganizadas = redistribuirRevisoesPendentes(revisoes, limite);
    const datasAnteriores = new Map(
      revisoes.map((revisao) => [revisao.id, dataCalendario(revisao.dataPrevista)])
    );
    const alteradas = reorganizadas.filter(
      (revisao) =>
        !revisao.concluida &&
        datasAnteriores.get(revisao.id) !== dataCalendario(revisao.dataPrevista)
    ).length;

    if (alteradas === 0) {
      showToast(
        `Nenhuma mudança necessária: a agenda já respeita o limite de ${limite} revisões por dia.`,
        "info"
      );
      return;
    }

    setRevisoes(reorganizadas);
    showToast(
      `${alteradas} ${alteradas === 1 ? "revisão foi reorganizada" : "revisões foram reorganizadas"}. Conclusões foram preservadas e nenhuma revisão futura foi antecipada.`,
      "success"
    );
  }

  const propsGrupo = {
    abrirRevisao,
    abrirQuestoesIA,
    abrirFlashcards: abrirFlashcardsDaRevisao,
    concluirRevisao,
    reagendarRevisao: reagendar,
    excluirRevisao,
    revisoesBase: revisoesComModulo,
    limiteDiario: configuracoes.metaRevisoesDiaria,
    nomesSimulados,
    sessoes,
  };

  return (
    <section className="revisoes-container">
      <h1 className="revisoes-title">🔁 Revisões</h1>
      <p className="revisoes-subtitle">
        O Study Pro usa seu desempenho para indicar como revisar. Clique em Revisar para abrir a Central de Estudos já vinculada a esta pendência; escolha Teoria ou Questões e, ao finalizar a sessão, a revisão é concluída e a próxima é agendada automaticamente.
      </p>

      <div className="revisoes-toolbar">
        <span>
          Limite atual: <strong>{configuracoes.metaRevisoesDiaria || "sem limite"}</strong> revisão(ões)/dia
        </span>
        <button type="button" onClick={reorganizarAgenda} title="Redistribui atrasos e excesso diário sem antecipar revisões futuras nem alterar conclusões.">Reorganizar agenda</button>
      </div>

      <div className="revisoes-resumo">
        <ResumoCard titulo="Atrasadas" valor={atrasadas.length} classe="resumo-atrasado" />
        <ResumoCard titulo="Hoje" valor={paraHoje.length} classe="resumo-hoje" />
        <ResumoCard titulo="Futuras" valor={futuras.length} classe="resumo-futuro" />
        <ResumoCard titulo="Concluídas" valor={revisoesConcluidas.length} classe="resumo-concluido" />
      </div>

      {revisoesPendentes.length === 0 ? (
        <div className="revisoes-vazio">
          <h2>Nenhuma revisão pendente</h2>
          <p>Revisões de simulados não são adicionadas a esta agenda. Consulte os erros no diagnóstico do simulado e treine com IA se desejar.</p>
        </div>
      ) : (
        <>
          {atrasadas.length > 0 && (
            <GrupoRevisoes titulo="🔴 Revisões atrasadas" revisoes={atrasadas} {...propsGrupo} />
          )}
          {paraHoje.length > 0 && (
            <GrupoRevisoes titulo="🟡 Revisões de hoje" revisoes={paraHoje} {...propsGrupo} />
          )}
          {futuras.length > 0 && (
            <GrupoRevisoes titulo="🟢 Próximas revisões" revisoes={futuras} {...propsGrupo} />
          )}
        </>
      )}

      {revisoesConcluidas.length > 0 && (
        <div className="revisoes-grupo">
          <h2>✅ Histórico de revisões</h2>
          <div className="revisoes-lista">
            {revisoesConcluidas.slice(0, 10).map((revisao) => (
              <div key={revisao.id} className="revisao-card revisao-concluida">
                <div>
                  <strong>{revisao.materia}</strong>
                  {revisao.modulo && <small className="revisao-caminho">{revisao.modulo}</small>}
                  <p>{revisao.assunto}</p>
                  {rotuloOrigemRevisaoSimulado(revisao, nomesSimulados) && (
                    <small className="revisao-origem-simulado">{rotuloOrigemRevisaoSimulado(revisao, nomesSimulados)}</small>
                  )}
                  <span>
                    Etapa {revisao.etapa} concluída em {formatarDataRevisao(revisao.dataConclusao || revisao.dataPrevista)}
                  </span>
                  {revisao.desempenho && (
                    <small className={`revisao-resultado resultado-${revisao.desempenho}`}>
                      Desempenho: {formatarDesempenho(revisao.desempenho)}
                    </small>
                  )}
                  {typeof revisao.certas === "number" && typeof revisao.erradas === "number" && (
                    <small>{revisao.certas} acerto(s) · {revisao.erradas} erro(s)</small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type ResumoCardProps = { titulo: string; valor: number; classe: string };

function ResumoCard({ titulo, valor, classe }: ResumoCardProps) {
  return (
    <div className={`revisao-resumo-card ${classe}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

type GrupoRevisoesProps = {
  titulo: string;
  revisoes: Revisao[];
  abrirRevisao: (revisao: Revisao) => void;
  abrirQuestoesIA: (revisao: Revisao) => void;
  abrirFlashcards: (revisao: Revisao) => void;
  concluirRevisao: (revisao: Revisao, desempenho: DesempenhoRevisao) => void;
  reagendarRevisao: (revisao: Revisao, dias: number) => void;
  excluirRevisao: (revisao: Revisao) => void;
  revisoesBase: Revisao[];
  limiteDiario: number;
  nomesSimulados: Record<string, string>;
  sessoes: SessaoEstudo[];
};

function GrupoRevisoes({
  titulo,
  revisoes,
  abrirRevisao,
  abrirQuestoesIA,
  abrirFlashcards,
  concluirRevisao,
  reagendarRevisao,
  excluirRevisao,
  revisoesBase,
  limiteDiario,
  nomesSimulados,
  sessoes,
}: GrupoRevisoesProps) {
  const [avaliandoId, setAvaliandoId] = useState<string | null>(null);
  const [opcoesId, setOpcoesId] = useState<string | null>(null);
  const [historicoId, setHistoricoId] = useState<string | null>(null);

  function alternarAvaliacao(id: string) {
    setAvaliandoId((atual) => (atual === id ? null : id));
    setOpcoesId(null);
  }

  function alternarOpcoes(id: string) {
    setOpcoesId((atual) => (atual === id ? null : id));
    setAvaliandoId(null);
    setHistoricoId(null);
  }

  function alternarHistorico(id: string) {
    setHistoricoId((atual) => (atual === id ? null : id));
    setAvaliandoId(null);
    setOpcoesId(null);
  }

  return (
    <div className="revisoes-grupo">
      <h2>{titulo}</h2>
      <div className="revisoes-lista">
        {revisoes.map((revisao) => {
          const diferenca = calcularDiasDiferenca(revisao.dataPrevista);
          const avaliando = avaliandoId === revisao.id;
          const mostrandoOpcoes = opcoesId === revisao.id;
          const plano = planejarRevisaoPendente(revisao);
          const temFlashcards = Boolean(
            buscarPacoteQuestoesFlashcards(
              revisao.materia,
              revisao.assunto
            )
          );
          const modoFlashcardsRecomendado =
            typeof plano.percentual === "number" &&
            plano.percentual >= 80
              ? "Quiz"
              : "Flashcards";
          const quando =
            diferenca < 0
              ? `Atrasada há ${Math.abs(diferenca)} dia(s)`
              : diferenca === 0
                ? "Hoje"
                : diferenca === 1
                  ? "Amanhã"
                  : `Daqui a ${diferenca} dias`;
          const previsaoDificil = preverDetalhesProximaRevisaoPorDesempenho({
            revisao,
            desempenho: "dificil",
            revisoesExistentes: revisoesBase,
            limiteDiario,
          });
          const previsaoMedia = preverDetalhesProximaRevisaoPorDesempenho({
            revisao,
            desempenho: "media",
            revisoesExistentes: revisoesBase,
            limiteDiario,
          });
          const previsaoFacil = preverDetalhesProximaRevisaoPorDesempenho({
            revisao,
            desempenho: "facil",
            revisoesExistentes: revisoesBase,
            limiteDiario,
          });

          const mostrandoHistorico = historicoId === revisao.id;
          const historico = montarHistoricoRevisao(
            revisao,
            revisoesBase,
            sessoes
          );

          return (
            <article key={revisao.id} className="revisao-card">
              <div className="revisao-conteudo">
                <strong>{revisao.materia}</strong>
                {revisao.modulo && <small className="revisao-caminho">{revisao.modulo}</small>}
                <p>{revisao.assunto}</p>
                {rotuloOrigemRevisaoSimulado(revisao, nomesSimulados) && (
                  <small className="revisao-origem-simulado">{rotuloOrigemRevisaoSimulado(revisao, nomesSimulados)}</small>
                )}
                <span>Etapa {revisao.etapa} · Prevista para {formatarDataRevisao(revisao.dataPrevista)}</span>

                <div className={`revisao-orientacao revisao-orientacao-${plano.modo}`}>
                  <div className="revisao-orientacao-topo">
                    <strong>{quando} · {plano.titulo}</strong>
                    {typeof plano.percentual === "number" && typeof plano.total === "number" ? (
                      <span>
                        Último resultado: {revisao.certas} acerto(s) de {plano.total} ({plano.percentual}%)
                      </span>
                    ) : (
                      <span>Sem nota medida ainda</span>
                    )}
                  </div>
                  <p>{plano.descricao}</p>
                  <details className="revisao-detalhes-previsao">
                    <summary>Ver próximas datas conforme meu desempenho</summary>
                    <p className="revisao-aviso-previsao">Estas datas são simulações. A próxima revisão só será definida ao concluir a atual.</p>
                    <div className="revisao-proximos-retornos">
                      <PrevisaoRetorno rotulo="Difícil" previsao={previsaoDificil} />
                      <PrevisaoRetorno rotulo="Médio" previsao={previsaoMedia} />
                      <PrevisaoRetorno rotulo="Fácil" previsao={previsaoFacil} />
                    </div>
                  </details>
                  {temFlashcards && (
                    <small className="revisao-flashcards-recomendacao">
                      🧠 Reforço disponível: {modoFlashcardsRecomendado}
                    </small>
                  )}
                </div>
              </div>

              <div className="revisao-lateral">
                <div className="revisao-acoes-compactas">
                  <button
                    type="button"
                    className="revisao-iniciar"
                    onClick={() => abrirRevisao(revisao)}
                  >
                    {plano.modo === "teoria_questoes"
                      ? "📖 Rever teoria"
                      : "🧩 Fazer questões"}
                  </button>
                  <button
                    type="button"
                    className="revisao-questoes-ia"
                    onClick={() => abrirQuestoesIA(revisao)}
                    title={`Abrir Questões IA com ${revisao.materia} → ${revisao.assunto} já preenchidos`}
                  >
                    ✨ Questões IA
                  </button>
                  {temFlashcards && (
                    <button
                      type="button"
                      className="revisao-flashcards"
                      onClick={() => abrirFlashcards(revisao)}
                      title={`Abrir ${modoFlashcardsRecomendado} deste assunto`}
                    >
                      🃏 {modoFlashcardsRecomendado}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`revisao-historico-toggle ${mostrandoHistorico ? "ativo" : ""}`}
                    onClick={() => alternarHistorico(revisao.id)}
                    aria-expanded={mostrandoHistorico}
                  >
                    📋 Histórico
                  </button>
                  <button
                    type="button"
                    className={`revisao-concluir-toggle ${avaliando ? "ativo" : ""}`}
                    onClick={() => alternarAvaliacao(revisao.id)}
                    aria-expanded={avaliando}
                  >
                    ✓ Concluir
                  </button>
                  <button
                    type="button"
                    className={`revisao-opcoes-toggle ${mostrandoOpcoes ? "ativo" : ""}`}
                    onClick={() => alternarOpcoes(revisao.id)}
                    aria-expanded={mostrandoOpcoes}
                    aria-label="Mais opções da revisão"
                    title="Mais opções"
                  >
                    •••
                  </button>
                </div>

                {avaliando && (
                  <div className="revisao-painel-compacto revisao-painel-avaliacao">
                    <span>Como foi a revisão?</span>
                    <button
                      type="button"
                      className="avaliacao-dificil"
                      onClick={() => {
                        concluirRevisao(revisao, "dificil");
                        setAvaliandoId(null);
                      }}
                    >
                      Difícil
                    </button>
                    <button
                      type="button"
                      className="avaliacao-media"
                      onClick={() => {
                        concluirRevisao(revisao, "media");
                        setAvaliandoId(null);
                      }}
                    >
                      Médio
                    </button>
                    <button
                      type="button"
                      className="avaliacao-facil"
                      onClick={() => {
                        concluirRevisao(revisao, "facil");
                        setAvaliandoId(null);
                      }}
                    >
                      Fácil
                    </button>
                  </div>
                )}

                {mostrandoOpcoes && (
                  <div className="revisao-painel-compacto revisao-painel-opcoes">
                    <span>Reagendar:</span>
                    {[1, 3, 7].map((dias) => (
                      <button
                        type="button"
                        key={dias}
                        onClick={() => {
                          reagendarRevisao(revisao, dias);
                          setOpcoesId(null);
                        }}
                      >
                        +{dias}d
                      </button>
                    ))}
                    <button
                      type="button"
                      className="revisao-excluir"
                      onClick={() => {
                        excluirRevisao(revisao);
                        setOpcoesId(null);
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>

              {mostrandoHistorico && (
                <HistoricoRevisao
                  revisaoAtual={revisao}
                  itens={historico}
                />
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function formatarDesempenho(desempenho: DesempenhoRevisao) {
  if (desempenho === "facil") return "Fácil";
  if (desempenho === "media") return "Médio";
  return "Difícil";
}

function dataCalendario(data: string) {
  const valor = new Date(data);
  return `${valor.getFullYear()}-${valor.getMonth() + 1}-${valor.getDate()}`;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


type DetalhesPrevisao = ReturnType<
  typeof preverDetalhesProximaRevisaoPorDesempenho
>;

function PrevisaoRetorno({
  rotulo,
  previsao,
}: {
  rotulo: string;
  previsao: DetalhesPrevisao;
}) {
  if (!previsao) {
    return (
      <span>
        <b>{rotulo}</b> → encerra o ciclo
      </span>
    );
  }

  const etapa = previsao.proxima.etapa;
  if (!previsao.adiadaPorCapacidade) {
    return (
      <span>
        <b>{rotulo}</b> → {formatarDataRevisao(previsao.dataAgendada)}
        {" · "}Etapa {etapa}
      </span>
    );
  }

  return (
    <span>
      <b>{rotulo}</b> → ideal {formatarDataRevisao(previsao.dataIdeal)}
      {" · "}agenda cheia → {formatarDataRevisao(previsao.dataAgendada)}
      {" · "}Etapa {etapa}
    </span>
  );
}

type ItemHistoricoRevisao = {
  revisao: Revisao;
  sessao?: SessaoEstudo;
};

function montarHistoricoRevisao(
  atual: Revisao,
  revisoes: Revisao[],
  sessoes: SessaoEstudo[]
): ItemHistoricoRevisao[] {
  const trilha = revisoes
    .filter((item) => mesmaTrilhaRevisao(item, atual))
    .sort(
      (a, b) =>
        dataOrdenacaoRevisao(a) - dataOrdenacaoRevisao(b)
    );

  return trilha.map((revisao) => ({
    revisao,
    sessao:
      sessoes.find((sessao) => sessao.id === revisao.sessaoId) ??
      sessoes.find((sessao) => sessao.revisaoId === revisao.id),
  }));
}

function HistoricoRevisao({
  revisaoAtual,
  itens,
}: {
  revisaoAtual: Revisao;
  itens: ItemHistoricoRevisao[];
}) {
  return (
    <div className="revisao-historico-assunto">
      <div className="revisao-historico-cabecalho">
        <div>
          <strong>📋 Histórico deste assunto</strong>
          <span>{revisaoAtual.assunto}</span>
        </div>
        <small>{itens.length} etapa(s) registrada(s)</small>
      </div>

      <div className="revisao-historico-linha">
        {itens.map(({ revisao, sessao }, indice) => {
          const concluida = revisao.concluida;
          const data = concluida
            ? revisao.dataConclusao ?? revisao.dataPrevista
            : revisao.dataPrevista;
          const total =
            typeof revisao.certas === "number" &&
            typeof revisao.erradas === "number"
              ? revisao.certas + revisao.erradas
              : undefined;
          const proxima = itens
            .slice(indice + 1)
            .find((item) => item.revisao.etapa > revisao.etapa)?.revisao;

          return (
            <div
              key={revisao.id}
              className={`revisao-historico-item ${
                concluida ? "concluido" : "pendente"
              }`}
            >
              <div className="revisao-historico-marcador" />
              <div>
                <strong>
                  Etapa {revisao.etapa}
                  {concluida ? " · concluída" : " · pendente"}
                </strong>
                <span>{formatarDataRevisao(data)}</span>
                <small>{rotuloAtividadeHistorico(revisao, sessao)}</small>

                {typeof total === "number" && total > 0 && (
                  <small>
                    Resultado: {revisao.certas}/{total}
                    {" · "}
                    {Math.round(((revisao.certas ?? 0) / total) * 100)}%
                    {revisao.desempenho
                      ? ` · ${formatarDesempenho(revisao.desempenho)}`
                      : ""}
                  </small>
                )}

                {typeof total !== "number" && revisao.desempenho && (
                  <small>
                    Resultado: {formatarDesempenho(revisao.desempenho)}
                  </small>
                )}

                {concluida && proxima && (
                  <small>
                    Próxima: Etapa {proxima.etapa} · agendada para{" "}
                    {formatarDataRevisao(proxima.dataPrevista)}
                  </small>
                )}

                {!concluida && (
                  <small>
                    Status atual · {planejarRevisaoPendente(revisao).titulo}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rotuloAtividadeHistorico(
  revisao: Revisao,
  sessao?: SessaoEstudo
) {
  if (sessao?.formatoRevisao === "teoria") {
    return "📖 Revisão de teoria";
  }
  if (
    sessao?.formatoRevisao === "questoes" ||
    typeof revisao.certas === "number"
  ) {
    return "🧩 Revisão por questões";
  }
  return "✓ Revisão registrada";
}

function mesmaTrilhaRevisao(a: Revisao, b: Revisao) {
  if (
    a.materiaId === b.materiaId &&
    a.assuntoId === b.assuntoId &&
    (!a.moduloId || !b.moduloId || a.moduloId === b.moduloId)
  ) {
    return true;
  }

  return (
    normalizar(a.materia) === normalizar(b.materia) &&
    normalizar(a.assunto) === normalizar(b.assunto)
  );
}

function dataOrdenacaoRevisao(revisao: Revisao) {
  const data =
    revisao.dataConclusao ??
    revisao.dataCriacao ??
    revisao.dataPrevista;
  const valor = new Date(data).getTime();
  return Number.isFinite(valor) ? valor : 0;
}
