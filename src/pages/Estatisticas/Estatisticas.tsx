import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./Estatisticas.css";

import { useApp } from "../../context/AppContext";
import {
  consolidarEvolucaoMensal,
  consolidarPorAssunto,
  consolidarPorMateria,
  type LinhaDesempenho,
} from "../../utils/estatisticasConsolidadas";
import {
  classificarDesempenho,
  estaNoPeriodo,
  filtrarQuestoesDesempenho,
  filtrarRevisoesDesempenho,
  filtrarSessoesDesempenho,
  normalizarFiltro,
  resumirQuestoes,
  rotuloClassificacao,
  type ClassificacaoDesempenho,
} from "../../utils/filtrosDesempenho";

type PeriodoFiltro =
  | "tudo"
  | "hoje"
  | "7d"
  | "30d"
  | "mes"
  | "personalizado";

export default function Estatisticas() {
  const { materias, questoes, sessoes, revisoes, simulados } = useApp();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("tudo");
  const [inicioPersonalizado, setInicioPersonalizado] = useState("");
  const [fimPersonalizado, setFimPersonalizado] = useState("");
  const [materiaSelecionada, setMateriaSelecionada] = useState("");
  const [assuntoSelecionado, setAssuntoSelecionado] = useState("");

  const intervalo = useMemo(
    () => obterIntervalo(periodo, inicioPersonalizado, fimPersonalizado),
    [periodo, inicioPersonalizado, fimPersonalizado]
  );

  const filtro = useMemo(
    () => ({
      ...intervalo,
      materia: materiaSelecionada || undefined,
      assunto: assuntoSelecionado || undefined,
    }),
    [intervalo, materiaSelecionada, assuntoSelecionado]
  );

  const materiasDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();
    questoes.forEach((item) => {
      const chave = normalizarFiltro(item.materia);
      if (chave && !mapa.has(chave)) mapa.set(chave, item.materia.trim());
    });
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [questoes]);

  const assuntosDisponiveis = useMemo(() => {
    if (!materiaSelecionada) return [];
    const materiaNormalizada = normalizarFiltro(materiaSelecionada);
    const mapa = new Map<string, string>();

    questoes
      .filter(
        (item) => normalizarFiltro(item.materia) === materiaNormalizada
      )
      .forEach((item) => {
        const chave = normalizarFiltro(item.assunto);
        if (chave && !mapa.has(chave)) mapa.set(chave, item.assunto.trim());
      });

    return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [questoes, materiaSelecionada]);

  const questoesFiltradas = useMemo(
    () => filtrarQuestoesDesempenho(questoes, filtro),
    [questoes, filtro]
  );
  const sessoesFiltradas = useMemo(
    () => filtrarSessoesDesempenho(sessoes, filtro),
    [sessoes, filtro]
  );
  const revisoesFiltradas = useMemo(
    () => filtrarRevisoesDesempenho(revisoes, filtro),
    [revisoes, filtro]
  );
  const simuladosFiltrados = useMemo(
    () =>
      materiaSelecionada || assuntoSelecionado
        ? []
        : simulados.filter((item) =>
            estaNoPeriodo(item.data, intervalo.inicio, intervalo.fim)
          ),
    [simulados, materiaSelecionada, assuntoSelecionado, intervalo]
  );

  const porMateria = useMemo(
    () =>
      consolidarPorMateria({
        materias,
        questoes: questoesFiltradas,
        sessoes: sessoesFiltradas,
        revisoes: revisoesFiltradas,
      }).filter((item) => item.questoes > 0),
    [materias, questoesFiltradas, sessoesFiltradas, revisoesFiltradas]
  );

  const porAssunto = useMemo(
    () =>
      consolidarPorAssunto({
        questoes: questoesFiltradas,
        sessoes: sessoesFiltradas,
        revisoes: revisoesFiltradas,
      }).filter((item) => item.questoes > 0),
    [questoesFiltradas, sessoesFiltradas, revisoesFiltradas]
  );

  const evolucao = useMemo(
    () =>
      consolidarEvolucaoMensal({
        questoes: questoesFiltradas,
        sessoes: sessoesFiltradas,
        revisoes: revisoesFiltradas,
        simulados: simuladosFiltrados,
      }),
    [questoesFiltradas, sessoesFiltradas, revisoesFiltradas, simuladosFiltrados]
  );

  const resumo = useMemo(
    () => resumirQuestoes(questoesFiltradas),
    [questoesFiltradas]
  );
  const classificacao = classificarDesempenho(
    resumo.aproveitamento,
    resumo.total
  );
  const linhasDesempenho = materiaSelecionada ? porAssunto : porMateria;
  const dadosGrafico = linhasDesempenho.slice(0, 12).map((linha) => ({
    nome: materiaSelecionada ? linha.assunto : linha.materia,
    aproveitamento: linha.aproveitamento,
    questoes: linha.questoes,
  }));

  const minutos = sessoesFiltradas.reduce(
    (total, item) => total + (Number(item.minutos) || 0),
    0
  );
  const revisoesFeitas = revisoesFiltradas.filter((item) => item.concluida).length;
  const redacoes = sessoesFiltradas.filter((item) => item.tipo === "redacao");
  const possuiDados = resumo.total + minutos + revisoesFeitas + simuladosFiltrados.length > 0;

  function limparFiltros() {
    setPeriodo("tudo");
    setInicioPersonalizado("");
    setFimPersonalizado("");
    setMateriaSelecionada("");
    setAssuntoSelecionado("");
  }

  function selecionarMateria(valor: string) {
    setMateriaSelecionada(valor);
    setAssuntoSelecionado("");
  }

  return (
    <section className="estatisticas-container">
      <h1 className="estatisticas-title">📊 Desempenho</h1>
      <p className="estatisticas-subtitle">
        Filtre seu histórico por período, matéria e assunto para descobrir onde você está forte e onde precisa revisar.
      </p>

      <div className="estatisticas-filtros-card">
        <div className="estatisticas-periodos" role="group" aria-label="Período das estatísticas">
          <FiltroPeriodo ativo={periodo === "tudo"} onClick={() => setPeriodo("tudo")}>Tudo</FiltroPeriodo>
          <FiltroPeriodo ativo={periodo === "hoje"} onClick={() => setPeriodo("hoje")}>Hoje</FiltroPeriodo>
          <FiltroPeriodo ativo={periodo === "7d"} onClick={() => setPeriodo("7d")}>7 dias</FiltroPeriodo>
          <FiltroPeriodo ativo={periodo === "30d"} onClick={() => setPeriodo("30d")}>30 dias</FiltroPeriodo>
          <FiltroPeriodo ativo={periodo === "mes"} onClick={() => setPeriodo("mes")}>Este mês</FiltroPeriodo>
          <FiltroPeriodo ativo={periodo === "personalizado"} onClick={() => setPeriodo("personalizado")}>Personalizado</FiltroPeriodo>
        </div>

        {periodo === "personalizado" && (
          <div className="estatisticas-datas">
            <label>
              De
              <input
                type="date"
                value={inicioPersonalizado}
                onChange={(evento) => setInicioPersonalizado(evento.target.value)}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={fimPersonalizado}
                onChange={(evento) => setFimPersonalizado(evento.target.value)}
              />
            </label>
          </div>
        )}

        <div className="estatisticas-selects">
          <label>
            Matéria
            <select
              value={materiaSelecionada}
              onChange={(evento) => selecionarMateria(evento.target.value)}
            >
              <option value="">Todas as matérias</option>
              {materiasDisponiveis.map((materia) => (
                <option value={materia} key={materia}>{materia}</option>
              ))}
            </select>
          </label>

          <label>
            Assunto
            <select
              value={assuntoSelecionado}
              disabled={!materiaSelecionada}
              onChange={(evento) => setAssuntoSelecionado(evento.target.value)}
            >
              <option value="">Todos os assuntos</option>
              {assuntosDisponiveis.map((assunto) => (
                <option value={assunto} key={assunto}>{assunto}</option>
              ))}
            </select>
          </label>

          <button type="button" className="estatisticas-limpar" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="estatisticas-cards estatisticas-cards-resumo">
        <Card titulo="Certas" valor={String(resumo.certas)} />
        <Card titulo="Erradas" valor={String(resumo.erradas)} />
        <Card titulo="Questões" valor={String(resumo.total)} />
        <Card titulo="Aproveitamento" valor={`${resumo.aproveitamento}%`} classe={classeClassificacao(classificacao)} />
        <Card titulo="Situação" valor={rotuloClassificacao(classificacao)} classe={classeClassificacao(classificacao)} compacto />
      </div>

      {resumo.total > 0 ? (
        <div className="estatisticas-desempenho-grid">
          <TabelaDesempenho
            titulo={materiaSelecionada ? `Assuntos de ${materiaSelecionada}` : "Desempenho por matéria"}
            linhas={linhasDesempenho}
            porAssunto={Boolean(materiaSelecionada)}
            onMateriaClick={materiaSelecionada ? undefined : selecionarMateria}
          />

          <Grafico
            titulo={materiaSelecionada ? "Aproveitamento por assunto" : "Aproveitamento por matéria"}
            descricao="Percentual de acertos dentro dos filtros selecionados."
          >
            <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
              <YAxis type="category" dataKey="nome" width={110} stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Aproveitamento"]} />
              <Bar dataKey="aproveitamento" name="Aproveitamento" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </Grafico>
        </div>
      ) : (
        <div className="estatisticas-vazio">
          <h2>Nenhuma questão encontrada</h2>
          <p>Altere o período, a matéria ou o assunto para ampliar o filtro.</p>
        </div>
      )}

      <div className="estatisticas-secao-cabecalho">
        <div>
          <h2>Atividade no período</h2>
          <p>Dados complementares que também respeitam o período e o conteúdo selecionados.</p>
        </div>
      </div>

      <div className="estatisticas-cards estatisticas-cards-atividade">
        <Card titulo="Horas estudadas" valor={`${(minutos / 60).toFixed(1)}h`} />
        <Card titulo="Revisões realizadas" valor={String(revisoesFeitas)} />
        <Card titulo="Simulados" valor={String(simuladosFiltrados.length)} detalhe={materiaSelecionada ? "Simulados gerais não entram no filtro por matéria." : undefined} />
        <Card titulo="Redações" valor={String(redacoes.length)} />
      </div>

      {possuiDados && evolucao.length > 0 && (
        <div className="graficos-grid">
          <Grafico titulo="Volume mensal" descricao="Horas estudadas e questões registradas dentro dos filtros.">
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="horas" name="Horas" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="questoes" name="Questões" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </Grafico>

          <Grafico titulo="Evolução do aproveitamento" descricao="Percentual mensal de acertos nos registros filtrados.">
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" />
              <YAxis domain={[0, 100]} stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Aproveitamento"]} />
              <Line type="monotone" dataKey="aproveitamento" stroke="#22c55e" strokeWidth={3} dot={{ fill: "#22c55e" }} />
            </LineChart>
          </Grafico>
        </div>
      )}
    </section>
  );
}

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
};

