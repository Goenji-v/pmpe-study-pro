import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import "./CentralRedacaoBridge.css";

import { armazenamentoLocalDaConta as localStorage } from "../../services/armazenamentoConta";
import { useApp } from "../../context/AppContext";
import { formatarTempo, useCronometro } from "../../context/CronometroContext";
import { useToast } from "../../context/ToastContext";
import {
  criarPlanoCalendario,
  normalizarMissoesPorDia,
  obterDiaAtualPlano,
} from "../../utils/planoCalendario";
import { aplicarDiasAtividadesSemanais } from "../../utils/atividadesSemanaisPlano";
import { getSemanaAtual } from "../../utils/planoUtils";
import { localizarMissaoRedacaoPendenteDoDia } from "../../utils/redacaoPlano";
import {
  montarObservacaoRedacao,
  type ModalidadeRedacao,
} from "../../utils/redacaoRegistro";
import {
  criarRascunhoTreinoRedacao,
  normalizarRascunhoTreinoRedacao,
  rascunhoTreinoRedacaoTemConteudo,
} from "../../utils/redacaoTreino";

const TIPO_REDACAO = "redacao" as const;
const MATERIA_REDACAO = "Redação";
const CHAVE_RASCUNHO_REDACAO = "pmpe:redacao:rascunho";

type PendenciaRedacao = {
  iniciadaEm: string | null;
  tema: string;
  modalidade: ModalidadeRedacao;
  nota?: number;
};

