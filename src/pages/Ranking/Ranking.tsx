import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { calcularGamificacao, type EntradaRanking } from "../../services/gamificacaoService";
import { carregarRankingMensal, publicarResumoRanking } from "../../services/rankingService";
import "./Ranking.css";

export default function Ranking() {
  const { usuario } = useAuth();
  const { sessoes, questoes, revisoes, simulados, configuracoes } = useApp();
  const [ranking, setRanking] = useState<EntradaRanking[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");

  const resumo = useMemo(
    () => calcularGamificacao({ sessoes, questoes, revisoes, simulados }),
    [sessoes, questoes, revisoes, simulados]
  );

  useEffect(() => {
    let ativo = true;

    async function sincronizar() {
      if (!usuario) return;
      try {
        setCarregando(true);
        setAviso("");
        const nome = configuracoes.nomeUsuario.trim() || String(usuario.user_metadata?.nome || "Usuário");
        await publicarResumoRanking({ userId: usuario.id, nome, resumo });
        const lista = await carregarRankingMensal(resumo.mes);
        if (ativo) setRanking(lista);
      } catch (erro) {
        console.error("Ranking indisponível:", erro);
        if (ativo) {
          setAviso("Execute o arquivo SQL da gamificação no Supabase para ativar o ranking entre usuários.");
          setRanking([
            {
              userId: usuario.id,
              nome: configuracoes.nomeUsuario || "Você",
              ...resumo,
              posicao: 1,
            },
          ]);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void sincronizar();
    return () => {
      ativo = false;
    };
  }, [usuario, configuracoes.nomeUsuario, resumo]);

  const minhaPosicao = ranking.find((item) => item.userId === usuario?.id)?.posicao;

  return (
    <section className="ranking-container">
      <header className="ranking-cabecalho">
        <div>
          <span className="ranking-etiqueta">COMPETIÇÃO MENSAL</span>
          <h1>🏆 Ranking</h1>
          <p>Classificação por XP, com desempate por tempo estudado e questões certas.</p>
        </div>
        <div className="ranking-minha-posicao">
          <span>Sua posição</span>
          <strong>{minhaPosicao ? `${minhaPosicao}º` : "—"}</strong>
          <small>{resumo.xp} XP neste mês</small>
        </div>
      </header>

      {aviso && <div className="ranking-aviso">{aviso}</div>}

      <div className="ranking-resumo-grid">
        <Resumo titulo="Nível" valor={`${resumo.nivel}`} detalhe={`${resumo.tituloNivel} · ${resumo.xpTotal} XP acumulados`} />
        <Resumo titulo="Horas" valor={`${resumo.horas}h`} detalhe="No mês atual" />
        <Resumo titulo="Questões" valor={`${resumo.questoes}`} detalhe={`${resumo.acertos} certas`} />
        <Resumo titulo="XP" valor={`${resumo.xp}`} detalhe="Pontuação mensal" />
      </div>

      <div className="ranking-tabela">
        <div className="ranking-linha ranking-titulo">
          <span>Posição</span><span>Usuário</span><span>XP</span><span>Horas</span><span>Questões</span><span>Acertos</span>
        </div>
        {carregando ? (
          <div className="ranking-vazio">Carregando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="ranking-vazio">Nenhum participante neste mês.</div>
        ) : (
          ranking.map((item) => (
            <div className={`ranking-linha ${item.userId === usuario?.id ? "ranking-eu" : ""}`} key={item.userId}>
              <strong>{item.posicao}º</strong>
              <span>{item.nome}{item.userId === usuario?.id ? " (você)" : ""}</span>
              <b>{item.xp}</b>
              <span>{item.horas}h</span>
              <span>{item.questoes}</span>
              <span>{item.acertos}</span>
            </div>
          ))
        )}
      </div>

      <section className="ranking-regras">
        <h2>Como o XP é calculado</h2>
        <p>10 min de estudo = 1 XP · 10 questões = 2 XP · 10 acertos = 2 XP · revisão = 5 XP · simulado = 10 XP, com bônus por desempenho.</p>
        <p>Seu nível considera o XP de todo o histórico e continua na virada do mês. A classificação do ranking usa apenas o XP do mês atual.</p>
      </section>
    </section>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return <article className="ranking-resumo-card"><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}
