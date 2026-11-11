import { agruparEventosCalendario } from "../../utils/agruparEventosCalendario";
import { useNavigate } from "react-router-dom";
import { usePlanoAtivo } from "../../hooks/usePlanoAtivo";
import { indexarPlanoPorData } from "../../utils/planoAtivo";
import {
  useMemo,
  useState,
} from "react";

import "./Calendario.css";
import CalendarioSemanalPreview from "./CalendarioSemanalPreview";

import {
  useApp,
} from "../../context/AppContext";
import { calcularMetricasConsolidadas } from "../../utils/metricasConsolidadas";
import { rotuloOrigemRevisaoSimulado, useNomesSimuladosDeRevisoes } from "../../utils/origemRevisaoSimulado";

type EventoCalendario = {
  id: string;
  tipo:
    | "sessao"
    | "questoes"
    | "revisao"
    | "simulado";
  titulo: string;
  detalhe: string;
  minutos: number;
  data: string;
  status?: "concluida" | "pendente" | "atrasada";
  quantidadeQuestoes?: number;
  revisaoId?: string;
};

type ResumoDia = {
  chave: string;
  data: Date;
  eventos: EventoCalendario[];
  minutos: number;
  questoes: number;
  sessoes: number;
  revisoesConcluidas: number;
  revisoesPendentes: number;
  simulados: number;
};

const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
];

