import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Revisao } from "../../types";
import type { SemanaPlano } from "../../data/planoPMPE";

import "./CalendarioSemanalPreview.css";

type DiaPlano = {
  semana: number;
  dia: number;
  missoes: SemanaPlano["dias"][number]["missoes"];
};

type ItemSemana = {
  id: string;
  tipo: "conteudo" | "revisao" | "redacao" | "simulado";
  materia: string;
  assunto: string;
  concluido: boolean;
  revisaoId?: string;
  semana?: number;
  dia?: number;
};

type Props = {
  programacao: Map<string, DiaPlano>;
  revisoes: Revisao[];
  missoesConcluidas: string[];
};

const DIAS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

export default function CalendarioSemanalPreview({
  programacao,
  revisoes,
  missoesConcluidas,
}: Props) {
  const navigate = useNavigate();
  const hoje = useMemo(() => inicioDoDia(new Date()), []);
  const [inicioSemana, setInicioSemana] = useState(() =>
    obterInicioSemana(hoje)
  );
  const [diaSelecionado, setDiaSelecionado] = useState(() =>
    formatarChaveData(hoje)
  );

  const diasSemana = useMemo(
    () =>
      Array.from({ length: 7 }, (_, indice) => {
        const data = new Date(inicioSemana);
        data.setDate(inicioSemana.getDate() + indice);
        const chave = formatarChaveData(data);
        const dadosPlano = programacao.get(chave);

        const itensPlano: ItemSemana[] =
          dadosPlano?.missoes.map((missao) => ({
            id: missao.id,
            tipo:
              missao.tipo === "redacao"
                ? "redacao"
                : missao.tipo === "simulado"
                  ? "simulado"
                  : "conteudo",
            materia: missao.materia,
            assunto: missao.assunto,
            concluido: missoesConcluidas.includes(missao.id),
            semana: dadosPlano.semana,
            dia: dadosPlano.dia,
          })) ?? [];

        const itensRevisao: ItemSemana[] = revisoes
          .filter(
            (revisao) =>
              formatarChaveData(new Date(revisao.dataPrevista)) === chave
          )
          .map((revisao) => ({
            id: `revisao-${revisao.id}`,
            tipo: "revisao",
            materia: revisao.materia,
            assunto: revisao.assunto,
            concluido: revisao.concluida,
            revisaoId: revisao.id,
          }));

        return {
          data,
          chave,
          dadosPlano,
          itens: [...itensPlano, ...itensRevisao],
        };
      }),
    [
      inicioSemana,
      programacao,
      revisoes,
      missoesConcluidas,
    ]
  );

  const diaAtual =
    diasSemana.find((dia) => dia.chave === diaSelecionado) ??
    diasSemana[0];

  const totais = useMemo(() => {
    const itens = diasSemana.flatMap((dia) => dia.itens);
    return {
      total: itens.length,
      pendentes: itens.filter((item) => !item.concluido).length,
      revisoes: itens.filter((item) => item.tipo === "revisao").length,
      concluidas: itens.filter((item) => item.concluido).length,
    };
  }, [diasSemana]);

  function moverSemana(delta: number) {
    setInicioSemana((atual) => {
      const proxima = new Date(atual);
      proxima.setDate(proxima.getDate() + delta * 7);
      setDiaSelecionado(formatarChaveData(proxima));
      return proxima;
    });
  }

  function voltarSemanaAtual() {
    const inicio = obterInicioSemana(hoje);
    setInicioSemana(inicio);
    setDiaSelecionado(formatarChaveData(hoje));
  }

  return (
    <div className="cal-semanal">
      <div className="cal-semanal-topo">
        <div>
          <span className="cal-semanal-kicker">
            PLANEJAMENTO DA SEMANA
          </span>
          <h2>{formatarIntervaloSemana(inicioSemana)}</h2>
          <p>
            Missões, revisões, redação e simulado na mesma visão.
          </p>
        </div>

        <div className="cal-semanal-navegacao">
          <button type="button" onClick={() => moverSemana(-1)}>
            ‹ Semana anterior
          </button>
          <button
            type="button"
            className="cal-semanal-atual"
            onClick={voltarSemanaAtual}
          >
            Semana atual
          </button>
          <button type="button" onClick={() => moverSemana(1)}>
            Próxima semana ›
          </button>
        </div>
      </div>

      <div className="cal-semanal-metricas">
        <div>
          <span>Atividades</span>
          <strong>{totais.total}</strong>
        </div>
        <div>
          <span>Pendentes</span>
          <strong>{totais.pendentes}</strong>
        </div>
        <div>
          <span>Revisões</span>
          <strong>{totais.revisoes}</strong>
        </div>
        <div>
          <span>Concluídas</span>
          <strong>{totais.concluidas}</strong>
        </div>
      </div>

      <div className="cal-semanal-grade" role="list">
        {diasSemana.map((dia, indice) => {
          const selecionado = dia.chave === diaAtual.chave;
          const ehHoje = dia.chave === formatarChaveData(hoje);

          return (
            <button
              key={dia.chave}
              type="button"
              role="listitem"
              className={
                `cal-semanal-dia ${selecionado ? "selecionado" : ""} ${ehHoje ? "hoje" : ""}`
              }
              onClick={() => setDiaSelecionado(dia.chave)}
            >
              <header>
                <span>{DIAS[indice].slice(0, 3)}</span>
                <strong>{dia.data.getDate()}</strong>
              </header>

              <div className="cal-semanal-blocos">
                {dia.itens.length === 0 ? (
                  <span className="cal-semanal-livre">Dia livre</span>
                ) : (
                  dia.itens.slice(0, 6).map((item) => (
                    <span
                      key={item.id}
                      className={
                        `cal-semanal-bloco tipo-${item.tipo} cor-${indiceMateria(item.materia)} ${item.concluido ? "concluido" : ""}`
                      }
                      title={`${item.materia} — ${item.assunto}`}
                    >
                      <b>{abreviarMateria(item.materia)}</b>
                      <small>{abreviarAssunto(item.assunto)}</small>
                    </span>
                  ))
                )}

                {dia.itens.length > 6 && (
                  <span className="cal-semanal-mais">
                    +{dia.itens.length - 6}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="cal-semanal-legenda">
        <span><i className="leg-conteudo" /> Conteúdo</span>
        <span><i className="leg-revisao" /> Revisão</span>
        <span><i className="leg-redacao" /> Redação</span>
        <span><i className="leg-simulado" /> Simulado</span>
        <span><i className="leg-concluido" /> Concluído</span>
      </div>

      <section className="cal-semanal-detalhes">
        <div className="cal-semanal-detalhes-topo">
          <div>
            <span>PROGRAMAÇÃO DO DIA</span>
            <h3>{formatarDataCompleta(diaAtual.data)}</h3>
          </div>
          <strong>
            {diaAtual.itens.length} {diaAtual.itens.length === 1 ? "atividade" : "atividades"}
          </strong>
        </div>

        {diaAtual.itens.length === 0 ? (
          <div className="cal-semanal-vazio">
            <strong>Dia livre no planejamento.</strong>
            <span>Você pode usar o dia para recuperar pendências ou descanso.</span>
          </div>
        ) : (
          <div className="cal-semanal-lista">
            {diaAtual.itens.map((item) => (
              <article
                key={item.id}
                className={`cal-semanal-item tipo-${item.tipo}`}
              >
                <span
                  className={`cal-semanal-check ${item.concluido ? "feito" : ""}`}
                  aria-hidden="true"
                >
                  {item.concluido ? "✓" : ""}
                </span>

                <div>
                  <strong>{item.materia}</strong>
                  <p>{item.assunto}</p>
                  <small>{rotuloTipo(item.tipo)}</small>
                </div>

                {!item.concluido && item.revisaoId && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/revisoes", {
                        state: { revisaoId: item.revisaoId },
                      })
                    }
                  >
                    Fazer revisão
                  </button>
                )}

                {!item.concluido &&
                  !item.revisaoId &&
                  item.semana &&
                  item.dia && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/plano", {
                          state: {
                            semana: item.semana,
                            dia: item.dia,
                          },
                        })
                      }
                    >
                      Abrir no plano
                    </button>
                  )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function obterInicioSemana(data: Date) {
  const inicio = inicioDoDia(data);
  const deslocamento = (inicio.getDay() + 6) % 7;
  inicio.setDate(inicio.getDate() - deslocamento);
  return inicio;
}

function inicioDoDia(data: Date) {
  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate(),
    0,
    0,
    0,
    0
  );
}

function formatarChaveData(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarIntervaloSemana(inicio: Date) {
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 6);

  const inicioTexto = inicio.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const fimTexto = fim.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `${inicioTexto} — ${fimTexto}`;
}

function formatarDataCompleta(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function abreviarMateria(materia: string) {
  const palavras = materia
    .replace(/noções de/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (palavras.length <= 2) {
    return palavras.join(" ").slice(0, 18);
  }

  return palavras
    .slice(0, 2)
    .join(" ")
    .slice(0, 18);
}

function abreviarAssunto(assunto: string) {
  return assunto.length > 24
    ? `${assunto.slice(0, 22)}…`
    : assunto;
}

function indiceMateria(materia: string) {
  let hash = 0;
  for (let indice = 0; indice < materia.length; indice += 1) {
    hash = (hash * 31 + materia.charCodeAt(indice)) >>> 0;
  }
  return hash % 6;
}

function rotuloTipo(tipo: ItemSemana["tipo"]) {
  if (tipo === "revisao") return "Revisão programada";
  if (tipo === "redacao") return "Redação semanal";
  if (tipo === "simulado") return "Simulado semanal";
  return "Conteúdo do plano";
}
