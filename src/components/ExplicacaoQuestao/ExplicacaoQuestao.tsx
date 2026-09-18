import { useMemo } from "react";

import {
  estruturarExplicacaoQuestao,
  type TrechoAlternativaExplicacao,
} from "../../utils/explicacaoQuestao";

import "./ExplicacaoQuestao.css";

type Props = {
  texto?: string | null;
  gabarito: string;
  titulo?: string;
};

const ORDEM = ["A", "B", "C", "D", "E"];

export default function ExplicacaoQuestao({
  texto,
  gabarito,
  titulo = "Explicação",
}: Props) {
  const dados = useMemo(
    () => estruturarExplicacaoQuestao(texto),
    [texto]
  );

  const letraGabarito =
    String(gabarito || "")
      .trim()
      .toUpperCase();

  const alternativas = useMemo(() => {
    const porLetra = new Map<
      string,
      TrechoAlternativaExplicacao
    >();

    dados.alternativas.forEach((item) => {
      porLetra.set(item.letra, item);
    });

    if (
      letraGabarito &&
      !porLetra.has(letraGabarito)
    ) {
      porLetra.set(letraGabarito, {
        letra: letraGabarito,
        status: "correta",
        texto: "",
      });
    }

    return Array.from(
      porLetra.values()
    ).sort(
      (a, b) =>
        ORDEM.indexOf(a.letra) -
        ORDEM.indexOf(b.letra)
    );
  }, [
    dados.alternativas,
    letraGabarito,
  ]);

  const temEstrutura =
    dados.resumo ||
    alternativas.length > 0;

  return (
    <section className="explicacao-questao">
      <div className="explicacao-questao-topo">
        <h3>{titulo}</h3>

        {letraGabarito && (
          <span className="explicacao-questao-gabarito">
            Gabarito{" "}
            <strong>
              {letraGabarito}
            </strong>
          </span>
        )}
      </div>

      {!temEstrutura ? (
        <p className="explicacao-questao-vazia">
          Esta questão não possui
          explicação cadastrada.
        </p>
      ) : dados.alternativas.length ===
          0 ? (
        <p className="explicacao-questao-texto">
          {texto}
        </p>
      ) : (
        <>
          {dados.resumo && (
            <div className="explicacao-questao-resumo">
              <span>
                Entenda o gabarito
              </span>

              <p>
                {dados.resumo}
              </p>
            </div>
          )}

          <div className="explicacao-questao-divisor">
            Análise das alternativas
          </div>

          <div className="explicacao-questao-alternativas">
            {alternativas.map(
              (item) => {
                const correta =
                  item.letra ===
                    letraGabarito ||
                  item.status ===
                    "correta";

                return (
                  <article
                    key={item.letra}
                    className={
                      correta
                        ? "explicacao-questao-alternativa correta"
                        : "explicacao-questao-alternativa errada"
                    }
                  >
                    <div className="explicacao-questao-letra">
                      {item.letra}
                    </div>

                    <div className="explicacao-questao-conteudo">
                      <strong>
                        {item.letra} —{" "}
                        {correta
                          ? "Correta"
                          : "Errada"}
                      </strong>

                      {item.texto ? (
                        <p>
                          {item.texto}
                        </p>
                      ) : correta ? (
                        <p>
                          Alternativa indicada
                          como gabarito da
                          questão.
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </>
      )}
    </section>
  );
}
