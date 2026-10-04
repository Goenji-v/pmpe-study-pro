import type { ResultadoQuestaoFlashcard } from "../../types/flashcards";

type Props = {
  resultados: ResultadoQuestaoFlashcard[];
  titulo?: string;
  onVoltar: () => void;
  onRevisarErros?: (questoesErradas: ResultadoQuestaoFlashcard[]) => void;
};

export default function Resultado({
  resultados,
  titulo = "Resultado",
  onVoltar,
  onRevisarErros,
}: Props) {
  const acertos = resultados.filter((item) => item.acertou).length;
  const erros = resultados.length - acertos;
  const percentual = resultados.length
    ? Math.round((acertos / resultados.length) * 100)
    : 0;
  const questoesErradas = resultados.filter((item) => !item.acertou);

  return (
    <section className="flashcards-resultado" aria-live="polite">
      <span className="flashcards-selo">Sessão concluída</span>
      <h3>{titulo}</h3>

      <div className="flashcards-placar">
        <div>
          <strong>{acertos}</strong>
          <span>Acertos</span>
        </div>
        <div>
          <strong>{erros}</strong>
          <span>Erros</span>
        </div>
        <div>
          <strong>{percentual}%</strong>
          <span>Aproveitamento</span>
        </div>
      </div>

      {questoesErradas.length > 0 && (
        <div className="flashcards-erros">
          <h4>Para revisar</h4>
          <ul>
            {questoesErradas.map(({ questao }) => (
              <li key={questao.id}>{questao.pergunta}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flashcards-acoes-final">
        {questoesErradas.length > 0 && onRevisarErros && (
          <button
            type="button"
            className="flashcards-botao-primario"
            onClick={() => onRevisarErros(questoesErradas)}
          >
            Revisar só os que errei
          </button>
        )}
        <button
          type="button"
          className="flashcards-botao-secundario"
          onClick={onVoltar}
        >
          Voltar aos tópicos
        </button>
      </div>
    </section>
  );
}
