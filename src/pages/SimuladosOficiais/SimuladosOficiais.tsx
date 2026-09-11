import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { listarSimuladosOficiais, type SimuladoOficial } from "../../services/simuladosOficiaisService";
import "./SimuladosOficiais.css";

export default function SimuladosOficiais() {
  const navigate = useNavigate();
  const { configuracoes } = useApp();
  const [simulados, setSimulados] = useState<SimuladoOficial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const lista = await listarSimuladosOficiais(configuracoes.concurso);
        if (ativo) setSimulados(lista);
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível carregar os simulados oficiais.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [configuracoes.concurso]);

  return (
    <section className="simulados-oficiais-lista">
      <header>
        <div>
          <span>PROVAS OFICIAIS</span>
          <h1>Simulados oficiais</h1>
          <p>Provas publicadas para {configuracoes.concurso || "seu concurso"}, com cronômetro, eliminação de alternativas e correção dentro do Study Pro.</p>
        </div>
        <button type="button" onClick={() => navigate("/simulados")}>Voltar</button>
      </header>

      {carregando ? (
        <div className="estado-oficial">Carregando provas...</div>
      ) : erro ? (
        <div className="estado-oficial">{erro}</div>
      ) : simulados.length === 0 ? (
        <div className="estado-oficial">Nenhum simulado oficial publicado para este concurso.</div>
      ) : (
        <div className="cards-oficiais">
          {simulados.map((simulado) => (
            <article key={simulado.id}>
              <div>
                <span>{simulado.concurso_alvo} · {simulado.banca}</span>
                <h2>{simulado.nome}</h2>
                <p>{simulado.total_questoes} questões · {simulado.duracao_minutos} min{simulado.data_prova ? ` · ${formatarData(simulado.data_prova)}` : ""}</p>
              </div>
              <button type="button" onClick={() => navigate(`/simulado-oficial/${simulado.id}`)}>Iniciar prova</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatarData(valor: string) {
  const data = new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}
