import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import "./Dashboard.css";

import { useApp } from "../../context/AppContext";
import { useCronometro } from "../../context/CronometroContext";
import {
  listarAssuntosDaMateria,
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";
import { localizarProximaAula } from "../../services/conteudos/localizarConteudo";
import { criarDadosSessaoDaMissao } from "../../services/conteudos/sincronizacaoCanonica";

import {
  calcularGamificacao,
} from "../../services/gamificacaoService";


import {
  getProgressoPlano,
  getProgressoSemana,
  getProximaMissao,
  getSemanaAtual,
  getTotalConcluidas,
  getTotalMissoes,
  getTotalPendentes,
  type ProximaMissaoPlano,
} from "../../utils/planoUtils";
import { criarPlanoCalendario, normalizarMissoesPorDia, obterDiaAtualPlano } from "../../utils/planoCalendario";

import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
} from "../../types/index";


export default function Dashboard() {
  const navigate = useNavigate();
  const { sessaoAtiva, segundosDecorridos, cronometroAtivo, iniciar, pausar, continuar } = useCronometro();

  const {
    materias,
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
    missoesConcluidas,
  } = useApp();

  const [
    atualizacaoPlano,
    setAtualizacaoPlano,
  ] = useState(0);

  const planoCalendario = useMemo(
    () => criarPlanoCalendario(normalizarMissoesPorDia(configuracoes.missoesPorDia ?? 1)),
    [configuracoes.missoesPorDia]
  );

  useEffect(() => {
    function atualizarPlano() {
      setAtualizacaoPlano(
        (valor) => valor + 1
      );
    }

    window.addEventListener(
      "pmpe-plano-atualizado",
      atualizarPlano
    );

    window.addEventListener(
      "storage",
      atualizarPlano
    );

    window.addEventListener(
      "focus",
      atualizarPlano
    );

    window.addEventListener(
      "pmpe-sessoes-atualizadas",
      atualizarPlano
    );

    window.addEventListener(
      "pmpe-dashboard-atualizado",
      atualizarPlano
    );

    window.addEventListener(
      "pmpe-simulado-ia-finalizado",
      atualizarPlano
    );

    return () => {
      window.removeEventListener(
        "pmpe-plano-atualizado",
        atualizarPlano
      );

      window.removeEventListener(
        "storage",
        atualizarPlano
      );

      window.removeEventListener(
        "focus",
        atualizarPlano
      );

      window.removeEventListener(
        "pmpe-sessoes-atualizadas",
        atualizarPlano
      );

      window.removeEventListener(
        "pmpe-dashboard-atualizado",
        atualizarPlano
      );

      window.removeEventListener(
        "pmpe-simulado-ia-finalizado",
        atualizarPlano
      );
    };
  }, []);

  const dadosPlano = useMemo(() => {
    const semanaAtual =
      getSemanaAtual(
        missoesConcluidas,
        planoCalendario,
        configuracoes.semanaAtualPlano
      );
    const diaAtual = obterDiaAtualPlano();
    const concluidasSet = new Set(missoesConcluidas);
    const semanaDoCalendario = planoCalendario.find(
      (semana) => semana.numero === semanaAtual
    );
    const diaDoCalendario = semanaDoCalendario?.dias.find(
      (dia) => dia.numero === diaAtual
    );
    const missaoPendenteHoje = diaDoCalendario?.missoes.find(
      (missao) => !concluidasSet.has(missao.id)
    );
    const missaoHoje = missaoPendenteHoje
      ? {
          semana: semanaAtual,
          dia: diaAtual,
          missao: missaoPendenteHoje,
        }
      : null;
    const hojeConcluido = Boolean(
      diaDoCalendario &&
      diaDoCalendario.missoes.length > 0 &&
      diaDoCalendario.missoes.every((missao) => concluidasSet.has(missao.id))
    );

    return {
      progresso:
        getProgressoPlano(missoesConcluidas, planoCalendario),

      concluidas:
        getTotalConcluidas(missoesConcluidas, planoCalendario),

      total:
        getTotalMissoes(planoCalendario),

      pendentes:
        getTotalPendentes(missoesConcluidas, planoCalendario),

      proxima:
        getProximaMissao(
          missoesConcluidas,
          planoCalendario,
          semanaAtual
        ),

      missaoHoje,
      hojeConcluido,
      diaAtual,
      semanaAtual,

      progressoSemana:
        getProgressoSemana(
          semanaAtual,
          missoesConcluidas,
          planoCalendario
        ),
    };
  }, [atualizacaoPlano, missoesConcluidas, planoCalendario]);

  const hoje = obterDataLocal();

  const totalQuestoes =
    questoes.reduce(
      (
        total: number,
        registro: RegistroQuestao
      ) =>
        total +
        registro.certas +
        registro.erradas,
      0
    );

  const totalCertas =
    questoes.reduce(
      (
        total: number,
        registro: RegistroQuestao
      ) =>
        total +
        registro.certas,
      0
    );

  const aproveitamento =
    totalQuestoes === 0
      ? 0
      : Math.round(
          (totalCertas /
            totalQuestoes) *
            100
        );

  const minutosSessoes =
    sessoes.reduce(
      (
        total: number,
        sessao: SessaoEstudo
      ) =>
        total +
        sessao.minutos,
      0
    );

  const minutosQuestoes =
    questoes.reduce(
      (total: number, registro: RegistroQuestao) => {
        const duplicadoPorSessao = sessoes.some((sessao) =>
          sessao.tipo === "questoes" &&
          sessao.materia === registro.materia &&
          sessao.assunto === registro.assunto &&
          Math.abs(new Date(sessao.data).getTime() - new Date(registro.data).getTime()) < 5000
        );

        return total + (duplicadoPorSessao ? 0 : registro.minutos);
      },
      0
    );

  const minutosTotais = minutosSessoes + minutosQuestoes;

  const assuntosTotais =
    materias.reduce(
      (total, materia) =>
        total + listarAssuntosDaMateria(materia).length,
      0
    );

  const assuntosConcluidos =
    materias.reduce(
      (total, materia) =>
        total +
        listarAssuntosDaMateria(materia).filter(
          (assunto) => assunto.concluido
        ).length,
      0
    );

  const trilhaPortugues = useMemo(() => {
    const materia = materias.find(
      (item) => normalizarTextoDashboard(item.nome) === "portugues"
    );

    if (!materia) return null;

    const modulos = listarModulosDaMateria(materia);
    const assuntos = modulos.flatMap((modulo) =>
      modulo.assuntos.map((assunto) => ({ modulo, assunto }))
    );
    const concluidos = assuntos.filter(({ assunto }) => assunto.concluido).length;
    const importados = assuntos.filter(
      ({ assunto }) => assunto.concluido && assunto.conclusaoOrigem === "importado"
    ).length;
    const proximo = assuntos.find(({ assunto }) => !assunto.concluido) ?? null;

    return {
      materia,
      total: assuntos.length,
      concluidos,
      importados,
      percentual: assuntos.length === 0 ? 0 : Math.round((concluidos / assuntos.length) * 100),
      proximo,
    };
  }, [materias]);

  const registrosQuestoesHoje =
    questoes.filter(
      (registro) =>
        obterDataLocal(
          new Date(
            registro.data
          )
        ) === hoje
    );

  const questoesHoje =
    registrosQuestoesHoje.reduce(
      (total, registro) =>
        total +
        registro.certas +
        registro.erradas,
      0
    );

  const minutosQuestoesHoje =
    registrosQuestoesHoje.reduce((total, registro) => {
      const duplicadoPorSessao = sessoes.some((sessao) =>
        sessao.tipo === "questoes" &&
        sessao.materia === registro.materia &&
        sessao.assunto === registro.assunto &&
        Math.abs(new Date(sessao.data).getTime() - new Date(registro.data).getTime()) < 5000
      );
      return total + (duplicadoPorSessao ? 0 : registro.minutos);
    }, 0);

  const sessoesHoje =
    sessoes.filter(
      (sessao) =>
        obterDataLocal(
          new Date(
            sessao.data
          )
        ) === hoje
    );

  const minutosSessoesHoje =
    sessoesHoje.reduce(
      (total, sessao) =>
        total +
        sessao.minutos,
      0
    );

  const minutosHoje =
    minutosQuestoesHoje +
    minutosSessoesHoje;

  const revisoesConcluidasHoje =
    revisoes.filter(
      (revisao) =>
        revisao.concluida &&
        revisao.dataConclusao &&
        obterDataLocal(
          new Date(
            revisao.dataConclusao
          )
        ) === hoje
    ).length;

  const revisoesAtrasadas =
    revisoes.filter(
      (revisao) =>
        !revisao.concluida &&
        inicioDoDia(
          new Date(
            revisao.dataPrevista
          )
        ).getTime() <
          inicioDoDia(
            new Date()
          ).getTime()
    );

  const progressoTempoHoje =
    calcularPercentualMeta(
      minutosHoje,
      configuracoes.metaMinutosDiaria
    );

  const sequencia =
    calcularSequencia(
      questoes,
      sessoes,
      revisoes
    );

  const resumoMaterias =
    calcularResumoMaterias(
      questoes
    );

  const melhorMateria =
    resumoMaterias[0] || null;

  const piorMateria =
    resumoMaterias.length > 0
      ? resumoMaterias[
          resumoMaterias.length - 1
        ]
      : null;

  const gamificacao = useMemo(
    () =>
      calcularGamificacao({
        sessoes,
        questoes,
        revisoes,
        simulados,
      }),
    [sessoes, questoes, revisoes, simulados]
  );

  const xpNoNivel =
    gamificacao.xp % 250;

  const xpParaProximoNivel =
    250;

  const progressoNivel =
    Math.round(
      (xpNoNivel / xpParaProximoNivel) * 100
    );

  const ouro =
    Math.floor(gamificacao.xp / 5);

  const conquistas =
    calcularConquistasDashboard({
      minutosTotais,
      totalQuestoes,
      totalCertas,
      simulados: simulados.length,
      sequencia,
      assuntosConcluidos,
      assuntosTotais,
    });

  const conquistasDetalhadas = montarConquistasDashboard({
    minutosTotais, totalQuestoes, totalCertas, simulados: simulados.length,
    sequencia, assuntosConcluidos, assuntosTotais,
  });

  const estatisticasPeriodos = montarEstatisticasPeriodos(questoes, sessoes);
  const desempenhoSemanal = montarDesempenhoSemanal(questoes, sessoes);
  const revisoesDashboard = montarRevisoesDashboard(revisoes);

  const recomendacaoCoach = montarRecomendacaoCoach({
    revisoesAtrasadas: revisoesAtrasadas.length,
    piorMateria: piorMateria?.materia,
    piorPercentual: piorMateria?.percentual,
    questoesHoje,
    minutosHoje,
    metaQuestoes: configuracoes.metaQuestoesDiaria,
    metaMinutos: configuracoes.metaMinutosDiaria,
  });
function iniciarProximaAulaPortugues() {
    if (!trilhaPortugues?.proximo) return;

    const { materia, proximo } = trilhaPortugues;
    const prefillSessao = {
      materia: materia.nome,
      materiaId: materia.id,
      modulo: proximo.modulo.nome,
      moduloId: proximo.modulo.id,
      assunto: proximo.assunto.nome,
      assuntoId: proximo.assunto.id,
      tipo: "aula" as const,
      objetivo: "Avançar na trilha oficial de Português",
      urlAula: localizarProximaAula(proximo.assunto)?.url ?? proximo.assunto.aula,
      urlQuestoes: proximo.assunto.questoes,
    };

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify(prefillSessao)
    );

    navigate("/central-estudos");
  }

  function iniciarProximaMissao() {
    if (!dadosPlano.missaoHoje) {
      return;
    }

    const { semana, dia, missao } = dadosPlano.missaoHoje;

    if (dia === 7 || missao.tipo === "redacao" || missao.tipo === "simulado") {
      navigate("/plano", { state: { semana, dia } });
      return;
    }

    // Se já existe uma sessão rodando, o botão funciona como atalho para ela.
    // Não substitui silenciosamente uma sessão que o usuário já iniciou.
    if (cronometroAtivo) {
      navigate("/central-estudos");
      return;
    }

    const dadosSessao = criarDadosSessaoDaMissao(
      materias,
      missao,
      semana,
      dia
    );

    // Evita que um prefill antigo da Central sobrescreva a sessão recém-iniciada.
    sessionStorage.removeItem("pmpe:central-estudos:prefill");

    const iniciada = iniciar(dadosSessao);
    if (!iniciada) {
      return;
    }

    navigate("/central-estudos", {
      state: { origem: "dashboard" },
    });
  }

  void trilhaPortugues;
  void conquistasDetalhadas;
  void xpNoNivel;
  void xpParaProximoNivel;
  void progressoNivel;
  void ouro;
  void conquistas;
  void iniciarProximaAulaPortugues;

  const saudacao = obterSaudacaoDashboard();
  const nomeCurto = (configuracoes.nomeUsuario || "Estudante").trim().split(/\s+/)[0];
  const minutosSemanaAtual = estatisticasPeriodos.find((item) => item.rotulo === "Semana")?.minutos ?? 0;

  return (
    <section className="dashboard-container dashboard-pro-v3">
      <header className="dashboard-pro-header">
        <div>
          <h1>{saudacao}, {nomeCurto}</h1>
          <p>Vamos avançar na missão de hoje.</p>
        </div>
        <div className="dashboard-pro-header-right">
          <button type="button" className="dashboard-pro-search" onClick={() => navigate("/buscar", { state: { focoBusca: true } })}>⌕ <span>Buscar conteúdos, questões...</span></button>
          <button type="button" className="dashboard-pro-icon" aria-label="Notificações">♧<i /></button>
          <div className="dashboard-pro-date">▣ {formatarDataLongaDashboard(new Date())}</div>
        </div>
      </header>

      <section className="dashboard-pro-hero">
        <article className="dashboard-pro-mission">
          <span className="dashboard-pro-kicker">◎ MISSÃO DE HOJE</span>
          {dadosPlano.missaoHoje ? (
            <>
              <h2>{dadosPlano.missaoHoje.missao.materia} — {dadosPlano.missaoHoje.missao.assunto}</h2>
              <span className="dashboard-pro-badge">{configuracoes.concurso || "PMPE"}</span>
              <div className="dashboard-pro-progress-row"><div className="dashboard-pro-progress"><div style={{width:`${dadosPlano.progressoSemana}%`}} /></div><strong>{dadosPlano.progressoSemana}%</strong></div>
              <div className="dashboard-pro-mission-meta"><span>▣ {dadosPlano.missaoHoje.missao.tipo || "Aula"}</span><b>•</b><span>◉ {questoesHoje} questões hoje</span><b>•</b><span>↻ {revisoesConcluidasHoje} revisão{revisoesConcluidasHoje === 1 ? "" : "ões"}</span></div>
              <div className="dashboard-pro-actions">
                <button type="button" className="primary" onClick={iniciarProximaMissao}>
                  ▶ {dadosPlano.missaoHoje.dia === 7 || dadosPlano.missaoHoje.missao.tipo === "redacao" || dadosPlano.missaoHoje.missao.tipo === "simulado"
                    ? "Abrir domingo"
                    : cronometroAtivo
                      ? "Ir para estudo"
                      : "Iniciar estudo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { semana, dia, missao } = dadosPlano.missaoHoje!;
                    if (dia === 7 || missao.tipo === "redacao" || missao.tipo === "simulado") {
                      navigate("/plano", { state: { semana, dia } });
                      return;
                    }
                    navigate("/estudos");
                  }}
                >
                  {dadosPlano.missaoHoje.dia === 7 || dadosPlano.missaoHoje.missao.tipo === "redacao" || dadosPlano.missaoHoje.missao.tipo === "simulado"
                    ? "Ver plano"
                    : "Ver conteúdo"}
                </button>
              </div>
            </>
          ) : dadosPlano.hojeConcluido ? (
            <div className="dashboard-pro-empty">
              <h2>Missão de hoje concluída</h2>
              <p>A próxima missão será liberada no próximo dia do calendário.</p>
              <div className="dashboard-pro-actions">
                <button type="button" onClick={() => navigate("/plano", { state: { semana: dadosPlano.semanaAtual, dia: dadosPlano.diaAtual } })}>Ver dia de hoje</button>
              </div>
            </div>
          ) : (
            <div className="dashboard-pro-empty"><h2>Plano concluído</h2><p>Não há missão programada para hoje.</p></div>
          )}
        </article>

        <article className="dashboard-pro-session">
          <div className={["dashboard-pro-timer", cronometroAtivo ? "active" : ""].join(" ")}><strong>{formatarSegundosDashboard(segundosDecorridos)}</strong></div>
          <div className="dashboard-pro-session-info">
            <span className="dashboard-pro-kicker">{cronometroAtivo ? "SESSÃO EM ANDAMENTO" : "CRONÔMETRO"}</span>
            <h2>{cronometroAtivo ? sessaoAtiva.materia : "Pronto para estudar"}</h2>
            <hr />
            <p>▱ {cronometroAtivo
              ? sessaoAtiva.assunto
              : dadosPlano.missaoHoje
                ? `${dadosPlano.missaoHoje.missao.materia} — ${dadosPlano.missaoHoje.missao.assunto}`
                : dadosPlano.hojeConcluido
                  ? "Missão de hoje concluída"
                  : "Nenhuma missão programada para hoje"}</p>
            <div className="dashboard-pro-actions">
              {cronometroAtivo && sessaoAtiva.status === "rodando" && <button type="button" onClick={pausar}>Ⅱ Pausar</button>}
              {cronometroAtivo && sessaoAtiva.status === "pausado" && <button type="button" onClick={continuar}>▶ Continuar</button>}
              <button
                type="button"
                className="outline"
                onClick={() => {
                  if (cronometroAtivo) {
                    navigate("/central-estudos");
                    return;
                  }

                  if (dadosPlano.missaoHoje) {
                    iniciarProximaMissao();
                    return;
                  }

                  if (dadosPlano.hojeConcluido) {
                    navigate("/plano", {
                      state: {
                        semana: dadosPlano.semanaAtual,
                        dia: dadosPlano.diaAtual,
                      },
                    });
                    return;
                  }

                  navigate("/central-estudos");
                }}
              >
                {cronometroAtivo
                  ? "Finalizar"
                  : dadosPlano.missaoHoje
                    ? dadosPlano.missaoHoje.dia === 7 || dadosPlano.missaoHoje.missao.tipo === "redacao" || dadosPlano.missaoHoje.missao.tipo === "simulado"
                      ? "Abrir domingo"
                      : "▶ Iniciar missão"
                    : dadosPlano.hojeConcluido
                      ? "Ver dia de hoje"
                      : "Abrir Central"}
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-pro-stats dashboard-pro-stats-art">
        <ProStat tone="azul" icon="⏱" valor={formatarMinutos(minutosHoje)} label="Tempo estudado hoje" detalhe={`${formatarMinutos(minutosSemanaAtual)} esta semana`} onClick={() => navigate("/historico-sessoes")} />
        <ProStat tone="roxo" icon="📝" valor={String(questoesHoje)} label="Questões hoje" detalhe={`${totalQuestoes} no total`} onClick={() => navigate("/historico")} />
        <ProStat tone="verde" icon="🎯" valor={`${aproveitamento}%`} label="Taxa de acertos" detalhe={melhorMateria ? `${melhorMateria.materia}: ${melhorMateria.percentual}%` : "Comece resolvendo questões"} onClick={() => navigate("/estatisticas")} />
        <StreakStat sequencia={sequencia} dados={desempenhoSemanal} onClick={() => navigate("/historico-sessoes", { state: { periodo: "semana" } })} />
      </section>

      <section className="dashboard-pro-middle">
        <article className="dashboard-pro-panel dashboard-pro-performance">
          <div className="dashboard-pro-panel-title"><div><span className="dashboard-pro-kicker">DESEMPENHO</span><h2>Desempenho semanal</h2></div><button type="button" onClick={() => navigate("/estatisticas")}>Esta semana ⌄</button></div>
          <GraficoDesempenhoSemanal dados={desempenhoSemanal} />
        </article>

        <article className="dashboard-pro-panel dashboard-pro-reviews">
          <div className="dashboard-pro-panel-title"><div><span className="dashboard-pro-kicker">REVISÕES</span><h2>Fila de revisão</h2></div><button type="button" onClick={() => navigate("/revisoes")}>Ver todas →</button></div>
          <div className="dashboard-pro-review-counts"><div><strong className="red">{revisoesAtrasadas.length}</strong><span>atrasadas</span></div><div><strong className="orange">{revisoes.filter(r => !r.concluida && obterDataLocal(new Date(r.dataPrevista)) === hoje).length}</strong><span>para hoje</span></div><div><strong>{revisoes.filter(r => !r.concluida && obterDataLocal(new Date(r.dataPrevista)) === obterDataLocal(adicionarDias(new Date(), 1))).length}</strong><span>amanhã</span></div></div>
          <div className="dashboard-pro-review-list">
            {revisoesDashboard.length > 0 ? revisoesDashboard.map(({ revisao, status }) => (
              <button type="button" key={revisao.id} onClick={() => navigate("/revisoes")}>
                <span className="dashboard-pro-review-calendar">▣</span>
                <b>{revisao.assunto}</b>
                <small className={`dashboard-pro-review-status ${status.classe}`}>{status.texto}</small>
                <em>›</em>
              </button>
            )) : <div className="dashboard-pro-review-empty">Nenhuma revisão atrasada, para hoje ou amanhã.</div>}
          </div>
        </article>
      </section>

      <section className="dashboard-pro-weekly">
        <div><span className="dashboard-pro-kicker">META DO DIA</span><h2>{formatarMinutos(minutosHoje)} / {formatarMinutos(configuracoes.metaMinutosDiaria)}</h2></div>
        <div className="dashboard-pro-weekly-progress"><div style={{width:`${progressoTempoHoje}%`}} /></div>
        <strong>{progressoTempoHoje}%</strong>
      </section>

      <section className="dashboard-pro-footer-grid">
        <article className="dashboard-pro-panel dashboard-pro-diagnostic"><span className="dashboard-pro-kicker">DIAGNÓSTICO</span><h2>Visão rápida</h2><LinhaDiagnostico titulo="Melhor matéria" valor={melhorMateria ? `${melhorMateria.materia} · ${melhorMateria.percentual}%` : "Sem dados"} classe="dashboard-positivo" /><LinhaDiagnostico titulo="Ponto de atenção" valor={piorMateria ? `${piorMateria.materia} · ${piorMateria.percentual}%` : "Sem dados"} classe="dashboard-negativo" /></article>
        <article className="dashboard-pro-panel dashboard-pro-coach"><span className="dashboard-pro-kicker">IA COACH</span><h2>{recomendacaoCoach.titulo}</h2><p>{recomendacaoCoach.texto}</p><button type="button" onClick={() => navigate(recomendacaoCoach.rota)}>Começar agora →</button></article>
      </section>
    </section>
  );
}

