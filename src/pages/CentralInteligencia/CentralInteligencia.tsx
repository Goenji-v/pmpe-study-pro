import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import "./CentralInteligencia.css";

import { useApp } from "../../context/AppContext";

import {
  Alerta,
  BarraProgresso,
  DadoSemana,
  LinhaDesempenho,
  ResumoCard,
} from "../../components/inteligencia/ComponentesInteligencia";

import { calcularCentralInteligencia } from "../../services/inteligencia/calcularCentralInteligencia";

import type { MissaoDia } from "../../services/inteligencia/types";

import {
  formatarMinutos,
  formatarTipoMissao,
  gerarMensagemProntidao,
  percentualMeta,
} from "../../services/inteligencia/utils";

export default function CentralInteligencia() {
  const navigate =
    useNavigate();

  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
  } = useApp();

  const dados = useMemo(
    () =>
      calcularCentralInteligencia({
        questoes,
        sessoes,
        revisoes,
        simulados,
        metaMinutos:
          configuracoes.metaMinutosDiaria,
        metaQuestoes:
          configuracoes.metaQuestoesDiaria,
        metaRevisoes:
          configuracoes.metaRevisoesDiaria,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      configuracoes.metaMinutosDiaria,
      configuracoes.metaQuestoesDiaria,
      configuracoes.metaRevisoesDiaria,
    ]
  );

  function abrirMissao(
    missao: MissaoDia
  ) {
    localStorage.setItem(
      "pmpe_missao_inteligente_atual",
      JSON.stringify({
        ...missao,
        criadaEm:
          new Date().toISOString(),
      })
    );

    navigate(missao.rota);
  }

  function iniciarMissaoCompleta() {
    localStorage.setItem(
      "pmpe_missao_inteligente_dia",
      JSON.stringify({
        data:
          new Date().toISOString(),
        missoes: dados.missoes,
        tempoTotal:
          dados.tempoMissao,
      })
    );

    const primeiraMissao =
      dados.missoes[0];

    if (primeiraMissao) {
      abrirMissao(primeiraMissao);
      return;
    }

    navigate("/central-estudos");
  }

  return (
    <section className="inteligencia-container">
      <header className="inteligencia-cabecalho">
        <div>
          <span className="inteligencia-etiqueta">
            ANÁLISE AUTOMÁTICA
          </span>

          <h1>
            🧠 Central de Inteligência
          </h1>

          <p>
            Diagnóstico completo baseado
            nos seus estudos, questões,
            revisões e simulados.
          </p>
        </div>

        <div className="inteligencia-indice">
          <span>
            Índice de prontidão
          </span>

          <strong>
            {dados.indiceProntidao}%
          </strong>

          <small>
            {dados.classificacao}
          </small>
        </div>
      </header>

      <section className="inteligencia-prontidao">
        <div className="inteligencia-prontidao-topo">
          <div>
            <span>
              Preparação estimada
            </span>

            <strong>
              {dados.indiceProntidao}%
            </strong>
          </div>

          <p>
            {gerarMensagemProntidao(
              dados.indiceProntidao
            )}
          </p>
        </div>

        <BarraProgresso
          percentual={
            dados.indiceProntidao
          }
        />
      </section>

      <div className="inteligencia-resumos">
        <ResumoCard
          titulo="Tempo hoje"
          valor={formatarMinutos(
            dados.hoje.minutos
          )}
          detalhe={`${percentualMeta(
            dados.hoje.minutos,
            configuracoes.metaMinutosDiaria
          )}% da meta diária`}
        />

        <ResumoCard
          titulo="Questões hoje"
          valor={String(
            dados.hoje.questoes
          )}
          detalhe={`${dados.hoje.percentual}% de aproveitamento`}
        />

        <ResumoCard
          titulo="Revisões hoje"
          valor={String(
            dados.hoje.revisoesConcluidas
          )}
          detalhe={`${dados.revisoesHoje.length} pendentes para hoje`}
        />

        <ResumoCard
          titulo="Dias ativos"
          valor={String(
            dados.semana.diasAtivos
          )}
          detalhe="Nos últimos 7 dias"
        />
      </div>

      <div className="inteligencia-grid-principal">
        <section className="inteligencia-painel inteligencia-missao">
          <div className="inteligencia-painel-topo">
            <div>
              <span className="inteligencia-etiqueta">
                PLANO AUTOMÁTICO
              </span>

              <h2>
                🎯 Missão de hoje
              </h2>

              <p>
                Tarefas selecionadas com
                base nas suas maiores
                necessidades.
              </p>
            </div>

            <div className="inteligencia-tempo-missao">
              <span>
                Tempo estimado
              </span>

              <strong>
                {formatarMinutos(
                  dados.tempoMissao
                )}
              </strong>
            </div>
          </div>

          {dados.missoes.length === 0 ? (
            <div className="inteligencia-vazio">
              Registre sessões, questões ou
              revisões para gerar uma missão
              inteligente.
            </div>
          ) : (
            <div className="inteligencia-lista-missoes">
              {dados.missoes.map(
                (
                  missao,
                  indice
                ) => (
                  <article
                    key={missao.id}
                    className={`inteligencia-item-missao prioridade-${missao.prioridade}`}
                  >
                    <div className="inteligencia-numero-missao">
                      {indice + 1}
                    </div>

                    <div className="inteligencia-conteudo-missao">
                      <div>
                        <strong>
                          {
                            missao.titulo
                          }
                        </strong>

                        <span>
                          {formatarTipoMissao(
                            missao.tipo
                          )}
                        </span>
                      </div>

                      <p>
                        {
                          missao.descricao
                        }
                      </p>

                      <small>
                        {missao.minutos} min
                        {missao.quantidadeQuestoes
                          ? ` • ${missao.quantidadeQuestoes} questões`
                          : ""}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        abrirMissao(
                          missao
                        )
                      }
                    >
                      Abrir
                    </button>
                  </article>
                )
              )}
            </div>
          )}

          <button
            type="button"
            className="inteligencia-botao-principal"
            onClick={
              iniciarMissaoCompleta
            }
            disabled={
              dados.missoes.length ===
              0
            }
          >
            ▶ Iniciar missão completa
          </button>
        </section>

        <section className="inteligencia-painel">
          <div className="inteligencia-painel-topo">
            <div>
              <h2>
                📅 Resumo semanal
              </h2>

              <p>
                Atividade dos últimos sete
                dias.
              </p>
            </div>
          </div>

          <div className="inteligencia-dados-semana">
            <DadoSemana
              titulo="Tempo"
              valor={formatarMinutos(
                dados.semana.minutos
              )}
            />

            <DadoSemana
              titulo="Questões"
              valor={String(
                dados.semana.questoes
              )}
            />

            <DadoSemana
              titulo="Aproveitamento"
              valor={`${dados.semana.percentual}%`}
            />

            <DadoSemana
              titulo="Sessões"
              valor={String(
                dados.semana.sessoes
              )}
            />
          </div>

          <div className="inteligencia-alertas">
            <h3>
              ⚠ Pontos de atenção
            </h3>

            {dados.revisoesAtrasadas.length >
              0 && (
              <Alerta
                titulo={`${dados.revisoesAtrasadas.length} revisões atrasadas`}
                descricao="Conclua as revisões antes de avançar para novos conteúdos."
                nivel="alto"
              />
            )}

            {dados.piorMateria && (
              <Alerta
                titulo={`Baixo desempenho em ${dados.piorMateria.materia}`}
                descricao={`Aproveitamento atual de ${dados.piorMateria.percentual}%.`}
                nivel={
                  dados.piorMateria
                    .percentual < 60
                    ? "alto"
                    : "medio"
                }
              />
            )}

            {dados.materiaEsquecida && (
              <Alerta
                titulo={`${dados.materiaEsquecida.materia} está esquecida`}
                descricao={`Sem atividade há ${dados.materiaEsquecida.diasSemEstudar} dias.`}
                nivel="medio"
              />
            )}

            {dados.revisoesAtrasadas
              .length === 0 &&
              !dados.piorMateria &&
              !dados.materiaEsquecida && (
                <div className="inteligencia-sem-alertas">
                  Nenhum alerta crítico no
                  momento.
                </div>
              )}
          </div>
        </section>
      </div>

      <div className="inteligencia-grid-duplo">
        <section className="inteligencia-painel">
          <div className="inteligencia-painel-topo">
            <div>
              <h2>
                📊 Desempenho por matéria
              </h2>

              <p>
                Aproveitamento acumulado nas
                questões registradas.
              </p>
            </div>
          </div>

          {dados.materias.length ===
          0 ? (
            <div className="inteligencia-vazio">
              Nenhuma questão registrada.
            </div>
          ) : (
            <div className="inteligencia-lista-desempenho">
              {dados.materias
                .slice(0, 8)
                .map(
                  (materia) => (
                    <LinhaDesempenho
                      key={
                        materia.materia
                      }
                      nome={
                        materia.materia
                      }
                      percentual={
                        materia.percentual
                      }
                      detalhe={`${materia.total} questões • ${formatarMinutos(
                        materia.minutos
                      )}`}
                    />
                  )
                )}
            </div>
          )}
        </section>

        <section className="inteligencia-painel">
          <div className="inteligencia-painel-topo">
            <div>
              <h2>
                🏛 Desempenho por banca
              </h2>

              <p>
                Comparação dos resultados
                por organizadora.
              </p>
            </div>
          </div>

          {dados.bancas.length === 0 ? (
            <div className="inteligencia-vazio">
              Nenhuma banca registrada.
            </div>
          ) : (
            <div className="inteligencia-lista-desempenho">
              {dados.bancas.map(
                (banca) => (
                  <LinhaDesempenho
                    key={banca.banca}
                    nome={banca.banca}
                    percentual={
                      banca.percentual
                    }
                    detalhe={`${banca.total} questões`}
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      <div className="inteligencia-grid-duplo">
        <section className="inteligencia-painel">
          <div className="inteligencia-painel-topo">
            <div>
              <h2>
                ⚠ Assuntos críticos
              </h2>

              <p>
                Assuntos que exigem
                reforço imediato.
              </p>
            </div>
          </div>

          {dados.assuntosCriticos.length ===
          0 ? (
            <div className="inteligencia-vazio">
              Ainda não há dados suficientes
              para identificar assuntos
              críticos.
            </div>
          ) : (
            <div className="inteligencia-assuntos">
              {dados.assuntosCriticos.map(
                (assunto) => (
                  <article
                    key={
                      assunto.chave
                    }
                    className="inteligencia-assunto-card assunto-critico"
                  >
                    <div>
                      <span>
                        {
                          assunto.materia
                        }
                      </span>

                      <strong>
                        {
                          assunto.assunto
                        }
                      </strong>
                    </div>

                    <b>
                      {
                        assunto.percentual
                      }
                      %
                    </b>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="inteligencia-painel">
          <div className="inteligencia-painel-topo">
            <div>
              <h2>
                ✅ Assuntos dominados
              </h2>

              <p>
                Conteúdos com desempenho
                consistente.
              </p>
            </div>
          </div>

          {dados.assuntosDominados.length ===
          0 ? (
            <div className="inteligencia-vazio">
              Resolva mais questões para
              identificar conteúdos
              dominados.
            </div>
          ) : (
            <div className="inteligencia-assuntos">
              {dados.assuntosDominados.map(
                (assunto) => (
                  <article
                    key={
                      assunto.chave
                    }
                    className="inteligencia-assunto-card assunto-dominado"
                  >
                    <div>
                      <span>
                        {
                          assunto.materia
                        }
                      </span>

                      <strong>
                        {
                          assunto.assunto
                        }
                      </strong>
                    </div>

                    <b>
                      {
                        assunto.percentual
                      }
                      %
                    </b>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>

      <section className="inteligencia-painel inteligencia-previsao">
        <div>
          <span className="inteligencia-etiqueta">
            SIMULAÇÃO ESTATÍSTICA
          </span>

          <h2>
            🔮 Se a prova fosse hoje
          </h2>

          <p>
            Estimativa baseada nos seus
            registros atuais. Não representa
            garantia de aprovação.
          </p>
        </div>

        <div className="inteligencia-previsao-dados">
          <div>
            <span>
              Nota estimada
            </span>

            <strong>
              {dados.previsaoNota}/100
            </strong>
          </div>

          <div>
            <span>
              Chance estimada
            </span>

            <strong>
              {dados.chanceAprovacao}%
            </strong>
          </div>

          <div>
            <span>
              Maior risco
            </span>

            <strong>
              {dados.maiorRisco}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="inteligencia-botao-ia"
          onClick={() =>
            navigate("/inteligencia?aba=coach")
          }
        >
          🤖 Abrir análise completa da IA
        </button>
      </section>
    </section>
  );
}
