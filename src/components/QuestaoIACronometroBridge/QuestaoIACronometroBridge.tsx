import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./QuestaoIACronometroBridge.css";

import {
  formatarTempo,
  useCronometro,
} from "../../context/CronometroContext";
import { obterTipoSessaoQuestoesIAAtiva } from "../../services/cadernosSimuladosIAService";
import type { QuestaoIA } from "../../types";

const CHAVE_QUESTOES_IA = "pmpe_questoes_ia";
const CHAVE_ORIGEM_REVISAO = "pmpe:questoes-ia:origem-revisao";
const MARCADOR_OBJETIVO = "[Questões IA]";

type OrigemRevisao = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  revisaoId?: string;
  etapa?: number;
  criadoEm?: string;
};

type ResultadoQuestoesIA = {
  revisaoConcluida?: boolean;
  data: string;
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
  questoes: QuestaoIA[];
};

export default function QuestaoIACronometroBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sessaoAtiva,
    segundosDecorridos,
    cronometroAtivo,
    iniciar,
    pausar,
    continuar,
    finalizar,
    cancelar,
  } = useCronometro();

  const [finalizadaNestaTela, setFinalizadaNestaTela] = useState(false);
  const emTelaDeProva = location.pathname === "/resolver-simulado-ia/prova";
  const cronometroQuestoesIA =
    cronometroAtivo && sessaoAtiva.objetivo.startsWith(MARCADOR_OBJETIVO);

  // location.key força releitura do storage a cada nova navegação para a prova.
  /* oxlint-disable react-hooks/exhaustive-deps */
  const questoes = useMemo(
    () => (emTelaDeProva ? carregarQuestoes() : []),
    [emTelaDeProva, location.key]
  );
  /* oxlint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    setFinalizadaNestaTela(false);
  }, [location.pathname, location.key]);

  useEffect(() => {
    function aoFinalizarQuestoes(evento: Event) {
      // Atualizações do cache também usam este evento, mas não encerram sessões.
      if (!(evento instanceof CustomEvent) || !evento.detail) return;
      const resultado = evento.detail as ResultadoQuestoesIA;
      if (!cronometroQuestoesIA) {
        setFinalizadaNestaTela(true);
        return;
      }

      const minutos = Math.max(1, Math.round(segundosDecorridos / 60));
      const total = resultado?.total ?? questoes.length;
      const primeiraQuestao = resultado?.questoes?.[0] ?? questoes[0];

      const finalizacao = finalizar({
        minutosReais: minutos,
        quantidadeQuestoes: total > 0 ? total : undefined,
        quantidadeAcertos: resultado.certas,
        quantidadeErros: resultado.erradas,
        resultadoJaRegistrado: true,
        banca: primeiraQuestao?.banca,
        formatoRevisao:
          sessaoAtiva.tipo === "revisao" ? "questoes" : undefined,
        observacao: resultado
          ? `Resultado no Study Pro: ${resultado.certas}/${resultado.total} (${resultado.percentual}%). ${resultado.erradas} erro(s) e ${resultado.emBranco} em branco.`
          : "Sessão de questões finalizada no Study Pro.",
      });
      resultado.revisaoConcluida = finalizacao?.revisaoConcluida ?? false;

      setFinalizadaNestaTela(true);
    }

    window.addEventListener("pmpe-simulado-ia-finalizado", aoFinalizarQuestoes);
    return () =>
      window.removeEventListener("pmpe-simulado-ia-finalizado", aoFinalizarQuestoes);
  }, [
    cronometroQuestoesIA,
    finalizar,
    questoes,
    segundosDecorridos,
    sessaoAtiva.tipo,
  ]);

  function iniciarQuestoes() {
    if (questoes.length === 0) return;

    const tipo = obterTipoSessaoQuestoesIAAtiva(questoes);
    const primeira = questoes[0];
    const origemRevisao = carregarOrigemRevisao(questoes);

    const dados = origemRevisao
      ? {
          materia: origemRevisao.materia,
          materiaId: origemRevisao.materiaId,
          modulo: origemRevisao.modulo,
          moduloId: origemRevisao.moduloId,
          assunto: origemRevisao.assunto,
          assuntoId: origemRevisao.assuntoId,
          revisaoId: origemRevisao.revisaoId,
          tipo: "revisao" as const,
          formatoRevisao: "questoes" as const,
          objetivo: `${MARCADOR_OBJETIVO} Revisão · ${origemRevisao.assunto}`,
          observacao: origemRevisao.etapa
            ? `Revisão etapa ${origemRevisao.etapa} feita por questões no Study Pro.`
            : "Revisão feita por questões no Study Pro.",
        }
      : tipo === "simulado"
        ? {
            materia: "Simulado IA",
            assunto: "Conteúdos variados",
            tipo: "simulado" as const,
            objetivo: `${MARCADOR_OBJETIVO} Simulado IA`,
            observacao: "Simulado realizado dentro do Study Pro.",
          }
        : {
            materia: primeira.materia || "Questões IA",
            materiaId: primeira.materiaId,
            modulo: primeira.modulo,
            moduloId: primeira.moduloId,
            assunto: primeira.assunto || "Questões por assunto",
            assuntoId: primeira.assuntoId,
            tipo: "questoes" as const,
            objetivo: `${MARCADOR_OBJETIVO} ${primeira.assunto || "Questões por assunto"}`,
            observacao: "Questões resolvidas dentro do Study Pro.",
          };

    const iniciada = iniciar(dados);
    if (iniciada) {
      sessionStorage.removeItem(CHAVE_ORIGEM_REVISAO);
      setFinalizadaNestaTela(false);
    }
  }

  function fecharAvisoInicio() {
    sessionStorage.removeItem(CHAVE_ORIGEM_REVISAO);
    navigate("/resolver-simulado-ia");
  }

  function encerrarSemSalvar() {
    cancelar(true);
  }

  const deveBloquearInicio =
    emTelaDeProva &&
    questoes.length > 0 &&
    !cronometroQuestoesIA &&
    !finalizadaNestaTela;

  return (
    <>
      {deveBloquearInicio && (
        <div className="questoes-crono-bloqueio" role="dialog" aria-modal="true">
          <section className="questoes-crono-inicio">
            <button
              type="button"
              className="questoes-crono-fechar"
              onClick={fecharAvisoInicio}
              aria-label="Fechar aviso e voltar"
              title="Agora não"
            >
              ×
            </button>
            <span>CRONÔMETRO INTEGRADO</span>
            <h2>
              {obterTipoSessaoQuestoesIAAtiva(questoes) === "simulado"
                ? "Começar simulado"
                : "Começar questões"}
            </h2>
            <p>
              Ao começar, o Study Pro mede seu tempo automaticamente. Quando você finalizar as questões,
              o tempo vira uma sessão de estudo e o resultado continua sendo registrado normalmente, sem duplicar questões.
            </p>
            {cronometroAtivo && !cronometroQuestoesIA && (
              <small>
                Existe outro cronômetro em andamento. Ao começar, você poderá confirmar a substituição.
              </small>
            )}
            <div className="questoes-crono-inicio-acoes">
              <button
                type="button"
                className="questoes-crono-agora-nao"
                onClick={fecharAvisoInicio}
              >
                Agora não
              </button>
              <button type="button" onClick={iniciarQuestoes}>
                ▶ Começar agora
              </button>
            </div>
          </section>
        </div>
      )}

      {cronometroQuestoesIA && (
        <aside className="questoes-crono-mini" aria-label="Cronômetro das questões">
          <div>
            <span>⏱ QUESTÕES</span>
            <strong>{formatarTempo(segundosDecorridos)}</strong>
          </div>
          <small>{sessaoAtiva.assunto}</small>
          <div className="questoes-crono-mini-acoes">
            {sessaoAtiva.status === "pausado" ? (
              <button type="button" onClick={continuar}>Continuar</button>
            ) : (
              <button type="button" onClick={pausar}>Pausar</button>
            )}
            <button type="button" className="cancelar" onClick={encerrarSemSalvar}>
              Cancelar
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

function carregarQuestoes(): QuestaoIA[] {
  const salvo = localStorage.getItem(CHAVE_QUESTOES_IA);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as QuestaoIA[]) : [];
  } catch {
    return [];
  }
}

function carregarOrigemRevisao(questoes: QuestaoIA[]): OrigemRevisao | null {
  const salvo = sessionStorage.getItem(CHAVE_ORIGEM_REVISAO);
  if (!salvo) return null;

  try {
    const origem = JSON.parse(salvo) as OrigemRevisao;
    const criadaEm = origem.criadoEm ? new Date(origem.criadoEm).getTime() : 0;
    const recente = criadaEm > 0 && Date.now() - criadaEm <= 6 * 60 * 60 * 1000;
    const mesmaMateria = questoes.every((questao) => normalizar(questao.materia) === normalizar(origem.materia));
    const mesmoAssunto = questoes.every((questao) => normalizar(questao.assunto) === normalizar(origem.assunto));

    if (recente && mesmaMateria && mesmoAssunto) return origem;
  } catch {
    // O marcador inválido é descartado abaixo.
  }

  sessionStorage.removeItem(CHAVE_ORIGEM_REVISAO);
  return null;
}

function normalizar(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
