import { useEffect, useState } from "react";

import { registrarRespostaFlashcard } from "../../services/flashcardsProgressoService";
import type {
  PacoteQuestoesFlashcard,
  ProgressoQuestaoFlashcard,
  QuestaoFlashcard,
  ResultadoQuestaoFlashcard,
} from "../../types/flashcards";
import Resultado from "./Resultado";

type Props = {
  pacote: PacoteQuestoesFlashcard;
  onVoltar: () => void;
  onProgressoAtualizado: (progresso: ProgressoQuestaoFlashcard) => void;
};

export default function Quiz({
  pacote,
  onVoltar,
  onProgressoAtualizado,
}: Props) {
  const [fila, setFila] = useState<QuestaoFlashcard[]>(pacote.questoes);
  const [indice, setIndice] = useState(0);
  const [selecionada, setSelecionada] = useState<string>();
  const [dicaVisivel, setDicaVisivel] = useState(false);
  const [resultados, setResultados] = useState<ResultadoQuestaoFlashcard[]>([]);
  const [finalizado, setFinalizado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setFila(pacote.questoes);
    setIndice(0);
    setSelecionada(undefined);
    setDicaVisivel(false);
    setResultados([]);
    setFinalizado(false);
    setErro("");
  }, [pacote]);

  const questao = fila[indice];
  const respondeu = selecionada !== undefined;
  const acertou =
    respondeu && selecionada === questao?.correta;
  const percentual = fila.length
    ? Math.round((resultados.length / fila.length) * 100)
    : 0;

  async function responder(alternativaId: string) {
    if (!questao || respondeu || salvando) return;

    const respostaCorreta = alternativaId === questao.correta;
    setSalvando(true);
    setErro("");

    try {
      const progresso = await registrarRespostaFlashcard({
        questaoId: questao.id,
        materia: pacote.materia,
        topico: pacote.topico,
        acertou: respostaCorreta,
        modalidade: "quiz",
      });

      onProgressoAtualizado(progresso);
      setSelecionada(alternativaId);
      setResultados((atuais) => [
        ...atuais,
        {
          questao,
          acertou: respostaCorreta,
        },
      ]);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível salvar a resposta."
      );
    } finally {
      setSalvando(false);
    }
  }

  function proxima() {
    if (!respondeu) return;

    if (indice >= fila.length - 1) {
      setFinalizado(true);
      return;
    }

    setIndice((atual) => atual + 1);
    setSelecionada(undefined);
    setDicaVisivel(false);
    setErro("");
  }

  function revisarErros(erros: ResultadoQuestaoFlashcard[]) {
    setFila(erros.map((item) => item.questao));
    setIndice(0);
    setSelecionada(undefined);
    setDicaVisivel(false);
    setResultados([]);
    setFinalizado(false);
    setErro("");
  }

  if (finalizado) {
    return (
      <Resultado
        resultados={resultados}
        titulo={`Quiz · ${pacote.topico}`}
        onVoltar={onVoltar}
        onRevisarErros={revisarErros}
      />
    );
  }

  if (!questao) {
    return (
      <div className="flashcards-vazio">
        <p>Este tópico ainda não possui questões.</p>
        <button
          type="button"
          className="flashcards-botao-secundario"
          onClick={onVoltar}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <section className="quiz-sessao">
      <div className="flashcards-sessao-cabecalho">
        <div>
          <button
            type="button"
            className="flashcards-voltar"
            onClick={onVoltar}
          >
            ← Tópicos
          </button>
          <h3>{pacote.topico}</h3>
          <p>{pacote.materia} · Quiz</p>
        </div>
      </div>

      <div className="flashcards-progresso">
        <div>
          <span>
            {indice + 1}/{fila.length}
          </span>
          <strong>{percentual}%</strong>
        </div>
        <div className="flashcards-progresso-barra">
          <div style={{ width: `${percentual}%` }} />
        </div>
      </div>

      <article className="quiz-cartao">
        <span className="flashcards-selo">Questão {indice + 1}</span>
        <h3>{questao.pergunta}</h3>

        {!respondeu && questao.dica && (
          <div className="flashcard-dica-area">
            <button
              type="button"
              className="flashcards-botao-secundario"
              onClick={() => setDicaVisivel((atual) => !atual)}
              aria-expanded={dicaVisivel}
            >
              💡 {dicaVisivel ? "Ocultar dica" : "Ver dica"}
            </button>
            {dicaVisivel && (
              <p className="flashcard-dica" role="status">
                {questao.dica}
              </p>
            )}
          </div>
        )}

        <div className="quiz-alternativas">
          {questao.alternativas.map((alternativa) => {
            const correta = alternativa.id === questao.correta;
            const escolhida = alternativa.id === selecionada;
            const classe = respondeu
              ? correta
                ? "correta"
                : escolhida
                  ? "errada"
                  : ""
              : "";

            return (
              <button
                type="button"
                className={`quiz-alternativa ${classe}`}
                key={alternativa.id}
                onClick={() => void responder(alternativa.id)}
                disabled={respondeu || salvando}
                aria-pressed={escolhida}
              >
                <span>{alternativa.id.toUpperCase()}</span>
                {alternativa.texto}
              </button>
            );
          })}
        </div>

        {respondeu && (
          <div
            className={`quiz-feedback ${acertou ? "acerto" : "erro"}`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {acertou ? "Resposta correta." : "Resposta incorreta."}
            </strong>
            <p>{questao.explicacao}</p>
          </div>
        )}
      </article>

      {respondeu && (
        <div className="quiz-proxima-area">
          <button
            type="button"
            className="flashcards-botao-primario"
            onClick={proxima}
          >
            {indice >= fila.length - 1
              ? "Ver resultado"
              : "Próxima"}
          </button>
        </div>
      )}

      {erro && (
        <p className="flashcards-erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  );
}
