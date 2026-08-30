import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import "./CentralRedacaoBridge.css";

import { useApp } from "../../context/AppContext";
import { useCronometro } from "../../context/CronometroContext";
import {
  criarPlanoCalendario,
  normalizarMissoesPorDia,
  obterDiaAtualPlano,
} from "../../utils/planoCalendario";
import { getSemanaAtual } from "../../utils/planoUtils";
import { localizarMissaoRedacaoPendenteDoDia } from "../../utils/redacaoPlano";
import {
  montarObservacaoRedacao,
  type ModalidadeRedacao,
} from "../../utils/redacaoRegistro";

const TIPO_REDACAO = "redacao" as const;
const MATERIA_REDACAO = "Redação";

type PendenciaRedacao = {
  iniciadaEm: string | null;
  tema: string;
  modalidade: ModalidadeRedacao;
  nota?: number;
};

export default function CentralRedacaoBridge() {
  const location = useLocation();
  const {
    sessoes,
    setSessoes,
    missoesConcluidas,
    configuracoes,
  } = useApp();
  const {
    sessaoAtiva,
    cronometroAtivo,
    prepararSessao,
    atualizarDados,
  } = useCronometro();

  const [destinoTipos, setDestinoTipos] = useState<HTMLElement | null>(null);
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
      criarPlanoCalendario(
        normalizarMissoesPorDia(configuracoes.missoesPorDia ?? 1)
      ),
    [configuracoes.missoesPorDia]
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
    if (!naCentral) {
      setDestinoTipos(null);
      setDestinoFormulario(null);
      setDestinoFinalizacao(null);
      return;
    }

    const localizarDestinos = () => {
      setDestinoTipos(
        document.querySelector<HTMLElement>(".central-estudos-tipos")
      );
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

  function selecionarRedacao() {
    if (cronometroAtivo) return;

    prepararSessao({
      materia: MATERIA_REDACAO,
      assunto: "",
      tipo: TIPO_REDACAO,
      objetivo: "Treino de redação",
      missaoId: vinculoRedacaoHoje?.missaoId,
      semana: vinculoRedacaoHoje?.semana,
      dia: vinculoRedacaoHoje?.dia,
    });
  }

  return (
    <>
      {naCentral && destinoTipos &&
        createPortal(
          <button
            type="button"
            className={
              redacaoAtiva
                ? "central-tipo central-tipo-ativo central-tipo-redacao"
                : "central-tipo central-tipo-redacao"
            }
            onClick={selecionarRedacao}
            disabled={cronometroAtivo}
          >
            <span>✍️</span>
            <strong>Redação</strong>
          </button>,
          destinoTipos
        )}

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

function parseNota(valor: string) {
  if (!valor.trim()) return undefined;

  const nota = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(nota) || nota < 0 || nota > 1000) {
    return undefined;
  }

  return Math.round(nota * 100) / 100;
}
