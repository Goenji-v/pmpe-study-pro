import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { calcularGamificacao } from "../../services/gamificacaoService";
import {
  carregarHistoricoMeuRanking,
  carregarRankingEstudo,
  carregarRankingSimulado,
  publicarResumoRanking,
  type EscopoRanking,
  type HistoricoRanking,
  type PainelRankingEstudo,
  type PainelRankingSimulado,
  type PeriodoRanking,
} from "../../services/rankingService";
import "./Ranking.css";

export default function Ranking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { usuario } = useAuth();
  const { sessoes, questoes, revisoes, simulados, configuracoes } = useApp();
  const [periodo, setPeriodo] = useState<PeriodoRanking>("mes");
  const [escopo, setEscopo] = useState<EscopoRanking>("geral");
  const [painel, setPainel] = useState<PainelRankingEstudo | null>(null);
  const [painelSimulado, setPainelSimulado] = useState<PainelRankingSimulado | null>(null);
  const [historico, setHistorico] = useState<HistoricoRanking[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const simuladoId = searchParams.get("simulado")?.trim() || "";
  const resumo = useMemo(
    () => calcularGamificacao({ sessoes, questoes, revisoes, simulados }),
    [sessoes, questoes, revisoes, simulados]
  );

  useEffect(() => {
    let ativo = true;

    async function sincronizarHistorico() {
      if (!usuario) return;
      try {
        const nome = configuracoes.nomeUsuario.trim() || String(usuario.user_metadata?.nome || "Usuário");
        await publicarResumoRanking({ userId: usuario.id, nome, resumo });
        const lista = await carregarHistoricoMeuRanking(6);
        if (ativo) setHistorico(lista);
      } catch (error) {
        console.error("Não foi possível atualizar o histórico do ranking:", error);
        if (ativo) setAviso("O ranking atual continua disponível, mas o histórico pode levar um pouco mais para atualizar.");
      }
    }

    void sincronizarHistorico();
    return () => { ativo = false; };
  }, [usuario, configuracoes.nomeUsuario, resumo]);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      if (!usuario) return;
      setCarregando(true);
      setErro("");
      try {
        if (simuladoId) {
          const dados = await carregarRankingSimulado(simuladoId);
          if (ativo) {
            setPainelSimulado(dados);
            setPainel(null);
          }
        } else {
          const dados = await carregarRankingEstudo(periodo, escopo);
          if (ativo) {
            setPainel(dados);
            setPainelSimulado(null);
          }
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar o ranking.");
          setPainel(null);
          setPainelSimulado(null);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => { ativo = false; };
  }, [escopo, periodo, simuladoId, usuario]);

  const minhaLinha = painel?.ranking.find((item) => item.userId === usuario?.id);
  const minhaLinhaSimulado = painelSimulado?.ranking.find((item) => item.userId === usuario?.id);
  const minhaPosicao = simuladoId ? painelSimulado?.minhaPosicao : painel?.minhaPosicao;

  return (
    <section className="ranking-container">
      <header className="ranking-cabecalho">
        <div>
          <span className="ranking-etiqueta">{simuladoId ? "RANKING DO SIMULADO" : "COMPETIÇÃO STUDY PRO"}</span>
          <h1>🏆 {painelSimulado?.simulado || "Ranking"}</h1>
          <p>
            {simuladoId
              ? "A primeira tentativa oficial define a classificação. Refazer a prova conta somente como treinamento."
              : "Compare sua evolução na turma ou no ranking geral, por semana ou por mês."}
          </p>
        </div>
        <div className="ranking-minha-posicao">
          <span>Sua posição</span>
          <strong>{minhaPosicao ? `${minhaPosicao}º` : "—"}</strong>
          <small>
            {simuladoId
              ? painelSimulado?.meuPremio || `${painelSimulado?.participantes || 0} participante(s)`
              : `${minhaLinha?.xp ?? 0} XP · ${painel?.participantes || 0} participante(s)`}
          </small>
        </div>
      </header>

      {!simuladoId && (
        <div className="ranking-filtros" aria-label="Filtros do ranking">
          <div>
            <span>Período</span>
            <button type="button" className={periodo === "semana" ? "ativo" : ""} onClick={() => setPeriodo("semana")}>Esta semana</button>
            <button type="button" className={periodo === "mes" ? "ativo" : ""} onClick={() => setPeriodo("mes")}>Este mês</button>
          </div>
          <div>
            <span>Comparar com</span>
            <button type="button" className={escopo === "turma" ? "ativo" : ""} onClick={() => setEscopo("turma")}>Minha turma</button>
            <button type="button" className={escopo === "geral" ? "ativo" : ""} onClick={() => setEscopo("geral")}>Geral</button>
          </div>
          {painel?.turma && escopo === "turma" && <small>{painel.parceiro} · {painel.turma}</small>}
        </div>
      )}

      {aviso && <div className="ranking-aviso">{aviso}</div>}
      {erro && <div className="ranking-aviso ranking-erro">{erro}</div>}

      {simuladoId ? (
        <div className="ranking-resumo-grid">
          <Resumo titulo="Participantes" valor={`${painelSimulado?.participantes || 0}`} detalhe="Primeiras tentativas concluídas" />
          <Resumo titulo="Acertos" valor={`${minhaLinhaSimulado?.certas ?? 0}`} detalhe={`${minhaLinhaSimulado?.erradas ?? 0} erros`} />
          <Resumo titulo="Em branco" valor={`${minhaLinhaSimulado?.emBranco ?? 0}`} detalhe="Na sua tentativa oficial" />
          <Resumo titulo="Tempo" valor={`${minhaLinhaSimulado?.minutos ?? 0} min`} detalhe={painelSimulado?.meuPremio ? `Prêmio: ${painelSimulado.meuPremio}` : "Tempo da prova"} />
        </div>
      ) : (
        <div className="ranking-resumo-grid">
          <Resumo titulo="Horas ativas" valor={`${minhaLinha?.horas ?? 0}h`} detalhe={periodo === "semana" ? "Nesta semana" : "Neste mês"} />
          <Resumo titulo="Questões" valor={`${minhaLinha?.questoes ?? 0}`} detalhe={`${minhaLinha?.acertos ?? 0} acertos · ${minhaLinha?.erradas ?? 0} erros`} />
          <Resumo titulo="Revisões" valor={`${minhaLinha?.revisoes ?? 0}`} detalhe={`${minhaLinha?.simulados ?? 0} simulado(s)`} />
          <Resumo titulo="XP" valor={`${minhaLinha?.xp ?? 0}`} detalhe={`Nível ${resumo.nivel} · ${resumo.xpTotal} XP acumulados`} />
        </div>
      )}

      {simuladoId ? (
        <div className="ranking-tabela ranking-tabela-simulado">
          <div className="ranking-linha ranking-linha-simulado ranking-titulo">
            <span>#</span><span>Aluno</span><span>Acertos</span><span>Erros</span><span>Branco</span><span>Tempo</span><span>Bonificação</span>
          </div>
          {carregando ? (
            <div className="ranking-vazio">Carregando ranking da prova...</div>
          ) : !painelSimulado?.ranking.length ? (
            <div className="ranking-vazio">Ainda não há tentativas oficiais classificadas.</div>
          ) : painelSimulado.ranking.map((item) => (
            <div className={`ranking-linha ranking-linha-simulado ${item.userId === usuario?.id ? "ranking-eu" : ""} ${item.top5 ? "ranking-top5" : ""}`} key={item.userId}>
              <strong>{medalha(item.posicao)}</strong>
              <span className="ranking-usuario"><b>{item.nome}{item.userId === usuario?.id ? " (você)" : ""}</b><small>{item.parceiro} · {item.turma}</small></span>
              <b>{item.certas}</b>
              <span>{item.erradas}</span>
              <span>{item.emBranco}</span>
              <span>{item.minutos} min</span>
              <span>{item.premio || (item.top5 ? "Top 5" : "—")}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ranking-tabela">
          <div className="ranking-linha ranking-titulo">
            <span>#</span><span>Usuário</span><span>XP</span><span>Horas</span><span>Questões</span><span>Acertos</span><span>Erros</span><span>Branco</span><span>Revisões</span>
          </div>
          {carregando ? (
            <div className="ranking-vazio">Carregando ranking...</div>
          ) : !painel?.ranking.length ? (
            <div className="ranking-vazio">Ainda não há atividade registrada neste período.</div>
          ) : painel.ranking.map((item) => (
            <div className={`ranking-linha ${item.userId === usuario?.id ? "ranking-eu" : ""} ${item.top5 ? "ranking-top5" : ""}`} key={item.userId}>
              <strong>{medalha(item.posicao)}</strong>
              <span className="ranking-usuario"><b>{item.nome}{item.userId === usuario?.id ? " (você)" : ""}</b><small>{item.parceiro} · {item.turma}</small></span>
              <b>{item.xp}</b>
              <span>{item.horas}h</span>
              <span>{item.questoes}</span>
              <span>{item.acertos}</span>
              <span>{item.erradas}</span>
              <span>{item.emBranco}</span>
              <span>{item.revisoes}</span>
            </div>
          ))}
        </div>
      )}

      <section className="ranking-revisao">
        <div>
          <span>SEU BLOCO DE REVISÃO</span>
          <h2>{simuladoId ? `${minhaLinhaSimulado?.erradas ?? 0} erro(s) na tentativa oficial` : `${minhaLinha?.erradas ?? 0} questão(ões) errada(s) no período`}</h2>
          <p>
            {simuladoId
              ? "O resultado da prova mantém as questões erradas e o gabarito para você revisar sem alterar a classificação."
              : `Você concluiu ${minhaLinha?.revisoes ?? 0} revisão(ões) neste período. Use a Central de Revisões para atacar os pontos fracos.`}
          </p>
        </div>
        <button type="button" onClick={() => navigate(simuladoId ? "/simulados" : "/revisoes")}>{simuladoId ? "Voltar aos simulados" : "Abrir revisões"}</button>
      </section>

      {!simuladoId && (
        <section className="ranking-historico">
          <header><div><span>HISTÓRICO</span><h2>Suas últimas posições mensais</h2></div></header>
          {historico.length === 0 ? <p className="ranking-vazio">O histórico aparecerá conforme você participar dos rankings mensais.</p> : (
            <div className="ranking-historico-grid">
              {historico.map((item) => (
                <article key={item.mes}>
                  <span>{formatarMes(item.mes)}</span>
                  <strong>{item.posicao}º</strong>
                  <small>{item.xp} XP · {item.participantes} participante(s)</small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="ranking-regras">
        <h2>Como funciona</h2>
        {simuladoId ? (
          <p>Apenas a primeira tentativa concluída entra no ranking. O desempate considera mais acertos e, depois, menor tempo. Refazer o simulado é treino. Quando o professor cadastrar bonificações, elas aparecem para as posições correspondentes do Top 5.</p>
        ) : (
          <>
            <p>10 min de estudo = 1 XP · 10 questões = 2 XP · 10 acertos = 2 XP · revisão = 5 XP · simulado = 10 XP, com bônus por desempenho.</p>
            <p>O Top 5 recebe destaque. O filtro “Minha turma” compara apenas alunos com acesso ativo à sua turma; “Geral” compara participantes do Study Pro entre turmas e cursos.</p>
          </>
        )}
      </section>
    </section>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return <article className="ranking-resumo-card"><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}

function medalha(posicao: number) {
  if (posicao === 1) return "🥇 1º";
  if (posicao === 2) return "🥈 2º";
  if (posicao === 3) return "🥉 3º";
  return `${posicao}º`;
}

function formatarMes(valor: string) {
  const [ano, mes] = valor.split("-").map(Number);
  if (!ano || !mes) return valor;
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}
