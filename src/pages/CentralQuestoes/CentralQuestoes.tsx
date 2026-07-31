import {
  useMemo,
  useState,
} from "react";

import Questoes from "../Questoes/Questoes";
import Historico from "../Historico/Historico";
import BancoQuestoes from "../BancoQuestoes/BancoQuestoes";
import Estatisticas from "../Estatisticas/Estatisticas";

import {
  useApp,
} from "../../context/AppContext";

import type {
  RegistroQuestao,
} from "../../types";

import "./CentralQuestoes.css";

type AbaQuestoes =
  | "visao-geral"
  | "registrar"
  | "historico"
  | "banco"
  | "estatisticas";

type DesempenhoAgrupado = {
  nome: string;
  certas: number;
  erradas: number;
  total: number;
  percentual: number;
};

type AtividadeDia = {
  chave: string;
  data: Date;
  diaSemana: string;
  dataFormatada: string;
  total: number;
  certas: number;
  erradas: number;
  percentual: number;
};

export default function CentralQuestoes() {
  const {
    questoes,
  } = useApp();

  const [
    abaAtiva,
    setAbaAtiva,
  ] = useState<AbaQuestoes>(
    "visao-geral"
  );

  const resumo = useMemo(
    () =>
      calcularResumo(
        questoes
      ),
    [questoes]
  );

  const materias = useMemo(
    () =>
      agruparDesempenho(
        questoes,
        (registro) =>
          registro.materia
      ),
    [questoes]
  );

  const bancas = useMemo(
    () =>
      agruparDesempenho(
        questoes,
        (registro) =>
          registro.banca ||
          "Não informada"
      ),
    [questoes]
  );

  const assuntos = useMemo(
    () =>
      agruparDesempenho(
        questoes,
        (registro) =>
          `${registro.materia} — ${registro.assunto}`
      ),
    [questoes]
  );

  const assuntosFracos =
    assuntos
      .filter(
        (item) =>
          item.total >= 5 &&
          item.percentual < 70
      )
      .sort(
        (a, b) =>
          a.percentual -
          b.percentual
      )
      .slice(0, 5);

  const assuntosFortes =
    assuntos
      .filter(
        (item) =>
          item.total >= 5 &&
          item.percentual >= 80
      )
      .sort(
        (a, b) =>
          b.percentual -
          a.percentual
      )
      .slice(0, 5);

  const atividadeSemanal =
    useMemo(
      () =>
        calcularUltimosSeteDias(
          questoes
        ),
      [questoes]
    );

  return (
    <section className="central-questoes">
      <header className="central-questoes-topo">
        <div>
          <h1>
            📝 Central de Questões
          </h1>

          <p>
            Registre questões,
            acompanhe resultados e
            identifique seus principais
            pontos fracos.
          </p>
        </div>
      </header>

      <nav
        className="central-questoes-abas"
        aria-label="Navegação da Central de Questões"
      >
        <BotaoAba
          ativo={
            abaAtiva ===
            "visao-geral"
          }
          texto="📊 Visão geral"
          onClick={() =>
            setAbaAtiva(
              "visao-geral"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "registrar"
          }
          texto="✍ Registrar"
          onClick={() =>
            setAbaAtiva(
              "registrar"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "historico"
          }
          texto="🕘 Histórico"
          onClick={() =>
            setAbaAtiva(
              "historico"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "banco"
          }
          texto="🧠 Banco"
          onClick={() =>
            setAbaAtiva(
              "banco"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "estatisticas"
          }
          texto="📈 Estatísticas"
          onClick={() =>
            setAbaAtiva(
              "estatisticas"
            )
          }
        />
      </nav>

      <div className="central-questoes-conteudo">
        {abaAtiva ===
          "visao-geral" && (
          <VisaoGeral
            resumo={resumo}
            materias={materias}
            bancas={bancas}
            assuntosFracos={
              assuntosFracos
            }
            assuntosFortes={
              assuntosFortes
            }
            atividadeSemanal={
              atividadeSemanal
            }
            abrirHistorico={() =>
              setAbaAtiva(
                "historico"
              )
            }
            abrirRegistro={() =>
              setAbaAtiva(
                "registrar"
              )
            }
          />
        )}

        {abaAtiva ===
          "registrar" && (
          <Questoes />
        )}

        {abaAtiva ===
          "historico" && (
          <Historico />
        )}

        {abaAtiva ===
          "banco" && (
          <BancoQuestoes />
        )}

        {abaAtiva ===
          "estatisticas" && (
          <Estatisticas />
        )}
      </div>
    </section>
  );
}

function BotaoAba({
  ativo,
  texto,
  onClick,
}: {
  ativo: boolean;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        ativo
          ? "central-questoes-aba central-questoes-aba-ativa"
          : "central-questoes-aba"
      }
      onClick={onClick}
    >
      {texto}
    </button>
  );
}

type VisaoGeralProps = {
  resumo: {
    total: number;
    certas: number;
    erradas: number;
    percentual: number;
    minutos: number;
  };
  materias: DesempenhoAgrupado[];
  bancas: DesempenhoAgrupado[];
  assuntosFracos: DesempenhoAgrupado[];
  assuntosFortes: DesempenhoAgrupado[];
  atividadeSemanal: AtividadeDia[];
  abrirHistorico: () => void;
  abrirRegistro: () => void;
};

function VisaoGeral({
  resumo,
  materias,
  bancas,
  assuntosFracos,
  assuntosFortes,
  atividadeSemanal,
  abrirHistorico,
  abrirRegistro,
}: VisaoGeralProps) {
  const materiasOrdenadas =
    [...materias].sort(
      (a, b) =>
        a.percentual -
        b.percentual
    );

  const bancasOrdenadas =
    [...bancas].sort(
      (a, b) =>
        a.percentual -
        b.percentual
    );

  const maiorAtividade =
    Math.max(
      ...atividadeSemanal.map(
        (dia) => dia.total
      ),
      1
    );

  if (resumo.total === 0) {
    return (
      <div className="cq-vazio">
        <div className="cq-vazio-icone">
          📝
        </div>

        <h2>
          Nenhuma questão registrada
        </h2>

        <p>
          Registre seu primeiro bloco
          de questões para liberar a
          análise de desempenho.
        </p>

        <button
          type="button"
          onClick={abrirRegistro}
        >
          Registrar questões
        </button>
      </div>
    );
  }

  return (
    <div className="cq-painel">
      <section className="cq-resumo-grid">
        <CardResumo
          titulo="Questões"
          valor={resumo.total}
          detalhe={`${resumo.certas} certas e ${resumo.erradas} erradas`}
          icone="📝"
        />

        <CardResumo
          titulo="Acertos"
          valor={resumo.certas}
          detalhe={`${resumo.percentual}% de aproveitamento`}
          icone="✅"
        />

        <CardResumo
          titulo="Tempo"
          valor={formatarTempo(
            resumo.minutos
          )}
          detalhe="Tempo total em questões"
          icone="⏱"
        />

        <CardResumo
          titulo="Aproveitamento"
          valor={`${resumo.percentual}%`}
          detalhe={classificarDesempenho(
            resumo.percentual
          )}
          icone="🎯"
          destaque
        />
      </section>

      <section className="cq-secao">
        <div className="cq-secao-topo">
          <div>
            <h2>
              Atividade dos últimos
              sete dias
            </h2>

            <p>
              Quantidade de questões
              resolvidas por dia.
            </p>
          </div>

          <button
            type="button"
            className="cq-botao-secundario"
            onClick={abrirHistorico}
          >
            Ver histórico
          </button>
        </div>

        <div className="cq-semana">
          {atividadeSemanal.map(
            (dia) => {
              const altura =
                dia.total === 0
                  ? 4
                  : Math.max(
                      12,
                      Math.round(
                        (dia.total /
                          maiorAtividade) *
                          100
                      )
                    );

              return (
                <div
                  key={dia.chave}
                  className="cq-dia"
                  title={`${dia.dataFormatada}: ${dia.total} questões`}
                >
                  <div className="cq-dia-valor">
                    {dia.total}
                  </div>

                  <div className="cq-barra-area">
                    <div
                      className="cq-barra-dia"
                      style={{
                        height: `${altura}%`,
                      }}
                    />
                  </div>

                  <strong>
                    {dia.diaSemana}
                  </strong>

                  <small>
                    {dia.dataFormatada}
                  </small>
                </div>
              );
            }
          )}
        </div>
      </section>

      <div className="cq-duas-colunas">
        <section className="cq-secao">
          <div className="cq-secao-topo">
            <div>
              <h2>
                Desempenho por matéria
              </h2>

              <p>
                Ordenado da menor para
                a maior porcentagem.
              </p>
            </div>
          </div>

          <ListaDesempenho
            itens={materiasOrdenadas}
            vazio="Ainda não existem matérias com registros."
          />
        </section>

        <section className="cq-secao">
          <div className="cq-secao-topo">
            <div>
              <h2>
                Desempenho por banca
              </h2>

              <p>
                Veja em quais bancas
                você tem mais
                dificuldade.
              </p>
            </div>
          </div>

          <ListaDesempenho
            itens={bancasOrdenadas}
            vazio="Ainda não existem bancas com registros."
          />
        </section>
      </div>

      <div className="cq-duas-colunas">
        <section className="cq-secao">
          <div className="cq-secao-topo">
            <div>
              <h2>
                ⚠ Assuntos fracos
              </h2>

              <p>
                Assuntos com pelo menos
                cinco questões e
                rendimento abaixo de
                70%.
              </p>
            </div>
          </div>

          {assuntosFracos.length ===
          0 ? (
            <MensagemPositiva
              texto="Nenhum assunto fraco identificado com os dados atuais."
            />
          ) : (
            <div className="cq-alertas-lista">
              {assuntosFracos.map(
                (item) => (
                  <CardAssunto
                    key={item.nome}
                    item={item}
                    tipo="fraco"
                  />
                )
              )}
            </div>
          )}
        </section>

        <section className="cq-secao">
          <div className="cq-secao-topo">
            <div>
              <h2>
                ⭐ Assuntos fortes
              </h2>

              <p>
                Assuntos com pelo menos
                cinco questões e
                rendimento de 80% ou
                mais.
              </p>
            </div>
          </div>

          {assuntosFortes.length ===
          0 ? (
            <MensagemPositiva
              texto="Continue registrando questões para identificar seus assuntos fortes."
            />
          ) : (
            <div className="cq-alertas-lista">
              {assuntosFortes.map(
                (item) => (
                  <CardAssunto
                    key={item.nome}
                    item={item}
                    tipo="forte"
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      <section className="cq-secao cq-recomendacao">
        <div className="cq-recomendacao-icone">
          💡
        </div>

        <div>
          <h2>
            Recomendação do sistema
          </h2>

          <p>
            {gerarRecomendacao(
              assuntosFracos,
              materiasOrdenadas,
              resumo.percentual
            )}
          </p>
        </div>
      </section>
    </div>
  );
}

function CardResumo({
  titulo,
  valor,
  detalhe,
  icone,
  destaque = false,
}: {
  titulo: string;
  valor: string | number;
  detalhe: string;
  icone: string;
  destaque?: boolean;
}) {
  return (
    <article
      className={
        destaque
          ? "cq-resumo-card cq-resumo-card-destaque"
          : "cq-resumo-card"
      }
    >
      <div className="cq-resumo-card-topo">
        <span>{titulo}</span>

        <div className="cq-resumo-icone">
          {icone}
        </div>
      </div>

      <strong>{valor}</strong>

      <small>{detalhe}</small>
    </article>
  );
}

function ListaDesempenho({
  itens,
  vazio,
}: {
  itens: DesempenhoAgrupado[];
  vazio: string;
}) {
  if (itens.length === 0) {
    return (
      <p className="cq-texto-vazio">
        {vazio}
      </p>
    );
  }

  return (
    <div className="cq-desempenho-lista">
      {itens.map((item) => (
        <article
          key={item.nome}
          className="cq-desempenho-item"
        >
          <div className="cq-desempenho-topo">
            <div>
              <strong>
                {item.nome}
              </strong>

              <small>
                {item.total} questões
              </small>
            </div>

            <span
              className={obterClassePercentual(
                item.percentual
              )}
            >
              {item.percentual}%
            </span>
          </div>

          <div className="cq-progresso">
            <div
              className={obterClasseBarra(
                item.percentual
              )}
              style={{
                width: `${item.percentual}%`,
              }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function CardAssunto({
  item,
  tipo,
}: {
  item: DesempenhoAgrupado;
  tipo: "fraco" | "forte";
}) {
  return (
    <article
      className={`cq-assunto-card cq-assunto-${tipo}`}
    >
      <div>
        <strong>{item.nome}</strong>

        <p>
          {item.certas} certas •{" "}
          {item.erradas} erradas •{" "}
          {item.total} questões
        </p>
      </div>

      <span>
        {item.percentual}%
      </span>
    </article>
  );
}

function MensagemPositiva({
  texto,
}: {
  texto: string;
}) {
  return (
    <div className="cq-mensagem">
      <span>✅</span>
      <p>{texto}</p>
    </div>
  );
}

function calcularResumo(
  questoes: RegistroQuestao[]
) {
  const resumo =
    questoes.reduce(
      (acumulador, registro) => {
        acumulador.certas +=
          registro.certas;

        acumulador.erradas +=
          registro.erradas;

        acumulador.minutos +=
          registro.minutos;

        return acumulador;
      },
      {
        certas: 0,
        erradas: 0,
        minutos: 0,
      }
    );

  const total =
    resumo.certas +
    resumo.erradas;

  const percentual =
    total === 0
      ? 0
      : Math.round(
          (resumo.certas /
            total) *
            100
        );

  return {
    ...resumo,
    total,
    percentual,
  };
}

function agruparDesempenho(
  questoes: RegistroQuestao[],
  obterNome: (
    registro: RegistroQuestao
  ) => string
): DesempenhoAgrupado[] {
  const grupos =
    new Map<
      string,
      {
        certas: number;
        erradas: number;
      }
    >();

  questoes.forEach(
    (registro) => {
      const nome =
        obterNome(registro);

      const grupoAtual =
        grupos.get(nome) || {
          certas: 0,
          erradas: 0,
        };

      grupoAtual.certas +=
        registro.certas;

      grupoAtual.erradas +=
        registro.erradas;

      grupos.set(
        nome,
        grupoAtual
      );
    }
  );

  return Array.from(
    grupos.entries()
  ).map(
    ([
      nome,
      desempenho,
    ]) => {
      const total =
        desempenho.certas +
        desempenho.erradas;

      const percentual =
        total === 0
          ? 0
          : Math.round(
              (desempenho.certas /
                total) *
                100
            );

      return {
        nome,
        certas:
          desempenho.certas,
        erradas:
          desempenho.erradas,
        total,
        percentual,
      };
    }
  );
}

function calcularUltimosSeteDias(
  questoes: RegistroQuestao[]
): AtividadeDia[] {
  const hoje = new Date();

  hoje.setHours(
    0,
    0,
    0,
    0
  );

  const dias =
    Array.from(
      {
        length: 7,
      },
      (_, indice) => {
        const data =
          new Date(hoje);

        data.setDate(
          hoje.getDate() -
            (6 - indice)
        );

        const chave =
          criarChaveData(data);

        return {
          chave,
          data,
          diaSemana:
            data
              .toLocaleDateString(
                "pt-BR",
                {
                  weekday:
                    "short",
                }
              )
              .replace(".", "")
              .toUpperCase(),
          dataFormatada:
            data.toLocaleDateString(
              "pt-BR",
              {
                day: "2-digit",
                month:
                  "2-digit",
              }
            ),
          total: 0,
          certas: 0,
          erradas: 0,
          percentual: 0,
        };
      }
    );

  const mapaDias =
    new Map(
      dias.map((dia) => [
        dia.chave,
        dia,
      ])
    );

  questoes.forEach(
    (registro) => {
      const dataRegistro =
        new Date(
          registro.data
        );

      const chave =
        criarChaveData(
          dataRegistro
        );

      const dia =
        mapaDias.get(chave);

      if (!dia) return;

      dia.certas +=
        registro.certas;

      dia.erradas +=
        registro.erradas;

      dia.total +=
        registro.certas +
        registro.erradas;
    }
  );

  dias.forEach((dia) => {
    dia.percentual =
      dia.total === 0
        ? 0
        : Math.round(
            (dia.certas /
              dia.total) *
              100
          );
  });

  return dias;
}

function criarChaveData(
  data: Date
) {
  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      data.getDate()
    ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarTempo(
  minutos: number
) {
  const horas =
    Math.floor(
      minutos / 60
    );

  const minutosRestantes =
    minutos % 60;

  if (horas === 0) {
    return `${minutosRestantes} min`;
  }

  return `${horas}h ${minutosRestantes}min`;
}

function classificarDesempenho(
  percentual: number
) {
  if (percentual >= 90) {
    return "Excelente desempenho";
  }

  if (percentual >= 80) {
    return "Bom desempenho";
  }

  if (percentual >= 70) {
    return "Desempenho regular";
  }

  if (percentual >= 60) {
    return "Precisa melhorar";
  }

  return "Revisão prioritária";
}

function obterClassePercentual(
  percentual: number
) {
  if (percentual >= 80) {
    return "cq-percentual cq-percentual-bom";
  }

  if (percentual >= 60) {
    return "cq-percentual cq-percentual-medio";
  }

  return "cq-percentual cq-percentual-ruim";
}

function obterClasseBarra(
  percentual: number
) {
  if (percentual >= 80) {
    return "cq-progresso-barra cq-barra-bom";
  }

  if (percentual >= 60) {
    return "cq-progresso-barra cq-barra-medio";
  }

  return "cq-progresso-barra cq-barra-ruim";
}

function gerarRecomendacao(
  assuntosFracos: DesempenhoAgrupado[],
  materias: DesempenhoAgrupado[],
  percentualGeral: number
) {
  const piorAssunto =
    assuntosFracos[0];

  if (piorAssunto) {
    return `Priorize o assunto "${piorAssunto.nome}". Seu aproveitamento atual é de ${piorAssunto.percentual}% em ${piorAssunto.total} questões. Faça uma revisão e resolva um novo bloco de questões.`;
  }

  const piorMateria =
    materias[0];

  if (
    piorMateria &&
    piorMateria.percentual < 80
  ) {
    return `Sua matéria com menor desempenho é "${piorMateria.nome}", com ${piorMateria.percentual}% de aproveitamento. Ela deve receber prioridade na próxima sessão de questões.`;
  }

  if (
    percentualGeral >= 80
  ) {
    return "Seu aproveitamento geral está bom. Continue aumentando a quantidade de questões e acompanhe se o percentual permanece estável.";
  }

  return "Continue registrando questões. Quanto mais dados forem adicionados, mais precisa ficará a análise de desempenho.";
}