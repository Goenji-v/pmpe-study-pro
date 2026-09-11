import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  carregarDashboardProfessor,
  type DashboardProfessor,
} from "../../services/professorDashboardService";
import "./ProfessorDashboard.css";

export default function ProfessorDashboard() {
  const [dados, setDados] = useState<DashboardProfessor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      setDados(await carregarDashboardProfessor());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a visão geral.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const maiorAtividade = useMemo(
    () => Math.max(1, ...(dados?.atividade7Dias.map((item) => item.minutos) ?? [1])),
    [dados]
  );

  if (carregando) {
    return <div className="prof-dashboard-estado">Carregando visão geral da turma...</div>;
  }

  if (erro) {
    return (
      <div className="prof-dashboard-erro" role="alert">
        <strong>Não foi possível carregar o dashboard.</strong>
        <span>{erro}</span>
        <button type="button" onClick={() => void carregar()}>Tentar novamente</button>
      </div>
    );
  }

  if (!dados) return null;
  const i = dados.indicadores;
  const totalSaude = dados.saude.emDia + dados.saude.atencao + dados.saude.risco;

  return (
    <div className="prof-dashboard">
      <section className="prof-dashboard-intro">
        <div>
          <span>VISÃO GERAL DA MENTORIA</span>
          <h2>Como sua turma está evoluindo</h2>
          <p>
            Os indicadores abaixo usam atividade real registrada pelos alunos no Study Pro durante o mês atual.
          </p>
        </div>
        <Link to="/parceiro/mentoria">Gerenciar trilhas →</Link>
      </section>

      <section className="prof-dashboard-kpis" aria-label="Indicadores principais">
        <Kpi titulo="Alunos ativos" valor={String(i.alunosAtivos)} detalhe={`${i.alunosAtivosHoje} estudaram hoje`} />
        <Kpi titulo="Horas estudadas" valor={formatarTempo(i.minutosMes)} detalhe={`${i.diasEstudoMes} dias de estudo somados`} />
        <Kpi titulo="Questões no mês" valor={formatarNumero(i.questoesMes)} detalhe={`${i.acuraciaMes.toFixed(1)}% de acertos`} />
        <Kpi titulo="Revisões atrasadas" valor={formatarNumero(i.revisoesAtrasadas)} detalhe={`${i.revisoesConcluidasMes} concluídas no mês`} destaque={i.revisoesAtrasadas > 0} />
        <Kpi titulo="Simulados" valor={formatarNumero(i.simuladosMes)} detalhe={i.simuladosMes ? `média ${i.mediaSimulados.toFixed(1)}%` : "nenhum neste mês"} />
        <Kpi titulo="Sequência média" valor={`${i.sequenciaMedia.toFixed(1)} dias`} detalhe={`${i.turmasAtivas} turma${i.turmasAtivas === 1 ? "" : "s"} ativa${i.turmasAtivas === 1 ? "" : "s"}`} />
      </section>

      <section className="prof-dashboard-duas-colunas">
        <article className="prof-dashboard-card prof-dashboard-saude">
          <div className="prof-dashboard-card-topo">
            <div>
              <span>SAÚDE DOS ALUNOS</span>
              <h3>Quem precisa de atenção</h3>
            </div>
            <small>{totalSaude} alunos avaliados</small>
          </div>

          <div className="prof-saude-grid">
            <Saude numero={dados.saude.emDia} titulo="Em dia" classe="em-dia" />
            <Saude numero={dados.saude.atencao} titulo="Atenção" classe="atencao" />
            <Saude numero={dados.saude.risco} titulo="Risco" classe="risco" />
          </div>

          <p className="prof-dashboard-regra-saude">
            A classificação considera dias sem estudar, revisões atrasadas e queda de acurácia com volume mínimo de questões.
          </p>
        </article>

        <article className="prof-dashboard-card">
          <div className="prof-dashboard-card-topo">
            <div>
              <span>ÚLTIMOS 7 DIAS</span>
              <h3>Ritmo de estudo</h3>
            </div>
            <small>minutos estudados</small>
          </div>

          <div className="prof-atividade-grafico">
            {dados.atividade7Dias.map((item) => {
              const altura = Math.max(6, Math.round((item.minutos / maiorAtividade) * 100));
              return (
                <div className="prof-atividade-coluna" key={item.data} title={`${formatarTempo(item.minutos)} · ${item.alunos} alunos`}>
                  <strong>{item.minutos ? formatarTempoCurto(item.minutos) : "0"}</strong>
                  <div className="prof-atividade-trilho">
                    <span style={{ height: `${altura}%` }} />
                  </div>
                  <small>{diaSemana(item.data)}</small>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="prof-dashboard-duas-colunas prof-dashboard-meio">
        <article className="prof-dashboard-card">
          <div className="prof-dashboard-card-topo">
            <div>
              <span>INTERVENÇÃO DO MENTOR</span>
              <h3>Alunos que precisam de atenção</h3>
            </div>
            <small>{dados.alunosAtencao.length} prioridade{dados.alunosAtencao.length === 1 ? "" : "s"}</small>
          </div>

          {dados.alunosAtencao.length === 0 ? (
            <div className="prof-dashboard-vazio">Nenhum aluno em atenção ou risco no momento.</div>
          ) : (
            <div className="prof-atencao-lista">
              {dados.alunosAtencao.map((aluno) => (
                <Link to={`/parceiro/mentoria/aluno/${aluno.userId}`} className="prof-atencao-item" key={aluno.userId}>
                  <span className={`prof-atencao-status ${aluno.saude}`}>{aluno.saude === "risco" ? "Risco" : "Atenção"}</span>
                  <div>
                    <strong>{aluno.nome}</strong>
                    <small>{aluno.turma}</small>
                    <p>{aluno.motivo || "Desempenho abaixo do padrão esperado."}</p>
                  </div>
                  <div className="prof-atencao-metricas">
                    <span>{aluno.questoesMes} questões</span>
                    <span>{aluno.acuraciaMes.toFixed(0)}% acertos</span>
                    <span>{aluno.sequencia}d sequência</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="prof-dashboard-card">
          <div className="prof-dashboard-card-topo">
            <div>
              <span>RANKING DO MÊS</span>
              <h3>Top 5 da mentoria</h3>
            </div>
            <Link to="/ranking">Ver ranking →</Link>
          </div>

          {dados.ranking.length === 0 ? (
            <div className="prof-dashboard-vazio">O ranking será exibido quando os alunos começarem a pontuar.</div>
          ) : (
            <div className="prof-ranking-lista">
              {dados.ranking.map((aluno) => (
                <div className="prof-ranking-item" key={aluno.userId}>
                  <b className={`prof-ranking-posicao p${aluno.posicao}`}>{aluno.posicao}</b>
                  <div>
                    <strong>{aluno.nome}</strong>
                    <small>Nível {aluno.nivel} · {formatarTempo(aluno.minutos)} · {aluno.questoes} questões</small>
                  </div>
                  <span>{formatarNumero(aluno.xp)} XP</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="prof-dashboard-card">
        <div className="prof-dashboard-card-topo">
          <div>
            <span>DESEMPENHO POR TURMA</span>
            <h3>Resumo das turmas ativas</h3>
          </div>
          <Link to="/parceiro/mentoria">Abrir mentoria →</Link>
        </div>

        {dados.turmas.length === 0 ? (
          <div className="prof-dashboard-vazio">Nenhuma turma ativa cadastrada.</div>
        ) : (
          <div className="prof-turmas-grid">
            {dados.turmas.map((turma) => (
              <article className="prof-turma-card" key={turma.id}>
                <div>
                  <strong>{turma.nome}</strong>
                  <span>{turma.alunosAtivos} aluno{turma.alunosAtivos === 1 ? "" : "s"}</span>
                </div>
                <dl>
                  <div><dt>Estudo</dt><dd>{formatarTempo(turma.minutosMes)}</dd></div>
                  <div><dt>Questões</dt><dd>{formatarNumero(turma.questoesMes)}</dd></div>
                  <div><dt>Acurácia</dt><dd>{turma.acuracia.toFixed(1)}%</dd></div>
                  <div><dt>Revisões atrasadas</dt><dd>{turma.revisoesAtrasadas}</dd></div>
                  <div><dt>Simulados</dt><dd>{turma.simuladosMes}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return (
    <article className={`prof-kpi ${destaque ? "destaque" : ""}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function Saude({ numero, titulo, classe }: { numero: number; titulo: string; classe: string }) {
  return (
    <div className={`prof-saude-item ${classe}`}>
      <strong>{numero}</strong>
      <span>{titulo}</span>
    </div>
  );
}

function formatarNumero(valor: number) {
  return valor.toLocaleString("pt-BR");
}

function formatarTempo(minutos: number) {
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  if (!horas) return `${resto} min`;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

function formatarTempoCurto(minutos: number) {
  if (minutos < 60) return `${minutos}m`;
  const horas = minutos / 60;
  return `${horas >= 10 ? Math.round(horas) : horas.toFixed(1)}h`;
}

function diaSemana(data: string) {
  const valor = new Date(`${data.slice(0, 10)}T12:00:00`);
  return valor.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}
