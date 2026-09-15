import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import {
  carregarDashboardProfessor,
  type DashboardProfessor,
} from "../../services/professorDashboardService";
import { obterPermissoesParceiro } from "../../utils/permissoesParceiro";
import "./ParceiroRelatorios.css";

type NivelSinal = "critico" | "atencao" | "info" | "ok";

type SinalAutomatico = {
  nivel: NivelSinal;
  titulo: string;
  descricao: string;
};

export default function ParceiroRelatorios() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const permissoes = obterPermissoesParceiro(contexto?.papel);
  const [dados, setDados] = useState<DashboardProfessor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [geradoEm, setGeradoEm] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    if (!permissoes.podeAcessarArea) {
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro("");
      const novo = await carregarDashboardProfessor();
      setDados(novo);
      setGeradoEm(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o relatório da mentoria.");
    } finally {
      setCarregando(false);
    }
  }, [permissoes.podeAcessarArea]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const sinais = useMemo(() => (dados ? gerarSinais(dados) : []), [dados]);
  const alunosPrioritarios = useMemo(
    () => [...(dados?.alunosAtencao ?? [])].sort((a, b) => {
      if (a.saude !== b.saude) return a.saude === "risco" ? -1 : 1;
      if (a.diasSemEstudar !== b.diasSemEstudar) return b.diasSemEstudar - a.diasSemEstudar;
      return b.revisoesAtrasadas - a.revisoesAtrasadas;
    }),
    [dados],
  );

  if (verificando) {
    return <div className="prel-estado">Verificando acesso aos relatórios...</div>;
  }

  if (!permissoes.podeAcessarArea) return <Navigate to="/" replace />;

  if (carregando) {
    return <div className="prel-estado">Gerando relatório da mentoria...</div>;
  }

  if (erro || !dados) {
    return (
      <section className="parceiro-relatorios">
        <div className="prel-erro" role="alert">
          <strong>Não foi possível abrir Relatórios e Alertas.</strong>
          <span>{erro || "Os dados da mentoria não estão disponíveis."}</span>
          <button type="button" onClick={() => void carregar()}>Tentar novamente</button>
        </div>
      </section>
    );
  }

  const i = dados.indicadores;
  const totalPrioridade = dados.saude.atencao + dados.saude.risco;

  return (
    <section className="parceiro-relatorios">
      <header className="prel-cabecalho">
        <div>
          <span>MENTORIA · GESTÃO</span>
          <h1>Relatórios e Alertas</h1>
          <p>
            Visão consolidada de desempenho, risco e atividade dos alunos da sua parceria, usando os dados reais do Study Pro.
          </p>
          <small>
            Competência: {mesAtual()} · Atualizado {geradoEm ? formatarDataHora(geradoEm) : "agora"}
          </small>
        </div>
        <div className="prel-acoes nao-imprimir">
          <Link to="/parceiro">← Painel do parceiro</Link>
          <button type="button" onClick={() => exportarCsv(dados)}>Exportar CSV</button>
          <button type="button" className="secundario" onClick={() => window.print()}>Imprimir relatório</button>
        </div>
      </header>

      <section className="prel-kpis" aria-label="Resumo gerencial">
        <Kpi titulo="Alunos ativos" valor={String(i.alunosAtivos)} detalhe={`${i.alunosAtivosHoje} estudaram hoje`} />
        <Kpi titulo="Atenção + risco" valor={String(totalPrioridade)} detalhe={`${dados.saude.risco} em risco`} destaque={dados.saude.risco > 0} />
        <Kpi titulo="Estudo no mês" valor={formatarTempo(i.minutosMes)} detalhe={`${i.diasEstudoMes} dias somados`} />
        <Kpi titulo="Acurácia" valor={`${i.acuraciaMes.toFixed(1)}%`} detalhe={`${formatarNumero(i.questoesMes)} questões`} destaque={i.questoesMes >= 20 && i.acuraciaMes < 70} />
        <Kpi titulo="Revisões atrasadas" valor={formatarNumero(i.revisoesAtrasadas)} detalhe={`${i.revisoesConcluidasMes} concluídas no mês`} destaque={i.revisoesAtrasadas > 0} />
        <Kpi titulo="Simulados" valor={formatarNumero(i.simuladosMes)} detalhe={i.simuladosMes ? `média ${i.mediaSimulados.toFixed(1)}%` : "nenhum no mês"} />
      </section>

      <section className="prel-bloco">
        <div className="prel-bloco-topo">
          <div>
            <span>SINAIS AUTOMÁTICOS</span>
            <h2>O que merece sua atenção agora</h2>
          </div>
          <small>Indicadores de apoio, não substituem a análise do professor.</small>
        </div>
        <div className="prel-sinais">
          {sinais.map((sinal) => (
            <article className={`prel-sinal ${sinal.nivel}`} key={`${sinal.nivel}-${sinal.titulo}`}>
              <span>{rotuloNivel(sinal.nivel)}</span>
              <div>
                <strong>{sinal.titulo}</strong>
                <p>{sinal.descricao}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="prel-bloco">
        <div className="prel-bloco-topo">
          <div>
            <span>ALERTAS POR ALUNO</span>
            <h2>Fila de intervenção do professor</h2>
          </div>
          <small>{alunosPrioritarios.length} aluno{alunosPrioritarios.length === 1 ? "" : "s"} em prioridade</small>
        </div>

        {alunosPrioritarios.length === 0 ? (
          <div className="prel-vazio">Nenhum aluno está classificado em atenção ou risco neste momento.</div>
        ) : (
          <div className="prel-alertas-lista">
            {alunosPrioritarios.map((aluno) => (
              <article className="prel-alerta-aluno" key={aluno.userId}>
                <span className={`prel-status ${aluno.saude}`}>{aluno.saude === "risco" ? "Risco" : "Atenção"}</span>
                <div className="prel-alerta-identidade">
                  <strong>{aluno.nome}</strong>
                  <small>{aluno.turma} · {aluno.email || "sem e-mail"}</small>
                  <p>{aluno.motivo || "Os indicadores atuais sugerem acompanhamento mais próximo."}</p>
                </div>
                <dl>
                  <div><dt>Sem estudar</dt><dd>{aluno.diasSemEstudar}d</dd></div>
                  <div><dt>Revisões atrasadas</dt><dd>{aluno.revisoesAtrasadas}</dd></div>
                  <div><dt>Questões</dt><dd>{aluno.questoesMes}</dd></div>
                  <div><dt>Acurácia</dt><dd>{aluno.acuraciaMes.toFixed(1)}%</dd></div>
                  <div><dt>Sequência</dt><dd>{aluno.sequencia}d</dd></div>
                </dl>
                <Link className="nao-imprimir" to={`/parceiro/mentoria/aluno/${aluno.userId}`}>Abrir acompanhamento →</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="prel-bloco">
        <div className="prel-bloco-topo">
          <div>
            <span>RELATÓRIO POR TURMA</span>
            <h2>Comparativo das turmas ativas</h2>
          </div>
          <small>{dados.turmas.length} turma{dados.turmas.length === 1 ? "" : "s"}</small>
        </div>

        {dados.turmas.length === 0 ? (
          <div className="prel-vazio">Nenhuma turma ativa cadastrada.</div>
        ) : (
          <div className="prel-tabela-wrap">
            <div className="prel-tabela cabecalho">
              <span>Turma</span><span>Alunos</span><span>Estudo</span><span>Questões</span><span>Acurácia</span><span>Rev. atrasadas</span><span>Simulados</span>
            </div>
            {dados.turmas.map((turma) => (
              <div className="prel-tabela" key={turma.id}>
                <strong>{turma.nome}</strong>
                <span>{turma.alunosAtivos}</span>
                <span>{formatarTempo(turma.minutosMes)}</span>
                <span>{formatarNumero(turma.questoesMes)}</span>
                <span className={turma.questoesMes >= 20 && turma.acuracia < 70 ? "valor-atencao" : ""}>{turma.acuracia.toFixed(1)}%</span>
                <span className={turma.revisoesAtrasadas > 0 ? "valor-atencao" : ""}>{turma.revisoesAtrasadas}</span>
                <span>{turma.simuladosMes}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="prel-duas-colunas">
        <article className="prel-bloco">
          <div className="prel-bloco-topo">
            <div><span>RANKING DO MÊS</span><h2>Destaques da mentoria</h2></div>
          </div>
          {dados.ranking.length === 0 ? (
            <div className="prel-vazio">O ranking aparecerá quando os alunos começarem a pontuar.</div>
          ) : (
            <div className="prel-ranking">
              {dados.ranking.map((aluno) => (
                <Link to={`/parceiro/mentoria/aluno/${aluno.userId}`} key={aluno.userId}>
                  <b>{aluno.posicao}º</b>
                  <div><strong>{aluno.nome}</strong><small>Nível {aluno.nivel} · {formatarTempo(aluno.minutos)} · {aluno.questoes} questões</small></div>
                  <span>{formatarNumero(aluno.xp)} XP</span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="prel-bloco">
          <div className="prel-bloco-topo">
            <div><span>ÚLTIMOS 7 DIAS</span><h2>Atividade registrada</h2></div>
          </div>
          <div className="prel-atividade">
            {dados.atividade7Dias.map((dia) => (
              <div key={dia.data}>
                <span>{formatarDia(dia.data)}</span>
                <strong>{formatarTempo(dia.minutos)}</strong>
                <small>{dia.alunos} aluno{dia.alunos === 1 ? "" : "s"}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}

function gerarSinais(dados: DashboardProfessor): SinalAutomatico[] {
  const sinais: SinalAutomatico[] = [];
  const i = dados.indicadores;

  if (dados.saude.risco > 0) {
    sinais.push({
      nivel: "critico",
      titulo: `${dados.saude.risco} aluno${dados.saude.risco === 1 ? "" : "s"} em risco`,
      descricao: "Priorize os alunos com maior tempo sem estudar, revisões atrasadas ou queda consistente de desempenho.",
    });
  }

  if (dados.saude.atencao > 0) {
    sinais.push({
      nivel: "atencao",
      titulo: `${dados.saude.atencao} aluno${dados.saude.atencao === 1 ? "" : "s"} em atenção`,
      descricao: "Há alunos com sinais que justificam acompanhamento antes de evoluírem para uma situação de risco.",
    });
  }

  if (i.revisoesAtrasadas > 0) {
    sinais.push({
      nivel: "atencao",
      titulo: `${i.revisoesAtrasadas} revisão${i.revisoesAtrasadas === 1 ? "" : "ões"} atrasada${i.revisoesAtrasadas === 1 ? "" : "s"}`,
      descricao: "Vale reforçar a regularização das revisões para evitar acúmulo no ciclo de estudos.",
    });
  }

  if (i.questoesMes >= 20 && i.acuraciaMes < 70) {
    sinais.push({
      nivel: "atencao",
      titulo: `Acurácia geral em ${i.acuraciaMes.toFixed(1)}%`,
      descricao: "Com volume relevante de questões no mês, a taxa de acertos está abaixo de 70% e merece revisão de conteúdo.",
    });
  }

  if (i.alunosAtivos > 0 && i.alunosAtivosHoje === 0) {
    sinais.push({
      nivel: "info",
      titulo: "Nenhum aluno estudou hoje ainda",
      descricao: "O indicador é informativo e pode mudar ao longo do dia. Use-o para acompanhar o ritmo da turma.",
    });
  }

  if (i.alunosAtivos > 0 && i.simuladosMes === 0) {
    sinais.push({
      nivel: "info",
      titulo: "Nenhum simulado registrado neste mês",
      descricao: "Considere programar um simulado para medir retenção, ritmo de prova e evolução da turma.",
    });
  }

  if (sinais.length === 0) {
    sinais.push({
      nivel: "ok",
      titulo: "Nenhum alerta prioritário detectado",
      descricao: "Os principais indicadores da mentoria estão dentro dos critérios automáticos de acompanhamento no momento.",
    });
  }

  return sinais;
}

function exportarCsv(dados: DashboardProfessor) {
  const linhas: (string | number)[][] = [["tipo", "nome", "turma", "status", "metrica_1", "metrica_2", "observacao"]];
  const i = dados.indicadores;

  linhas.push(["resumo", "Alunos ativos", "", "", i.alunosAtivos, `${i.alunosAtivosHoje} hoje`, ""]);
  linhas.push(["resumo", "Horas estudadas", "", "", (i.minutosMes / 60).toFixed(2), "horas", ""]);
  linhas.push(["resumo", "Questões no mês", "", "", i.questoesMes, `${i.acuraciaMes.toFixed(1)}% acertos`, ""]);
  linhas.push(["resumo", "Revisões atrasadas", "", "", i.revisoesAtrasadas, i.revisoesConcluidasMes, "concluídas no mês"]);
  linhas.push(["resumo", "Simulados", "", "", i.simuladosMes, `${i.mediaSimulados.toFixed(1)}%`, "média"]);

  dados.alunosAtencao.forEach((aluno) => linhas.push([
    "alerta_aluno",
    aluno.nome,
    aluno.turma,
    aluno.saude,
    `${aluno.diasSemEstudar} dias sem estudar`,
    `${aluno.revisoesAtrasadas} revisões atrasadas`,
    aluno.motivo || `${aluno.acuraciaMes.toFixed(1)}% de acurácia`,
  ]));

  dados.turmas.forEach((turma) => linhas.push([
    "turma",
    turma.nome,
    turma.nome,
    "ativa",
    `${turma.alunosAtivos} alunos`,
    `${turma.acuracia.toFixed(1)}% acurácia`,
    `${turma.questoesMes} questões; ${turma.revisoesAtrasadas} revisões atrasadas; ${turma.simuladosMes} simulados`,
  ]));

  dados.ranking.forEach((aluno) => linhas.push([
    "ranking",
    aluno.nome,
    "",
    `${aluno.posicao}º`,
    `${aluno.xp} XP`,
    `${aluno.questoes} questões`,
    `${aluno.minutos} minutos estudados`,
  ]));

  const csv = `\uFEFF${linhas.map((linha) => linha.map(celulaCsv).join(";")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-mentoria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function celulaCsv(valor: string | number) {
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function Kpi({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return <article className={`prel-kpi ${destaque ? "destaque" : ""}`}><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}

function rotuloNivel(nivel: NivelSinal) {
  if (nivel === "critico") return "Prioridade";
  if (nivel === "atencao") return "Atenção";
  if (nivel === "ok") return "Em dia";
  return "Informativo";
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

function mesAtual() {
  const texto = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarDataHora(data: Date) {
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarDia(data: string) {
  return new Date(`${data.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", "");
}
