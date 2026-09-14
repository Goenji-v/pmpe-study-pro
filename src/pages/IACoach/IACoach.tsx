import { armazenamentoLocalDaConta as localStorage } from "../../services/armazenamentoConta";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./IACoach.css";
import { useApp } from "../../context/AppContext";
import {
  carregarUltimoDiagnosticoComMeta,
  gerarDiagnosticoCoach,
  type AcaoCoachIA,
  type DiagnosticoCoachSalvo,
} from "../../services/iaCoachService";
import { calcularCentralInteligencia } from "../../services/inteligencia/calcularCentralInteligencia";
import { calcularInsightsCoach } from "../../services/inteligencia/calcularInsightsCoach";
import { resumirSimulado } from "../../utils/metricasConsolidadas";

const CHAVE_FILTRO_MATERIAIS = "pmpe_filtro_materiais";

export default function IACoach() {
  const navigate = useNavigate();
  const { questoes, sessoes, revisoes, simulados, configuracoes } = useApp();
  const [diagnosticoSalvo, setDiagnosticoSalvo] = useState<DiagnosticoCoachSalvo | null>(
    carregarUltimoDiagnosticoComMeta
  );
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroIA, setErroIA] = useState("");

  const dados = useMemo(
    () =>
      calcularCentralInteligencia({
        questoes,
        sessoes,
        revisoes,
        simulados,
        metaMinutos: configuracoes.metaMinutosDiaria,
        metaQuestoes: configuracoes.metaQuestoesDiaria,
        metaRevisoes: configuracoes.metaRevisoesDiaria,
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

  const insights = useMemo(
    () =>
      calcularInsightsCoach({
        questoes,
        sessoes,
        revisoes,
        simulados,
        metaMinutosDia: configuracoes.metaMinutosDiaria,
        metaQuestoesDia: configuracoes.metaQuestoesDiaria,
        metaRevisoesDia: configuracoes.metaRevisoesDiaria,
        revisoesAtrasadas: dados.revisoesAtrasadas.length,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      configuracoes.metaMinutosDiaria,
      configuracoes.metaQuestoesDiaria,
      configuracoes.metaRevisoesDiaria,
      dados.revisoesAtrasadas.length,
    ]
  );

  const aproveitamentoSimulados = useMemo(() => {
    let certas = 0;
    let validas = 0;
    simulados.forEach((simulado) => {
      const resumo = resumirSimulado(simulado);
      certas += resumo.certas;
      validas += resumo.validas;
    });
    return validas === 0 ? 0 : Math.round((certas / validas) * 100);
  }, [simulados]);

  const diagnosticoIA = diagnosticoSalvo?.diagnostico ?? null;
  const analiseDesatualizada = useMemo(() => {
    if (!diagnosticoSalvo || !insights.atividadeMaisRecenteEm) return false;
    const gerado = new Date(diagnosticoSalvo.geradoEm).getTime();
    const atividade = new Date(insights.atividadeMaisRecenteEm).getTime();
    return Number.isFinite(gerado) && Number.isFinite(atividade) && atividade > gerado;
  }, [diagnosticoSalvo, insights.atividadeMaisRecenteEm]);

  async function gerarAnaliseIA() {
    if (gerandoIA) return;

    try {
      setGerandoIA(true);
      setErroIA("");

      const resultado = await gerarDiagnosticoCoach({
        nomeUsuario: configuracoes.nomeUsuario,
        concurso: configuracoes.concurso,
        banca: configuracoes.bancaPadrao,
        indiceGeral: dados.indiceProntidao,
        aproveitamentoGeral: dados.total.percentual,
        minutosSemana: dados.semana.minutos,
        diasAtivosSemana: dados.semana.diasAtivos,
        revisoesAtrasadas: dados.revisoesAtrasadas.length,
        revisoesPendentes: revisoes.filter((item) => !item.concluida).length,
        totalQuestoes: dados.total.questoes,
        simuladosRealizados: dados.total.simulados,
        aproveitamentoSimulados,
        materias: dados.materias.map((item) => ({
          materia: item.materia,
          percentual: item.percentual,
          certas: item.certas,
          erradas: item.erradas,
          total: item.total,
          minutos: item.minutos,
          diasSemEstudar: item.diasSemEstudar,
        })),
        assuntosCriticos: dados.assuntosCriticos.map((item) => ({
          materia: item.materia,
          assunto: item.assunto,
          percentual: item.percentual,
          erros: item.erradas,
          total: item.total,
        })),
        metas: {
          minutosDia: configuracoes.metaMinutosDiaria,
          questoesDia: configuracoes.metaQuestoesDiaria,
          revisoesDia: configuracoes.metaRevisoesDiaria,
        },
      });

      setDiagnosticoSalvo({
        geradoEm: new Date().toISOString(),
        diagnostico: resultado,
      });
    } catch (erro) {
      setErroIA(
        erro instanceof Error ? erro.message : "Erro ao gerar análise com IA."
      );
    } finally {
      setGerandoIA(false);
    }
  }

  function abrirMateriais(materia: string, assunto = "") {
    localStorage.setItem(
      CHAVE_FILTRO_MATERIAIS,
      JSON.stringify({ materia, assunto })
    );
    navigate("/materiais");
  }

  function executarAcaoIA(acao: AcaoCoachIA) {
    if (acao.tipo === "revisao") {
      navigate("/revisoes");
      return;
    }
    if (acao.tipo === "questoes" || acao.tipo === "simulado") {
      navigate("/gerar-simulado-ia");
      return;
    }
    if (acao.materia) {
      abrirMateriais(acao.materia, acao.assunto ?? "");
      return;
    }
    navigate("/materiais");
  }

  const assuntoCritico = dados.assuntosCriticos[0] ?? null;
  const materiaRisco = dados.piorMateria ?? dados.materiaEsquecida ?? null;

  return (
    <section className="coach-container">
      <div className="coach-cabecalho">
        <div>
          <span className="coach-etiqueta">INTELIGÊNCIA DE ESTUDO</span>
          <h1>🤖 Coach IA</h1>
          <p>
            Cruza questões, tempo, simulados e revisões para mostrar evolução,
            risco e a próxima ação mais útil.
          </p>
        </div>
        <div className="coach-pontuacao">
          <span>Índice de prontidão</span>
          <strong>{dados.indiceProntidao}%</strong>
          <small>{dados.classificacao}</small>
        </div>
      </div>

      <section className="coach-leitura">
        <div className="coach-leitura-principal">
          <span className="coach-etiqueta">LEITURA DO MOMENTO</span>
          <strong>{insights.leituraMomento}</strong>
        </div>
        <div className={`coach-confianca coach-confianca-${insights.confianca}`}>
          <span>Confiança dos dados</span>
          <strong>{formatarConfianca(insights.confianca)}</strong>
          <small>{insights.confiancaDescricao}</small>
        </div>
      </section>

      <section className="coach-painel coach-painel-evolucao">
        <div className="coach-painel-topo coach-painel-topo-acoes">
          <div>
            <h2>📈 Evolução recente</h2>
            <p>Últimos 7 dias comparados aos 7 dias anteriores.</p>
          </div>
          <button type="button" className="coach-botao-secundario" onClick={() => navigate("/desempenho")}>
            Ver desempenho completo
          </button>
        </div>

        <div className="coach-comparativos">
          <ComparativoCard
            titulo="Tempo estudado"
            valor={formatarMinutos(insights.tempo.atual)}
            anterior={formatarMinutos(insights.tempo.anterior)}
            variacao={formatarVariacao(insights.tempo.variacaoPercentual)}
            tendencia={classeVariacao(insights.tempo.variacaoPercentual)}
          />
          <ComparativoCard
            titulo="Questões"
            valor={String(insights.questoes.atual)}
            anterior={String(insights.questoes.anterior)}
            variacao={formatarVariacao(insights.questoes.variacaoPercentual)}
            tendencia={classeVariacao(insights.questoes.variacaoPercentual)}
          />
          <ComparativoCard
            titulo="Aproveitamento"
            valor={`${insights.aproveitamento.atual}%`}
            anterior={`${insights.aproveitamento.anterior}%`}
            variacao={formatarDiferencaPontos(insights.aproveitamento.diferenca)}
            tendencia={classeNumero(insights.aproveitamento.diferenca)}
          />
          <ComparativoCard
            titulo="Dias ativos"
            valor={`${insights.diasAtivos.atual}/7`}
            anterior={`${insights.diasAtivos.anterior}/7`}
            variacao={formatarDiferencaDias(insights.diasAtivos.diferenca)}
            tendencia={classeNumero(insights.diasAtivos.diferenca)}
          />
        </div>
      </section>

      <section className="coach-painel coach-metas-painel">
        <div className="coach-painel-topo">
          <div>
            <h2>🎯 Meta semanal</h2>
            <p>Progresso estimado a partir das suas metas diárias em uma semana de 6 dias.</p>
          </div>
        </div>
        <div className="coach-metas-grid">
          <MetaCard
            titulo="Tempo"
            atual={formatarMinutos(insights.metas.minutos.atual)}
            meta={formatarMinutos(insights.metas.minutos.meta)}
            percentual={insights.metas.minutos.percentual}
          />
          <MetaCard
            titulo="Questões"
            atual={String(insights.metas.questoes.atual)}
            meta={String(insights.metas.questoes.meta)}
            percentual={insights.metas.questoes.percentual}
          />
          <MetaCard
            titulo="Revisões"
            atual={String(insights.metas.revisoes.atual)}
            meta={String(insights.metas.revisoes.meta)}
            percentual={insights.metas.revisoes.percentual}
          />
        </div>
      </section>

      <section className="coach-painel coach-painel-ia">
        <div className="coach-ia-topo">
          <div>
            <span className="coach-etiqueta">INTERPRETAÇÃO COM IA</span>
            <h2>Diagnóstico estratégico</h2>
            <p>
              A IA recebe os dados consolidados do Study Pro e transforma os números em uma sequência executável.
            </p>
            {diagnosticoSalvo && (
              <div className={`coach-status-analise ${analiseDesatualizada ? "desatualizada" : "atualizada"}`}>
                <span>
                  {analiseDesatualizada
                    ? "Há atividades novas desde esta análise."
                    : "Análise alinhada aos dados registrados."}
                </span>
                <small>{formatarDataAnalise(diagnosticoSalvo.geradoEm)}</small>
              </div>
            )}
          </div>
          <button
            type="button"
            className="coach-botao-primario"
            onClick={gerarAnaliseIA}
            disabled={gerandoIA}
          >
            {gerandoIA
              ? "Analisando..."
              : diagnosticoIA
                ? "Atualizar análise"
                : "Gerar análise com IA"}
          </button>
        </div>

        {erroIA && <div className="coach-ia-erro">{erroIA}</div>}

        {diagnosticoIA ? (
          <div className="coach-ia-conteudo">
            <div className="coach-ia-resumo">
              <div><span>Resumo</span><p>{diagnosticoIA.resumo}</p></div>
              <div><span>Alerta principal</span><p>{diagnosticoIA.alertaPrincipal}</p></div>
              <div><span>Foco do dia</span><p>{diagnosticoIA.focoDoDia}</p></div>
              <div><span>Tempo sugerido</span><strong>{formatarMinutos(diagnosticoIA.tempoTotalMinutos)}</strong></div>
            </div>

            <div className="coach-ia-acoes">
              {diagnosticoIA.acoes.map((acao) => (
                <article
                  key={`${acao.ordem}-${acao.titulo}`}
                  className={`coach-ia-acao coach-${acao.prioridade}`}
                >
                  <div className="coach-recomendacao-numero">{acao.ordem}</div>
                  <div className="coach-ia-acao-corpo">
                    <div className="coach-ia-acao-topo">
                      <strong>{acao.titulo}</strong>
                      <span>{formatarTipoAcao(acao.tipo)}</span>
                    </div>
                    <p>{acao.motivo}</p>
                    <div className="coach-ia-acao-rodape">
                      <small>
                        {acao.duracaoMinutos} min
                        {acao.quantidadeQuestoes > 0 ? ` • ${acao.quantidadeQuestoes} questões` : ""}
                        {acao.materia ? ` • ${acao.materia}` : ""}
                        {acao.assunto ? ` — ${acao.assunto}` : ""}
                      </small>
                      <button type="button" onClick={() => executarAcaoIA(acao)}>
                        Executar agora
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="coach-ia-final">{diagnosticoIA.mensagemFinal}</div>
          </div>
        ) : (
          <div className="coach-vazio">
            Gere a primeira análise para transformar seus dados em um plano de ação personalizado.
          </div>
        )}
      </section>

      <section className="coach-painel coach-mapa-painel">
        <div className="coach-painel-topo">
          <div>
            <h2>🧭 Mapa estratégico</h2>
            <p>O que proteger, o que corrigir e o que não deixar esquecido.</p>
          </div>
        </div>
        <div className="coach-mapa-grid">
          <MapaCard
            rotulo="Ponto forte"
            titulo={dados.melhorMateria?.materia ?? "Sem amostra suficiente"}
            detalhe={
              dados.melhorMateria
                ? `${dados.melhorMateria.percentual}% em ${dados.melhorMateria.total} questões`
                : "Registre mais questões para identificar seu melhor desempenho."
            }
            tom="positivo"
          />
          <MapaCard
            rotulo="Maior risco"
            titulo={materiaRisco?.materia ?? "Sem risco definido"}
            detalhe={
              materiaRisco
                ? `${materiaRisco.percentual}% • ${formatarDiasSemEstudar(materiaRisco.diasSemEstudar)}`
                : "Ainda não há dados suficientes."
            }
            tom="negativo"
          />
          <MapaCard
            rotulo="Assunto crítico"
            titulo={assuntoCritico?.assunto ?? "Nenhum crítico agora"}
            detalhe={
              assuntoCritico
                ? `${assuntoCritico.materia} • ${assuntoCritico.percentual}% • ${assuntoCritico.erradas} erros`
                : "Nenhum assunto com amostra suficiente abaixo do alvo."
            }
            tom="alerta"
          />
          <MapaCard
            rotulo="Revisões"
            titulo={dados.revisoesAtrasadas.length > 0 ? `${dados.revisoesAtrasadas.length} atrasadas` : "Fila sob controle"}
            detalhe={`${dados.revisoesHoje.length} para hoje • ${revisoes.filter((item) => !item.concluida).length} pendentes no total`}
            tom={dados.revisoesAtrasadas.length > 0 ? "negativo" : "positivo"}
          />
        </div>
      </section>

      <div className="coach-resumo">
        <ResumoCard titulo="Tempo na semana" valor={formatarMinutos(dados.semana.minutos)} detalhe={`${dados.semana.sessoes} sessões`} />
        <ResumoCard titulo="Questões no histórico" valor={String(dados.total.questoes)} detalhe={`${dados.total.percentual}% de aproveitamento`} />
        <ResumoCard titulo="Simulados" valor={String(dados.total.simulados)} detalhe={dados.total.simulados > 0 ? `${aproveitamentoSimulados}% de aproveitamento` : "Sem simulado registrado"} />
        <ResumoCard titulo="Revisões atrasadas" valor={String(dados.revisoesAtrasadas.length)} detalhe={dados.revisoesAtrasadas.length > 0 ? "Prioridade imediata" : "Nenhuma pendência crítica"} />
      </div>

      <div className="coach-grid">
        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div><h2>🎯 Próximas prioridades</h2><p>Sequência calculada pela inteligência central, antes mesmo da interpretação da IA.</p></div>
          </div>
          <div className="coach-recomendacoes">
            {dados.missoes.length === 0 ? (
              <div className="coach-vazio">Registre atividades para gerar prioridades.</div>
            ) : (
              dados.missoes.map((missao, indice) => (
                <article key={missao.id} className={`coach-recomendacao coach-${missao.prioridade}`}>
                  <div className="coach-recomendacao-numero">{indice + 1}</div>
                  <div className="coach-recomendacao-conteudo">
                    <div><strong>{missao.titulo}</strong><span>{missao.prioridade === "alta" ? "Prioridade alta" : "Prioridade média"}</span></div>
                    <p>{missao.descricao}</p>
                    <small>{missao.minutos} min{missao.quantidadeQuestoes ? ` • ${missao.quantidadeQuestoes} questões` : ""}</small>
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="coach-acoes">
            <button type="button" className="coach-botao-secundario" onClick={() => navigate("/revisoes")}>🔁 Abrir revisões</button>
            <button type="button" className="coach-botao-primario" onClick={() => navigate("/gerar-simulado-ia")}>🤖 Gerar treino IA</button>
          </div>
        </section>

        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div><h2>📊 Matérias</h2><p>Desempenho por questão, volume e tempo registrado.</p></div>
          </div>
          {dados.materias.length === 0 ? (
            <div className="coach-vazio">Ainda não há dados suficientes.</div>
          ) : (
            <div className="coach-materias">
              {dados.materias.slice(0, 8).map((item) => (
                <article key={item.materia} className="coach-materia">
                  <div className="coach-materia-topo">
                    <div>
                      <strong>{item.materia}</strong>
                      <span>{item.total} questões • {formatarMinutos(item.minutos)} • {formatarDiasSemEstudar(item.diasSemEstudar)}</span>
                    </div>
                    <strong className={item.percentual >= 70 ? "coach-positivo" : item.percentual < 50 ? "coach-negativo" : "coach-medio"}>{item.percentual}%</strong>
                  </div>
                  <div className="coach-barra"><div style={{ width: `${item.percentual}%` }} /></div>
                  <button type="button" onClick={() => abrirMateriais(item.materia)}>Abrir materiais</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="coach-painel">
        <div className="coach-painel-topo coach-painel-topo-acoes">
          <div><h2>⚠ Assuntos críticos</h2><p>Conteúdos com amostra suficiente e rendimento abaixo do alvo.</p></div>
          <div className="coach-atalhos">
            <button type="button" className="coach-botao-secundario" onClick={() => navigate("/cronograma-ia")}>Cronograma IA</button>
            <button type="button" className="coach-botao-secundario" onClick={() => navigate("/inteligencia?aba=relatorio")}>Relatório inteligente</button>
          </div>
        </div>
        {dados.assuntosCriticos.length === 0 ? (
          <div className="coach-vazio">Nenhum assunto crítico identificado com os dados atuais.</div>
        ) : (
          <div className="coach-assuntos">
            {dados.assuntosCriticos.map((item) => (
              <article key={item.chave}>
                <div><strong>{item.assunto}</strong><span>{item.materia}</span></div>
                <div><strong>{item.percentual}%</strong><span>{item.erradas} erros</span></div>
                <button type="button" onClick={() => abrirMateriais(item.materia, item.assunto)}>Materiais</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ComparativoCard({
  titulo,
  valor,
  anterior,
  variacao,
  tendencia,
}: {
  titulo: string;
  valor: string;
  anterior: string;
  variacao: string;
  tendencia: "positivo" | "negativo" | "neutro";
}) {
  return (
    <article className="coach-comparativo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <div>
        <small>Antes: {anterior}</small>
        <b className={`coach-tendencia coach-tendencia-${tendencia}`}>{variacao}</b>
      </div>
    </article>
  );
}

function MetaCard({
  titulo,
  atual,
  meta,
  percentual,
}: {
  titulo: string;
  atual: string;
  meta: string;
  percentual: number;
}) {
  const largura = Math.min(100, Math.max(0, percentual));
  return (
    <article className="coach-meta-card">
      <div className="coach-meta-topo">
        <div><span>{titulo}</span><strong>{atual} <small>/ {meta}</small></strong></div>
        <b>{percentual}%</b>
      </div>
      <div className="coach-meta-barra"><div style={{ width: `${largura}%` }} /></div>
    </article>
  );
}

function MapaCard({
  rotulo,
  titulo,
  detalhe,
  tom,
}: {
  rotulo: string;
  titulo: string;
  detalhe: string;
  tom: "positivo" | "negativo" | "alerta";
}) {
  return (
    <article className={`coach-mapa-card coach-mapa-${tom}`}>
      <span>{rotulo}</span>
      <strong>{titulo}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function ResumoCard({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return <article className="coach-resumo-card"><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}

function formatarMinutos(minutosTotais: number) {
  const minutos = Math.max(0, Math.round(minutosTotais));
  const horas = Math.floor(minutos / 60);
  const restantes = minutos % 60;
  if (horas === 0) return `${restantes}min`;
  if (restantes === 0) return `${horas}h`;
  return `${horas}h ${restantes}min`;
}

function formatarDiasSemEstudar(dias: number) {
  if (dias >= 999) return "sem histórico";
  if (dias === 0) return "estudada hoje";
  if (dias === 1) return "1 dia sem estudar";
  return `${dias} dias sem estudar`;
}

function formatarTipoAcao(tipo: string) {
  if (tipo === "teoria") return "Teoria";
  if (tipo === "questoes") return "Questões";
  if (tipo === "revisao") return "Revisão";
  if (tipo === "simulado") return "Simulado";
  return "Misto";
}

function formatarConfianca(nivel: "baixa" | "media" | "alta") {
  if (nivel === "alta") return "Alta";
  if (nivel === "media") return "Média";
  return "Baixa";
}

function formatarVariacao(valor: number | null) {
  if (valor === null) return "Novo ritmo";
  if (valor === 0) return "Estável";
  return `${valor > 0 ? "+" : ""}${valor}%`;
}

function formatarDiferencaPontos(valor: number) {
  if (valor === 0) return "Estável";
  return `${valor > 0 ? "+" : ""}${valor} p.p.`;
}

function formatarDiferencaDias(valor: number) {
  if (valor === 0) return "Estável";
  return `${valor > 0 ? "+" : ""}${valor} dia${Math.abs(valor) === 1 ? "" : "s"}`;
}

function classeVariacao(valor: number | null): "positivo" | "negativo" | "neutro" {
  if (valor === null || valor === 0) return "neutro";
  return valor > 0 ? "positivo" : "negativo";
}

function classeNumero(valor: number): "positivo" | "negativo" | "neutro" {
  if (valor === 0) return "neutro";
  return valor > 0 ? "positivo" : "negativo";
}

function formatarDataAnalise(valor: string) {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime()) || data.getFullYear() <= 1970) {
    return "Análise anterior sem horário registrado";
  }
  return `Gerada em ${data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })} às ${data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
