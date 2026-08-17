import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import "./CronogramaIA.css";

import {
  useApp,
} from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import {
  chaveSemana,
  criarAjusteControlado,
  gerarRelatorioMensal,
  type AjusteControlado,
} from "../../utils/cronogramaAdaptativo";
import {
  calcularDiagnosticoSemanalPlano,
} from "../../utils/adaptacaoPlano";

import {
  planoPMPE,
} from "../../data/planoPMPE";

import {
  excluirCronogramaIA,
  gerarCronogramaIA,
  listarCronogramasIA,
  type CronogramaGeradoIA,
  type PeriodoCronogramaIA,
  type TarefaCronogramaIA,
} from "../../services/cronogramaIAService";

type PerfilCronograma = {
  minutosPorDia: number;
  diasPorSemana: number;
  materiaMaiorDificuldade: string;
  nivelAtual: "iniciante" | "intermediario" | "avancado";
  formatoPreferido: "teoria-questoes" | "teoria" | "questoes";
  domingoEstrategico: boolean;
  observacao: string;
};

function carregarPerfil(chave: string, minutos: number): PerfilCronograma {
  try {
    const salvo = localStorage.getItem(chave);
    if (salvo) return JSON.parse(salvo) as PerfilCronograma;
  } catch { /* usa o perfil inicial */ }
  return { minutosPorDia: minutos, diasPorSemana: 6, materiaMaiorDificuldade: "", nivelAtual: "intermediario", formatoPreferido: "teoria-questoes", domingoEstrategico: true, observacao: "" };
}

function carregarLista(chave: string): string[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(salvo) ? salvo.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function carregarAjustes(chave: string): AjusteControlado[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(salvo) ? salvo as AjusteControlado[] : [];
  } catch { return []; }
}

