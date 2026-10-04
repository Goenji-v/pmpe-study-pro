import { useEffect, useMemo, useState } from "react";

import {
  buscarPacoteQuestoesFlashcards,
  pacotesQuestoesFlashcards,
} from "../../data/questoes";
import {
  calcularEstatisticasFlashcards,
  listarProgressoFlashcards,
} from "../../services/flashcardsProgressoService";
import type {
  ModoEstudoFlashcard,
  PacoteQuestoesFlashcard,
  ProgressoQuestaoFlashcard,
} from "../../types/flashcards";
import FlashcardsSessao from "./FlashcardsSessao";
import Quiz from "./Quiz";
import SeletorDeMateria from "./SeletorDeMateria";

import "./Flashcards.css";

type FocoFlashcards = {
  materia: string;
  topico: string;
  token: number;
};

type Props = {
  foco?: FocoFlashcards;
};

export default function FlashcardsQuizPanel({
  foco,
}: Props) {
  const [progresso, setProgresso] = useState<ProgressoQuestaoFlashcard[]>([]);
  const [pacoteSelecionado, setPacoteSelecionado] =
    useState<PacoteQuestoesFlashcard>();
  const [modo, setModo] = useState<ModoEstudoFlashcard>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    void listarProgressoFlashcards()
      .then((dados) => {
        if (ativo) setProgresso(dados);
      })
      .catch((falha) => {
        if (!ativo) return;
        setErro(
          falha instanceof Error
            ? falha.message
            : "Não foi possível carregar o progresso."
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!foco) return;

    const pacote = buscarPacoteQuestoesFlashcards(
      foco.materia,
      foco.topico
    );

    if (!pacote) return;
    setPacoteSelecionado(pacote);
    setModo(undefined);
  }, [foco]);

  const estatisticas = useMemo(
    () => calcularEstatisticasFlashcards(progresso),
    [progresso]
  );

  function atualizarProgresso(
    atualizado: ProgressoQuestaoFlashcard
  ) {
    setProgresso((atuais) => {
      const existe = atuais.some(
        (item) => item.questaoId === atualizado.questaoId
      );

      return existe
        ? atuais.map((item) =>
            item.questaoId === atualizado.questaoId
              ? atualizado
              : item
          )
        : [atualizado, ...atuais];
    });
  }

  function voltarAosTopicos() {
    setModo(undefined);
    setPacoteSelecionado(undefined);
  }

  return (
    <section
      id="flashcards-quiz"
      className="flashcards-painel"
      aria-labelledby="flashcards-quiz-titulo"
    >
      <header className="flashcards-painel-cabecalho">
        <div>
          <span className="flashcards-selo">Revisão ativa</span>
          <h2 id="flashcards-quiz-titulo">🧠 Flashcards & Quiz</h2>
          <p>
            Revise os assuntos do concurso e salve o progresso na sua conta.
          </p>
        </div>

        <div className="flashcards-estatisticas" aria-label="Estatísticas de flashcards">
          <div>
            <strong>{estatisticas.totalRespondidas}</strong>
            <span>respondidas</span>
          </div>
          <div>
            <strong>{estatisticas.totalTentativas}</strong>
            <span>tentativas</span>
          </div>
          <div>
            <strong>{estatisticas.percentualAcertos}%</strong>
            <span>acertos</span>
          </div>
        </div>
      </header>

      {erro && (
        <p className="flashcards-erro" role="alert">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="flashcards-carregando" role="status">
          Carregando progresso...
        </div>
      ) : modo === "flashcards" && pacoteSelecionado ? (
        <FlashcardsSessao
          pacote={pacoteSelecionado}
          onVoltar={voltarAosTopicos}
          onProgressoAtualizado={atualizarProgresso}
        />
      ) : modo === "quiz" && pacoteSelecionado ? (
        <Quiz
          pacote={pacoteSelecionado}
          onVoltar={voltarAosTopicos}
          onProgressoAtualizado={atualizarProgresso}
        />
      ) : pacoteSelecionado ? (
        <section className="flashcards-modo">
          <button
            type="button"
            className="flashcards-voltar"
            onClick={voltarAosTopicos}
          >
            ← Todos os tópicos
          </button>

          <span className="flashcards-selo">{pacoteSelecionado.materia}</span>
          <h3>{pacoteSelecionado.topico}</h3>
          <p>
            {pacoteSelecionado.questoes.length} questões disponíveis. Como você quer estudar?
          </p>

          <div className="flashcards-modos-grid">
            <button
              type="button"
              className="flashcards-modo-card"
              onClick={() => setModo("flashcards")}
            >
              <span>🃏</span>
              <strong>Flashcards</strong>
              <small>Vire o cartão e marque Acertei ou Errei.</small>
            </button>
            <button
              type="button"
              className="flashcards-modo-card"
              onClick={() => setModo("quiz")}
            >
              <span>✅</span>
              <strong>Quiz</strong>
              <small>Responda alternativas com correção imediata.</small>
            </button>
          </div>
        </section>
      ) : pacotesQuestoesFlashcards.length > 0 ? (
        <SeletorDeMateria
          pacotes={pacotesQuestoesFlashcards}
          progresso={progresso}
          onSelecionar={(pacote) => {
            setPacoteSelecionado(pacote);
            setModo(undefined);
          }}
        />
      ) : (
        <div className="flashcards-vazio">
          Nenhum banco de flashcards foi adicionado ainda.
        </div>
      )}
    </section>
  );
}
