import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarSimuladosOficiais, type SimuladoOficial } from "../../services/simuladosOficiaisService";
import "./SimuladosOficiais.css";

export default function SimuladosOficiais() {
  const navigate = useNavigate();
  const [simulados, setSimulados] = useState<SimuladoOficial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    listarSimuladosOficiais("publicado").then(setSimulados).catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar os simulados.")).finally(() => setCarregando(false));
  }, []);

  return <section className="simulados-oficiais-lista"><header><div><span>PROVAS OFICIAIS</span><h1>Simulados oficiais</h1><p>Provas publicadas para o seu concurso, com tempo e correção dentro do Study Pro.</p></div><button onClick={() => navigate("/simulados")}>Voltar</button></header>{carregando ? <div className="estado-oficial">Carregando...</div> : erro ? <div className="estado-oficial">{erro}</div> : simulados.length === 0 ? <div className="estado-oficial">Nenhum simulado oficial publicado para você ainda.</div> : <div className="cards-oficiais">{simulados.map((s) => <article key={s.id}><div><span>{s.concurso_alvo} • {s.banca}</span><h2>{s.nome}</h2><p>{s.total_questoes} questões • {s.duracao_minutos} min{s.data_prova ? ` • ${formatarData(s.data_prova)}` : ""}</p></div><button onClick={() => navigate(`/simulado-oficial/${s.id}`)}>Iniciar prova</button></article>)}</div>}</section>;
}
function formatarData(v:string){const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString("pt-BR");}