function obterIntervalo(
  periodo: PeriodoFiltro,
  inicioPersonalizado: string,
  fimPersonalizado: string
) {
  if (periodo === "tudo") return {};

  const agora = new Date();
  const fimHoje = new Date(agora);
  fimHoje.setHours(23, 59, 59, 999);
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);

  if (periodo === "personalizado") {
    const inicio = inicioPersonalizado
      ? new Date(`${inicioPersonalizado}T00:00:00`)
      : undefined;
    const fim = fimPersonalizado
      ? new Date(`${fimPersonalizado}T23:59:59.999`)
      : undefined;
    return { inicio, fim };
  }

  if (periodo === "hoje") return { inicio: inicioHoje, fim: fimHoje };

  const inicio = new Date(inicioHoje);
  if (periodo === "7d") inicio.setDate(inicio.getDate() - 6);
  if (periodo === "30d") inicio.setDate(inicio.getDate() - 29);
  if (periodo === "mes") inicio.setDate(1);

  return { inicio, fim: fimHoje };
}

function classeClassificacao(classificacao: ClassificacaoDesempenho) {
  return `desempenho-${classificacao}`;
}

function Card({
  titulo,
  valor,
  detalhe,
  classe = "",
  compacto = false,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  classe?: string;
  compacto?: boolean;
}) {
  return (
    <div className="estatistica-card">
      <span>{titulo}</span>
      <strong className={`${classe} ${compacto ? "estatistica-valor-compacto" : ""}`.trim()}>
        {valor}
      </strong>
      {detalhe && <small>{detalhe}</small>}
    </div>
  );
}

