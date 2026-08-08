import {
  useEffect,
  useMemo,
  useState,
} from "react";

import MissaoDoDia from "../../components/MissaoDoDia/MissaoDoDia";
import RankingResumo from "../../components/RankingResumo/RankingResumo";

import { useNavigate } from "react-router-dom";

import "./Dashboard.css";

import { useApp } from "../../context/AppContext";
import {
  listarAssuntosDaMateria,
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";

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

import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types/index";

type ResultadoSimuladoIA = {
  id: string;
  nome: string;
  data: string;
  total: number;
  certas: number;
  erradas: number;
  emBranco?: number;
  percentual: number;
};

const CHAVE_RESULTADOS_IA =
  "pmpe_resultados_simulados_ia";

export default function Dashboard() {
  const navigate = useNavigate();

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


  const [
    atualizacaoSimuladoIA,
    setAtualizacaoSimuladoIA,
  ] = useState(0);

  useEffect(() => {
    function atualizarPlano() {
      setAtualizacaoPlano(
        (valor) => valor + 1
      );

      setAtualizacaoSimuladoIA(
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
      getSemanaAtual(missoesConcluidas);

    return {
      progresso:
        getProgressoPlano(missoesConcluidas),

      concluidas:
        getTotalConcluidas(missoesConcluidas),

      total:
        getTotalMissoes(),

      pendentes:
        getTotalPendentes(missoesConcluidas),

      proxima:
        getProximaMissao(missoesConcluidas),

      semanaAtual,

      progressoSemana:
        getProgressoSemana(
          semanaAtual,
          missoesConcluidas
        ),
    };
  }, [atualizacaoPlano, missoesConcluidas]);

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

  const progressoEdital =
    assuntosTotais === 0
      ? 0
      : Math.round(
          (assuntosConcluidos /
            assuntosTotais) *
            100
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

  const progressoQuestoesHoje =
    calcularPercentualMeta(
      questoesHoje,
      configuracoes.metaQuestoesDiaria
    );

  const progressoTempoHoje =
    calcularPercentualMeta(
      minutosHoje,
      configuracoes.metaMinutosDiaria
    );

  const progressoRevisoesHoje =
    calcularPercentualMeta(
      revisoesConcluidasHoje,
      configuracoes.metaRevisoesDiaria
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

  const ultimoSimuladoManual =
    obterUltimoSimulado(
      simulados
    );

  const ultimoSimuladoIA =
    useMemo(
      () =>
        obterUltimoSimuladoIA(),
      [atualizacaoSimuladoIA]
    );

  const ultimoResultado =
    escolherUltimoResultado(
      ultimoSimuladoManual,
      ultimoSimuladoIA
    );

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

  const semanaAtualDashboard =
    calcularSemanaDashboard(
      questoes,
      sessoes,
      revisoes
    );

  const conquistasDetalhadas = montarConquistasDashboard({
    minutosTotais, totalQuestoes, totalCertas, simulados: simulados.length,
    sequencia, assuntosConcluidos, assuntosTotais,
  });

  const metaGeralHoje = Math.round((
    progressoQuestoesHoje + progressoTempoHoje + progressoRevisoesHoje
  ) / 3);

  const estatisticasPeriodos = montarEstatisticasPeriodos(questoes, sessoes);

  const recomendacaoCoach = montarRecomendacaoCoach({
    revisoesAtrasadas: revisoesAtrasadas.length,
    piorMateria: piorMateria?.materia,
    piorPercentual: piorMateria?.percentual,
    questoesHoje,
    minutosHoje,
    metaQuestoes: configuracoes.metaQuestoesDiaria,
    metaMinutos: configuracoes.metaMinutosDiaria,
  });

  const ultimasSessoes =
    [...sessoes]
      .sort(
        (a, b) =>
          new Date(
            b.data
          ).getTime() -
          new Date(
            a.data
          ).getTime()
      )
      .slice(0, 5);


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
      urlAula: proximo.assunto.aula,
      urlQuestoes: proximo.assunto.questoes,
    };

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify(prefillSessao)
    );

    navigate("/central-estudos");
  }

  function iniciarProximaMissao() {
    if (!dadosPlano.proxima) {
      return;
    }

    const { semana, dia, missao } = dadosPlano.proxima;

    const materia = materias.find(
      (item) => normalizarTextoDashboard(item.nome) === normalizarTextoDashboard(missao.materia)
    );

    let moduloEncontrado:
      | ReturnType<typeof listarModulosDaMateria>[number]
      | undefined;
    let assuntoEncontrado:
      | ReturnType<typeof listarAssuntosDaMateria>[number]
      | undefined;

    if (materia) {
      for (const modulo of listarModulosDaMateria(materia)) {
        const assunto = modulo.assuntos.find(
          (item) => normalizarTextoDashboard(item.nome) === normalizarTextoDashboard(missao.assunto)
        );

        if (assunto) {
          moduloEncontrado = modulo;
          assuntoEncontrado = assunto;
          break;
        }
      }
    }

    const prefillSessao = {
      materia: missao.materia,
      materiaId: materia?.id,
      modulo: moduloEncontrado?.nome,
      moduloId: moduloEncontrado?.id,
      assunto: missao.assunto,
      assuntoId: assuntoEncontrado?.id,
      tipo:
        missao.tipo === "revisao"
          ? "revisao"
          : missao.tipo === "questoes"
            ? "questoes"
            : "aula",
      objetivo: `Semana ${semana} — Dia ${dia} — Missão ${missao.numero}`,
      missaoId: missao.id,
      semana,
      dia,
      urlAula: missao.urlAula,
      urlQuestoes: missao.urlQuestoes,
    };

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify(prefillSessao)
    );

    navigate("/central-estudos");
  }

  return (
    <section className="dashboard-container">
      <section className="dashboard-player">
        <div className="dashboard-player-identidade">
          <div className="dashboard-player-avatar">
            {(configuracoes.nomeUsuario || "U")
              .trim()
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="dashboard-player-saudacao">
              Olá, {configuracoes.nomeUsuario}
            </span>

            <strong>
              Nível {gamificacao.nivel} · {gamificacao.tituloNivel}
            </strong>

            <div className="dashboard-player-xp">
              <div>
                <span>XP</span>
                <b>
                  {xpNoNivel} / {xpParaProximoNivel}
                </b>
              </div>

              <div className="dashboard-player-xp-barra">
                <div style={{ width: `${progressoNivel}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-player-indicadores">
          <button
            type="button"
            onClick={() => navigate("/ranking")}
          >
            <span>🏆</span>
            <strong>{conquistas}</strong>
            <small>Conquistas</small>
          </button>

          <div>
            <span>🪙</span>
            <strong>{ouro}</strong>
            <small>Ouro</small>
          </div>

          <div>
            <span>🔥</span>
            <strong>{sequencia}</strong>
            <small>dias</small>
          </div>
        </div>
      </section>

      <section className="dashboard-hero-grid">
        <div className="dashboard-hero-progresso">
          <div className="dashboard-hero-topo">
            <div>
              <span>PROGRESSO DO PLANO</span>
              <h1>{dadosPlano.progresso}% concluído</h1>
              <p>
                {dadosPlano.concluidas} de {dadosPlano.total} missões finalizadas
              </p>
            </div>

            <strong>{dadosPlano.progresso}%</strong>
          </div>

          <div className="dashboard-hero-barra">
            <div style={{ width: `${dadosPlano.progresso}%` }} />
          </div>

          <div className="dashboard-hero-meta">
            <span>
              Semana {dadosPlano.semanaAtual} de 8
            </span>
            <span>
              {dadosPlano.pendentes} missões pendentes
            </span>
          </div>
        </div>

        <div className="dashboard-semana-card">
          <div className="dashboard-semana-titulo">
            <div>
              <span>SEQUÊNCIA</span>
              <strong>{sequencia} dias</strong>
            </div>
            <span className="dashboard-semana-fogo">🔥</span>
          </div>

          <div className="dashboard-semana-dias">
            {semanaAtualDashboard.map((dia) => (
              <div
                key={dia.chave}
                className={[
                  "dashboard-semana-dia",
                  dia.estudou ? "feito" : "",
                  dia.hoje ? "hoje" : "",
                  dia.futuro ? "futuro" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>{dia.rotulo}</span>
                <strong>
                  {dia.estudou
                    ? "✓"
                    : dia.hoje
                      ? "•"
                      : dia.futuro
                        ? "○"
                        : "–"}
                </strong>
                <small>{dia.numero}</small>
              </div>
            ))}
          </div>

          <p>
            {sequencia > 0
              ? "Mantenha sua sequência estudando pelo menos 30 minutos por dia."
              : "Estude 30 minutos hoje para iniciar sua sequência."}
          </p>
        </div>
      </section>

      <RankingResumo />

      <section className="dashboard-v22-grid">
        <article className="dashboard-v22-card dashboard-meta-premium">
          <div className="dashboard-v22-topo">
            <div><span>META DO DIA</span><h2>{metaGeralHoje}% concluída</h2></div>
            <strong>{formatarMinutos(minutosHoje)}</strong>
          </div>
          <div className="dashboard-v22-progress"><div style={{ width: `${metaGeralHoje}%` }} /></div>
          <div className="dashboard-v22-metas">
            <span>⏱ {minutosHoje}/{configuracoes.metaMinutosDiaria} min</span>
            <span>📝 {questoesHoje}/{configuracoes.metaQuestoesDiaria} questões</span>
            <span>🔁 {revisoesConcluidasHoje}/{configuracoes.metaRevisoesDiaria} revisões</span>
          </div>
        </article>

        <article className="dashboard-v22-card dashboard-coach-premium">
          <div className="dashboard-v22-topo">
            <div><span>IA COACH</span><h2>{recomendacaoCoach.titulo}</h2></div><b>🧠</b>
          </div>
          <p>{recomendacaoCoach.texto}</p>
          <button type="button" onClick={() => navigate(recomendacaoCoach.rota)}>Começar agora →</button>
        </article>
      </section>

      <section className="dashboard-v22-card dashboard-estatisticas-periodos">
        <div className="dashboard-v22-topo"><div><span>DESEMPENHO</span><h2>Seu ritmo de estudo</h2></div></div>
        <div className="dashboard-periodos-grid">
          {estatisticasPeriodos.map((periodo) => (
            <div key={periodo.rotulo}>
              <span>{periodo.rotulo}</span>
              <strong>{formatarMinutos(periodo.minutos)}</strong>
              <small>{periodo.questoes} questões</small>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-v22-card dashboard-conquistas-premium">
        <div className="dashboard-v22-topo">
          <div><span>CONQUISTAS</span><h2>{conquistasDetalhadas.filter((item) => item.desbloqueada).length} desbloqueadas</h2></div>
          <strong>{conquistasDetalhadas.length} desafios</strong>
        </div>
        <div className="dashboard-conquistas-grid">
          {conquistasDetalhadas.slice(0, 8).map((item) => (
            <div key={item.titulo} className={item.desbloqueada ? "desbloqueada" : "bloqueada"}>
              <b>{item.icone}</b><div><strong>{item.titulo}</strong><small>{item.descricao}</small></div>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-cabecalho dashboard-cabecalho-compacto">
        <div>
          <MissaoDoDia
            atualizacao={atualizacaoPlano}
          />

          <p>
            Preparação focada na{" "}
            <strong>{configuracoes.concurso}</strong>.
          </p>
        </div>
      </div>

      {revisoesAtrasadas.length >
        0 && (
        <div className="dashboard-alerta">
          <strong>
            ⚠ Você possui{" "}
            {
              revisoesAtrasadas.length
            }{" "}
            revisão
            {revisoesAtrasadas.length >
            1
              ? "ões"
              : ""}{" "}
            atrasada
            {revisoesAtrasadas.length >
            1
              ? "s"
              : ""}
            .
          </strong>

          <p>
            Priorize as revisões
            vencidas antes de avançar
            para novos conteúdos.
          </p>
        </div>
      )}

      <div className="dashboard-cards">
        <ResumoCard
          icone="📝"
          titulo="Questões"
          valor={totalQuestoes}
          detalhe={`${totalCertas} acertos`}
        />

        <ResumoCard
          icone="🎯"
          titulo="Aproveitamento"
          valor={`${aproveitamento}%`}
          detalhe="Desempenho geral"
        />

        <ResumoCard
          icone="⏱"
          titulo="Tempo estudado"
          valor={formatarMinutos(
            minutosTotais
          )}
          detalhe={`${sessoes.length} sessões`}
        />

        <ResumoCard
          icone="📚"
          titulo="Progresso do edital"
          valor={`${progressoEdital}%`}
          detalhe={`${assuntosConcluidos}/${assuntosTotais} assuntos`}
        />

        <ResumoCard
          icone="✅"
          titulo="Missões concluídas"
          valor={
            dadosPlano.concluidas
          }
          detalhe={`${dadosPlano.pendentes} pendentes`}
        />

        <ResumoCard
          icone="📅"
          titulo="Progresso do plano"
          valor={`${dadosPlano.progresso}%`}
          detalhe={`${dadosPlano.total} missões`}
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-painel dashboard-plano">
          <div className="dashboard-painel-topo">
            <div>
              <h2>
                📅 Plano Tático PMPE
              </h2>

              <p>
                Semana{" "}
                {
                  dadosPlano.semanaAtual
                }{" "}
                de 8
              </p>
            </div>

            <strong className="dashboard-plano-percentual">
              {
                dadosPlano.progresso
              }
              %
            </strong>
          </div>

          <BarraProgresso
            percentual={
              dadosPlano.progresso
            }
          />

          <div className="dashboard-plano-dados">
            <div>
              <span>
                Concluídas
              </span>

              <strong>
                {
                  dadosPlano.concluidas
                }
              </strong>
            </div>

            <div>
              <span>
                Pendentes
              </span>

              <strong>
                {
                  dadosPlano.pendentes
                }
              </strong>
            </div>

            <div>
              <span>
                Semana atual
              </span>

              <strong>
                {
                  dadosPlano
                    .progressoSemana
                }
                %
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="dashboard-abrir-plano"
            onClick={() =>
              navigate("/plano")
            }
          >
            Abrir Plano de Estudos
          </button>
        </div>

        <ProximaMissaoCard
          proxima={
            dadosPlano.proxima
          }
          onIniciar={
            iniciarProximaMissao
          }
          onAbrirPlano={() =>
            navigate("/plano")
          }
        />
      </div>

      {trilhaPortugues && (
        <div className="dashboard-painel dashboard-portugues-trilha">
          <div className="dashboard-painel-topo">
            <div>
              <h2>📘 Trilha de Português</h2>
              <p>Curso oficial organizado por módulos e aulas.</p>
            </div>
            <strong className="dashboard-portugues-percentual">{trilhaPortugues.percentual}%</strong>
          </div>

          <div className="dashboard-barra">
            <div style={{ width: `${trilhaPortugues.percentual}%` }} />
          </div>

          <div className="dashboard-portugues-dados">
            <span>
              {trilhaPortugues.concluidos} de {trilhaPortugues.total} aulas concluídas
              {trilhaPortugues.importados > 0 ? ` · ${trilhaPortugues.importados} importadas` : ""}
            </span>
            {trilhaPortugues.proximo ? (
              <>
                <small>{trilhaPortugues.proximo.modulo.nome}</small>
                <strong>{trilhaPortugues.proximo.assunto.nome}</strong>
                <div className="dashboard-missao-botoes">
                  <button type="button" className="dashboard-iniciar-missao" onClick={iniciarProximaAulaPortugues}>
                    ▶ Continuar Português
                  </button>
                  <button type="button" className="dashboard-ver-plano" onClick={() => navigate("/estudos")}>
                    Ver todos os módulos
                  </button>
                </div>
              </>
            ) : (
              <strong>Trilha de Português concluída.</strong>
            )}
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-painel">
          <div className="dashboard-painel-topo">
            <div>
              <h2>
                🎯 Metas de hoje
              </h2>

              <p>
                Acompanhamento das metas
                configuradas.
              </p>
            </div>
          </div>

          <div className="dashboard-metas">
            <MetaItem
              titulo="Questões"
              atual={
                questoesHoje
              }
              meta={
                configuracoes.metaQuestoesDiaria
              }
              percentual={
                progressoQuestoesHoje
              }
              unidade=""
            />

            <MetaItem
              titulo="Tempo"
              atual={
                minutosHoje
              }
              meta={
                configuracoes.metaMinutosDiaria
              }
              percentual={
                progressoTempoHoje
              }
              unidade=" min"
            />

            <MetaItem
              titulo="Revisões"
              atual={
                revisoesConcluidasHoje
              }
              meta={
                configuracoes.metaRevisoesDiaria
              }
              percentual={
                progressoRevisoesHoje
              }
              unidade=""
            />
          </div>
        </div>

        <div className="dashboard-painel">
          <h2>
            📊 Diagnóstico
          </h2>

          <LinhaDiagnostico
            titulo="Melhor matéria"
            valor={
              melhorMateria
                ? `${melhorMateria.materia} — ${melhorMateria.percentual}%`
                : "Sem dados"
            }
            classe="dashboard-positivo"
          />

          <LinhaDiagnostico
            titulo="Matéria mais fraca"
            valor={
              piorMateria
                ? `${piorMateria.materia} — ${piorMateria.percentual}%`
                : "Sem dados"
            }
            classe="dashboard-negativo"
          />

          <LinhaDiagnostico
            titulo="Questões hoje"
            valor={String(
              questoesHoje
            )}
          />

          <LinhaDiagnostico
            titulo="Tempo hoje"
            valor={formatarMinutos(
              minutosHoje
            )}
          />

          <LinhaDiagnostico
            titulo="Revisões hoje"
            valor={String(
              revisoesConcluidasHoje
            )}
          />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-painel">
          <h2>
            🎯 Último simulado
          </h2>

          {ultimoResultado ? (
            <div className="dashboard-simulado">
              <div>
                <div className="dashboard-simulado-titulo">
                  <strong>
                    {ultimoResultado.nome}
                  </strong>

                  <span className="dashboard-simulado-origem">
                    {ultimoResultado.origem}
                  </span>
                </div>

                <p>
                  {ultimoResultado.detalhe}
                  {" • "}
                  {formatarData(
                    ultimoResultado.data
                  )}
                </p>
              </div>

              <div className="dashboard-simulado-resultado">
                <strong>
                  {ultimoResultado.percentual}%
                </strong>

                <span>
                  {ultimoResultado.certas} certas
                  {" • "}
                  {ultimoResultado.erradas} erradas
                  {ultimoResultado.emBranco > 0
                    ? ` • ${ultimoResultado.emBranco} em branco`
                    : ""}
                </span>
              </div>
            </div>
          ) : (
            <p className="dashboard-vazio">
              Nenhum simulado registrado.
            </p>
          )}
        </div>

        <div className="dashboard-painel">
          <h2>
            🕘 Sessões recentes
          </h2>

          {ultimasSessoes.length ===
          0 ? (
            <p className="dashboard-vazio">
              Nenhuma sessão
              registrada.
            </p>
          ) : (
            <div className="dashboard-sessoes">
              {ultimasSessoes.map(
                (sessao) => (
                  <article
                    key={sessao.id}
                    className="dashboard-sessao"
                  >
                    <div>
                      <strong>
                        {
                          sessao.materia
                        }
                      </strong>

                      <p>
                        {
                          sessao.assunto
                        }
                      </p>
                    </div>

                    <div>
                      <strong>
                        {formatarMinutos(
                          sessao.minutos
                        )}
                      </strong>

                      <span>
                        {formatarData(
                          sessao.data
                        )}
                      </span>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </div>


    </section>
  );
}

type ResumoCardProps = {
  icone: string;
  titulo: string;
  valor: string | number;
  detalhe: string;
};

function ResumoCard({
  icone,
  titulo,
  valor,
  detalhe,
}: ResumoCardProps) {
  return (
    <article className="dashboard-resumo-card">
      <div className="dashboard-resumo-icone">
        {icone}
      </div>

      <div>
        <span>
          {titulo}
        </span>

        <strong>
          {valor}
        </strong>

        <small>
          {detalhe}
        </small>
      </div>
    </article>
  );
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

type MetaItemProps = {
  titulo: string;
  atual: number;
  meta: number;
  percentual: number;
  unidade: string;
};

function MetaItem({
  titulo,
  atual,
  meta,
  percentual,
  unidade,
}: MetaItemProps) {
  return (
    <div className="dashboard-meta-item">
      <div>
        <span>
          {titulo}
        </span>

        <strong>
          {atual}
          {unidade} / {meta}
          {unidade}
        </strong>
      </div>

      <BarraProgresso
        percentual={
          percentual
        }
      />

      <small>
        {percentual}% concluído
      </small>
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

function calcularSemanaDashboard(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[],
  revisoes: Revisao[]
) {
  const minutosPorDia =
    new Map<string, number>();

  const adicionarMinutos = (
    data: string,
    minutos: number
  ) => {
    const chave =
      obterDataLocalSeguro(data);

    minutosPorDia.set(
      chave,
      (minutosPorDia.get(chave) || 0) +
        (Number(minutos) || 0)
    );
  };

  sessoes.forEach((sessao) =>
    adicionarMinutos(
      sessao.data,
      sessao.minutos
    )
  );

  questoes.forEach((registro) =>
    adicionarMinutos(
      registro.data,
      registro.minutos
    )
  );

  revisoes.forEach((revisao) => {
    if (
      revisao.concluida &&
      revisao.dataConclusao
    ) {
      const chave =
        obterDataLocalSeguro(
          revisao.dataConclusao
        );

      if (!minutosPorDia.has(chave)) {
        minutosPorDia.set(chave, 0);
      }
    }
  });

  const hoje = inicioDoDia(new Date());
  const diaSemana = hoje.getDay();
  const deslocamentoSegunda =
    diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda =
    adicionarDias(
      hoje,
      deslocamentoSegunda
    );

  const rotulos = [
    "S",
    "T",
    "Q",
    "Q",
    "S",
    "S",
    "D",
  ];

  return Array.from(
    { length: 7 },
    (_, indice) => {
      const data =
        adicionarDias(
          segunda,
          indice
        );

      const chave =
        obterDataLocal(data);

      const minutos =
        minutosPorDia.get(chave) || 0;

      return {
        chave,
        rotulo: rotulos[indice],
        numero: data.getDate(),
        estudou: minutos >= 30,
        hoje:
          chave === obterDataLocal(hoje),
        futuro:
          data.getTime() > hoje.getTime(),
      };
    }
  );
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

function obterUltimoSimulado(
  simulados: Simulado[]
): Simulado | null {
  if (
    simulados.length === 0
  ) {
    return null;
  }

  return [...simulados].sort(
    (a, b) =>
      new Date(
        b.data
      ).getTime() -
      new Date(
        a.data
      ).getTime()
  )[0];
}

function calcularAproveitamentoSimulado(
  simulado: Simulado
): number {
  const total =
    simulado.certas +
    simulado.erradas;

  if (total === 0) {
    return 0;
  }

  return Math.round(
    (simulado.certas /
      total) *
      100
  );
}

function obterUltimoSimuladoIA():
  ResultadoSimuladoIA | null {
  const salvo =
    localStorage.getItem(
      CHAVE_RESULTADOS_IA
    );

  if (!salvo) {
    return null;
  }

  try {
    const valor: unknown =
      JSON.parse(salvo);

    if (!Array.isArray(valor)) {
      return null;
    }

    const resultados =
      valor as ResultadoSimuladoIA[];

    if (
      resultados.length === 0
    ) {
      return null;
    }

    return [...resultados].sort(
      (a, b) =>
        new Date(
          b.data
        ).getTime() -
        new Date(
          a.data
        ).getTime()
    )[0];
  } catch {
    return null;
  }
}

function escolherUltimoResultado(
  manual: Simulado | null,
  ia: ResultadoSimuladoIA | null
) {
  if (!manual && !ia) {
    return null;
  }

  if (
    ia &&
    (
      !manual ||
      new Date(
        ia.data
      ).getTime() >
        new Date(
          manual.data
        ).getTime()
    )
  ) {
    return {
      nome:
        ia.nome ||
        "Simulado gerado por IA",

      data: ia.data,
      detalhe: "Gemini",
      origem: "Simulado IA",

      percentual:
        Number.isFinite(
          ia.percentual
        )
          ? ia.percentual
          : calcularPercentualSimulado(
              ia.certas,
              ia.erradas +
                (ia.emBranco || 0)
            ),

      certas: ia.certas,
      erradas: ia.erradas,
      emBranco:
        ia.emBranco || 0,
    };
  }

  if (!manual) {
    return null;
  }

  return {
    nome: manual.nome,
    data: manual.data,
    detalhe: manual.banca,
    origem: "Simulado manual",

    percentual:
      calcularAproveitamentoSimulado(
        manual
      ),

    certas: manual.certas,
    erradas: manual.erradas,
    emBranco: 0,
  };
}

function calcularPercentualSimulado(
  certas: number,
  incorretas: number
) {
  const total =
    certas +
    incorretas;

  if (total === 0) {
    return 0;
  }

  return Math.round(
    (certas / total) *
      100
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

function montarRecomendacaoCoach(d:{ revisoesAtrasadas:number; piorMateria?:string; piorPercentual?:number; questoesHoje:number; minutosHoje:number; metaQuestoes:number; metaMinutos:number; }) {
  if(d.revisoesAtrasadas>0) return { titulo:`${d.revisoesAtrasadas} revisão${d.revisoesAtrasadas>1?"ões":""} atrasada${d.revisoesAtrasadas>1?"s":""}`, texto:"Priorize o conteúdo vencido antes de avançar para matéria nova.", rota:"/revisoes" };
  if(d.piorMateria && (d.piorPercentual ?? 100)<70) return { titulo:`Reforce ${d.piorMateria}`, texto:`Seu aproveitamento nessa matéria está em ${d.piorPercentual}%. Um bloco de questões direcionadas tem maior retorno agora.`, rota:"/questoes" };
  if(d.minutosHoje<d.metaMinutos) return { titulo:"Complete sua meta de tempo", texto:`Faltam ${Math.max(0,d.metaMinutos-d.minutosHoje)} minutos para fechar a meta diária.`, rota:"/central-estudos" };
  if(d.questoesHoje<d.metaQuestoes) return { titulo:"Feche a meta de questões", texto:`Faltam ${Math.max(0,d.metaQuestoes-d.questoesHoje)} questões para a meta de hoje.`, rota:"/questoes" };
  return { titulo:"Meta diária em bom ritmo", texto:"Mantenha a consistência e avance para a próxima missão do plano.", rota:"/plano" };
}
