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
      (
        total: number,
        registro: RegistroQuestao
      ) =>
        total +
        registro.minutos,
      0
    );

  const minutosTotais =
    minutosSessoes +
    minutosQuestoes;

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
    registrosQuestoesHoje.reduce(
      (total, registro) =>
        total +
        registro.minutos,
      0
    );

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
      <RankingResumo />
      <div className="dashboard-cabecalho">
        <div>
        <MissaoDoDia
            atualizacao={atualizacaoPlano}
         />

          <h1>
            Olá,{" "}
            {
              configuracoes.nomeUsuario
            }
          </h1>

          <p>
            Preparação focada na{" "}
            <strong>
              {
                configuracoes.concurso
              }
            </strong>
            .
          </p>
        </div>

        <div className="dashboard-sequencia">
          <span>
            🔥 Sequência
          </span>

          <strong>
            {sequencia}{" "}
            {sequencia === 1
              ? "dia"
              : "dias"}
          </strong>
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