function FiltroPeriodo({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`estatisticas-periodo ${ativo ? "ativo" : ""}`
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Grafico({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactElement;
}) {
  return (
    <div className="grafico-card">
      <h2>{titulo}</h2>
      <p className="grafico-descricao">{descricao}</p>
      <div className="grafico-area">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TabelaDesempenho({
  titulo,
  linhas,
  porAssunto,
  onMateriaClick,
}: {
  titulo: string;
  linhas: LinhaDesempenho[];
  porAssunto: boolean;
  onMateriaClick?: (materia: string) => void;
}) {
  return (
    <div className="estatisticas-painel estatisticas-painel-tabela">
      <div className="estatisticas-painel-cabecalho">
        <h2>{titulo}</h2>
        {porAssunto && <small>Clique em “Todas as matérias” no filtro para voltar à visão geral.</small>}
      </div>

      <div className="estatisticas-tabela-wrapper">
        <table className="estatisticas-tabela">
          <thead>
            <tr>
              <th>{porAssunto ? "Assunto" : "Matéria"}</th>
              <th>Certas</th>
              <th>Erradas</th>
              <th>Total</th>
              <th>%</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const classificacao = classificarDesempenho(
                linha.aproveitamento,
                linha.questoes
              );
              const nome = porAssunto ? linha.assunto || "Geral" : linha.materia;

              return (
                <tr key={linha.chave}>
                  <td>
                    {onMateriaClick ? (
                      <button
                        type="button"
                        className="estatisticas-drilldown"
                        onClick={() => onMateriaClick(linha.materia)}
                      >
                        {nome}
                      </button>
                    ) : (
                      <strong>{nome}</strong>
                    )}
                    {porAssunto && linha.modulo && <small>{linha.modulo}</small>}
                  </td>
                  <td>{linha.certas}</td>
                  <td>{linha.erradas}</td>
                  <td>{linha.questoes}</td>
                  <td className={classeClassificacao(classificacao)}>{linha.aproveitamento}%</td>
                  <td>
                    <span className={`estatisticas-status ${classeClassificacao(classificacao)}`}>
                      {rotuloClassificacao(classificacao)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