export default function CronogramaIA() {
  const navigate =
    useNavigate();

  const {
    materias,
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
    missoesConcluidas,
  } = useApp();

  const { usuario } = useAuth();
  const chavePerfil = `pmpe:${usuario?.id ?? "local"}:perfil-cronograma-ia`;
  const chaveAprovados = `pmpe:${usuario?.id ?? "local"}:cronogramas-ia-aprovados`;
  const chaveAjustes = `pmpe:${usuario?.id ?? "local"}:ajustes-controlados`;
  const chaveAutomacao = `pmpe:${usuario?.id ?? "local"}:automacao-controlada`;
  const [perfil, setPerfil] = useState(() => carregarPerfil(chavePerfil, configuracoes.metaMinutosDiaria || 120));
  const [perfilSalvo, setPerfilSalvo] = useState(() => Boolean(localStorage.getItem(chavePerfil)));
  const [aprovados, setAprovados] = useState<string[]>(() => carregarLista(chaveAprovados));
  const [mensagemPerfil, setMensagemPerfil] = useState("");
  const [automacaoAtiva, setAutomacaoAtiva] = useState(() => localStorage.getItem(chaveAutomacao) === "true");
  const [ajustes, setAjustes] = useState<AjusteControlado[]>(() => carregarAjustes(chaveAjustes));
  const [mensagemAutomacao, setMensagemAutomacao] = useState("");

  const [
    periodo,
    setPeriodo,
  ] =
    useState<PeriodoCronogramaIA>(
      "hoje"
    );

  const [
    tempoDisponivel,
    setTempoDisponivel,
  ] = useState(
    configuracoes.metaMinutosDiaria ||
    120
  );

  const [
    gerando,
    setGerando,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    cronogramas,
    setCronogramas,
  ] =
    useState<
      CronogramaGeradoIA[]
    >([]);

  const [
    cronogramaAtual,
    setCronogramaAtual,
  ] =
    useState<
      CronogramaGeradoIA | null
    >(null);

  const missoesPendentes =
    useMemo(
      () =>
        planoPMPE.flatMap(
          (semana) =>
            semana.dias.flatMap(
              (dia) =>
                dia.missoes
                  .filter(
                    (missao) =>
                      !missoesConcluidas.includes(
                        missao.id
                      )
                  )
                  .map(
                    (missao) => ({
                      id:
                        missao.id,
                      semana:
                        semana.numero,
                      dia:
                        dia.numero,
                      numero:
                        missao.numero,
                      materia:
                        missao.materia,
                      assunto:
                        missao.assunto,
                      tipo:
                        missao.tipo,
                    })
                  )
            )
        ),
      [
        missoesConcluidas,
      ]
    );

  const relatorioMensal = useMemo(() => gerarRelatorioMensal({
    questoes,
    sessoes,
    revisoes,
    simulados,
    minutosMetaDia: perfil.minutosPorDia,
    diasSemana: perfil.diasPorSemana,
  }), [questoes, sessoes, revisoes, simulados, perfil.minutosPorDia, perfil.diasPorSemana]);

  const diagnosticoSemanal = useMemo(() => calcularDiagnosticoSemanalPlano({
    questoes,
    sessoes,
    revisoes,
    materiasDisponiveis: materias.map((materia) => materia.nome),
  }), [questoes, sessoes, revisoes, materias]);

  const prioridadeAtiva =
    ajustes.find((item) => item.ativo)?.materiaPrioritaria ??
    diagnosticoSemanal.materiaPrioritaria ??
    perfil.materiaMaiorDificuldade;

  useEffect(() => {
    void carregarHistorico();
  }, []);

  useEffect(() => {
    if (!automacaoAtiva || new Date().getDay() !== 1 || ajustes.some((item) => item.semana === chaveSemana())) return;
    const ajuste = criarAjusteControlado(relatorioMensal, perfil.materiaMaiorDificuldade);
    if (!ajuste) return;
    const novaLista = [ajuste, ...ajustes];
    const novoPerfil = { ...perfil, materiaMaiorDificuldade: ajuste.materiaPrioritaria };
    setAjustes(novaLista);
    setPerfil(novoPerfil);
    localStorage.setItem(chaveAjustes, JSON.stringify(novaLista));
    localStorage.setItem(chavePerfil, JSON.stringify(novoPerfil));
    setMensagemAutomacao(`Ajuste semanal aplicado: prioridade em ${ajuste.materiaPrioritaria}.`);
  }, [automacaoAtiva, relatorioMensal, ajustes, perfil, chaveAjustes, chavePerfil]);

  function salvarPerfil() {
    if (perfil.minutosPorDia < 20 || perfil.diasPorSemana < 1 || perfil.diasPorSemana > 7 || !perfil.materiaMaiorDificuldade) {
      setMensagemPerfil("Preencha o tempo, os dias e a matéria de maior dificuldade.");
      return;
    }
    const perfilFinal = { ...perfil, domingoEstrategico: true };
    setPerfil(perfilFinal);
    localStorage.setItem(chavePerfil, JSON.stringify(perfilFinal));
    setTempoDisponivel(perfilFinal.minutosPorDia);
    setPerfilSalvo(true);
    setMensagemPerfil("Perfil salvo. A IA usará estas respostas nas próximas propostas.");
  }

  function identificadorCronograma(cronograma: CronogramaGeradoIA) {
    return cronograma.id || cronograma.geradoEm;
  }

  function aprovarCronograma(cronograma: CronogramaGeradoIA) {
    const id = identificadorCronograma(cronograma);
    const novaLista = Array.from(new Set([...aprovados, id]));
    setAprovados(novaLista);
    localStorage.setItem(chaveAprovados, JSON.stringify(novaLista));
  }

  function alternarAutomacao(ativa: boolean) {
    setAutomacaoAtiva(ativa);
    localStorage.setItem(chaveAutomacao, String(ativa));
    setMensagemAutomacao(ativa ? "Automação ativada. Os ajustes ocorrerão somente às segundas-feiras." : "Automação pausada.");
  }

  function desfazerAjuste(ajuste: AjusteControlado) {
    if (!ajuste.ativo) return;
    const novaLista = ajustes.map((item) => item.id === ajuste.id ? { ...item, ativo: false, desfeitoEm: new Date().toISOString() } : item);
    const novoPerfil = { ...perfil, materiaMaiorDificuldade: ajuste.materiaAnterior };
    setAjustes(novaLista);
    setPerfil(novoPerfil);
    localStorage.setItem(chaveAjustes, JSON.stringify(novaLista));
    localStorage.setItem(chavePerfil, JSON.stringify(novoPerfil));
    setMensagemAutomacao("Último ajuste desfeito. A prioridade anterior foi restaurada.");
  }

  async function carregarHistorico() {
    try {
      setCarregando(true);
      setErro("");

      const lista =
        await listarCronogramasIA();

      setCronogramas(lista);

      if (
        lista.length > 0
      ) {
        setCronogramaAtual(
          lista[0]
        );
      }
    } catch (erroCarregamento) {
      setErro(
        obterMensagemErro(
          erroCarregamento
        )
      );
    } finally {
      setCarregando(false);
    }
  }

  async function gerar() {
    if (gerando) {
      return;
    }

    if (
      tempoDisponivel < 20
    ) {
      setErro(
        "Informe pelo menos 20 minutos disponíveis."
      );

      return;
    }

    if (!perfilSalvo) {
      setErro("Salve primeiro o questionário inicial.");
      return;
    }

    try {
      setGerando(true);
      setErro("");

      const novo =
        await gerarCronogramaIA({
          nomeUsuario:
            configuracoes.nomeUsuario,

          concurso:
            configuracoes.concurso,

          banca:
            configuracoes.bancaPadrao,

          periodo,

          tempoDisponivelMinutos:
            tempoDisponivel,

          perfilEstudo: {
            diasPorSemana: perfil.diasPorSemana,
            materiaMaiorDificuldade: perfil.materiaMaiorDificuldade,
            nivelAtual: perfil.nivelAtual,
            formatoPreferido: perfil.formatoPreferido,
            domingoEstrategico: true,
            observacao: perfil.observacao,
            modo: "assistido",
            prioridadeAutomatica: prioridadeAtiva,
          },

          metas: {
            minutosDia:
              configuracoes.metaMinutosDiaria,

            questoesDia:
              configuracoes.metaQuestoesDiaria,

            revisoesDia:
              configuracoes.metaRevisoesDiaria,
          },

          questoes:
            questoes.map(
              (item) => ({
                materia:
                  item.materia,
                assunto:
                  item.assunto,
                certas:
                  item.certas,
                erradas:
                  item.erradas,
                minutos:
                  item.minutos,
                data:
                  item.data,
              })
            ),

          sessoes:
            sessoes.map(
              (item) => ({
                materia:
                  item.materia,
                assunto:
                  item.assunto,
                tipo:
                  item.tipo,
                minutos:
                  item.minutos,
                data:
                  item.data,
              })
            ),

          revisoes:
            revisoes.map(
              (item) => ({
                id:
                  item.id,
                materia:
                  item.materia,
                assunto:
                  item.assunto,
                etapa:
                  item.etapa,
                dataPrevista:
                  item.dataPrevista,
                concluida:
                  item.concluida,
              })
            ),

          simulados:
            simulados.map(
              (item) => ({
                nome:
                  item.nome,
                banca:
                  item.banca,
                certas:
                  item.certas,
                erradas:
                  item.erradas,
                anuladas:
                  item.anuladas,
                minutos:
                  item.minutos,
                data:
                  item.data,
              })
            ),

          missoesPendentes:
            missoesPendentes.slice(
              0,
              80
            ),
        });

      setCronogramaAtual(
        novo
      );

      setCronogramas(
        (anteriores) => [
          novo,
          ...anteriores,
        ]
      );
    } catch (erroGeracao) {
      setErro(
        obterMensagemErro(
          erroGeracao
        )
      );
    } finally {
      setGerando(false);
    }
  }

  async function excluir(
    cronograma:
      CronogramaGeradoIA
  ) {
    if (!cronograma.id) {
      return;
    }

    const confirmar =
      window.confirm(
        `Excluir "${cronograma.titulo}"?`
      );

    if (!confirmar) {
      return;
    }

    try {
      await excluirCronogramaIA(
        cronograma.id
      );

      const novaLista =
        cronogramas.filter(
          (item) =>
            item.id !==
            cronograma.id
        );

      setCronogramas(
        novaLista
      );

      if (
        cronogramaAtual?.id ===
        cronograma.id
      ) {
        setCronogramaAtual(
          novaLista[0] ??
          null
        );
      }
    } catch (erroExclusao) {
      setErro(
        obterMensagemErro(
          erroExclusao
        )
      );
    }
  }

  function iniciarTarefa(
    tarefa:
      TarefaCronogramaIA
  ) {
    const cronometro = {
      ativo: true,
      pausado: false,
      materia:
        tarefa.materia,
      assunto:
        tarefa.assunto,
      tipo:
        tarefa.tipo ===
        "revisao"
          ? "revisao"
          : tarefa.tipo ===
              "questoes"
            ? "questoes"
            : "estudo",
      objetivo:
        tarefa.titulo,
      iniciadaEm:
        new Date()
          .toISOString(),
      pausadaEm: null,
      segundosPausados: 0,
      missaoId:
        tarefa.missaoId,
    };

    localStorage.setItem(
      "pmpe_cronometro_estudo",
      JSON.stringify(
        cronometro
      )
    );

    window.dispatchEvent(
      new Event(
        "pmpe-cronometro-atualizado"
      )
    );

    navigate(
      "/central-estudos"
    );
  }

  return (
    <section className="cronograma-container">
      <div className="cronograma-cabecalho">
        <div>
          <span className="cronograma-etiqueta">
            PLANEJAMENTO INTELIGENTE
          </span>

          <h1>
            🧠 Cronograma com IA
          </h1>

          <p>
            O Gemini combina desempenho,
            revisões, missões pendentes e
            tempo disponível.
          </p>
        </div>

        <div className="cronograma-configuracao">
          <label>
            Período
          </label>

          <select
            value={periodo}
            onChange={(evento) =>
              setPeriodo(
                evento.target
                  .value as
                  PeriodoCronogramaIA
              )
            }
          >
            <option value="hoje">
              Hoje
            </option>

            <option value="7-dias">
              Próximos 7 dias
            </option>
          </select>

          <label>
            {periodo ===
            "hoje"
              ? "Minutos disponíveis hoje"
              : "Minutos disponíveis por dia"}
          </label>

          <input
            type="number"
            min={20}
            max={600}
            value={
              tempoDisponivel
            }
            onChange={(evento) =>
              setTempoDisponivel(
                Math.max(
                  0,
                  Number(
                    evento.target.value
                  )
                )
              )
            }
          />

          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
          >
            {gerando
              ? "Montando cronograma..."
              : "Gerar cronograma"}
          </button>
        </div>
      </div>

      <section className="cronograma-questionario">
        <div className="cronograma-questionario-topo">
          <div><span>ETAPA 9</span><h2>Seu perfil de estudo</h2><p>Estas respostas formam a base do cronograma. Você pode atualizá-las quando sua rotina mudar.</p></div>
          <strong>{perfilSalvo ? "✓ Perfil configurado" : "Configuração pendente"}</strong>
        </div>
        <div className="cronograma-perguntas">
          <label>Minutos disponíveis por dia<input type="number" min="20" max="600" value={perfil.minutosPorDia} onChange={(e) => setPerfil({ ...perfil, minutosPorDia: Number(e.target.value) })} /></label>
          <label>Dias de estudo por semana<input type="number" min="1" max="7" value={perfil.diasPorSemana} onChange={(e) => setPerfil({ ...perfil, diasPorSemana: Number(e.target.value) })} /></label>
          <label>Maior dificuldade<select value={perfil.materiaMaiorDificuldade} onChange={(e) => setPerfil({ ...perfil, materiaMaiorDificuldade: e.target.value })}><option value="">Selecione</option>{materias.map((materia) => <option key={materia.id} value={materia.nome}>{materia.nome}</option>)}</select></label>
          <label>Nível atual<select value={perfil.nivelAtual} onChange={(e) => setPerfil({ ...perfil, nivelAtual: e.target.value as PerfilCronograma["nivelAtual"] })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
          <label>Formato preferido<select value={perfil.formatoPreferido} onChange={(e) => setPerfil({ ...perfil, formatoPreferido: e.target.value as PerfilCronograma["formatoPreferido"] })}><option value="teoria-questoes">Teoria + questões</option><option value="teoria">Mais teoria</option><option value="questoes">Mais questões</option></select></label>
          <div className="cronograma-domingo-fixo"><strong>Domingo estratégico</strong><span>Redação + simulado · regra fixa do plano</span></div>
          <label className="cronograma-observacao">Observação sobre sua rotina<textarea value={perfil.observacao} onChange={(e) => setPerfil({ ...perfil, observacao: e.target.value })} placeholder="Ex.: de manhã teoria; à noite questões e revisões." /></label>
        </div>
        <div className="cronograma-questionario-rodape">{mensagemPerfil && <span>{mensagemPerfil}</span>}<button type="button" onClick={salvarPerfil}>Salvar perfil</button></div>
      </section>

      <section className="cronograma-diagnostico-semanal">
        <header>
          <div><span>ETAPA 17</span><h2>Diagnóstico adaptativo · 14 dias</h2></div>
          <strong>{prioridadeAtiva || "Coletando dados"}</strong>
        </header>
        <div className="cronograma-diagnostico-grid">
          <div><span>Prioridade calculada</span><strong>{diagnosticoSemanal.prioridade}/100</strong></div>
          <div><span>Confiança dos dados</span><strong>{diagnosticoSemanal.confianca}%</strong></div>
          <div><span>Matérias com evidência</span><strong>{diagnosticoSemanal.materias.length}</strong></div>
        </div>
        <div className="cronograma-diagnostico-ranking">
          {diagnosticoSemanal.materias.slice(0, 3).map((item, indice) => (
            <article key={item.materia}>
              <b>{indice + 1}</b>
              <div><strong>{item.materia}</strong><small>{item.percentualAcertos !== undefined ? `${item.percentualAcertos}% de acertos · ` : ""}{item.questoes} questões · {item.revisoesAtrasadas} revisões atrasadas</small></div>
              <em>{item.prioridade}</em>
            </article>
          ))}
          {diagnosticoSemanal.materias.length === 0 && <p>Registre questões, estudo ou revisões para liberar o diagnóstico.</p>}
        </div>
        <p className="cronograma-diagnostico-regra">A prioridade influencia propostas da IA e os slots flexíveis de reforço. Conteúdo fixo e domingo não são movidos.</p>
      </section>

      <div className="cronograma-fechamento-grid">
        <section className="cronograma-relatorio-mensal">
          <header><div><span>ETAPA 11</span><h2>Relatório mensal</h2></div><strong>{new Date(`${relatorioMensal.mes}-02T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong></header>
          <div className="cronograma-relatorio-cards">
            <div><span>Tempo realizado</span><strong>{(relatorioMensal.minutosRealizados / 60).toFixed(1)}h</strong><small>de {(relatorioMensal.minutosPlanejados / 60).toFixed(1)}h planejadas</small></div>
            <div><span>Questões</span><strong>{relatorioMensal.questoes}</strong><small>{relatorioMensal.aproveitamento}% de acertos</small></div>
            <div><span>Revisões</span><strong>{relatorioMensal.revisoes}</strong><small>{relatorioMensal.simulados} simulados</small></div>
            <div><span>Redações</span><strong>{relatorioMensal.redacoes}</strong><small>{relatorioMensal.percentualTempo}% da meta de tempo</small></div>
          </div>
          <div className="cronograma-diagnostico-mensal"><p><strong>Destaque:</strong> {relatorioMensal.materiaDestaque || "dados insuficientes"}</p><p><strong>Ponto crítico:</strong> {relatorioMensal.materiaCritica || "dados insuficientes"}</p><p><strong>Proposta:</strong> {relatorioMensal.proposta}</p></div>
        </section>

        <section className="cronograma-automacao-controlada">
          <header><div><span>ETAPA 12</span><h2>Automação controlada</h2></div><label><input type="checkbox" checked={automacaoAtiva} onChange={(e) => alternarAutomacao(e.target.checked)} /><b>{automacaoAtiva ? "Ativa" : "Pausada"}</b></label></header>
          <ul><li>Somente no início de uma nova semana</li><li>Nenhuma matéria é removida</li><li>Disponibilidade diária não é aumentada</li><li>Todo ajuste pode ser desfeito</li></ul>
          {mensagemAutomacao && <p className="cronograma-mensagem-automacao">{mensagemAutomacao}</p>}
          <div className="cronograma-historico-ajustes"><h3>Histórico de alterações</h3>{ajustes.length === 0 ? <p>Nenhum ajuste automático realizado.</p> : ajustes.slice(0, 6).map((ajuste) => <article key={ajuste.id}><div><strong>{ajuste.materiaPrioritaria}</strong><span>{ajuste.semana} · {ajuste.ativo ? "ativo" : "desfeito"}</span><p>{ajuste.motivo}</p></div>{ajuste.ativo && <button type="button" onClick={() => desfazerAjuste(ajuste)}>Desfazer</button>}</article>)}</div>
        </section>
      </div>

      {erro && (
        <div className="cronograma-erro">
          {erro}
        </div>
      )}

      <div className="cronograma-resumo">
        <ResumoCard
          titulo="Missões pendentes"
          valor={
            missoesPendentes.length
          }
        />

        <ResumoCard
          titulo="Revisões abertas"
          valor={
            revisoes.filter(
              (item) =>
                !item.concluida
            ).length
          }
        />

        <ResumoCard
          titulo="Tempo escolhido"
          valor={formatarMinutos(
            tempoDisponivel
          )}
        />

        <ResumoCard
          titulo="Cronogramas salvos"
          valor={
            cronogramas.length
          }
        />
      </div>

      <div className="cronograma-layout">
        <main className="cronograma-principal">
          {carregando ? (
            <div className="cronograma-vazio">
              Carregando cronogramas...
            </div>
          ) : !cronogramaAtual ? (
            <div className="cronograma-vazio">
              <h2>
                Nenhum cronograma gerado
              </h2>

              <p>
                Escolha o período e o tempo
                disponível para começar.
              </p>
            </div>
          ) : (
            <>
              <div className="cronograma-plano-topo">
                <div>
                  <span>
                    {cronogramaAtual.periodo ===
                    "hoje"
                      ? "PLANO DE HOJE"
                      : "PLANO DE 7 DIAS"}
                  </span>

                  <h2>
                    {
                      cronogramaAtual.titulo
                    }
                  </h2>

                  <p>
                    {
                      cronogramaAtual.resumo
                    }
                  </p>
                </div>

                <strong>
                  {formatarMinutos(
                    cronogramaAtual.tempoTotalMinutos
                  )}
                </strong>
              </div>

              <div className={`cronograma-aprovacao ${aprovados.includes(identificadorCronograma(cronogramaAtual)) ? "aprovado" : ""}`}>
                <div><span>ETAPA 10 · MODO ASSISTIDO</span><strong>{aprovados.includes(identificadorCronograma(cronogramaAtual)) ? "Plano aprovado" : "Proposta aguardando sua aprovação"}</strong><p>A IA recomenda a distribuição, mas não substitui nem altera automaticamente o cronograma original.</p></div>
                {!aprovados.includes(identificadorCronograma(cronogramaAtual)) && <button type="button" onClick={() => aprovarCronograma(cronogramaAtual)}>Aprovar proposta</button>}
              </div>

              <div className="cronograma-objetivo">
                <span>
                  Objetivo principal
                </span>

                <strong>
                  {
                    cronogramaAtual.objetivoPrincipal
                  }
                </strong>
              </div>

              <div className="cronograma-dias">
                {agruparPorDia(
                  cronogramaAtual.tarefas
                ).map(
                  (grupo) => (
                    <section
                      key={
                        grupo.dia
                      }
                      className="cronograma-dia"
                    >
                      <div className="cronograma-dia-titulo">
                        <h3>
                          {cronogramaAtual.periodo ===
                          "hoje"
                            ? "Hoje"
                            : `Dia ${grupo.dia}`}
                        </h3>

                        <span>
                          {formatarMinutos(
                            grupo.tarefas.reduce(
                              (
                                total,
                                tarefa
                              ) =>
                                total +
                                tarefa.duracaoMinutos,
                              0
                            )
                          )}
                        </span>
                      </div>

                      <div className="cronograma-tarefas">
                        {grupo.tarefas.map(
                          (tarefa) => (
                            <article
                              key={
                                tarefa.id
                              }
                              className={`cronograma-tarefa cronograma-${tarefa.tipo}`}
                            >
                              <div className="cronograma-numero">
                                {
                                  tarefa.ordem
                                }
                              </div>

                              <div className="cronograma-tarefa-conteudo">
                                <div className="cronograma-tarefa-topo">
                                  <div>
                                    <strong>
                                      {
                                        tarefa.titulo
                                      }
                                    </strong>

                                    <span>
                                      {
                                        tarefa.materia
                                      }
                                      {" — "}
                                      {
                                        tarefa.assunto
                                      }
                                    </span>
                                  </div>

                                  <small>
                                    {
                                      tarefa.duracaoMinutos
                                    }{" "}
                                    min
                                  </small>
                                </div>

                                <p>
                                  {
                                    tarefa.justificativa
                                  }
                                </p>

                                <div className="cronograma-tarefa-rodape">
                                  <span>
                                    {formatarTipo(
                                      tarefa.tipo
                                    )}

                                    {tarefa.quantidadeQuestoes >
                                    0
                                      ? ` • ${tarefa.quantidadeQuestoes} questões`
                                      : ""}
                                  </span>

                                  <button
                                    type="button"
                                    disabled={!aprovados.includes(identificadorCronograma(cronogramaAtual))}
                                    onClick={() =>
                                      iniciarTarefa(
                                        tarefa
                                      )
                                    }
                                  >
                                    {aprovados.includes(identificadorCronograma(cronogramaAtual)) ? "▶ Iniciar" : "Aguardando aprovação"}
                                  </button>
                                </div>
                              </div>
                            </article>
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>
            </>
          )}
        </main>

        <aside className="cronograma-historico">
          <h2>
            Histórico
          </h2>

          {cronogramas.length ===
          0 ? (
            <p>
              Nenhum cronograma salvo.
            </p>
          ) : (
            <div className="cronograma-historico-lista">
              {cronogramas.map(
                (cronograma) => (
                  <article
                    key={
                      cronograma.id ||
                      cronograma.geradoEm
                    }
                    className={
                      cronogramaAtual?.id ===
                      cronograma.id
                        ? "ativo"
                        : ""
                    }
                  >
                    <button
                      type="button"
                      className="cronograma-abrir"
                      onClick={() =>
                        setCronogramaAtual(
                          cronograma
                        )
                      }
                    >
                      <strong>
                        {
                          cronograma.titulo
                        }
                      </strong>

                      <span>
                        {formatarData(
                          cronograma.geradoEm
                        )}
                        {" • "}
                        {cronograma.periodo ===
                        "hoje"
                          ? "Hoje"
                          : "7 dias"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="cronograma-excluir"
                      onClick={() =>
                        excluir(
                          cronograma
                        )
                      }
                    >
                      ×
                    </button>
                  </article>
                )
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ResumoCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string | number;
}) {
  return (
    <article className="cronograma-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function agruparPorDia(
  tarefas:
    TarefaCronogramaIA[]
) {
  const mapa =
    new Map<
      number,
      TarefaCronogramaIA[]
    >();

  tarefas.forEach(
    (tarefa) => {
      const dia =
        Math.max(
          1,
          tarefa.dia || 1
        );

      const lista =
        mapa.get(dia) ??
        [];

      lista.push(
        tarefa
      );

      mapa.set(
        dia,
        lista
      );
    }
  );

  return Array.from(
    mapa.entries()
  )
    .sort(
      ([a], [b]) =>
        a - b
    )
    .map(
      ([
        dia,
        lista,
      ]) => ({
        dia,
        tarefas:
          [...lista].sort(
            (a, b) =>
              a.ordem -
              b.ordem
          ),
      })
    );
}

function formatarTipo(
  tipo:
    TarefaCronogramaIA["tipo"]
) {
  const nomes = {
    teoria:
      "Teoria",
    questoes:
      "Questões",
    revisao:
      "Revisão",
    simulado:
      "Simulado",
    redacao:
      "Redação",
    misto:
      "Misto",
  };

  return nomes[tipo];
}

function formatarMinutos(
  total: number
) {
  const minutos =
    Math.max(
      0,
      Math.round(total)
    );

  const horas =
    Math.floor(
      minutos / 60
    );

  const restante =
    minutos % 60;

  if (horas === 0) {
    return `${restante}min`;
  }

  return `${horas}h ${restante}min`;
}

function formatarData(
  data: string
) {
  return new Date(
    data
  ).toLocaleString(
    "pt-BR",
    {
      dateStyle:
        "short",
      timeStyle:
        "short",
    }
  );
}

function obterMensagemErro(
  erro: unknown
) {
  return erro instanceof Error
    ? erro.message
    : "Ocorreu um erro inesperado.";
}
