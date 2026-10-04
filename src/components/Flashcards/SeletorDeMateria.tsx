import type {
  PacoteQuestoesFlashcard,
  ProgressoQuestaoFlashcard,
} from "../../types/flashcards";

type Props = {
  pacotes: PacoteQuestoesFlashcard[];
  progresso: ProgressoQuestaoFlashcard[];
  onSelecionar: (pacote: PacoteQuestoesFlashcard) => void;
};

export default function SeletorDeMateria({
  pacotes,
  progresso,
  onSelecionar,
}: Props) {
  const progressoPorQuestao = new Map(
    progresso.map((item) => [item.questaoId, item])
  );

  const grupos = Array.from(
    pacotes.reduce(
      (mapa, pacote) => {
        const lista = mapa.get(pacote.materia) ?? [];
        lista.push(pacote);
        mapa.set(pacote.materia, lista);
        return mapa;
      },
      new Map<string, PacoteQuestoesFlashcard[]>()
    )
  );

  return (
    <div className="flashcards-seletor" aria-label="Matérias e tópicos de flashcards">
      {grupos.map(([materia, topicos]) => (
        <article className="flashcards-materia" key={materia}>
          <div className="flashcards-materia-cabecalho">
            <div>
              <span className="flashcards-selo">Banco de revisão</span>
              <h3>{materia}</h3>
            </div>
            <strong>
              {topicos.reduce(
                (total, pacote) => total + pacote.questoes.length,
                0
              )} questões
            </strong>
          </div>

          <div className="flashcards-topicos">
            {topicos.map((pacote) => {
              const respondidas = pacote.questoes.filter(
                (questao) =>
                  (progressoPorQuestao.get(questao.id)?.tentativas ?? 0) > 0
              ).length;
              const percentual = pacote.questoes.length
                ? Math.round((respondidas / pacote.questoes.length) * 100)
                : 0;

              return (
                <button
                  type="button"
                  className="flashcards-topico"
                  key={`${pacote.materia}:${pacote.topico}`}
                  onClick={() => onSelecionar(pacote)}
                >
                  <span>
                    <strong>{pacote.topico}</strong>
                    <small>
                      {pacote.questoes.length} questões · {respondidas} respondidas
                    </small>
                  </span>
                  <span
                    className="flashcards-topico-progresso"
                    aria-label={`${percentual}% concluído`}
                  >
                    {percentual}%
                  </span>
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