export default function Calendario() {
  const navigate = useNavigate();
  const planoAtivo = usePlanoAtivo();
  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
    missoesConcluidas,
  } = useApp();
  const programacao = useMemo(() => indexarPlanoPorData(planoAtivo, configuracoes.dataInicioPlano), [planoAtivo, configuracoes.dataInicioPlano]);
  const datasPlano = [...programacao.keys()].sort();
  const dataBR = (data: string) => data.split('-').reverse().join('/');
  const diasProva = configuracoes.dataProva ? Math.round((Date.parse(configuracoes.dataProva + 'T00:00:00Z') - Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000) : null;
  const pendenciasPlano = planoAtivo.flatMap(s => s.dias.flatMap(d => d.missoes)).filter(m => !missoesConcluidas.includes(m.id)).length;
  const nomesSimulados = useNomesSimuladosDeRevisoes(revisoes);

  const hoje =
    inicioDoDia(
      new Date()
    );

  const [
    mesExibido,
    setMesExibido,
  ] = useState(
    new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    )
  );

  const [
    diaSelecionado,
    setDiaSelecionado,
  ] = useState(
    formatarChaveData(
      hoje
    )
  );

  const [visao, setVisao] = useState<"semana" | "mes">("semana");

  const motivoSemMissao = !datasPlano.length ? 'Seu plano não tem missões cadastradas. Confira o plano ou o edital ativo.' : diaSelecionado < datasPlano[0] ? 'Esta data é anterior ao início do plano.' : diaSelecionado > datasPlano[datasPlano.length - 1] ? 'Esta data está depois do fim do plano. As missões anteriores continuam disponíveis; não criamos semanas vazias.' : 'Dia sem missão na programação atual. Você pode estudar livremente ou retomar pendências.';

  const eventos =
    useMemo(
      () =>
        montarEventos({
          questoes,
          sessoes,
          revisoes,
          simulados,
          nomesSimulados,
        }),
      [
        questoes,
        sessoes,
        revisoes,
        simulados,
        nomesSimulados,
      ]
    );

  const diasDoMes =
    useMemo(
      () =>
        montarDiasCalendario(
          mesExibido,
          eventos
        ),
      [
        mesExibido,
        eventos,
      ]
    );

  const resumoMes =
    useMemo(
      () => {
        const inicio = new Date(
          mesExibido.getFullYear(),
          mesExibido.getMonth(),
          1,
          0,
          0,
          0,
          0
        );
        const fim = new Date(
          mesExibido.getFullYear(),
          mesExibido.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        const metricas = calcularMetricasConsolidadas({
          questoes,
          sessoes,
          revisoes,
          simulados,
          inicio,
          fim,
        });

        return {
          diasAtivos: metricas.diasAtivos,
          minutos: metricas.minutos,
          questoes: metricas.questoes,
          revisoes: metricas.revisoesConcluidas,
          simulados: metricas.simulados,
        };
      },
      [
        questoes,
        sessoes,
        revisoes,
        simulados,
        mesExibido,
      ]
    );

  const detalheDia =
    diasDoMes.find(
      (dia) =>
        dia.chave ===
        diaSelecionado
    ) ?? null;

  function mudarMes(
    quantidade: number
  ) {
    const novoMes =
      new Date(
        mesExibido.getFullYear(),
        mesExibido.getMonth() +
          quantidade,
        1
      );

    setMesExibido(
      novoMes
    );

    setDiaSelecionado(
      formatarChaveData(
        novoMes
      )
    );
  }

  function voltarHoje() {
    const agora =
      new Date();

    setMesExibido(
      new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1
      )
    );

    setDiaSelecionado(
      formatarChaveData(
        agora
      )
    );
  }

  return (
    <section className="calendario-container">
      <div className="calendario-horizonte">
        <div><span>SUA PROVA</span><strong>{diasProva === null || !Number.isFinite(diasProva) ? 'Defina a data da prova' : diasProva > 0 ? `Faltam ${diasProva} dias` : diasProva === 0 ? 'A prova é hoje' : 'A data da prova já passou'}</strong>{configuracoes.dataProva && <small>{dataBR(configuracoes.dataProva)}</small>}</div>
        <div><span>PERÍODO DO PLANO</span><strong>{datasPlano.length ? `${dataBR(datasPlano[0])} a ${dataBR(datasPlano[datasPlano.length - 1])}` : 'Aguardando início automático'}</strong><small>{planoAtivo.length} semanas · {pendenciasPlano} missões pendentes</small></div>
        <button type="button" onClick={() => navigate('/configuracoes')}>Data da prova</button>
      </div>
      <div className="calendario-cabecalho">
        <div>
          <span className="calendario-etiqueta">
            {visao === "semana" ? "PLANEJAMENTO SEMANAL" : "VISÃO MENSAL"}
          </span>

          <h1>
            📅 Calendário de Estudos
          </h1>

          <p>
            {visao === "semana"
              ? "Veja a semana como uma grade de estudo: matérias, revisões, redação e simulado aparecem no dia em que devem ser feitos."
              : "Veja o que está planejado e o que você realizou. Registrar questões não conclui automaticamente uma missão do plano."}
          </p>

          <div className="calendario-alternar-visao" role="tablist" aria-label="Visualização do calendário">
            <button
              type="button"
              className={visao === "semana" ? "ativo" : ""}
              onClick={() => setVisao("semana")}
              role="tab"
              aria-selected={visao === "semana"}
            >
              Semana
            </button>
            <button
              type="button"
              className={visao === "mes" ? "ativo" : ""}
              onClick={() => setVisao("mes")}
              role="tab"
              aria-selected={visao === "mes"}
            >
              Mês
            </button>
          </div>
        </div>

        {visao === "mes" && <div className="calendario-controles">
          <button
            type="button"
            onClick={() =>
              mudarMes(-1)
            }
          >
            ‹
          </button>

          <strong>
            {
              NOMES_MESES[
                mesExibido.getMonth()
              ]
            }{" "}
            {
              mesExibido.getFullYear()
            }
          </strong>

          <button
            type="button"
            onClick={() =>
              mudarMes(1)
            }
          >
            ›
          </button>

          <button
            type="button"
            className="calendario-hoje"
            onClick={
              voltarHoje
            }
          >
            Hoje
          </button>
        </div>}
      </div>

      {visao === "semana" ? (
        <CalendarioSemanalPreview
          programacao={programacao}
          revisoes={revisoes}
          missoesConcluidas={missoesConcluidas}
        />
      ) : (
        <>
      <div className="calendario-resumo">
        <ResumoCard
          titulo="Dias ativos"
          valor={
            resumoMes.diasAtivos
          }
          detalhe="No mês"
        />

        <ResumoCard
          titulo="Tempo estudado"
          valor={formatarMinutos(
            resumoMes.minutos
          )}
          detalhe="Sessões + questões + simulados"
        />

        <ResumoCard
          titulo="Questões"
          valor={
            resumoMes.questoes
          }
          detalhe="Resolvidas"
        />

        <ResumoCard
          titulo="Revisões"
          valor={
            resumoMes.revisoes
          }
          detalhe="Concluídas"
        />

        <ResumoCard
          titulo="Simulados"
          valor={
            resumoMes.simulados
          }
          detalhe="Realizados"
        />
      </div>

      <div className="calendario-layout">
        <div className="calendario-painel">
          <div className="calendario-semana">
            {DIAS_SEMANA.map(
              (dia) => (
                <span key={dia}>
                  {dia}
                </span>
              )
            )}
          </div>

          <div className="calendario-grade">
            {diasDoMes.map(
              (dia) => {
                const pertenceAoMes =
                  dia.data.getMonth() ===
                  mesExibido.getMonth();

                const ehHoje =
                  dia.chave ===
                  formatarChaveData(
                    hoje
                  );

                const selecionado =
                  dia.chave ===
                  diaSelecionado;

                const possuiAtividade =
                  dia.sessoes > 0 ||
                  dia.questoes > 0 ||
                  dia.revisoesConcluidas >
                    0 ||
                  dia.simulados > 0;

                return (
                  <button
                    key={
                      dia.chave
                    }
                    type="button"
                    className={
                      `calendario-dia ${
                        pertenceAoMes
                          ? ""
                          : "calendario-dia-fora"
                      } ${
                        ehHoje
                          ? "calendario-dia-hoje"
                          : ""
                      } ${
                        selecionado
                          ? "calendario-dia-selecionado"
                          : ""
                      } ${
                        possuiAtividade
                          ? "calendario-dia-ativo"
                          : ""
                      }`
                    }
                    onClick={() =>
                      setDiaSelecionado(
                        dia.chave
                      )
                    }
                  >
                    {configuracoes.dataProva === dia.chave && <span className="calendario-prova-marca">DIA DA PROVA</span>}
                    <div className="calendario-dia-topo">
                      <strong>
                        {
                          dia.data.getDate()
                        }
                      </strong>

                      {dia.minutos >
                        0 && (
                        <span>
                          {formatarMinutosCurto(
                            dia.minutos
                          )}
                        </span>
                      )}
                    </div>

                    <div className="calendario-indicadores">
                      {(programacao.get(dia.chave)?.missoes.length ?? 0) > 0 && (
                        <span className="calendario-planejado-indicador" title="Missões planejadas">
                          {programacao.get(dia.chave)!.missoes.filter(m => missoesConcluidas.includes(m.id)).length}/{programacao.get(dia.chave)!.missoes.length} do plano
                        </span>
                      )}
                      {dia.sessoes >
                        0 && (
                        <i className="indicador-sessao">
                          {dia.sessoes}
                        </i>
                      )}

                      {dia.questoes >
                        0 && (
                        <i className="indicador-questoes">
                          {
                            dia.questoes
                          }
                        </i>
                      )}

                      {dia.revisoesConcluidas >
                        0 && (
                        <i className="indicador-revisao">
                          {
                            dia.revisoesConcluidas
                          }
                        </i>
                      )}

                      {dia.simulados >
                        0 && (
                        <i className="indicador-simulado">
                          {
                            dia.simulados
                          }
                        </i>
                      )}
                    </div>

                    {!!programacao.get(dia.chave)?.missoes.length && <span className="calendario-planejado">{programacao.get(dia.chave)!.missoes.filter(m => missoesConcluidas.includes(m.id)).length}/{programacao.get(dia.chave)!.missoes.length} missões concluídas</span>}
                    {dia.revisoesPendentes >
                      0 && (
                      <small>
                        {
                          dia.revisoesPendentes
                        }{" "}
                        {dia.revisoesPendentes > 1 ? "revisões" : "revisão"}{" "}
                        pendente
                        {dia.revisoesPendentes >
                        1
                          ? "s"
                          : ""}
                      </small>
                    )}
                  </button>
                );
              }
            )}
          </div>

          <div className="calendario-legenda">
            <span>
              <i className="indicador-sessao" />
              Sessões
            </span>

            <span>
              <i className="indicador-questoes" />
              Questões
            </span>

            <span>
              <i className="indicador-revisao" />
              Revisões
            </span>

            <span>
              <i className="indicador-simulado" />
              Simulados
            </span>
          </div>
        </div>

        <aside className="calendario-detalhes">
          <div className="calendario-detalhes-topo">
            <div>
              <span>
                DIA SELECIONADO
              </span>

              <h2>
                {detalheDia
                  ? formatarDataCompleta(
                      detalheDia.data
                    )
                  : "Sem dia selecionado"}
              </h2>
            </div>

            {detalheDia && (
              <strong>
                {formatarMinutos(
                  detalheDia.minutos
                )}
              </strong>
            )}
          </div>

          <div className="calendario-programacao">
            <h3>Programação do plano</h3>
            {!configuracoes.dataInicioPlano ? (
              <p>O início é registrado automaticamente após a sincronização da conta.</p>
            ) : (programacao.get(diaSelecionado)?.missoes.length ?? 0) === 0 ? (
              <div><p>{motivoSemMissao}</p><p>{pendenciasPlano} missões ainda pendentes no plano.</p><button type="button" onClick={() => navigate('/plano')}>Ver plano e pendências</button></div>
            ) : <>
              <ul>{programacao.get(diaSelecionado)!.missoes.map(m => <li key={m.id}>
                <strong>{m.materia}</strong> — {m.assunto}<br />
                <span>{missoesConcluidas.includes(m.id) ? "✓ Concluída" : "Pendente"}</span>
              </li>)}</ul>
              <button type="button" onClick={() => { const data = programacao.get(diaSelecionado)!; navigate("/plano", {state: {semana: data.semana, dia: data.dia}}); }}>Abrir este dia no plano</button>
            </>}
          </div>
          <h3>Atividades registradas</h3>
          {!detalheDia ||
          detalheDia.eventos.length ===
            0 ? (
            <div className="calendario-vazio">
              Nenhuma atividade registrada
              neste dia.
            </div>
          ) : (
            <>
              <div className="calendario-detalhes-resumo">
                <MiniResumo
                  titulo="Sessões"
                  valor={
                    detalheDia.sessoes
                  }
                />

                <MiniResumo
                  titulo="Questões"
                  valor={
                    detalheDia.questoes
                  }
                />

                <MiniResumo
                  titulo="Revisões"
                  valor={
                    detalheDia.revisoesConcluidas
                  }
                />

                <MiniResumo
                  titulo="Simulados"
                  valor={
                    detalheDia.simulados
                  }
                />
              </div>

              <div className="calendario-eventos">
                {agruparEventosCalendario(detalheDia.eventos).map(grupo => <details className="calendario-grupo" key={grupo.materia}>
                  <summary><strong>{grupo.materia}</strong><span>{formatarMinutos(grupo.minutos)} de estudo · {grupo.questoes} questões</span><small>{grupo.revisoesConcluidas > 0 ? `${grupo.revisoesConcluidas} revisões concluídas` : ''}{grupo.revisoesPendentes > 0 ? ` · ${grupo.revisoesPendentes} revisões pendentes` : ''}</small></summary>
                  {grupo.eventos.map(evento => <article key={evento.id} className={`calendario-evento calendario-evento-${evento.tipo}`}>
                    <div className="calendario-evento-icone">{iconeEvento(evento.tipo)}</div>
                    <div><p>{evento.detalhe}</p><span>{evento.minutos > 0 ? formatarMinutos(evento.minutos) : evento.tipo==='revisao' ? formatarStatus(evento.status) : ''}</span>
                    {evento.revisaoId && evento.status !== 'concluida' && <button type="button" onClick={() => navigate('/revisoes', {state:{revisaoId:evento.revisaoId}})}>Fazer revisão</button>}</div>
                  </article>)}
                </details>)}
              </div>
            </>
          )}
        </aside>
      </div>
        </>
      )}
    </section>
  );
}

