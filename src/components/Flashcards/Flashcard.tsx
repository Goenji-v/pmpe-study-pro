import type { KeyboardEvent } from "react";

import type { QuestaoFlashcard } from "../../types/flashcards";

type Props = {
  questao: QuestaoFlashcard;
  virado: boolean;
  dicaVisivel: boolean;
  onVirar: () => void;
  onAlternarDica: () => void;
};

export default function Flashcard({
  questao,
  virado,
  dicaVisivel,
  onVirar,
  onAlternarDica,
}: Props) {
  const correta = questao.alternativas.find(
    (alternativa) => alternativa.id === questao.correta
  );

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "Enter" && evento.key !== " ") return;
    evento.preventDefault();
    onVirar();
  }

  return (
    <div className="flashcard-area">
      <div
        className={`flashcard ${virado ? "virado" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={virado}
        aria-label={
          virado
            ? "Mostrar frente do cartão"
            : "Virar cartão para ver a resposta"
        }
        onClick={onVirar}
        onKeyDown={aoTeclar}
      >
        <div className="flashcard-face flashcard-frente">
          <span className="flashcards-selo">Pergunta</span>
          <h3>{questao.pergunta}</h3>
          <span className="flashcard-instrucao">
            Toque ou pressione Enter para virar
          </span>
        </div>

        <div className="flashcard-face flashcard-verso">
          <span className="flashcards-selo">Resposta</span>
          <h3>{correta?.texto ?? "Resposta não encontrada"}</h3>
          <p>{questao.explicacao}</p>
        </div>
      </div>

      {!virado && questao.dica && (
        <div className="flashcard-dica-area">
          <button
            type="button"
            className="flashcards-botao-secundario"
            onClick={(evento) => {
              evento.stopPropagation();
              onAlternarDica();
            }}
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
    </div>
  );
}
