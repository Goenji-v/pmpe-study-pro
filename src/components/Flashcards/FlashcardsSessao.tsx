import { useEffect, useMemo, useRef, useState } from "react";

import { registrarRespostaFlashcard } from "../../services/flashcardsProgressoService";
import type {
  PacoteQuestoesFlashcard,
  ProgressoQuestaoFlashcard,
  QuestaoFlashcard,
  ResultadoQuestaoFlashcard,
} from "../../types/flashcards";
import type { AvaliacaoSRS } from "../../utils/repeticaoEspacada";
import Flashcard from "./Flashcard";
import Resultado from "./Resultado";

type Props = {
  pacote: PacoteQuestoesFlashcard;
  progresso: ProgressoQuestaoFlashcard[];
  onVoltar: () => void;
  onProgressoAtualizado: (progresso: ProgressoQuestaoFlashcard) => void;
};

function embaralhar<T>(itens: T[]) {
  const copia = [...itens];

  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const sorteado = Math.floor(Math.random() * (indice + 1));
    [copia[indice], copia[sorteado]] = [
      copia[sorteado],
      copia[indice],
    ];
  }

  return copia;
}

function ordenarPorRevisao(
  questoes: QuestaoFlashcard[],
  progresso: ProgressoQuestaoFlashcard[]
) {
  const agora = Date.now();
  const porId = new Map(progresso.map((item) => [item.questaoId, item]));

  return [...questoes].sort((a, b) => {
    const progressoA = porId.get(a.id);
    const progressoB = porId.get(b.id);
    const prioridadeA = prioridadeSRS(progressoA, agora);
    const prioridadeB = prioridadeSRS(progressoB, agora);

    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

    const dataA = progressoA?.proximaRevisaoEm
      ? Date.parse(progressoA.proximaRevisaoEm)
      : Number.MAX_SAFE_INTEGER;
    const dataB = progressoB?.proximaRevisaoEm
      ? Date.parse(progressoB.proximaRevisaoEm)
      : Number.MAX_SAFE_INTEGER;

    return dataA - dataB;
  });
}

function prioridadeSRS(
  progresso: ProgressoQuestaoFlashcard | undefined,
  agora: number
) {
  if (progresso?.proximaRevisaoEm && Date.parse(progresso.proximaRevisaoEm) <= agora) {
    return 0;
  }
  if (!progresso || progresso.tentativas === 0) return 1;
  return 2;
}

export default function FlashcardsSessao({
  pacote,
  progresso,
  onVoltar,
  onProgressoAtualizado,
}: Props) {
  const progressoRef = useRef(progresso);
  progressoRef.current = progresso;

  const [fila, setFila] = useState<QuestaoFlashcard[]>(() =>
    ordenarPorRevisao(pacote.questoes, progresso)
  );
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  const [dicaVisivel, setDicaVisivel] = useState(false);
  const [resultados, setResultados] = useState<ResultadoQuestaoFlashcard[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setFila(ordenarPorRevisao(pacote.questoes, progressoRef.current));
    setIndice(0);
    setVirado(false);
    setDicaVisivel(false);
    setResultados([]);
    setErro("");
  }, [pacote]);

  const questaoAtual = fila[indice];
  const finalizado =
    fila.length > 0 && resultados.length === fila.length;
  const percentual = fila.length
    ? Math.round((resultados.length / fila.length) * 100)
    : 0;

  const idsRespondidos = useMemo(
    () => new Set(resultados.map((item) => item.questao.id)),
    [resultados]
  );

  async function marcar(avaliacao: AvaliacaoSRS) {
    if (!questaoAtual || salvando || idsRespondidos.has(questaoAtual.id)) {
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const progresso = await registrarRespostaFlashcard({
        questaoId: questaoAtual.id,
        materia: pacote.materia,
        topico: pacote.topico,
        avaliacao,
        modalidade: "flashcards",
      });

      onProgressoAtualizado(progresso);
      setResultados((atuais) => [
        ...atuais,
        {
          questao: questaoAtual,
          acertou: avaliacao !== "dificil",
        },
      ]);

      if (indice < fila.length - 1) {
        setIndice((atual) => atual + 1);
        setVirado(false);
        setDicaVisivel(false);
      }
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

  function embaralharFila() {
    if (resultados.length > 0) return;
    setFila((atual) => embaralhar(atual));
    setIndice(0);
    setVirado(false);
    setDicaVisivel(false);
  }

  function revisarErros(erros: ResultadoQuestaoFlashcard[]) {
    setFila(erros.map((item) => item.questao));
    setIndice(0);
    setVirado(false);
    setDicaVisivel(false);
    setResultados([]);
    setErro("");
  }

  if (finalizado) {
    return (
      <Resultado
        resultados={resultados}
        titulo={`Flashcards · ${pacote.topico}`}
        onVoltar={onVoltar}
        onRevisarErros={revisarErros}
      />
    );
  }

  if (!questaoAtual) {
    return (
      <div className="flashcards-vazio">
        <p>Este tópico ainda não possui cartões.</p>
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
    <section className="flashcards-sessao">
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
          <p>{pacote.materia} · Flashcards com repetição espaçada</p>
        </div>

        <button
          type="button"
          className="flashcards-botao-secundario"
          onClick={embaralharFila}
          disabled={resultados.length > 0}
          title={
            resultados.length > 0
              ? "Embaralhe antes de começar a sessão."
              : "Embaralhar ordem dos cartões"
          }
        >
          🔀 Embaralhar
        </button>
      </div>

      <div className="flashcards-progresso">
        <div>
          <span>
            {Math.min(resultados.length + 1, fila.length)}/{fila.length}
          </span>
          <strong>{percentual}%</strong>
        </div>
        <div className="flashcards-progresso-barra">
          <div style={{ width: `${percentual}%` }} />
        </div>
      </div>

      <Flashcard
        questao={questaoAtual}
        virado={virado}
        dicaVisivel={dicaVisivel}
        onVirar={() => setVirado((atual) => !atual)}
        onAlternarDica={() => setDicaVisivel((atual) => !atual)}
      />

      {virado && (
        <>
          <p className="flashcards-srs-instrucao">
            Como foi lembrar? Isso define quando este cartão volta.
          </p>
          <div className="flashcards-avaliacao" aria-label="Avaliar dificuldade">
            <button
              type="button"
              className="flashcards-dificil"
              onClick={() => void marcar("dificil")}
              disabled={salvando}
            >
              🔴 Difícil
              <small>rever amanhã</small>
            </button>
            <button
              type="button"
              className="flashcards-medio"
              onClick={() => void marcar("medio")}
              disabled={salvando}
            >
              🟡 Médio
              <small>intervalo normal</small>
            </button>
            <button
              type="button"
              className="flashcards-facil"
              onClick={() => void marcar("facil")}
              disabled={salvando}
            >
              🟢 Fácil
              <small>intervalo maior</small>
            </button>
          </div>
        </>
      )}

      {erro && (
        <p className="flashcards-erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  );
}
