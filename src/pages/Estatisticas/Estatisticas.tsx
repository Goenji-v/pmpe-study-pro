import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  type EvolucaoMensal,
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

type PeriodoFiltro = "tudo" | "hoje" | "7d" | "30d" | "mes" | "personalizado";

type DadoCategoria = {
  nome: string;
  aproveitamento: number;
  questoes: number;
  cor: string;
};

const CORES_CATEGORIAS = [
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#22c55e",
  "#06b6d4",
  "#eab308",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
  "#84cc16",
  "#f43f5e",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#6366f1",
];

const CORES_MESES = [
  "#3b82f6", // janeiro
  "#22c55e", // fevereiro
  "#8b5cf6", // março
  "#f97316", // abril
  "#ef4444", // maio
  "#06b6d4", // junho
  "#eab308", // julho
  "#ec4899", // agosto
  "#14b8a6", // setembro
  "#a855f7", // outubro
  "#f59e0b", // novembro
  "#f43f5e", // dezembro
];

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
      .filter((item) => normalizarFiltro(item.materia) === materiaNormalizada)
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
        : simulados.filter((item) => estaNoPeriodo(item.data, intervalo.inicio, intervalo.fim)),
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

  const resumo = useMemo(() => resumirQuestoes(questoesFiltradas), [questoesFiltradas]);
  const classificacao = classificarDesempenho(resumo.aproveitamento, resumo.total);
  const linhasDesempenho = materiaSelecionada ? porAssunto : porMateria;
  const dadosGrafico: DadoCategoria[] = linhasDesempenho.slice(0, 12).map((linha) => {
    const nome = materiaSelecionada ? linha.assunto || "Geral" : linha.materia;
    return {
      nome,
      aproveitamento: linha.aproveitamento,
      questoes: linha.questoes,
      cor: corDaCategoria(nome),
    };
  });

  const minutos = sessoesFiltradas.reduce((total, item) => total + (Number(item.minutos) || 0), 0);
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

      <div className="estatisticas-filtros-card estatisticas-entrada">
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
            <select value={materiaSelecionada} onChange={(evento) => selecionarMateria(evento.target.value)}>
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

      <div className="estatisticas-cards estatisticas-cards-resumo estatisticas-entrada">
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
            descricao="Cada conteúdo tem uma cor própria. A altura mostra o percentual de acertos."
            classe="grafico-card-categorias"
          >
            <BarChart data={dadosGrafico} margin={{ top: 22, right: 6, left: 0, bottom: 56 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="nome"
                stroke="#94a3b8"
                interval={0}
                height={68}
                angle={-32}
                textAnchor="end"
                tick={{ fontSize: 10 }}
                tickFormatter={abreviarRotulo}
              />
              <YAxis domain={[0, 100]} stroke="#94a3b8" width={30} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(valor) => [`${valor}%`, "Aproveitamento"]}
                labelFormatter={(rotulo) => String(rotulo)}
              />
              <Bar
                dataKey="aproveitamento"
                name="Aproveitamento"
                radius={[7, 7, 0, 0]}
                maxBarSize={34}
                isAnimationActive
                animationDuration={650}
              >
                {dadosGrafico.map((item) => (
                  <Cell key={item.nome} fill={item.cor} />
                ))}
                <LabelList
                  dataKey="aproveitamento"
                  position="top"
                  fill="#e2e8f0"
                  fontSize={10}
                  formatter={(valor: string | number) => `${valor}%`}
                />
              </Bar>
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

      <div className="estatisticas-cards estatisticas-cards-atividade estatisticas-entrada">
        <Card titulo="Horas estudadas" valor={`${(minutos / 60).toFixed(1)}h`} />
        <Card titulo="Revisões realizadas" valor={String(revisoesFeitas)} />
        <Card titulo="Simulados" valor={String(simuladosFiltrados.length)} detalhe={materiaSelecionada ? "Simulados gerais não entram no filtro por matéria." : undefined} />
        <Card titulo="Redações" valor={String(redacoes.length)} />
      </div>

      {possuiDados && evolucao.length > 0 && (
        <div className="graficos-grid graficos-grid-evolucao">
          <VolumeMensal evolucao={evolucao} />

          <Grafico titulo="Evolução do aproveitamento" descricao="Percentual mensal de acertos nos registros filtrados." classe="grafico-card-compacto">
            <LineChart data={evolucao} margin={{ top: 8, right: 8, left: -12, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(valor) => [`${valor}%`, "Aproveitamento"]} />
              <Line
                type="monotone"
                dataKey="aproveitamento"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ fill: "#22c55e", r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={650}
              />
            </LineChart>
          </Grafico>
        </div>
      )}
    </section>
  );
}