function ResumoCard({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string | number;
  detalhe: string;
}) {
  return (
    <article className="calendario-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function MiniResumo({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="calendario-mini-resumo">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function montarEventos({
  questoes,
  sessoes,
  revisoes,
  simulados,
  nomesSimulados,
}: {
  questoes: any[];
  sessoes: any[];
  revisoes: any[];
  simulados: any[];
  nomesSimulados: Record<string, string>;
}): EventoCalendario[] {
  const eventos:
    EventoCalendario[] = [];

  const tentativasJaContabilizadas = new Set(
    questoes
      .map((registro) => registro.tentativaId)
      .filter(
        (id) =>
          typeof id === "string" &&
          id.length > 0
      )
  );

  sessoes.forEach(
    (sessao) => {
      eventos.push({
        id:
          `sessao-${sessao.id}`,
        tipo:
          "sessao",
        titulo:
          sessao.materia ||
          "Sessão de estudo",
        detalhe:
          sessao.assunto ||
          sessao.tipo ||
          "Estudo",
        minutos:
          Number(
            sessao.minutos
          ) || 0,
        data:
          sessao.data,
      });
    }
  );

  questoes.forEach(
    (registro) => {
      const total =
        (Number(
          registro.certas
        ) || 0) +
        (Number(
          registro.erradas
        ) || 0) +
        (Number(
          registro.emBranco
        ) || 0);

      eventos.push({
        id:
          `questoes-${registro.id}`,
        tipo:
          "questoes",
        titulo:
          registro.materia ||
          "Questões",
        detalhe:
          `${registro.assunto || "Sem assunto"} • ${total} questões`,
        minutos:
          Number(
            registro.minutos
          ) || 0,
        quantidadeQuestoes:
          total,
        data:
          registro.data,
      });
    }
  );

  revisoes.forEach(
    (revisao) => {
      const concluida =
        Boolean(
          revisao.concluida
        );

      const data =
        concluida &&
        revisao.dataConclusao
          ? revisao.dataConclusao
          : revisao.dataPrevista;

      const status =
        concluida
          ? "concluida"
          : inicioDoDia(
              new Date(
                revisao.dataPrevista
              )
            ).getTime() <
            inicioDoDia(
              new Date()
            ).getTime()
            ? "atrasada"
            : "pendente";

      eventos.push({
        id:
          `revisao-${revisao.id}-${status}`,
        tipo:
          "revisao",
        revisaoId: revisao.id,
        titulo:
          revisao.materia ||
          "Revisão",
        detalhe:
          `${revisao.assunto || "Sem assunto"} • Etapa ${revisao.etapa}` +
          (rotuloOrigemRevisaoSimulado(revisao, nomesSimulados)
            ? ` • ${rotuloOrigemRevisaoSimulado(revisao, nomesSimulados)}`
            : ""),
        minutos: 0,
        data,
        status,
      });
    }
  );

  simulados.forEach(
    (simulado) => {
      const somaInformada =
        (Number(
          simulado.certas
        ) || 0) +
        (Number(
          simulado.erradas
        ) || 0) +
        (Number(
          simulado.emBranco
        ) || 0) +
        (Number(
          simulado.anuladas
        ) || 0);
      const total = Math.max(
        somaInformada,
        Number(simulado.totalQuestoes) || 0
      );

      const espelhadoEmQuestoes =
        typeof simulado.tentativaId === "string" &&
        tentativasJaContabilizadas.has(
          simulado.tentativaId
        );

      eventos.push({
        id:
          `simulado-${simulado.id}`,
        tipo:
          "simulado",
        titulo:
          simulado.nome ||
          "Simulado",
        detalhe:
          `${simulado.banca || "Sem banca"} • ${total} questões`,
        minutos:
          Number(
            simulado.minutos
          ) || 0,
        quantidadeQuestoes:
          espelhadoEmQuestoes
            ? 0
            : total,
        data:
          simulado.data,
      });
    }
  );

  return eventos;
}

