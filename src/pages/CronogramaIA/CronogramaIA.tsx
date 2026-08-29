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
  } catch {
    /* usa o perfil inicial */
  }

  return {
    minutosPorDia: minutos,
    diasPorSemana: 6,
    materiaMaiorDificuldade: "",
    nivelAtual: "intermediario",
    formatoPreferido: "teoria-questoes",
    domingoEstrategico: true,
    observacao: "",
  };
}

function carregarLista(chave: string): string[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(salvo)
      ? salvo.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function carregarAjustes(chave: string): AjusteControlado[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(salvo) ? salvo as AjusteControlado[] : [];
  } catch {
    return [];
  }
}

export default function CronogramaIA() {
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

  const { usuario } = useAuth();
  const chavePerfil = `pmpe:${usuario?.id ?? "local"}:perfil-cronograma-ia`;
  const chaveAprovados = `pmpe:${usuario?.id ?? "local"}:cronogramas-ia-aprovados`;
  const chaveAjustes = `pmpe:${usuario?.id ?? "local"}:ajustes-controlados`;
  const chaveAutomacao = `pmpe:${usuario?.id ?? "local"}:automacao-controlada`;

  const [perfil, setPerfil] = useState(() =>
    carregarPerfil(chavePerfil, configuracoes.metaMinutosDiaria || 120)
  );
  const [perfilSalvo, setPerfilSalvo] = useState(() =>
    Boolean(localStorage.getItem(chavePerfil))
  );
  const [aprovados, setAprovados] = useState<string[]>(() =>
    carregarLista(chaveAprovados)
  );
  const [mensagemPerfil, setMensagemPerfil] = useState("");
  const [automacaoAtiva, setAutomacaoAtiva] = useState(() =>
    localStorage.getItem(chaveAutomacao) === "true"
  );
  const [ajustes, setAjustes] = useState<AjusteControlado[]>(() =>
    carregarAjustes(chaveAjustes)
  );
  const [mensagemAutomacao, setMensagemAutomacao] = useState("");

  const [periodo, setPeriodo] = useState<PeriodoCronogramaIA>("hoje");
  const [tempoDisponivel, setTempoDisponivel] = useState(
    configuracoes.metaMinutosDiaria || 120
  );
  const [gerando, setGerando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [cronogramas, setCronogramas] = useState<CronogramaGeradoIA[]>([]);
  const [cronogramaAtual, setCronogramaAtual] = useState<CronogramaGeradoIA | null>(null);

  const [estrategiaAberta, setEstrategiaAberta] = useState(() =>
    !Boolean(localStorage.getItem(chavePerfil))
  );
  const [diagnosticoAberto, setDiagnosticoAberto] = useState(false);
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [diaAberto, setDiaAberto] = useState<number | null>(null);

  const missoesPendentes = useMemo(
    () =>
      planoPMPE.flatMap((semana) =>
        semana.dias.flatMap((dia) =>
          dia.missoes
            .filter((missao) => !missoesConcluidas.includes(missao.id))
            .map((missao) => ({
              id: missao.id,
              semana: semana.numero,
              dia: dia.numero,
              numero: missao.numero,
              materia: missao.materia,
              assunto: missao.assunto,
              tipo: missao.tipo,
            }))
        )
      ),
    [missoesConcluidas]
  );

  const relatorioMensal = useMemo(
    () =>
      gerarRelatorioMensal({
        questoes,
        sessoes,
        revisoes,
        simulados,
        minutosMetaDia: perfil.minutosPorDia,
        diasSemana: perfil.diasPorSemana,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      perfil.minutosPorDia,
      perfil.diasPorSemana,
    ]
  );

  const diagnosticoSemanal = useMemo(
    () =>
      calcularDiagnosticoSemanalPlano({
        questoes,
        sessoes,
        revisoes,
        materiasDisponiveis: materias.map((materia) => materia.nome),
      }),
    [questoes, sessoes, revisoes, materias]
  );

  const prioridadeAtiva =
    ajustes.find((item) => item.ativo)?.materiaPrioritaria ??
    diagnosticoSemanal.materiaPrioritaria ??
    perfil.materiaMaiorDificuldade;

  const pontoCritico = diagnosticoSemanal.materias[0];
  const pontoForte = useMemo(
    () =>
      [...diagnosticoSemanal.materias]
        .filter((item) => item.percentualAcertos !== undefined)
        .sort(
          (a, b) =>
            (b.percentualAcertos ?? -1) - (a.percentualAcertos ?? -1) ||
            a.prioridade - b.prioridade
        )[0],
    [diagnosticoSemanal.materias]
  );

  const tarefasOrdenadas = useMemo(
    () =>
      cronogramaAtual
        ? [...cronogramaAtual.tarefas].sort(
            (a, b) => a.dia - b.dia || a.ordem - b.ordem
          )
        : [],
    [cronogramaAtual]
  );

  const tarefaAtual = tarefasOrdenadas[0];
  const planoAtualAprovado = cronogramaAtual
    ? aprovados.includes(identificadorCronograma(cronogramaAtual))
    : false;
  const ultimoAjuste = ajustes[0];
  const ajusteAtivo = ajustes.find((item) => item.ativo);

  useEffect(() => {
    void carregarHistorico();
  }, []);

  useEffect(() => {
    if (
      !automacaoAtiva ||
      new Date().getDay() !== 1 ||
      ajustes.some((item) => item.semana === chaveSemana())
    ) {
      return;
    }

    const ajuste = criarAjusteControlado(
      relatorioMensal,
      perfil.materiaMaiorDificuldade
    );
    if (!ajuste) return;

    const novaLista = [ajuste, ...ajustes];
    const novoPerfil = {
      ...perfil,
      materiaMaiorDificuldade: ajuste.materiaPrioritaria,
    };

    setAjustes(novaLista);
    setPerfil(novoPerfil);
    localStorage.setItem(chaveAjustes, JSON.stringify(novaLista));
    localStorage.setItem(chavePerfil, JSON.stringify(novoPerfil));
    setMensagemAutomacao(
      `Ajuste semanal aplicado: prioridade em ${ajuste.materiaPrioritaria}.`
    );
  }, [
    automacaoAtiva,
    relatorioMensal,
    ajustes,
    perfil,
    chaveAjustes,
    chavePerfil,
  ]);

  function salvarPerfil() {
    if (
      perfil.minutosPorDia < 20 ||
      perfil.diasPorSemana < 1 ||
      perfil.diasPorSemana > 7 ||
      !perfil.materiaMaiorDificuldade
    ) {
      setMensagemPerfil(
        "Preencha o tempo, os dias e a matéria de maior dificuldade."
      );
      return;
    }

    const perfilFinal = {
      ...perfil,
      domingoEstrategico: true,
    };

    setPerfil(perfilFinal);
    localStorage.setItem(chavePerfil, JSON.stringify(perfilFinal));
    setTempoDisponivel(perfilFinal.minutosPorDia);
    setPerfilSalvo(true);
    setMensagemPerfil(
      "Estratégia salva. A IA usará estas preferências nas próximas propostas."
    );
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
    setMensagemAutomacao(
      ativa
        ? "Automação ativada. Os ajustes ocorrerão somente às segundas-feiras."
        : "Automação pausada."
    );
  }

  function desfazerAjuste(ajuste: AjusteControlado) {
    if (!ajuste.ativo) return;

    const novaLista = ajustes.map((item) =>
      item.id === ajuste.id
        ? {
            ...item,
            ativo: false,
            desfeitoEm: new Date().toISOString(),
          }
        : item
    );
    const novoPerfil = {
      ...perfil,
      materiaMaiorDificuldade: ajuste.materiaAnterior,
    };

    setAjustes(novaLista);
    setPerfil(novoPerfil);
    localStorage.setItem(chaveAjustes, JSON.stringify(novaLista));
    localStorage.setItem(chavePerfil, JSON.stringify(novoPerfil));
    setMensagemAutomacao(
      "Último ajuste desfeito. A prioridade anterior foi restaurada."
    );
  }

  async function carregarHistorico() {
    try {
      setCarregando(true);
      setErro("");

      const lista = await listarCronogramasIA();
      setCronogramas(lista);

      if (lista.length > 0) {
        setCronogramaAtual(lista[0]);
      }
    } catch (erroCarregamento) {
      setErro(obterMensagemErro(erroCarregamento));
    } finally {
      setCarregando(false);
    }
  }

  async function gerar() {
    if (gerando) return;

    if (tempoDisponivel < 20) {
      setErro("Informe pelo menos 20 minutos disponíveis.");
      return;
    }

    if (!perfilSalvo) {
      setErro("Salve primeiro sua estratégia de estudo.");
      setEstrategiaAberta(true);
      return;
    }

    try {
      setGerando(true);
      setErro("");

      const novo = await gerarCronogramaIA({
        nomeUsuario: configuracoes.nomeUsuario,
        concurso: configuracoes.concurso,
        banca: configuracoes.bancaPadrao,
        periodo,
        tempoDisponivelMinutos: tempoDisponivel,
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
          minutosDia: configuracoes.metaMinutosDiaria,
          questoesDia: configuracoes.metaQuestoesDiaria,
          revisoesDia: configuracoes.metaRevisoesDiaria,
        },
        questoes: questoes.map((item) => ({
          materia: item.materia,
          assunto: item.assunto,
          certas: item.certas,
          erradas: item.erradas,
          minutos: item.minutos,
          data: item.data,
        })),
        sessoes: sessoes.map((item) => ({
          materia: item.materia,
          assunto: item.assunto,
          tipo: item.tipo,
          minutos: item.minutos,
          data: item.data,
        })),
        revisoes: revisoes.map((item) => ({
          id: item.id,
          materia: item.materia,
          assunto: item.assunto,
          etapa: item.etapa,
          dataPrevista: item.dataPrevista,
          concluida: item.concluida,
        })),
        simulados: simulados.map((item) => ({
          nome: item.nome,
          banca: item.banca,
          certas: item.certas,
          erradas: item.erradas,
          anuladas: item.anuladas,
          minutos: item.minutos,
          data: item.data,
        })),
        missoesPendentes: missoesPendentes.slice(0, 80),
      });

      setCronogramaAtual(novo);
      setCronogramas((anteriores) => [novo, ...anteriores]);
      setDiaAberto(null);
      setEstrategiaAberta(false);
    } catch (erroGeracao) {
      setErro(obterMensagemErro(erroGeracao));
    } finally {
      setGerando(false);
    }
  }

  async function excluir(cronograma: CronogramaGeradoIA) {
    if (!cronograma.id) return;

    const confirmar = window.confirm(`Excluir "${cronograma.titulo}"?`);
    if (!confirmar) return;

    try {
      await excluirCronogramaIA(cronograma.id);

      const novaLista = cronogramas.filter(
        (item) => item.id !== cronograma.id
      );
      setCronogramas(novaLista);

      if (cronogramaAtual?.id === cronograma.id) {
        setCronogramaAtual(novaLista[0] ?? null);
      }
    } catch (erroExclusao) {
      setErro(obterMensagemErro(erroExclusao));
    }
  }

  function iniciarTarefa(tarefa: TarefaCronogramaIA) {
    const cronometro = {
      ativo: true,
      pausado: false,
      materia: tarefa.materia,
      assunto: tarefa.assunto,
      tipo:
        tarefa.tipo === "revisao"
          ? "revisao"
          : tarefa.tipo === "questoes"
            ? "questoes"
            : "estudo",
      objetivo: tarefa.titulo,
      iniciadaEm: new Date().toISOString(),
      pausadaEm: null,
      segundosPausados: 0,
      missaoId: tarefa.missaoId,
    };

    localStorage.setItem(
      "pmpe_cronometro_estudo",
      JSON.stringify(cronometro)
    );

    window.dispatchEvent(new Event("pmpe-cronometro-atualizado"));
    navigate("/central-estudos");
  }

  function executarAcaoPrincipal() {
    if (!cronogramaAtual || !tarefaAtual) {
      if (!perfilSalvo) {
        setEstrategiaAberta(true);
        setMensagemPerfil(
          "Configure sua estratégia antes de gerar o primeiro plano."
        );
        return;
      }

      void gerar();
      return;
    }

    if (!planoAtualAprovado) {
      aprovarCronograma(cronogramaAtual);
      return;
    }

    iniciarTarefa(tarefaAtual);
  }

  const textoAcaoPrincipal = carregando
    ? "Carregando plano..."
    : gerando
      ? "Montando plano..."
      : !cronogramaAtual || !tarefaAtual
        ? "Gerar missão"
        : !planoAtualAprovado
          ? "Aprovar plano"
          : "Iniciar missão";

  return (
    <section className="cronograma-container tatico-container">
      <header className="tatico-cabecalho">
        <div>
          <span className="tatico-eyebrow">PLANO TÁTICO</span>
          <h1>Central de comando do estudo</h1>
          <p>
            Veja o que estudar agora, o que vem depois e por que a IA definiu
            essa prioridade.
          </p>
        </div>

        <button
          type="button"
          className="tatico-botao-estrategia"
          onClick={() => setEstrategiaAberta((aberta) => !aberta)}
          aria-expanded={estrategiaAberta}
        >
          ⚙ Ajustar estratégia
        </button>
      </header>

      {erro && <div className="tatico-alerta tatico-alerta-erro">{erro}</div>}

      <section className="tatico-missao-atual">
        <div className="tatico-missao-superior">
          <div>
            <span className="tatico-secao-label">SUA MISSÃO ATUAL</span>
            <span
              className={`tatico-status ${
                planoAtualAprovado ? "aprovado" : cronogramaAtual ? "pendente" : "neutro"
              }`}
            >
              {planoAtualAprovado
                ? "Plano aprovado"
                : cronogramaAtual
                  ? "Aguardando aprovação"
                  : "Aguardando plano"}
            </span>
          </div>
          <span className="tatico-prioridade-badge">
            Prioridade: {prioridadeAtiva || "coletando dados"}
          </span>
        </div>

        <div className="tatico-missao-grid">
          <div className="tatico-missao-conteudo">
            <span className="tatico-missao-tipo">
              {tarefaAtual ? formatarTipo(tarefaAtual.tipo) : "Próxima ação"}
            </span>
            <h2>{tarefaAtual?.materia || prioridadeAtiva || "Definir prioridade"}</h2>
            <p className="tatico-missao-assunto">
              {tarefaAtual?.assunto ||
                "Gere o plano para transformar seu diagnóstico em uma missão objetiva."}
            </p>

            {tarefaAtual && (
              <div className="tatico-missao-meta">
                <span>{tarefaAtual.duracaoMinutos} min</span>
                {tarefaAtual.quantidadeQuestoes > 0 && (
                  <span>{tarefaAtual.quantidadeQuestoes} questões</span>
                )}
                <span>{formatarTipo(tarefaAtual.tipo)}</span>
              </div>
            )}
          </div>

          <div className="tatico-missao-contexto">
            <div>
              <span>Tempo disponível hoje</span>
              <strong>{formatarMinutos(tempoDisponivel)}</strong>
            </div>
            <div>
              <span>Objetivo do plano</span>
              <strong>
                {cronogramaAtual?.objetivoPrincipal ||
                  (prioridadeAtiva
                    ? `Reforçar ${prioridadeAtiva} sem abandonar o restante do ciclo.`
                    : "Criar uma distribuição baseada no desempenho recente.")}
              </strong>
            </div>
          </div>
        </div>

        <div className="tatico-missao-acoes">
          <button
            type="button"
            className="tatico-botao-principal"
            onClick={executarAcaoPrincipal}
            disabled={carregando || gerando}
          >
            {textoAcaoPrincipal}
          </button>

          {cronogramaAtual && !planoAtualAprovado && (
            <span className="tatico-ajuda-inline">
              Revise o plano abaixo antes de aprovar. A IA não inicia nenhuma
              tarefa automaticamente.
            </span>
          )}
        </div>
      </section>

      {estrategiaAberta && (
        <section className="tatico-painel tatico-estrategia">
          <div className="tatico-painel-cabecalho">
            <div>
              <span className="tatico-secao-label">ESTRATÉGIA</span>
              <h2>Ajustar estratégia</h2>
              <p>
                Estas preferências orientam as próximas propostas. O domingo
                estratégico continua fixo.
              </p>
            </div>
            <button
              type="button"
              className="tatico-botao-fechar"
              onClick={() => setEstrategiaAberta(false)}
              aria-label="Fechar ajustes de estratégia"
            >
              ×
            </button>
          </div>

          <div className="tatico-estrategia-grid">
            <label>
              Período do próximo plano
              <select
                value={periodo}
                onChange={(evento) =>
                  setPeriodo(evento.target.value as PeriodoCronogramaIA)
                }
              >
                <option value="hoje">Hoje</option>
                <option value="7-dias">Próximos 7 dias</option>
              </select>
            </label>

            <label>
              {periodo === "hoje"
                ? "Minutos disponíveis hoje"
                : "Minutos disponíveis por dia"}
              <input
                type="number"
                min={20}
                max={600}
                value={tempoDisponivel}
                onChange={(evento) =>
                  setTempoDisponivel(Math.max(0, Number(evento.target.value)))
                }
              />
            </label>

            <label>
              Minutos padrão por dia
              <input
                type="number"
                min={20}
                max={600}
                value={perfil.minutosPorDia}
                onChange={(evento) =>
                  setPerfil({
                    ...perfil,
                    minutosPorDia: Number(evento.target.value),
                  })
                }
              />
            </label>

            <label>
              Dias de estudo por semana
              <input
                type="number"
                min={1}
                max={7}
                value={perfil.diasPorSemana}
                onChange={(evento) =>
                  setPerfil({
                    ...perfil,
                    diasPorSemana: Number(evento.target.value),
                  })
                }
              />
            </label>

            <label>
              Maior dificuldade declarada
              <select
                value={perfil.materiaMaiorDificuldade}
                onChange={(evento) =>
                  setPerfil({
                    ...perfil,
                    materiaMaiorDificuldade: evento.target.value,
                  })
                }
              >
                <option value="">Selecione</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.nome}>
                    {materia.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Nível atual
              <select
                value={perfil.nivelAtual}
                onChange={(evento) =>
                  setPerfil({
                    ...perfil,
                    nivelAtual: evento.target.value as PerfilCronograma["nivelAtual"],
                  })
                }
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </label>

            <label>
              Formato preferido
              <select
                value={perfil.formatoPreferido}
                onChange={(evento) =>
                  setPerfil({
                    ...perfil,
                    formatoPreferido:
                      evento.target.value as PerfilCronograma["formatoPreferido"],
                  })
                }
              >
                <option value="teoria-questoes">Teoria + questões</option>
                <option value="teoria">Mais teoria</option>
                <option value="questoes">Mais questões</option>
              </select>
            </label>

            <div className="tatico-campo-fixo">
              <span>Domingo estratégico</span>
              <strong>Redação + simulado</strong>
              <small>Regra fixa do plano</small>
            </div>

            <label className="tatico-observacao">
              Observação sobre sua rotina
              <textarea
                value={perfil.observacao}
                onChange={(evento) =>
                  setPerfil({ ...perfil, observacao: evento.target.value })
                }
                placeholder="Ex.: de manhã teoria; à noite questões e revisões."
              />
            </label>
          </div>

          <div className="tatico-estrategia-rodape">
            <div>
              {mensagemPerfil && <span>{mensagemPerfil}</span>}
              <small>
                {perfilSalvo ? "Estratégia configurada" : "Configuração inicial pendente"}
              </small>
            </div>
            <div className="tatico-estrategia-acoes">
              <button type="button" className="tatico-botao-secundario" onClick={salvarPerfil}>
                Salvar estratégia
              </button>
              <button
                type="button"
                className="tatico-botao-principal compacto"
                onClick={() => void gerar()}
                disabled={gerando || !perfilSalvo}
              >
                {gerando ? "Montando plano..." : "Gerar novo plano"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="tatico-painel tatico-plano-semana">
        <div className="tatico-painel-cabecalho">
          <div>
            <span className="tatico-secao-label">DEPOIS</span>
            <h2>{cronogramaAtual?.periodo === "hoje" ? "Plano de hoje" : "Plano dos próximos dias"}</h2>
            <p>
              Visão compacta. Abra somente o dia que deseja analisar em detalhe.
            </p>
          </div>
          {cronogramaAtual && (
            <strong className="tatico-total-plano">
              {formatarMinutos(cronogramaAtual.tempoTotalMinutos)}
            </strong>
          )}
        </div>

        {carregando ? (
          <div className="tatico-vazio">Carregando seu plano...</div>
        ) : !cronogramaAtual ? (
          <div className="tatico-vazio">
            <strong>Nenhum plano gerado.</strong>
            <span>Use “Ajustar estratégia” para definir o período e gerar a primeira missão.</span>
          </div>
        ) : (
          <>
            <div className="tatico-plano-resumo">
              <div>
                <span>{cronogramaAtual.titulo}</span>
                <strong>{cronogramaAtual.objetivoPrincipal}</strong>
              </div>
              <span>{cronogramaAtual.resumo}</span>
            </div>

            <div className="tatico-dias-lista">
              {agruparPorDia(cronogramaAtual.tarefas).map((grupo) => {
                const primeira = grupo.tarefas[0];
                const minutosDia = grupo.tarefas.reduce(
                  (total, tarefa) => total + tarefa.duracaoMinutos,
                  0
                );
                const aberto = diaAberto === grupo.dia;

                return (
                  <article
                    key={grupo.dia}
                    className={`tatico-dia-card ${aberto ? "aberto" : ""}`}
                  >
                    <button
                      type="button"
                      className="tatico-dia-resumo"
                      onClick={() => setDiaAberto(aberto ? null : grupo.dia)}
                      aria-expanded={aberto}
                    >
                      <div className="tatico-dia-data">
                        <span>
                          {formatarDiaDoPlano(
                            cronogramaAtual.geradoEm,
                            grupo.dia,
                            cronogramaAtual.periodo
                          )}
                        </span>
                        <strong>{primeira?.materia || "Estudo"}</strong>
                        <small>
                          {primeira?.assunto || "Conteúdo planejado"}
                          {grupo.tarefas.length > 1
                            ? ` · +${grupo.tarefas.length - 1} tarefa${
                                grupo.tarefas.length - 1 === 1 ? "" : "s"
                              }`
                            : ""}
                        </small>
                      </div>

                      <div className="tatico-dia-meta">
                        <strong>{formatarMinutos(minutosDia)}</strong>
                        <span>{grupo.tarefas.length} tarefa{grupo.tarefas.length === 1 ? "" : "s"}</span>
                        <b>{aberto ? "−" : "+"}</b>
                      </div>
                    </button>

                    {aberto && (
                      <div className="tatico-dia-detalhes">
                        {grupo.tarefas.map((tarefa) => (
                          <div key={tarefa.id} className="tatico-tarefa-linha">
                            <div className="tatico-tarefa-ordem">{tarefa.ordem}</div>
                            <div className="tatico-tarefa-info">
                              <div>
                                <strong>{tarefa.titulo}</strong>
                                <span>{tarefa.materia} · {tarefa.assunto}</span>
                              </div>
                              <p>{tarefa.justificativa}</p>
                            </div>
                            <div className="tatico-tarefa-acao">
                              <span>{tarefa.duracaoMinutos} min</span>
                              <small>
                                {formatarTipo(tarefa.tipo)}
                                {tarefa.quantidadeQuestoes > 0
                                  ? ` · ${tarefa.quantidadeQuestoes} questões`
                                  : ""}
                              </small>
                              <button
                                type="button"
                                onClick={() => iniciarTarefa(tarefa)}
                                disabled={!planoAtualAprovado}
                              >
                                {planoAtualAprovado ? "Iniciar" : "Aprovar plano"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="tatico-painel tatico-diagnostico">
        <div className="tatico-painel-cabecalho">
          <div>
            <span className="tatico-secao-label">POR QUÊ</span>
            <h2>Por que essa missão?</h2>
            <p>Diagnóstico dos últimos {diagnosticoSemanal.janelaDias} dias.</p>
          </div>
          <button
            type="button"
            className="tatico-botao-texto"
            onClick={() => setDiagnosticoAberto((aberto) => !aberto)}
            aria-expanded={diagnosticoAberto}
          >
            {diagnosticoAberto ? "Ocultar diagnóstico" : "Ver diagnóstico completo"}
          </button>
        </div>

        <div className="tatico-diagnostico-resumo">
          <div>
            <span>Prioridade atual</span>
            <strong>{prioridadeAtiva || "Coletando dados"}</strong>
          </div>
          <div>
            <span>Confiança dos dados</span>
            <strong>
              {diagnosticoSemanal.possuiDados
                ? `${rotuloConfianca(diagnosticoSemanal.confianca)} · ${diagnosticoSemanal.confianca}%`
                : "Dados insuficientes"}
            </strong>
          </div>
          <div>
            <span>Ponto forte</span>
            <strong>
              {pontoForte
                ? `${pontoForte.materia} · ${pontoForte.percentualAcertos}%`
                : "Ainda não identificado"}
            </strong>
          </div>
          <div>
            <span>Ponto crítico</span>
            <strong>
              {pontoCritico
                ? `${pontoCritico.materia} · prioridade ${pontoCritico.prioridade}/100`
                : "Ainda não identificado"}
            </strong>
          </div>
        </div>

        <div className="tatico-explicacao-prioridade">
          <span>Decisão do plano</span>
          <strong>
            {prioridadeAtiva
              ? `Por isso seu plano está priorizando ${prioridadeAtiva}.`
              : "Registre questões, sessões ou revisões para a IA calcular uma prioridade confiável."}
          </strong>
          {diagnosticoSemanal.motivos[0] && <p>{diagnosticoSemanal.motivos[0]}</p>}
        </div>

        {diagnosticoAberto && (
          <div className="tatico-diagnostico-detalhes">
            {diagnosticoSemanal.materias.length === 0 ? (
              <div className="tatico-vazio compacto">
                Ainda não há evidência suficiente nos últimos {diagnosticoSemanal.janelaDias} dias.
              </div>
            ) : (
              diagnosticoSemanal.materias.map((item, indice) => (
                <article key={item.materia} className="tatico-ranking-linha">
                  <span className="tatico-ranking-posicao">{indice + 1}</span>
                  <div>
                    <strong>{item.materia}</strong>
                    <small>
                      {item.percentualAcertos !== undefined
                        ? `${item.percentualAcertos}% de acertos · `
                        : ""}
                      {item.questoes} questões · {item.revisoesAtrasadas} revisões atrasadas
                    </small>
                    {item.motivos[0] && <p>{item.motivos[0]}</p>}
                  </div>
                  <div className="tatico-ranking-score">
                    <strong>{item.prioridade}</strong>
                    <span>prioridade</span>
                    <small>{item.confianca}% confiança</small>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      <section className="tatico-painel tatico-ajustes-ia">
        <div className="tatico-painel-cabecalho">
          <div>
            <span className="tatico-secao-label">O QUE MUDOU</span>
            <h2>Ajustes da IA</h2>
            <p>A automação altera prioridade, não remove matérias nem aumenta sua carga diária.</p>
          </div>
          <label className="tatico-toggle">
            <input
              type="checkbox"
              checked={automacaoAtiva}
              onChange={(evento) => alternarAutomacao(evento.target.checked)}
            />
            <span>{automacaoAtiva ? "Automação ativa" : "Automação pausada"}</span>
          </label>
        </div>

        <div className="tatico-ajuste-atual">
          <div>
            <span>Último ajuste realizado</span>
            <strong>
              {ultimoAjuste
                ? `${ultimoAjuste.materiaAnterior || "Prioridade anterior"} → ${ultimoAjuste.materiaPrioritaria}`
                : "Nenhum ajuste automático realizado"}
            </strong>
            <small>
              {ultimoAjuste
                ? `${formatarData(ultimoAjuste.criadoEm)} · ${ultimoAjuste.ativo ? "ativo" : "desfeito"}`
                : "A IA só aplicará um ajuste quando houver evidência suficiente."}
            </small>
          </div>

          <div className="tatico-ajuste-acoes">
            {ajusteAtivo && (
              <button
                type="button"
                className="tatico-botao-secundario"
                onClick={() => desfazerAjuste(ajusteAtivo)}
              >
                Desfazer
              </button>
            )}
            <button
              type="button"
              className="tatico-botao-texto"
              onClick={() => setAjustesAbertos((aberto) => !aberto)}
              aria-expanded={ajustesAbertos}
            >
              {ajustesAbertos ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
          </div>
        </div>

        {mensagemAutomacao && (
          <div className="tatico-alerta tatico-alerta-info">{mensagemAutomacao}</div>
        )}

        {ajustesAbertos && (
          <div className="tatico-ajustes-detalhes">
            <div className="tatico-regras-ia">
              <span>Regras da automação</span>
              <ul>
                <li>Aplica ajustes somente no início de uma nova semana.</li>
                <li>Nenhuma matéria é removida do plano.</li>
                <li>A disponibilidade diária não é aumentada.</li>
                <li>Todo ajuste ativo pode ser desfeito.</li>
              </ul>
            </div>

            <div className="tatico-historico-ajustes">
              <span>Histórico de alterações</span>
              {ajustes.length === 0 ? (
                <p>Nenhum ajuste registrado.</p>
              ) : (
                ajustes.slice(0, 8).map((ajuste) => (
                  <article key={ajuste.id}>
                    <div>
                      <strong>{ajuste.materiaPrioritaria}</strong>
                      <small>
                        {ajuste.semana} · {ajuste.ativo ? "ativo" : "desfeito"}
                      </small>
                      <p>{ajuste.motivo}</p>
                    </div>
                    {ajuste.ativo && (
                      <button type="button" onClick={() => desfazerAjuste(ajuste)}>
                        Desfazer
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <section className={`tatico-painel tatico-historico ${historicoAberto ? "aberto" : ""}`}>
        <button
          type="button"
          className="tatico-historico-toggle"
          onClick={() => setHistoricoAberto((aberto) => !aberto)}
          aria-expanded={historicoAberto}
        >
          <div>
            <span className="tatico-secao-label">O QUE JÁ ACONTECEU</span>
            <h2>Histórico e relatório</h2>
            <p>
              {cronogramas.length} plano{cronogramas.length === 1 ? "" : "s"} salvo{cronogramas.length === 1 ? "" : "s"} · {relatorioMensal.questoes} questões no mês · {relatorioMensal.aproveitamento}% de acertos
            </p>
          </div>
          <strong>{historicoAberto ? "−" : "+"}</strong>
        </button>

        {historicoAberto && (
          <div className="tatico-historico-conteudo">
            <section className="tatico-relatorio-mensal">
              <div className="tatico-subcabecalho">
                <div>
                  <span>Relatório mensal</span>
                  <strong>
                    {new Date(`${relatorioMensal.mes}-02T12:00:00`).toLocaleDateString(
                      "pt-BR",
                      { month: "long", year: "numeric" }
                    )}
                  </strong>
                </div>
              </div>

              <div className="tatico-relatorio-grid">
                <div>
                  <span>Tempo realizado</span>
                  <strong>{(relatorioMensal.minutosRealizados / 60).toFixed(1)}h</strong>
                  <small>de {(relatorioMensal.minutosPlanejados / 60).toFixed(1)}h planejadas</small>
                </div>
                <div>
                  <span>Questões</span>
                  <strong>{relatorioMensal.questoes}</strong>
                  <small>{relatorioMensal.aproveitamento}% de acertos</small>
                </div>
                <div>
                  <span>Revisões</span>
                  <strong>{relatorioMensal.revisoes}</strong>
                  <small>{relatorioMensal.simulados} simulados</small>
                </div>
                <div>
                  <span>Redações</span>
                  <strong>{relatorioMensal.redacoes}</strong>
                  <small>{relatorioMensal.percentualTempo}% da meta de tempo</small>
                </div>
              </div>

              <div className="tatico-relatorio-leitura">
                <p><strong>Destaque:</strong> {relatorioMensal.materiaDestaque || "dados insuficientes"}</p>
                <p><strong>Ponto crítico:</strong> {relatorioMensal.materiaCritica || "dados insuficientes"}</p>
                <p><strong>Próxima decisão:</strong> {relatorioMensal.proposta}</p>
              </div>
            </section>

            <section className="tatico-planos-antigos">
              <div className="tatico-subcabecalho">
                <div>
                  <span>Planos salvos</span>
                  <strong>{cronogramas.length}</strong>
                </div>
              </div>

              {cronogramas.length === 0 ? (
                <div className="tatico-vazio compacto">Nenhum plano salvo.</div>
              ) : (
                <div className="tatico-planos-lista">
                  {cronogramas.map((cronograma) => (
                    <article
                      key={cronograma.id || cronograma.geradoEm}
                      className={
                        identificadorCronograma(cronogramaAtual ?? cronograma) ===
                        identificadorCronograma(cronograma)
                          ? "ativo"
                          : ""
                      }
                    >
                      <button
                        type="button"
                        className="tatico-plano-abrir"
                        onClick={() => {
                          setCronogramaAtual(cronograma);
                          setDiaAberto(null);
                        }}
                      >
                        <strong>{cronograma.titulo}</strong>
                        <span>
                          {formatarData(cronograma.geradoEm)} · {cronograma.periodo === "hoje" ? "Hoje" : "7 dias"}
                        </span>
                      </button>

                      {cronograma.id && (
                        <button
                          type="button"
                          className="tatico-plano-excluir"
                          onClick={() => void excluir(cronograma)}
                          aria-label={`Excluir ${cronograma.titulo}`}
                        >
                          ×
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </section>
  );
}

function agruparPorDia(tarefas: TarefaCronogramaIA[]) {
  const mapa = new Map<number, TarefaCronogramaIA[]>();

  tarefas.forEach((tarefa) => {
    const dia = Math.max(1, tarefa.dia || 1);
    const lista = mapa.get(dia) ?? [];
    lista.push(tarefa);
    mapa.set(dia, lista);
  });

  return Array.from(mapa.entries())
    .sort(([a], [b]) => a - b)
    .map(([dia, lista]) => ({
      dia,
      tarefas: [...lista].sort((a, b) => a.ordem - b.ordem),
    }));
}

function formatarTipo(tipo: TarefaCronogramaIA["tipo"]) {
  const nomes = {
    teoria: "Teoria",
    questoes: "Questões",
    revisao: "Revisão",
    simulado: "Simulado",
    redacao: "Redação",
    misto: "Misto",
  };

  return nomes[tipo];
}

function formatarMinutos(total: number) {
  const minutos = Math.max(0, Math.round(total));
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;

  if (horas === 0) return `${restante}min`;
  if (restante === 0) return `${horas}h`;
  return `${horas}h ${restante}min`;
}

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarDiaDoPlano(
  geradoEm: string,
  dia: number,
  periodo: PeriodoCronogramaIA
) {
  if (periodo === "hoje") return "Hoje";

  const data = new Date(geradoEm);
  if (Number.isNaN(data.getTime())) return `Dia ${dia}`;

  data.setDate(data.getDate() + Math.max(0, dia - 1));
  const rotulo = data.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

function rotuloConfianca(valor: number) {
  if (valor >= 70) return "Alta";
  if (valor >= 40) return "Média";
  return "Baixa";
}

function obterMensagemErro(erro: unknown) {
  return erro instanceof Error
    ? erro.message
    : "Ocorreu um erro inesperado.";
}