function VolumeMensal({ evolucao }: { evolucao: EvolucaoMensal[] }) {
  return (
    <div className="grafico-card grafico-card-volume estatisticas-entrada">
      <h2>Volume mensal</h2>
      <p className="grafico-descricao">
        Cada mês mantém a mesma cor em todos os anos. Barras finas deixam a comparação mais limpa.
      </p>

      <div className="volume-mensal-grid">
        <MiniGraficoVolume titulo="Horas estudadas" dataKey="horas" evolucao={evolucao} sufixo="h" />
        <MiniGraficoVolume titulo="Questões" dataKey="questoes" evolucao={evolucao} />
      </div>
    </div>
  );
}

function MiniGraficoVolume({
  titulo,
  dataKey,
  evolucao,
  sufixo = "",
}: {
  titulo: string;
  dataKey: "horas" | "questoes";
  evolucao: EvolucaoMensal[];
  sufixo?: string;
}) {
  return (
    <div className="volume-mini-card">
      <div className="volume-mini-cabecalho">
        <strong>{titulo}</strong>
        <small>{evolucao.length} mês{evolucao.length === 1 ? "" : "es"}</small>
      </div>
      <div className="volume-mini-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={evolucao} margin={{ top: 8, right: 4, left: -18, bottom: 4 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fontSize: 9 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} width={34} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(valor) => [`${valor}${sufixo}`, titulo]}
            />
            <Bar
              dataKey={dataKey}
              radius={[5, 5, 0, 0]}
              maxBarSize={24}
              isAnimationActive
              animationDuration={600}
            >
              {evolucao.map((item) => (
                <Cell key={`${dataKey}-${item.chave}`} fill={corDoMes(item.chave)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  fontSize: 12,
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
    const inicio = inicioPersonalizado ? new Date(`${inicioPersonalizado}T00:00:00`) : undefined;
    const fim = fimPersonalizado ? new Date(`${fimPersonalizado}T23:59:59.999`) : undefined;
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

function corDaCategoria(nome: string) {
  const normalizado = normalizarFiltro(nome);
  let hash = 0;
  for (let indice = 0; indice < normalizado.length; indice += 1) {
    hash = (hash * 31 + normalizado.charCodeAt(indice)) >>> 0;
  }
  return CORES_CATEGORIAS[hash % CORES_CATEGORIAS.length];
}

function corDoMes(chave: string) {
  const mes = Number(chave.split("-")[1]);
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return CORES_MESES[0];
  return CORES_MESES[mes - 1];
}

function abreviarRotulo(valor: string) {
  const texto = String(valor || "");
  if (texto.length <= 16) return texto;
  return `${texto.slice(0, 14)}…`;
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
      <strong className={`${classe} ${compacto ? "estatistica-valor-compacto" : ""}`.trim()}>{valor}</strong>
      {detalhe && <small>{detalhe}</small>}
    </div>
  );
}

function FiltroPeriodo({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`estatisticas-periodo ${ativo ? "ativo" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Grafico({
  titulo,
  descricao,
  children,
  classe = "",
}: {
  titulo: string;
  descricao: string;
  children: ReactElement;
  classe?: string;
}) {
  return (
    <div className={`grafico-card estatisticas-entrada ${classe}`.trim()}>
      <h2>{titulo}</h2>
      <p className="grafico-descricao">{descricao}</p>
      <div className="grafico-area">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
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
    <div className="estatisticas-painel estatisticas-painel-tabela estatisticas-entrada">
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
              const classificacao = classificarDesempenho(linha.aproveitamento, linha.questoes);
              const nome = porAssunto ? linha.assunto || "Geral" : linha.materia;
              const cor = corDaCategoria(nome);

              return (
                <tr key={linha.chave}>
                  <td>
                    <div className="estatisticas-nome-linha">
                      <span className="estatisticas-cor-dot" style={{ backgroundColor: cor }} aria-hidden="true" />
                      <div>
                        {onMateriaClick ? (
                          <button type="button" className="estatisticas-drilldown" onClick={() => onMateriaClick(linha.materia)}>
                            {nome}
                          </button>
                        ) : (
                          <strong>{nome}</strong>
                        )}
                        {porAssunto && linha.modulo && <small>{linha.modulo}</small>}
                      </div>
                    </div>
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