function montarDiasCalendario(
  mes: Date,
  eventos:
    EventoCalendario[]
): ResumoDia[] {
  const primeiroDiaMes =
    new Date(
      mes.getFullYear(),
      mes.getMonth(),
      1
    );

  const inicioGrade =
    adicionarDias(
      primeiroDiaMes,
      -primeiroDiaMes.getDay()
    );

  const mapaEventos =
    new Map<
      string,
      EventoCalendario[]
    >();

  eventos.forEach(
    (evento) => {
      const chave =
        formatarChaveData(
          new Date(
            evento.data
          )
        );

      const lista =
        mapaEventos.get(
          chave
        ) ?? [];

      lista.push(
        evento
      );

      mapaEventos.set(
        chave,
        lista
      );
    }
  );

  return Array.from(
    {
      length: 42,
    },
    (
      _,
      indice
    ) => {
      const data =
        adicionarDias(
          inicioGrade,
          indice
        );

      const chave =
        formatarChaveData(
          data
        );

      const lista =
        mapaEventos.get(
          chave
        ) ?? [];

      const eventosAtivos =
        lista.filter(
          (evento) =>
            evento.tipo !==
              "revisao" ||
            evento.status ===
              "concluida"
        );

      return {
        chave,
        data,
        eventos: lista,

        minutos:
          eventosAtivos.reduce(
            (
              total,
              evento
            ) =>
              total +
              evento.minutos,
            0
          ),

        questoes:
          eventosAtivos.reduce(
            (total, evento) =>
              total +
              (evento.quantidadeQuestoes ?? 0),
            0
          ),

        sessoes:
          eventosAtivos.filter(
            (evento) =>
              evento.tipo ===
              "sessao"
          ).length,

        revisoesConcluidas:
          lista.filter(
            (evento) =>
              evento.tipo ===
                "revisao" &&
              evento.status ===
                "concluida"
          ).length,

        revisoesPendentes:
          lista.filter(
            (evento) =>
              evento.tipo ===
                "revisao" &&
              evento.status !==
                "concluida"
          ).length,

        simulados:
          eventosAtivos.filter(
            (evento) =>
              evento.tipo ===
              "simulado"
          ).length,
      };
    }
  );
}

