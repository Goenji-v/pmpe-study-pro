import { useMemo } from "react";
import { useApp } from "../../context/AppContext";
import "./Conquistas.css";

type Conquista = { icone:string; titulo:string; descricao:string; desbloqueada:boolean; progresso:number; atual:string };

export default function Conquistas() {
  const { questoes, sessoes, revisoes, simulados, materias } = useApp();

  const dados = useMemo(() => {
    const totalQuestoes = questoes.reduce((t, q) => t + q.certas + q.erradas, 0);
    const totalCertas = questoes.reduce((t, q) => t + q.certas, 0);
    const minutos = sessoes.reduce((t, s) => t + s.minutos, 0);
    const revisoesConcluidas = revisoes.filter((r) => r.concluida).length;
    const assuntos = materias.flatMap((m) => m.modulos?.length ? m.modulos.flatMap((mod) => mod.assuntos) : m.assuntos);
    const assuntosConcluidos = assuntos.filter((a) => a.concluido).length;
    const aproveitamento = totalQuestoes ? Math.round(totalCertas / totalQuestoes * 100) : 0;
    return { totalQuestoes, minutos, revisoesConcluidas, assuntosConcluidos, simulados: simulados.length, aproveitamento };
  }, [questoes, sessoes, revisoes, simulados, materias]);

  const conquistas: Conquista[] = [
    criar("🎯", "Primeiros passos", "Resolva 100 questões", dados.totalQuestoes, 100, `${dados.totalQuestoes}/100`),
    criar("⚡", "Ritmo forte", "Resolva 500 questões", dados.totalQuestoes, 500, `${dados.totalQuestoes}/500`),
    criar("🏹", "Mil questões", "Alcance 1.000 questões resolvidas", dados.totalQuestoes, 1000, `${dados.totalQuestoes}/1000`),
    criar("⏱️", "10 horas de foco", "Acumule 10 horas de estudo", dados.minutos, 600, `${Math.floor(dados.minutos/60)}h/10h`),
    criar("🔥", "50 horas de foco", "Acumule 50 horas de estudo", dados.minutos, 3000, `${Math.floor(dados.minutos/60)}h/50h`),
    criar("🔁", "Revisor", "Conclua 30 revisões", dados.revisoesConcluidas, 30, `${dados.revisoesConcluidas}/30`),
    criar("📚", "Avanço no edital", "Conclua 25 assuntos", dados.assuntosConcluidos, 25, `${dados.assuntosConcluidos}/25`),
    criar("🧪", "Simulador", "Finalize 10 simulados", dados.simulados, 10, `${dados.simulados}/10`),
    criar("🏆", "Alta precisão", "Alcance 80% de aproveitamento geral", dados.aproveitamento, 80, `${dados.aproveitamento}%/80%`),
  ];
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;

  return <section className="conquistas-page">
    <header className="conquistas-hero">
      <div><span>PROGRESSO</span><h1>Conquistas</h1><p>Marcos desbloqueados pelo seu desempenho real no Study Pro.</p></div>
      <div className="conquistas-contador"><strong>{desbloqueadas}</strong><span>de {conquistas.length}</span></div>
    </header>
    <div className="conquistas-grid">
      {conquistas.map((c) => <article key={c.titulo} className={`conquista-card ${c.desbloqueada ? "ativa" : "bloqueada"}`}>
        <div className="conquista-icone">{c.icone}</div>
        <div className="conquista-info"><span>{c.desbloqueada ? "DESBLOQUEADA" : "EM PROGRESSO"}</span><h2>{c.titulo}</h2><p>{c.descricao}</p>
          <div className="conquista-barra"><div style={{width:`${c.progresso}%`}} /></div><small>{c.atual}</small>
        </div>
      </article>)}
    </div>
  </section>;
}

function criar(icone:string,titulo:string,descricao:string,valor:number,meta:number,atual:string): Conquista {
  return { icone,titulo,descricao,desbloqueada:valor>=meta,progresso:Math.min(100,Math.round(valor/meta*100)),atual };
}
