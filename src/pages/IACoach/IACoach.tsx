import { armazenamentoLocalDaConta as localStorage } from "../../services/armazenamentoConta";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./IACoach.css";
import { useApp } from "../../context/AppContext";
import {
  carregarUltimoDiagnostico,
  gerarDiagnosticoCoach,
  type DiagnosticoCoachIA,
} from "../../services/iaCoachService";
import { calcularCentralInteligencia } from "../../services/inteligencia/calcularCentralInteligencia";
import { resumirSimulado } from "../../utils/metricasConsolidadas";

const CHAVE_FILTRO_MATERIAIS = "pmpe_filtro_materiais";

export default function IACoach() {
  const navigate = useNavigate();
  const { questoes, sessoes, revisoes, simulados, configuracoes } = useApp();
  const [diagnosticoIA, setDiagnosticoIA] = useState<DiagnosticoCoachIA | null>(
    carregarUltimoDiagnostico
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

      setDiagnosticoIA(resultado);
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

  return (
    <section className="coach-container">
      <div className="coach-cabecalho">
        <div>
          <span className="coach-etiqueta">ANÁLISE AUTOMÁTICA</span>
          <h1>🤖 IA Coach</h1>
          <p>
            O Gemini interpreta a mesma base canônica usada pela Central de Inteligência,
            incluindo questões, sessões, simulados e revisões.
          </p>
        </div>
        <div className="coach-pontuacao">
          <span>Índice atual</span>
          <strong>{dados.indiceProntidao}%</strong>
          <small>{dados.classificacao}</small>
        </div>
      </div>

      <section className="coach-painel coach-painel-ia">
        <div className="coach-ia-topo">
          <div>
            <span className="coach-etiqueta">GEMINI</span>
            <h2>Diagnóstico estratégico</h2>
            <p>A IA interpreta seus dados consolidados e monta uma sequência executável.</p>
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
              <div><span>Tempo total</span><strong>{formatarMinutos(diagnosticoIA.tempoTotalMinutos)}</strong></div>
            </div>

            <div className="coach-ia-acoes">
              {diagnosticoIA.acoes.map((acao) => (
                <article
                  key={`${acao.ordem}-${acao.titulo}`}
                  className={`coach-ia-acao coach-${acao.prioridade}`}
                >
                  <div className="coach-recomendacao-numero">{acao.ordem}</div>
                  <div>
                    <div className="coach-ia-acao-topo">
                      <strong>{acao.titulo}</strong>
                      <span>{formatarTipoAcao(acao.tipo)}</span>
                    </div>
                    <p>{acao.motivo}</p>
                    <small>
                      {acao.duracaoMinutos} min
                      {acao.quantidadeQuestoes > 0 ? ` • ${acao.quantidadeQuestoes} questões` : ""}
                      {acao.materia ? ` • ${acao.materia}` : ""}
                      {acao.assunto ? ` — ${acao.assunto}` : ""}
                    </small>
                  </div>
                </article>
              ))}
            </div>
            <div className="coach-ia-final">{diagnosticoIA.mensagemFinal}</div>
          </div>
        ) : (
          <div className="coach-vazio">
            Gere a primeira análise para receber uma estratégia baseada nos seus dados reais.
          </div>
        )}
      </section>

      <div className="coach-resumo">
        <ResumoCard titulo="Tempo na semana" valor={formatarMinutos(dados.semana.minutos)} detalhe={`${dados.semana.sessoes} sessões`} />
        <ResumoCard titulo="Questões respondidas" valor={String(dados.total.questoes)} detalhe={`${dados.total.percentual}% de aproveitamento`} />
        <ResumoCard titulo="Simulados" valor={String(dados.total.simulados)} detalhe={dados.total.simulados > 0 ? `${aproveitamentoSimulados}% de aproveitamento` : "Sem simulado registrado"} />
        <ResumoCard titulo="Revisões atrasadas" valor={String(dados.revisoesAtrasadas.length)} detalhe={dados.revisoesAtrasadas.length > 0 ? "Prioridade imediata" : "Nenhuma pendência crítica"} />
      </div>

      <div className="coach-grid">
        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div><h2>🎯 Prioridades calculadas</h2><p>Mesma lógica usada na inteligência central.</p></div>
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
            <div><h2>📊 Matérias</h2><p>Desempenho por questão e tempo registrado.</p></div>
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
        <div className="coach-painel-topo">
          <div><h2>⚠ Assuntos críticos</h2><p>Conteúdos com amostra suficiente e rendimento abaixo do alvo.</p></div>
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