type DesempenhoDia = {
  chave: string;
  rotulo: string;
  minutos: number;
  percentual: number;
};

function GraficoDesempenhoSemanal({ dados }: { dados: DesempenhoDia[] }) {
  const largura = 700;
  const altura = 132;
  const baseY = 94;
  const topoY = 16;
  const maxMinutos = Math.max(1, ...dados.map((item) => item.minutos));
  const passo = largura / Math.max(1, dados.length);
  const pontos = dados.map((item, indice) => {
    const x = passo * indice + passo / 2;
    const y = baseY - ((item.percentual / 100) * (baseY - topoY));
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="dashboard-pro-chart-wrap">
      <div className="dashboard-pro-chart-legend"><span><i className="bar" /> Tempo estudado</span><span><i className="line" /> Taxa de acertos</span></div>
      <div className="dashboard-pro-chart">
        <div className="dashboard-pro-chart-bars">
          {dados.map((item) => (
            <div className="dashboard-pro-chart-day" key={item.chave}>
              <div className="dashboard-pro-chart-bar-track">
                <i style={{ height: `${Math.max(5, Math.round((item.minutos / maxMinutos) * 100))}%` }} />
              </div>
              <span>{item.rotulo}</span>
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-label="Taxa de acertos da semana">
          <polyline points={pontos} fill="none" vectorEffect="non-scaling-stroke" />
          {dados.map((item, indice) => {
            const x = passo * indice + passo / 2;
            const y = baseY - ((item.percentual / 100) * (baseY - topoY));
            return <circle key={item.chave} cx={x} cy={y} r="4" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
      </div>
      <div className="dashboard-pro-chart-summary">
        <strong>{formatarMinutos(dados.reduce((total, item) => total + item.minutos, 0))}</strong> estudados na semana
        <span>•</span>
        <strong>{dados.length ? Math.round(dados.reduce((total, item) => total + item.percentual, 0) / dados.length) : 0}%</strong> média de acertos
      </div>
    </div>
  );
}

function ProStat({ icon, valor, label, detalhe, tone, onClick }: { icon: string; valor: string; label: string; detalhe: string; tone: "azul" | "roxo" | "verde"; onClick: () => void }) {
  return (
    <article
      className={`dashboard-pro-stat dashboard-pro-stat-art dashboard-pro-stat-clickable ${tone}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="dashboard-pro-stat-icon"><i>{icon}</i></span>
      <div className="dashboard-pro-stat-copy">
        <strong>{valor}</strong>
        <b>{label}</b>
        <small>↗ {detalhe}</small>
      </div>
      <span className="dashboard-pro-stat-arrow">›</span>
    </article>
  );
}

function StreakStat({ sequencia, dados, onClick }: { sequencia: number; dados: DesempenhoDia[]; onClick: () => void }) {
  const hoje = new Date();
  const indiceHoje = hoje.getDay() === 0 ? 6 : hoje.getDay() - 1;

  return (
    <article
      className="dashboard-pro-stat dashboard-pro-stat-art dashboard-pro-stat-clickable laranja dashboard-pro-stat-streak"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="dashboard-pro-streak-top">
        <span className="dashboard-pro-stat-icon"><i>🔥</i></span>

        <div className="dashboard-pro-stat-copy">
          <strong>{sequencia} dias</strong>
          <b>Sequência atual</b>
        </div>
      </div>

      <div className="dashboard-pro-streak-week" aria-label="Dias estudados nesta semana">
        {dados.map((item, indice) => {
          const estudou = item.minutos >= 30;
          const hojeDia = indice === indiceHoje;
          const futuro = indice > indiceHoje;

          return (
            <div
              key={item.chave}
              className={[
                estudou ? "feito" : "",
                hojeDia ? "hoje" : "",
                futuro ? "futuro" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{item.rotulo.toUpperCase()}</span>
              <i>{estudou ? "✓" : ""}</i>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function formatarSegundosDashboard(segundos: number) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return h > 0 ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function obterSaudacaoDashboard() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function formatarDataLongaDashboard(data: Date) {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

type ProximaMissaoCardProps = {
  proxima:
    | ProximaMissaoPlano
    | null;

  onIniciar: () => void;

  onAbrirPlano: () => void;
};

function ProximaMissaoCard({
  proxima,
  onIniciar,
  onAbrirPlano,
}: ProximaMissaoCardProps) {
  return (
    <div className="dashboard-painel dashboard-proxima-missao">
      <h2>
        🎯 Próxima missão
      </h2>

      {proxima ? (
        <>
          <div className="dashboard-missao-local">
            <span>
              Semana{" "}
              {proxima.semana}
            </span>

            <span>
              Dia {proxima.dia}
            </span>

            <span>
              Missão{" "}
              {
                proxima.missao
                  .numero
              }
            </span>
          </div>

          <h3>
            {
              proxima.missao
                .materia
            }
          </h3>

          <p>
            {
              proxima.missao
                .assunto
            }
          </p>

          <div className="dashboard-missao-botoes">
            <button
              type="button"
              className="dashboard-iniciar-missao"
              onClick={onIniciar}
            >
              ▶ Iniciar missão
            </button>

            <button
              type="button"
              className="dashboard-ver-plano"
              onClick={
                onAbrirPlano
              }
            >
              Ver plano
            </button>
          </div>
        </>
      ) : (
        <div className="dashboard-plano-concluido">
          <strong>
            Plano concluído
          </strong>

          <p>
            Todas as missões foram
            realizadas.
          </p>
        </div>
      )}
    </div>
  );
}

function BarraProgresso({
  percentual,
}: {
  percentual: number;
}) {
  return (
    <div className="dashboard-barra">
      <div
        style={{
          width: `${Math.min(
            100,
            Math.max(
              0,
              percentual
            )
          )}%`,
        }}
      />
    </div>
  );
}

function LinhaDiagnostico({
  titulo,
  valor,
  classe = "",
}: {
  titulo: string;
  valor: string;
  classe?: string;
}) {
  return (
    <div className="dashboard-diagnostico-linha">
      <span>
        {titulo}
      </span>

      <strong
        className={classe}
      >
        {valor}
      </strong>
    </div>
  );
}

function calcularConquistasDashboard({
  minutosTotais,
  totalQuestoes,
  totalCertas,
  simulados,
  sequencia,
  assuntosConcluidos,
  assuntosTotais,
}: {
  minutosTotais: number;
  totalQuestoes: number;
  totalCertas: number;
  simulados: number;
  sequencia: number;
  assuntosConcluidos: number;
  assuntosTotais: number;
}) {
  const metas = [
    minutosTotais >= 60,
    minutosTotais >= 600,
    minutosTotais >= 3000,
    totalQuestoes >= 100,
    totalQuestoes >= 500,
    totalQuestoes >= 1000,
    totalCertas >= 500,
    simulados >= 1,
    simulados >= 10,
    sequencia >= 3,
    sequencia >= 7,
    sequencia >= 30,
    assuntosConcluidos >= 10,
    assuntosTotais > 0 &&
      assuntosConcluidos === assuntosTotais,
  ];

  return metas.filter(Boolean).length;
}

function calcularPercentualMeta(
  atual: number,
  meta: number
): number {
  if (meta <= 0) {
    return 100;
  }

  return Math.min(
    100,
    Math.round(
      (atual / meta) *
        100
    )
  );
}

function calcularSequencia(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[],
  revisoes: Revisao[]
): number {
  const MINUTOS_MINIMOS_POR_DIA = 30;

  const minutosPorDia =
    new Map<string, number>();

  sessoes.forEach((sessao) => {
    const dataLocal =
      obterDataLocalSeguro(
        sessao.data
      );

    const minutos =
      Number(sessao.minutos) || 0;

    minutosPorDia.set(
      dataLocal,
      (minutosPorDia.get(
        dataLocal
      ) || 0) + minutos
    );
  });

  questoes.forEach((registro) => {
    const dataLocal =
      obterDataLocalSeguro(
        registro.data
      );

    const minutos =
      Number(registro.minutos) || 0;

    minutosPorDia.set(
      dataLocal,
      (minutosPorDia.get(
        dataLocal
      ) || 0) + minutos
    );
  });

  revisoes.forEach((revisao) => {
    if (
      !revisao.concluida ||
      !revisao.dataConclusao
    ) {
      return;
    }

    const dataLocal =
      obterDataLocalSeguro(
        revisao.dataConclusao
      );

    /*
     * Uma revisão concluída sem tempo
     * informado não cria automaticamente
     * 30 minutos. Ela só reforça um dia
     * que já tenha estudo registrado.
     */
    if (
      !minutosPorDia.has(dataLocal)
    ) {
      minutosPorDia.set(
        dataLocal,
        0
      );
    }
  });

  const diasValidos =
    new Set<string>();

  minutosPorDia.forEach(
    (minutos, data) => {
      if (
        minutos >=
        MINUTOS_MINIMOS_POR_DIA
      ) {
        diasValidos.add(data);
      }
    }
  );

  const hoje = inicioDoDia(
    new Date()
  );

  const chaveHoje =
    obterDataLocal(hoje);

  /*
   * Se hoje ainda não atingiu 30 minutos,
   * verificamos a sequência terminando ontem.
   * Isso evita mostrar zero durante a manhã
   * antes de você estudar.
   */
  const dataInicial =
    diasValidos.has(chaveHoje)
      ? hoje
      : adicionarDias(
          hoje,
          -1
        );

  let sequencia = 0;
  let dataVerificada =
    dataInicial;

  while (
    diasValidos.has(
      obterDataLocal(
        dataVerificada
      )
    )
  ) {
    sequencia += 1;

    dataVerificada =
      adicionarDias(
        dataVerificada,
        -1
      );
  }

  return sequencia;
}

function calcularResumoMaterias(
  questoes: RegistroQuestao[]
) {
  const mapa = new Map<
    string,
    {
      certas: number;
      erradas: number;
    }
  >();

  questoes.forEach(
    (registro) => {
      const atual =
        mapa.get(
          registro.materia
        ) || {
          certas: 0,
          erradas: 0,
        };

      mapa.set(
        registro.materia,
        {
          certas:
            atual.certas +
            registro.certas,

          erradas:
            atual.erradas +
            registro.erradas,
        }
      );
    }
  );

  return Array.from(
    mapa.entries()
  )
    .map(
      ([materia, dados]) => {
        const total =
          dados.certas +
          dados.erradas;

        return {
          materia,

          certas:
            dados.certas,

          erradas:
            dados.erradas,

          percentual:
            total === 0
              ? 0
              : Math.round(
                  (dados.certas /
                    total) *
                    100
                ),
        };
      }
    )
    .sort(
      (a, b) =>
        b.percentual -
        a.percentual
    );
}

function formatarMinutos(
  minutosTotais: number
): string {
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

function formatarData(
  data: string
): string {
  return new Date(
    data
  ).toLocaleDateString(
    "pt-BR"
  );
}

function normalizarTextoDashboard(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function obterDataLocal(
  data = new Date()
): string {
  const ano =
    data.getFullYear();

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    data.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function inicioDoDia(
  data: Date
): Date {
  const copia =
    new Date(data);

  copia.setHours(
    0,
    0,
    0,
    0
  );

  return copia;
}

function obterDataLocalSeguro(
  valor: string
): string {
  /*
   * Datas simples como 2026-07-16
   * são tratadas diretamente para evitar
   * mudança de dia por causa do UTC.
   */
  const dataSimples =
    valor.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (dataSimples) {
    return valor;
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return obterDataLocal();
  }

  return obterDataLocal(data);
}

function adicionarDias(
  data: Date,
  quantidade: number
): Date {
  const copia =
    new Date(data);

  copia.setDate(
    copia.getDate() +
      quantidade
  );

  copia.setHours(
    0,
    0,
    0,
    0
  );

  return copia;
}

function montarConquistasDashboard(d: { minutosTotais:number; totalQuestoes:number; totalCertas:number; simulados:number; sequencia:number; assuntosConcluidos:number; assuntosTotais:number; }) {
  return [
    { icone:"🌱", titulo:"Primeiro passo", descricao:"Estude 60 minutos", desbloqueada:d.minutosTotais>=60 },
    { icone:"📝", titulo:"100 questões", descricao:"Resolva 100 questões", desbloqueada:d.totalQuestoes>=100 },
    { icone:"🎯", titulo:"500 acertos", descricao:"Acerte 500 questões", desbloqueada:d.totalCertas>=500 },
    { icone:"🔥", titulo:"3 dias", descricao:"Mantenha 3 dias de sequência", desbloqueada:d.sequencia>=3 },
    { icone:"⚡", titulo:"7 dias", descricao:"Mantenha 7 dias de sequência", desbloqueada:d.sequencia>=7 },
    { icone:"🏆", titulo:"Primeiro simulado", descricao:"Finalize um simulado", desbloqueada:d.simulados>=1 },
    { icone:"📚", titulo:"10 conteúdos", descricao:"Conclua 10 assuntos", desbloqueada:d.assuntosConcluidos>=10 },
    { icone:"👑", titulo:"Edital dominado", descricao:"Conclua todos os assuntos", desbloqueada:d.assuntosTotais>0 && d.assuntosConcluidos===d.assuntosTotais },
  ];
}

function montarEstatisticasPeriodos(questoes: RegistroQuestao[], sessoes: SessaoEstudo[]) {
  const agora = new Date();
  const inicioHoje = inicioDoDia(agora).getTime();
  const diaSemana = (agora.getDay()+6)%7;
  const inicioSemana = inicioHoje - diaSemana*86400000;
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
  const periodos = [
    { rotulo:"Hoje", inicio:inicioHoje }, { rotulo:"Semana", inicio:inicioSemana },
    { rotulo:"Mês", inicio:inicioMes }, { rotulo:"Total", inicio:0 },
  ];
  return periodos.map((p) => {
    const ss=sessoes.filter(x=>new Date(x.data).getTime()>=p.inicio);
    const qs=questoes.filter(x=>new Date(x.data).getTime()>=p.inicio);
    const minutosSessao=ss.reduce((t,x)=>t+x.minutos,0);
    const minutosQuestao=qs.reduce((t,x)=>{
      const dup=ss.some(se=>se.tipo==="questoes" && se.materia===x.materia && se.assunto===x.assunto && Math.abs(new Date(se.data).getTime()-new Date(x.data).getTime())<5000);
      return t+(dup?0:x.minutos);
    },0);
    return { rotulo:p.rotulo, minutos:minutosSessao+minutosQuestao, questoes:qs.reduce((t,x)=>t+x.certas+x.erradas,0) };
  });
}

function montarDesempenhoSemanal(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[]
): DesempenhoDia[] {
  const hoje = inicioDoDia(new Date());
  const diaSemana = hoje.getDay();
  const deslocamentoSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = adicionarDias(hoje, deslocamentoSegunda);
  const rotulos = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return rotulos.map((rotulo, indice) => {
    const data = adicionarDias(segunda, indice);
    const chave = obterDataLocal(data);
    const sessoesDia = sessoes.filter((sessao) => obterDataLocalSeguro(sessao.data) === chave);
    const questoesDia = questoes.filter((registro) => obterDataLocalSeguro(registro.data) === chave);

    const minutosSessoes = sessoesDia.reduce((total, sessao) => total + (Number(sessao.minutos) || 0), 0);
    const minutosQuestoes = questoesDia.reduce((total, registro) => {
      const duplicado = sessoesDia.some((sessao) =>
        sessao.tipo === "questoes" &&
        sessao.materia === registro.materia &&
        sessao.assunto === registro.assunto &&
        Math.abs(new Date(sessao.data).getTime() - new Date(registro.data).getTime()) < 5000
      );
      return total + (duplicado ? 0 : (Number(registro.minutos) || 0));
    }, 0);

    const certas = questoesDia.reduce((total, registro) => total + registro.certas, 0);
    const totalQuestoesDia = questoesDia.reduce((total, registro) => total + registro.certas + registro.erradas, 0);
    const percentual = totalQuestoesDia === 0 ? 0 : Math.round((certas / totalQuestoesDia) * 100);

    return { chave, rotulo, minutos: minutosSessoes + minutosQuestoes, percentual };
  });
}

function montarRevisoesDashboard(revisoes: Revisao[]) {
  const hoje = inicioDoDia(new Date());
  const amanha = inicioDoDia(adicionarDias(hoje, 1));

  return revisoes
    .filter((revisao) => {
      if (revisao.concluida) return false;
      const data = inicioDoDia(new Date(revisao.dataPrevista));
      return data.getTime() <= amanha.getTime();
    })
    .sort((a, b) => new Date(a.dataPrevista).getTime() - new Date(b.dataPrevista).getTime())
    .slice(0, 3)
    .map((revisao) => ({ revisao, status: obterStatusRevisaoDashboard(revisao.dataPrevista) }));
}

function obterStatusRevisaoDashboard(dataPrevista: string) {
  const data = inicioDoDia(new Date(dataPrevista));
  const hoje = inicioDoDia(new Date());
  const amanha = inicioDoDia(adicionarDias(hoje, 1));

  if (data.getTime() < hoje.getTime()) return { texto: "Atrasada", classe: "atrasada" };
  if (data.getTime() === hoje.getTime()) return { texto: "▣ Hoje", classe: "hoje" };
  if (data.getTime() === amanha.getTime()) return { texto: "▣ Amanhã", classe: "amanha" };
  return { texto: formatarData(dataPrevista), classe: "futura" };
}

function montarRecomendacaoCoach(d:{ revisoesAtrasadas:number; piorMateria?:string; piorPercentual?:number; questoesHoje:number; minutosHoje:number; metaQuestoes:number; metaMinutos:number; }) {
  if(d.revisoesAtrasadas>0) return { titulo:`${d.revisoesAtrasadas} revisão${d.revisoesAtrasadas>1?"ões":""} atrasada${d.revisoesAtrasadas>1?"s":""}`, texto:"Priorize o conteúdo vencido antes de avançar para matéria nova.", rota:"/revisoes" };
  if(d.piorMateria && (d.piorPercentual ?? 100)<70) return { titulo:`Reforce ${d.piorMateria}`, texto:`Seu aproveitamento nessa matéria está em ${d.piorPercentual}%. Um bloco de questões direcionadas tem maior retorno agora.`, rota:"/questoes" };
  if(d.minutosHoje<d.metaMinutos) return { titulo:"Complete sua meta de tempo", texto:`Faltam ${Math.max(0,d.metaMinutos-d.minutosHoje)} minutos para fechar a meta diária.`, rota:"/central-estudos" };
  if(d.questoesHoje<d.metaQuestoes) return { titulo:"Feche a meta de questões", texto:`Faltam ${Math.max(0,d.metaQuestoes-d.questoesHoje)} questões para a meta de hoje.`, rota:"/questoes" };
  return { titulo:"Meta diária em bom ritmo", texto:"Mantenha a consistência e avance para a próxima missão do plano.", rota:"/plano" };
}


// Compatibilidade: componentes/auxiliares mantidos para futuras variações da Dashboard.
void ProximaMissaoCard;
void BarraProgresso;
void calcularConquistasDashboard;
void montarConquistasDashboard;
