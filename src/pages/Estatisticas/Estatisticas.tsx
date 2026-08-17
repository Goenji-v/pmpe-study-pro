import "./Estatisticas.css";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../../context/AppContext";
import { consolidarEvolucaoMensal, consolidarPorAssunto, consolidarPorMateria, type LinhaDesempenho } from "../../utils/estatisticasConsolidadas";

export default function Estatisticas() {
  const { materias, questoes, sessoes, revisoes, simulados } = useApp();
  const porMateria = consolidarPorMateria({ materias, questoes, sessoes, revisoes });
  const porAssunto = consolidarPorAssunto({ questoes, sessoes, revisoes });
  const evolucao = consolidarEvolucaoMensal({ questoes, sessoes, revisoes, simulados });
  const minutos = sessoes.reduce((total, item) => total + (Number(item.minutos) || 0), 0);
  const certas = questoes.reduce((total, item) => total + (Number(item.certas) || 0), 0);
  const erradas = questoes.reduce((total, item) => total + (Number(item.erradas) || 0), 0);
  const totalQuestoes = certas + erradas;
  const aproveitamento = totalQuestoes ? Math.round(certas / totalQuestoes * 100) : 0;
  const aulas = porMateria.reduce((total, item) => total + item.aulas, 0);
  const revisoesFeitas = revisoes.filter((item) => item.concluida).length;
  const redacoes = sessoes.filter((item) => item.tipo === "redacao");
  const notas = redacoes.filter((item) => typeof item.notaRedacao === "number").map((item) => item.notaRedacao!);
  const mediaRedacao = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : "—";
  const possuiDados = minutos + totalQuestoes + revisoesFeitas + simulados.length + aulas > 0;

  return <section className="estatisticas-container">
    <h1 className="estatisticas-title">📊 Estatísticas confiáveis</h1>
    <p className="estatisticas-subtitle">Tempo calculado pelas sessões e desempenho calculado pelos registros de questões, sem contar o mesmo bloco duas vezes.</p>
    <div className="estatisticas-cards estatisticas-cards-ampliados">
      <Card titulo="Horas estudadas" valor={`${(minutos / 60).toFixed(1)}h`} />
      <Card titulo="Aulas concluídas" valor={String(aulas)} />
      <Card titulo="Questões" valor={String(totalQuestoes)} detalhe={`${certas} certas · ${erradas} erradas`} />
      <Card titulo="Aproveitamento" valor={`${aproveitamento}%`} classe={cor(aproveitamento)} />
      <Card titulo="Revisões realizadas" valor={String(revisoesFeitas)} />
      <Card titulo="Simulados" valor={String(simulados.length)} />
      <Card titulo="Redações" valor={String(redacoes.length)} />
      <Card titulo="Média de redação" valor={mediaRedacao} />
    </div>
    {!possuiDados ? <div className="estatisticas-vazio"><h2>Nenhum dado disponível</h2><p>Conclua uma aula, sessão, revisão, simulado ou bloco de questões.</p></div> : <>
      <div className="graficos-grid">
        <Grafico titulo="Volume mensal" descricao="Horas estudadas e questões registradas por mês."><BarChart data={evolucao}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="mes" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="horas" name="Horas" fill="#3b82f6" radius={[6, 6, 0, 0]} /><Bar dataKey="questoes" name="Questões" fill="#8b5cf6" radius={[6, 6, 0, 0]} /></BarChart></Grafico>
        <Grafico titulo="Evolução do aproveitamento" descricao="Percentual mensal de acertos nos blocos de questões."><LineChart data={evolucao}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="mes" stroke="#94a3b8" /><YAxis domain={[0, 100]} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Aproveitamento"]} /><Line type="monotone" dataKey="aproveitamento" stroke="#22c55e" strokeWidth={3} dot={{ fill: "#22c55e" }} /></LineChart></Grafico>
      </div>
      <div className="estatisticas-tabelas"><Painel titulo="Desempenho por matéria" linhas={porMateria.slice(0, 12)} /><Painel titulo="Desempenho por assunto" linhas={porAssunto.slice(0, 15)} assunto /></div>
    </>}
  </section>;
}

const tooltipStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: 10 };
function cor(valor: number) { return valor >= 80 ? "texto-verde" : valor >= 60 ? "texto-amarelo" : "texto-vermelho"; }
function Card({ titulo, valor, detalhe, classe = "" }: { titulo: string; valor: string; detalhe?: string; classe?: string }) { return <div className="estatistica-card"><span>{titulo}</span><strong className={classe}>{valor}</strong>{detalhe && <small>{detalhe}</small>}</div>; }
function Grafico({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactElement }) { return <div className="grafico-card"><h2>{titulo}</h2><p className="grafico-descricao">{descricao}</p><div className="grafico-area"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>; }
function Painel({ titulo, linhas, assunto = false }: { titulo: string; linhas: LinhaDesempenho[]; assunto?: boolean }) { return <div className="estatisticas-painel"><h2>{titulo}</h2><div className="ranking-estatisticas">{linhas.length === 0 ? <p className="estatisticas-sem-linhas">Ainda sem registros.</p> : linhas.map((linha) => <div className="ranking-estatistica-item" key={linha.chave}><div><strong>{assunto ? linha.assunto : linha.materia}</strong><p>{assunto && `${linha.materia} · ${linha.modulo} · `}{(linha.minutos / 60).toFixed(1)}h · {linha.questoes} questões · {linha.revisoes} revisões</p></div><span className={cor(linha.aproveitamento)}>{linha.questoes ? `${linha.aproveitamento}%` : "—"}</span></div>)}</div></div>; }