export default function CentralRedacaoBridge() {
  const location = useLocation();
  const { showToast } = useToast();
  const {
    sessoes,
    setSessoes,
    missoesConcluidas,
    configuracoes,
  } = useApp();
  const {
    sessaoAtiva,
    segundosDecorridos,
    cronometroAtivo,
    iniciar,
    prepararSessao,
    atualizarDados,
    pausar,
    continuar,
  } = useCronometro();

  const [destinoFormulario, setDestinoFormulario] = useState<HTMLElement | null>(null);
  const [destinoFinalizacao, setDestinoFinalizacao] = useState<HTMLElement | null>(null);
  const [temaFinalizacao, setTemaFinalizacao] = useState("");
  const [notaFinalizacao, setNotaFinalizacao] = useState("");
  const [modalidadeFinalizacao, setModalidadeFinalizacao] =
    useState<ModalidadeRedacao>("treino");

  const pendenciaRef = useRef<PendenciaRedacao | null>(null);
  const tipoAnteriorRef = useRef(sessaoAtiva.tipo);

  const naCentral = location.pathname === "/central-estudos";
  const redacaoAtiva = sessaoAtiva.tipo === TIPO_REDACAO;

  const planoCalendario = useMemo(
    () =>
      aplicarDiasAtividadesSemanais(
        criarPlanoCalendario(
          normalizarMissoesPorDia(configuracoes.missoesPorDia ?? 1),
          configuracoes.planoPadraoAtivo !== false
        ),
        {
          diaRedacaoSemanal: configuracoes.diaRedacaoSemanal ?? "dom",
          diaSimuladoSemanal: configuracoes.diaSimuladoSemanal ?? "dom",
        }
      ),
    [
      configuracoes.missoesPorDia,
      configuracoes.planoPadraoAtivo,
      configuracoes.diaRedacaoSemanal,
      configuracoes.diaSimuladoSemanal,
    ]
  );

  const semanaAtual = useMemo(
    () =>
      getSemanaAtual(
        missoesConcluidas,
        planoCalendario,
        configuracoes.semanaAtualPlano
      ),
    [
      configuracoes.semanaAtualPlano,
      missoesConcluidas,
      planoCalendario,
    ]
  );

  const diaAtual = obterDiaAtualPlano();

  const vinculoRedacaoHoje = useMemo(
    () =>
      localizarMissaoRedacaoPendenteDoDia(
        planoCalendario,
        missoesConcluidas,
        semanaAtual,
        diaAtual
      ),
    [diaAtual, missoesConcluidas, planoCalendario, semanaAtual]
  );

  useEffect(() => {
    if (
      !naCentral ||
      !redacaoAtiva ||
      cronometroAtivo ||
      sessaoAtiva.materia === MATERIA_REDACAO
    ) {
      return;
    }

    const rascunho = carregarRascunhoRedacao();

    prepararSessao({
      materia: MATERIA_REDACAO,
      assunto: rascunho?.tema ?? "",
      tipo: TIPO_REDACAO,
      objetivo:
        rascunho?.objetivo ||
        "Atividade de redação",
      observacao: rascunho?.observacao ?? "",
      missaoId:
        vinculoRedacaoHoje?.missaoId ??
        rascunho?.missaoId,
      semana:
        vinculoRedacaoHoje?.semana ??
        rascunho?.semana,
      dia:
        vinculoRedacaoHoje?.dia ??
        rascunho?.dia,
    });

    if (rascunho) {
      showToast(
        "Rascunho da redação restaurado.",
        "info"
      );
    }
  }, [
    cronometroAtivo,
    naCentral,
    prepararSessao,
    redacaoAtiva,
    sessaoAtiva.materia,
    showToast,
    vinculoRedacaoHoje?.dia,
    vinculoRedacaoHoje?.missaoId,
    vinculoRedacaoHoje?.semana,
  ]);

  useEffect(() => {
    if (
      !redacaoAtiva ||
      cronometroAtivo ||
      sessaoAtiva.materia !== MATERIA_REDACAO
    ) return;

    const rascunho = criarRascunhoTreinoRedacao({
      tema: sessaoAtiva.assunto,
      objetivo: sessaoAtiva.objetivo,
      observacao: sessaoAtiva.observacao,
      missaoId: sessaoAtiva.missaoId,
      semana: sessaoAtiva.semana,
      dia: sessaoAtiva.dia,
    });

    if (!rascunhoTreinoRedacaoTemConteudo(rascunho)) {
      localStorage.removeItem(CHAVE_RASCUNHO_REDACAO);
      return;
    }

    localStorage.setItem(
      CHAVE_RASCUNHO_REDACAO,
      JSON.stringify(rascunho)
    );
  }, [
    cronometroAtivo,
    redacaoAtiva,
    sessaoAtiva.assunto,
    sessaoAtiva.dia,
    sessaoAtiva.materia,
    sessaoAtiva.missaoId,
    sessaoAtiva.objetivo,
    sessaoAtiva.observacao,
    sessaoAtiva.semana,
  ]);

  useEffect(() => {
    if (!naCentral) {
      setDestinoFormulario(null);
      setDestinoFinalizacao(null);
      return;
    }

    const localizarDestinos = () => {
      setDestinoFormulario(
        document.querySelector<HTMLElement>(".central-estudos-formulario")
      );
      setDestinoFinalizacao(
        document.querySelector<HTMLElement>(".finalizacao-grid")
      );
    };

    localizarDestinos();

    const observer = new MutationObserver(localizarDestinos);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [naCentral]);

  useEffect(() => {
    if (!naCentral) return;

    const container = document.querySelector<HTMLElement>(
      ".central-estudos-container"
    );

    container?.classList.toggle(
      "central-redacao-ativa",
      redacaoAtiva
    );

    return () => {
      container?.classList.remove("central-redacao-ativa");
    };
  }, [naCentral, redacaoAtiva, destinoFormulario]);

  useEffect(() => {
    const anterior = tipoAnteriorRef.current;
    const atual = sessaoAtiva.tipo;

    if (
      anterior === TIPO_REDACAO &&
      atual !== TIPO_REDACAO &&
      !cronometroAtivo
    ) {
      tipoAnteriorRef.current = atual;
      prepararSessao({
        materia: "",
        assunto: "",
        tipo: atual,
      });
      return;
    }

    tipoAnteriorRef.current = atual;
  }, [cronometroAtivo, prepararSessao, sessaoAtiva.tipo]);

  useEffect(() => {
    if (!destinoFinalizacao || !redacaoAtiva) return;

    setTemaFinalizacao(sessaoAtiva.assunto || "");
    setNotaFinalizacao("");
    setModalidadeFinalizacao("treino");
  }, [destinoFinalizacao, redacaoAtiva, sessaoAtiva.assunto]);

  useEffect(() => {
    if (!destinoFinalizacao || !redacaoAtiva) return;

    const botaoSalvar = document.querySelector<HTMLButtonElement>(
      ".finalizacao-confirmar"
    );

    if (!botaoSalvar) return;

    const capturarFinalizacao = (evento: Event) => {
      const tema = temaFinalizacao.trim();
      const nota =
        modalidadeFinalizacao === "completa"
          ? parseNota(notaFinalizacao)
          : undefined;

      if (!tema) {
        evento.preventDefault();
        evento.stopPropagation();
        window.alert(
          modalidadeFinalizacao === "treino"
            ? "Informe o tema ou foco do treino."
            : "Informe o tema da redação."
        );
        return;
      }

      if (
        modalidadeFinalizacao === "completa" &&
        notaFinalizacao.trim() &&
        nota === undefined
      ) {
        evento.preventDefault();
        evento.stopPropagation();
        window.alert("Informe uma nota válida ou deixe o campo em branco.");
        return;
      }

      pendenciaRef.current = {
        iniciadaEm: sessaoAtiva.iniciadoEm,
        tema,
        modalidade: modalidadeFinalizacao,
        nota,
      };
    };

    botaoSalvar.addEventListener("click", capturarFinalizacao, true);

    return () =>
      botaoSalvar.removeEventListener("click", capturarFinalizacao, true);
  }, [
    destinoFinalizacao,
    modalidadeFinalizacao,
    notaFinalizacao,
    redacaoAtiva,
    sessaoAtiva.iniciadoEm,
    temaFinalizacao,
  ]);

  useEffect(() => {
    const pendencia = pendenciaRef.current;
    if (!pendencia) return;

    const sessaoCriada = sessoes.find(
      (sessao) =>
        sessao.tipo === TIPO_REDACAO &&
        sessao.iniciadaEm === pendencia.iniciadaEm
    );

    if (!sessaoCriada) return;

    pendenciaRef.current = null;
    localStorage.removeItem(CHAVE_RASCUNHO_REDACAO);

    setSessoes((anteriores) =>
      anteriores.map((sessao) => {
        if (sessao.id !== sessaoCriada.id) return sessao;

        const observacao = montarObservacaoRedacao(
          sessao.observacao,
          pendencia.modalidade,
          pendencia.nota
        );

        return {
          ...sessao,
          materia: MATERIA_REDACAO,
          assunto: pendencia.tema,
          notaRedacao: pendencia.nota,
          observacao,
        };
      })
    );
  }, [sessoes, setSessoes]);

  function iniciarTreinoRedacao() {
    if (cronometroAtivo || !redacaoAtiva) return;

    const tema = sessaoAtiva.assunto.trim();
    if (!tema) {
      showToast(
        "Informe o tema ou foco do treino antes de iniciar.",
        "warning"
      );
      return;
    }

    const iniciada = iniciar({
      materia: MATERIA_REDACAO,
      assunto: tema,
      tipo: TIPO_REDACAO,
      objetivo: sessaoAtiva.objetivo,
      observacao: sessaoAtiva.observacao,
      missaoId:
        sessaoAtiva.missaoId ??
        vinculoRedacaoHoje?.missaoId,
      semana:
        sessaoAtiva.semana ??
        vinculoRedacaoHoje?.semana,
      dia:
        sessaoAtiva.dia ??
        vinculoRedacaoHoje?.dia,
    });

    if (iniciada) {
      showToast(
        "Treino de redação iniciado. O cronômetro será retomado mesmo após atualizar a página.",
        "success"
      );
    }
  }

  return (
    <>
      {naCentral && redacaoAtiva && destinoFormulario &&
        createPortal(
          <>
            <div className="central-estudos-campo central-redacao-campo">
              <label>Matéria</label>
              <div className="central-redacao-materia-fixa">
                <span>✍️</span>
                <div>
                  <strong>Redação</strong>
                  <small>Fixa no Study Pro e não aparece em Meus Conteúdos.</small>
                </div>
              </div>
            </div>

            <div className="central-estudos-campo central-redacao-campo">
              <label>Tema ou foco da atividade</label>
              <input
                value={sessaoAtiva.assunto}
                onChange={(evento) =>
                  atualizarDados({ assunto: evento.target.value })
                }
                disabled={cronometroAtivo}
                placeholder="Ex.: treinar introdução sobre desperdício de alimentos"
              />
              <small>
                Pode ser o tema completo ou apenas a parte da redação que será treinada.
              </small>
            </div>

            <div className="central-estudos-campo central-redacao-campo">
              <label>
                Objetivo <small>(opcional)</small>
              </label>
              <input
                value={sessaoAtiva.objetivo}
                onChange={(evento) =>
                  atualizarDados({ objetivo: evento.target.value })
                }
                disabled={cronometroAtivo}
                placeholder="Ex.: treinar introdução, D1, D2 e conclusão"
              />
            </div>

            <div className="central-estudos-campo central-redacao-campo">
              <label>
                Observações <small>(opcional)</small>
              </label>
              <textarea
                value={sessaoAtiva.observacao}
                onChange={(evento) =>
                  atualizarDados({ observacao: evento.target.value })
                }
                disabled={cronometroAtivo}
                placeholder="Pontos treinados, dificuldades, repertórios usados..."
              />
            </div>

            <div className="central-redacao-controles">
              <div className="central-redacao-status">
                <span>
                  {!cronometroAtivo
                    ? "Pronto para iniciar"
                    : sessaoAtiva.status === "pausado"
                      ? "Treino pausado"
                      : "Treino em andamento"}
                </span>
                <strong>{formatarTempo(segundosDecorridos)}</strong>
              </div>

              <div className="central-redacao-acoes">
                {!cronometroAtivo && (
                  <button
                    type="button"
                    className="central-redacao-iniciar"
                    onClick={iniciarTreinoRedacao}
                  >
                    ▶ Iniciar treino
                  </button>
                )}

                {cronometroAtivo && sessaoAtiva.status === "rodando" && (
                  <button
                    type="button"
                    className="central-redacao-pausar"
                    onClick={pausar}
                  >
                    ⏸ Pausar
                  </button>
                )}

                {cronometroAtivo && sessaoAtiva.status === "pausado" && (
                  <button
                    type="button"
                    className="central-redacao-continuar"
                    onClick={continuar}
                  >
                    ▶ Continuar
                  </button>
                )}
              </div>

              <small>
                {!cronometroAtivo
                  ? "Tema, objetivo e observações são salvos automaticamente neste aparelho."
                  : "Sessão salva automaticamente. Se atualizar ou fechar a página, o cronômetro retoma do ponto correto."}
              </small>
            </div>
          </>,
          destinoFormulario
        )}

      {naCentral && redacaoAtiva && destinoFinalizacao &&
        createPortal(
          <>
            <label className="central-redacao-finalizacao">
              Tipo do registro
              <select
                value={modalidadeFinalizacao}
                onChange={(evento) => {
                  const modalidade = evento.target.value as ModalidadeRedacao;
                  setModalidadeFinalizacao(modalidade);
                  if (modalidade === "treino") {
                    setNotaFinalizacao("");
                  }
                }}
              >
                <option value="treino">Treino de redação</option>
                <option value="completa">Redação completa</option>
              </select>
              <small>
                Treino registra o tempo sem nota. Redação completa permite informar a nota.
              </small>
            </label>

            <label className="central-redacao-finalizacao">
              {modalidadeFinalizacao === "treino"
                ? "Tema ou foco do treino"
                : "Tema da redação"}
              <input
                value={temaFinalizacao}
                onChange={(evento) => setTemaFinalizacao(evento.target.value)}
                placeholder={
                  modalidadeFinalizacao === "treino"
                    ? "Ex.: introdução, D1 ou conclusão"
                    : "Tema trabalhado na redação"
                }
              />
            </label>

            {modalidadeFinalizacao === "completa" && (
              <label className="central-redacao-finalizacao">
                Nota obtida <small>(opcional)</small>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={notaFinalizacao}
                  onChange={(evento) => setNotaFinalizacao(evento.target.value)}
                  placeholder="Ex.: 8.5, 18 ou 85"
                />
              </label>
            )}

            <div className="central-redacao-finalizacao-info finalizacao-campo-largo">
              {modalidadeFinalizacao === "treino"
                ? "O treino será identificado no Histórico e o tempo entrará normalmente no Dashboard. Se houver uma missão de redação pendente hoje, ela também será concluída com este mesmo registro."
                : "A redação completa será identificada no Histórico, com a nota quando informada. O tempo entra normalmente no Dashboard e conclui a missão de redação pendente do dia sem duplicação."}
            </div>
          </>,
          destinoFinalizacao
        )}
    </>
  );
}

function carregarRascunhoRedacao() {
  const salvo = localStorage.getItem(CHAVE_RASCUNHO_REDACAO);
  if (!salvo) return null;

  try {
    return normalizarRascunhoTreinoRedacao(
      JSON.parse(salvo)
    );
  } catch {
    localStorage.removeItem(CHAVE_RASCUNHO_REDACAO);
    return null;
  }
}

function parseNota(valor: string) {
  if (!valor.trim()) return undefined;

  const nota = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(nota) || nota < 0 || nota > 1000) {
    return undefined;
  }

  return Math.round(nota * 100) / 100;
}
