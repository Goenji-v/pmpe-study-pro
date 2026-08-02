import { useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";

import "./MissaoDoDia.css";

import {
  getProximaMissao,
  type ProximaMissaoPlano,
} from "../../utils/planoUtils";

type MissaoDoDiaProps = {
  atualizacao?: number;
};

const CHAVE_CRONOMETRO =
  "pmpe_cronometro_estudo";

export default function MissaoDoDia({
  atualizacao = 0,
}: MissaoDoDiaProps) {
  const navigate = useNavigate();
  const { missoesConcluidas } = useApp();

  const proxima = useMemo(
    () => getProximaMissao(missoesConcluidas),
    [atualizacao, missoesConcluidas]
  );

  function iniciarMissao(
    dados: ProximaMissaoPlano
  ) {
    const { semana, dia, missao } = dados;

    const tipo =
      missao.tipo === "revisao"
        ? "revisao"
        : missao.tipo === "questoes"
          ? "questoes"
          : "aula";

    const cronometro = {
      ativo: false,
      pausado: false,

      tipo,

      materia: missao.materia,
      assunto: missao.assunto,

      objetivo:
        `Semana ${semana} — ` +
        `Dia ${dia} — ` +
        `Missão ${missao.numero}`,

      observacao: "",

      iniciadaEm: null,
      pausadaEm: null,

      segundosPausados: 0,

      missaoId: missao.id,
      semana,
      dia,

      urlAula: missao.urlAula,
      urlQuestoes: missao.urlQuestoes,
    };

    localStorage.setItem(
      CHAVE_CRONOMETRO,
      JSON.stringify(cronometro)
    );

    window.dispatchEvent(
      new Event(
        "pmpe-cronometro-atualizado"
      )
    );

    navigate("/central-estudos");
  }

  if (!proxima) {
    return (
      <section className="missao-dia-card missao-dia-concluida">
        <div>
          <span className="missao-dia-etiqueta">
            MISSÃO DO DIA
          </span>

          <h2>Plano concluído</h2>

          <p>
            Todas as missões cadastradas
            foram concluídas.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/plano")
          }
        >
          Ver plano
        </button>
      </section>
    );
  }

  const { semana, dia, missao } =
    proxima;

  return (
    <section className="missao-dia-card">
      <div className="missao-dia-topo">
        <div>
          <span className="missao-dia-etiqueta">
            MISSÃO DO DIA
          </span>

          <h2>{missao.materia}</h2>

          <p>{missao.assunto}</p>
        </div>

        <div className="missao-dia-local">
          <span>Semana {semana}</span>
          <span>Dia {dia}</span>
          <span>
            Missão {missao.numero}
          </span>
        </div>
      </div>

      <div className="missao-dia-detalhes">
        <Detalhe
          titulo="Tipo"
          valor={formatarTipo(
            missao.tipo
          )}
        />

        <Detalhe
          titulo="Aula"
          valor={
            missao.urlAula
              ? "Disponível"
              : "Sem link"
          }
        />

        <Detalhe
          titulo="Questões"
          valor={
            missao.urlQuestoes
              ? "Disponíveis"
              : "Sem link"
          }
        />
      </div>

      <div className="missao-dia-acoes">
        <button
          type="button"
          className="missao-dia-secundario"
          onClick={() =>
            navigate("/plano")
          }
        >
          Ver plano
        </button>

        <button
          type="button"
          className="missao-dia-primario"
          onClick={() =>
            iniciarMissao(proxima)
          }
        >
          ▶ Iniciar missão
        </button>
      </div>
    </section>
  );
}

function Detalhe({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <article>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function formatarTipo(
  tipo: string
) {
  const nomes: Record<
    string,
    string
  > = {
    conteudo: "Aula",
    revisao: "Revisão",
    questoes: "Questões",
    redacao: "Redação",
    livre: "Livre",
  };

  return nomes[tipo] || tipo;
}