function formatarChaveData(
  data: Date
) {
  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      data.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${ano}-${mes}-${dia}`;
}

function formatarDataCompleta(
  data: Date
) {
  return data.toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function formatarMinutos(
  minutosTotais: number
) {
  const minutos =
    Math.max(
      0,
      Math.round(
        minutosTotais
      )
    );

  const horas =
    Math.floor(
      minutos / 60
    );

  const restante =
    minutos % 60;

  if (horas === 0) {
    return `${restante}min`;
  }

  return `${horas}h ${restante}min`;
}

function formatarMinutosCurto(
  minutosTotais: number
) {
  if (
    minutosTotais < 60
  ) {
    return `${minutosTotais}m`;
  }

  return `${Math.floor(
    minutosTotais / 60
  )}h`;
}

function formatarStatus(
  status?: EventoCalendario["status"]
) {
  if (
    status === "concluida"
  ) {
    return "Concluída";
  }

  if (
    status === "atrasada"
  ) {
    return "Atrasada";
  }

  if (
    status === "pendente"
  ) {
    return "Pendente";
  }

  return "";
}

function iconeEvento(
  tipo: EventoCalendario["tipo"]
) {
  const icones = {
    sessao: "⏱",
    questoes: "📝",
    revisao: "🔁",
    simulado: "🎯",
  };

  return icones[tipo];
}

function inicioDoDia(
  data: Date
) {
  const copia =
    new Date(data);

  copia.setHours(
    0,
    0,
    0,
    0
  );

  return copia;
}

function adicionarDias(
  data: Date,
  quantidade: number
) {
  const copia =
    new Date(data);

  copia.setDate(
    copia.getDate() +
      quantidade
  );

  return copia;
}