import { useMemo } from "react";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import {
  obterEstadoEconomia,
  type ConfiguracoesComEconomia,
} from "../../services/economiaGamificacao";
import {
  calcularTitulosConquista,
  type RaridadeConquista,
} from "../../services/conquistasTitulos";
import "./Conquistas.css";

type Conquista = {
  icone: string;
  titulo: string;
  descricao: string;
  desbloqueada: boolean;
  progresso: number;
  atual: string;
};

export default function Conquistas() {
  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    materias,
    missoesConcluidas,
    configuracoes,
    setConfiguracoes,
  } = useApp();
  const { showToast } = useToast();

  const economia = useMemo(
    () => obterEstadoEconomia(configuracoes),
    [configuracoes]
  );

  const titulos = useMemo(
    () =>
      calcularTitulosConquista({
        questoes,
        sessoes,
        revisoes,
        simulados,
        missoesConcluidas,
        configuracoes,
        economia,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      missoesConcluidas,
      configuracoes,
      economia,
    ]
  );

  const dados = useMemo(() => {
    const totalQuestoes = questoes.reduce((t, q) => t + q.certas + q.erradas, 0);
    const totalCertas = questoes.reduce((t, q) => t + q.certas, 0);
    const minutos = sessoes.reduce((t, s) => t + s.minutos, 0);
    const revisoesConcluidas = revisoes.filter((r) => r.concluida).length;
    const assuntos = materias.flatMap((m) =>
      m.modulos?.length ? m.modulos.flatMap((mod) => mod.assuntos) : m.assuntos
    );
    const assuntosConcluidos = assuntos.filter((a) => a.concluido).length;
    const aproveitamento = totalQuestoes
      ? Math.round((totalCertas / totalQuestoes) * 100)
      : 0;

    return {
      totalQuestoes,
      minutos,
      revisoesConcluidas,
      assuntosConcluidos,
      simulados: simulados.length,
      aproveitamento,
    };
  }, [questoes, sessoes, revisoes, simulados, materias]);

  const conquistas: Conquista[] = [
    criar("🎯", "Primeiros passos", "Resolva 100 questões", dados.totalQuestoes, 100, `${dados.totalQuestoes}/100`),
    criar("⚡", "Ritmo forte", "Resolva 500 questões", dados.totalQuestoes, 500, `${dados.totalQuestoes}/500`),
    criar("🏹", "Mil questões", "Alcance 1.000 questões resolvidas", dados.totalQuestoes, 1000, `${dados.totalQuestoes}/1000`),
    criar("⏱️", "10 horas de foco", "Acumule 10 horas de estudo", dados.minutos, 600, `${Math.floor(dados.minutos / 60)}h/10h`),
    criar("🔥", "50 horas de foco", "Acumule 50 horas de estudo", dados.minutos, 3000, `${Math.floor(dados.minutos / 60)}h/50h`),
    criar("🔁", "Revisor", "Conclua 30 revisões", dados.revisoesConcluidas, 30, `${dados.revisoesConcluidas}/30`),
    criar("📚", "Avanço no edital", "Conclua 25 assuntos", dados.assuntosConcluidos, 25, `${dados.assuntosConcluidos}/25`),
    criar("🧪", "Simulador", "Finalize 10 simulados", dados.simulados, 10, `${dados.simulados}/10`),
    criar("🏆", "Alta precisão", "Alcance 80% de aproveitamento geral", dados.aproveitamento, 80, `${dados.aproveitamento}%/80%`),
  ];

  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;
  const titulosDesbloqueados = titulos.filter((titulo) => titulo.desbloqueada).length;

  function equiparTitulo(id: string, nome: string) {
    const titulo = titulos.find((item) => item.id === id);
    if (!titulo?.desbloqueada) {
      showToast("Esse título ainda não foi conquistado.", "warning");
      return;
    }

    setConfiguracoes((atuais) => {
      const atual = obterEstadoEconomia(atuais);
      const proximo = { ...atual, tituloEquipado: id, atualizadoEm: new Date().toISOString() };
      return { ...atuais, economia: proximo } as ConfiguracoesComEconomia;
    });
    showToast(`${nome} agora é o seu título ativo.`);
  }

  function usarTituloPadrao() {
    setConfiguracoes((atuais) => {
      const atual = obterEstadoEconomia(atuais);
      const proximo = { ...atual, atualizadoEm: new Date().toISOString() };
      delete proximo.tituloEquipado;
      return { ...atuais, economia: proximo } as ConfiguracoesComEconomia;
    });
    showToast("Título padrão do nível restaurado.", "info");
  }

  return (
    <section className="conquistas-page">
      <header className="conquistas-hero">
        <div>
          <span>PROGRESSO</span>
          <h1>Conquistas</h1>
          <p>Marcos e títulos desbloqueados pelo desempenho real no Study Pro.</p>
        </div>
        <div className="conquistas-contador">
          <strong>{desbloqueadas + titulosDesbloqueados}</strong>
          <span>desbloqueadas</span>
        </div>
      </header>

      <section className="conquistas-titulos-cabecalho">
        <div>
          <span>TÍTULOS DE MÉRITO</span>
          <h2>Não se compram. Se conquistam.</h2>
          <p>
            Os títulos substituem o nome padrão do nível no Dashboard enquanto seus requisitos estiverem válidos.
          </p>
        </div>
        {economia.tituloEquipado && (
          <button type="button" onClick={usarTituloPadrao}>Usar título padrão</button>
        )}
      </section>

      <div className="conquistas-grid conquistas-grid-titulos">
        {titulos.map((titulo) => {
          const equipado = economia.tituloEquipado === titulo.id && titulo.desbloqueada;
          return (
            <article
              key={titulo.id}
              className={`conquista-card conquista-titulo raridade-${titulo.raridade} ${titulo.desbloqueada ? "ativa" : "bloqueada"} ${equipado ? "equipada" : ""}`}
            >
              <div className="conquista-icone">{titulo.icone}</div>
              <div className="conquista-info">
                <div className="conquista-titulo-topo">
                  <span>{titulo.desbloqueada ? "TÍTULO DESBLOQUEADO" : "EM PROGRESSO"}</span>
                  <em className={`conquista-raridade raridade-${titulo.raridade}`}>
                    {nomeRaridade(titulo.raridade)}
                  </em>
                </div>
                <h2>{titulo.nome}</h2>
                <p>{titulo.descricao}</p>
                <div className="conquista-barra"><div style={{ width: `${titulo.progresso}%` }} /></div>
                <small>{titulo.atual}</small>
                {titulo.detalheValidade && (
                  <small className="conquista-validade">{titulo.detalheValidade}</small>
                )}
                {titulo.desbloqueada && (
                  <button
                    type="button"
                    className="conquista-equipar"
                    disabled={equipado}
                    onClick={() => equiparTitulo(titulo.id, titulo.nome)}
                  >
                    {equipado ? "✓ Título em uso" : "Usar este título"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="conquistas-titulos-cabecalho conquistas-marcos-cabecalho">
        <div>
          <span>MARCOS PERMANENTES</span>
          <h2>Seu histórico de progresso</h2>
        </div>
      </section>

      <div className="conquistas-grid">
        {conquistas.map((c) => (
          <article key={c.titulo} className={`conquista-card ${c.desbloqueada ? "ativa" : "bloqueada"}`}>
            <div className="conquista-icone">{c.icone}</div>
            <div className="conquista-info">
              <span>{c.desbloqueada ? "DESBLOQUEADA" : "EM PROGRESSO"}</span>
              <h2>{c.titulo}</h2>
              <p>{c.descricao}</p>
              <div className="conquista-barra"><div style={{ width: `${c.progresso}%` }} /></div>
              <small>{c.atual}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function criar(
  icone: string,
  titulo: string,
  descricao: string,
  valor: number,
  meta: number,
  atual: string
): Conquista {
  return {
    icone,
    titulo,
    descricao,
    desbloqueada: valor >= meta,
    progresso: Math.min(100, Math.round((valor / meta) * 100)),
    atual,
  };
}

function nomeRaridade(raridade: RaridadeConquista) {
  if (raridade === "lendario") return "Lendária";
  if (raridade === "epico") return "Épica";
  if (raridade === "raro") return "Rara";
  return "Comum";
}
