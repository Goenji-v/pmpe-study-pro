import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { carregarDashboardProfessor, type DashboardProfessor } from "../../services/professorDashboardService";
import { obterPermissoesParceiro } from "../../utils/permissoesParceiro";
import GerenciarTurmasParceiro from "./GerenciarTurmasParceiro";
import "./ProfessorDashboard.css";

export default function ProfessorDashboard() {
  const { contexto } = useContextoComercial();
  const permissoes = obterPermissoesParceiro(contexto?.papel);
  const [dados, setDados] = useState<DashboardProfessor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      setDados(await carregarDashboardProfessor());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o resumo das turmas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  const maiorAtividade = useMemo(() => Math.max(1, ...(dados?.atividade7Dias.map((item) => item.minutos) ?? [1])), [dados]);

  if (carregando) return <div className="prof-dashboard-estado">Carregando resumo das turmas...</div>;
  if (erro) return <div className="prof-dashboard-erro" role="alert"><strong>Não foi possível carregar o resumo.</strong><span>{erro}</span><button type="button" onClick={() => void carregar()}>Tentar novamente</button></div>;
  if (!dados) return null;

  const i = dados.indicadores;
  return (
    <div className="prof-dashboard">
      <section className="prof-dashboard-intro">
        <div>
          <span>VISÃO GERAL DAS TURMAS</span>
          <h2>Resumo do uso do seu curso</h2>
          <p>Indicadores consolidados da parceria. Nenhum dado individual de aluno é exibido nesta área.</p>
        </div>
        <div className="prof-dashboard-intro-acoes">
          <Link to="/parceiro/cursos">Gerenciar meu curso →</Link>
          <Link to="/parceiro/simulados">Gerenciar simulados →</Link>
        </div>
      </section>

      {permissoes.podeGerenciarTurmas && <GerenciarTurmasParceiro onChanged={carregar} />}

      <section className="prof-dashboard-kpis" aria-label="Indicadores consolidados">
        <Kpi titulo="Alunos ativos" valor={String(i.alunosAtivos)} detalhe={`${i.alunosAtivosHoje} estudaram hoje`} />
        <Kpi titulo="Turmas ativas" valor={String(i.turmasAtivas)} detalhe="com acesso ao conteúdo" />
        <Kpi titulo="Horas estudadas" valor={formatarTempo(i.minutosMes)} detalhe={`${i.diasEstudoMes} dias de estudo somados`} />
        <Kpi titulo="Questões no mês" valor={formatarNumero(i.questoesMes)} detalhe={`${i.acuraciaMes.toFixed(1)}% de acertos da turma`} />
        <Kpi titulo="Revisões feitas" valor={formatarNumero(i.revisoesConcluidasMes)} detalhe={`${i.revisoesAtrasadas} pendentes no total`} />
        <Kpi titulo="Simulados" valor={formatarNumero(i.simuladosMes)} detalhe={i.simuladosMes ? `média geral ${i.mediaSimulados.toFixed(1)}%` : "nenhum neste mês"} />
      </section>

      <section className="prof-dashboard-duas-colunas">
        <article className="prof-dashboard-card">
          <div className="prof-dashboard-card-topo"><div><span>ÚLTIMOS 7 DIAS</span><h3>Ritmo geral de estudo</h3></div><small>dados somados de todos os alunos</small></div>
          <div className="prof-atividade-grafico">
            {dados.atividade7Dias.map((item) => {
              const altura = Math.max(6, Math.round((item.minutos / maiorAtividade) * 100));
              return <div className="prof-atividade-coluna" key={item.data} title={`${formatarTempo(item.minutos)} · ${item.alunos} alunos`}><strong>{item.minutos ? formatarTempoCurto(item.minutos) : "0"}</strong><div className="prof-atividade-trilho"><span style={{ height: `${altura}%` }} /></div><small>{diaSemana(item.data)}</small></div>;
            })}
          </div>
        </article>
        <article className="prof-dashboard-card">
          <div className="prof-dashboard-card-topo"><div><span>MODELO DA PARCERIA</span><h3>Um curso para toda a turma</h3></div></div>
          <p className="prof-dashboard-regra-saude">Você organiza disciplinas, módulos, aulas e links uma vez. O Study Pro entrega essa estrutura para todos os alunos liberados e registra o avanço sem criar tarefas individuais para o parceiro.</p>
          <div className="prof-dashboard-intro-acoes"><Link to="/parceiro/cursos">Abrir conteúdos do curso →</Link></div>
        </article>
      </section>

      <section className="prof-dashboard-card">
        <div className="prof-dashboard-card-topo"><div><span>RESUMO POR TURMA</span><h3>Uso consolidado do curso</h3></div><small>sem acompanhamento individual</small></div>
        {dados.turmas.length === 0 ? <div className="prof-dashboard-vazio">Nenhuma turma ativa cadastrada.</div> : (
          <div className="prof-turmas-grid">{dados.turmas.map((turma) => (
            <article className="prof-turma-card" key={turma.id}>
              <div><strong>{turma.nome}</strong><span>{turma.alunosAtivos} aluno{turma.alunosAtivos === 1 ? "" : "s"}</span></div>
              <dl><div><dt>Estudo</dt><dd>{formatarTempo(turma.minutosMes)}</dd></div><div><dt>Questões</dt><dd>{formatarNumero(turma.questoesMes)}</dd></div><div><dt>Acurácia</dt><dd>{turma.acuracia.toFixed(1)}%</dd></div><div><dt>Revisões pendentes</dt><dd>{turma.revisoesAtrasadas}</dd></div><div><dt>Simulados</dt><dd>{turma.simuladosMes}</dd></div></dl>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) { return <article className="prof-kpi"><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>; }
function formatarNumero(valor: number) { return valor.toLocaleString("pt-BR"); }
function formatarTempo(minutos: number) { const horas = Math.floor(minutos / 60); const resto = Math.round(minutos % 60); if (!horas) return `${resto} min`; return resto ? `${horas}h ${resto}min` : `${horas}h`; }
function formatarTempoCurto(minutos: number) { if (minutos < 60) return `${minutos}m`; const horas = minutos / 60; return `${horas >= 10 ? Math.round(horas) : horas.toFixed(1)}h`; }
function diaSemana(data: string) { return new Date(`${data.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""); }
