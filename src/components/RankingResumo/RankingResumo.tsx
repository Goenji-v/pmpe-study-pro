import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { calcularGamificacao, type EntradaRanking } from "../../services/gamificacaoService";
import { carregarRankingMensal, publicarResumoRanking } from "../../services/rankingService";
import "./RankingResumo.css";

export default function RankingResumo() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { sessoes, questoes, revisoes, simulados, configuracoes } = useApp();
  const [ranking, setRanking] = useState<EntradaRanking[]>([]);

  const resumo = useMemo(
    () => calcularGamificacao({ sessoes, questoes, revisoes, simulados }),
    [sessoes, questoes, revisoes, simulados]
  );

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      if (!usuario) return;

      try {
        const nome = configuracoes.nomeUsuario.trim() || String(usuario.user_metadata?.nome || "Usuário");
        await publicarResumoRanking({ userId: usuario.id, nome, resumo });
        const lista = await carregarRankingMensal(resumo.mes);
        if (ativo) setRanking(lista.slice(0, 5));
      } catch {
        if (ativo) {
          setRanking([{ userId: usuario.id, nome: configuracoes.nomeUsuario || "Você", ...resumo, posicao: 1 }]);
        }
      }
    }

    void atualizar();
    return () => { ativo = false; };
  }, [usuario, configuracoes.nomeUsuario, resumo]);

  return (
    <section className="ranking-resumo-dashboard">
      <div className="ranking-resumo-topo">
        <div>
          <h2>🏆 Ranking mensal</h2>
          <p>XP calculado por estudo, questões, revisões e simulados.</p>
        </div>
        <button type="button" onClick={() => navigate("/ranking")}>Ver ranking completo</button>
      </div>

      <div className="ranking-resumo-lista">
        {ranking.map((item) => (
          <article key={item.userId} className={item.userId === usuario?.id ? "ranking-resumo-eu" : ""}>
            <strong>{item.posicao}º</strong>
            <span>{item.nome}</span>
            <b>{item.xp} XP</b>
            <small>{item.horas}h · {item.questoes} questões</small>
          </article>
        ))}
      </div>
    </section>
  );
}
