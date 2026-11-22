import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import type { Revisao, SessaoEstudo } from "../../types";
import { calcularDiasDiferenca, formatarDataRevisao } from "../../utils/revisoes";
import { planejarRevisaoPendente } from "../../utils/revisaoAdaptativa";
import "./RevisoesVitrineV2.css";

type Aba = "revisoes" | "catalogo" | "historico";
type Filtro = "todas" | "hoje" | "amanha" | "proximas";

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function codigoLegado(revisao: Revisao) {
  const match = revisao.assuntoId?.match(/aula-(\d+)(?:$|[^\d])/);
  return match ? `AULA ${match[1]}` : "ID legado";
}
function rotuloPrazo(dias: number) {
  if (dias < 0) return `Atrasada ${Math.abs(dias)}d`;
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}
function corPorPrazo(dias: number) {
  return dias <= 0 ? "urgente" : dias === 1 ? "amanha" : "futura";
}
function nomeDisciplina(nome: string) {
  const n = normalizar(nome);
  if (n === "portugues" || n === "lingua portuguesa") return "Língua Portuguesa";
  if (n === "rlm" || n.includes("raciocinio logico")) return "Raciocínio Lógico e Matemática";
  return nome;
}
function aliasesSeguros(revisao: Revisao) {
  const nome = normalizar(revisao.assunto);
  if (nome === "crase" || nome.includes("sinal grave indicativo de crase")) return ["Crase", "Emprego da crase"];
  if (nome === "logica argumentativa") return ["Lógica argumentativa"];
  if (nome === "exercicios - logica argumentativa") return ["Exercícios - Lógica argumentativa"];
  if (nome === "verbos" || nome === "verbo") return ["Verbo", "Verbos"];
  return [revisao.assunto];
}

export default function RevisoesVitrineV2(props: {
  pendentes: Revisao[];
  concluidas: Revisao[];
  sessoes: SessaoEstudo[];
  abrirRevisao: (revisao: Revisao) => void;
  abrirQuestoesIA: (revisao: Revisao) => void;
}) {
  const { pendentes, concluidas, sessoes, abrirRevisao, abrirQuestoesIA } = props;
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("revisoes");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"data"|"materia">("data");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [verAntigos, setVerAntigos] = useState(false);

  const listaBase = aba === "historico" ? concluidas : pendentes;
  const lista = useMemo(() => listaBase
    .filter((r) => {
      const q = normalizar(busca);
      if (q && !normalizar(`${r.materia} ${r.modulo || ""} ${r.assunto}`).includes(q)) return false;
      if (aba !== "revisoes" || filtro === "todas") return true;
      const dias = calcularDiasDiferenca(r.dataPrevista);
      return filtro === "hoje" ? dias <= 0 : filtro === "amanha" ? dias === 1 : dias > 1;
    })
    .sort((a,b) => ordem === "materia"
      ? a.materia.localeCompare(b.materia) || a.assunto.localeCompare(b.assunto)
      : new Date(a.dataPrevista).getTime() - new Date(b.dataPrevista).getTime()),
    [listaBase, aba, filtro, busca, ordem]);

  const selecionada = lista.find((r) => r.id === selecionadaId) ?? lista[0] ?? null;
  const registros = selecionada
    ? [...pendentes, ...concluidas].filter((r) => r.assuntoId === selecionada.assuntoId && r.materiaId === selecionada.materiaId)
    : [];
  const sessoesDoAssunto = selecionada ? sessoes.filter((s) =>
    (s.assuntoId && s.assuntoId === selecionada.assuntoId && s.materiaId === selecionada.materiaId) ||
    (normalizar(s.assunto) === normalizar(selecionada.assunto) && normalizar(s.materia) === normalizar(selecionada.materia))
  ) : [];
  const totalHoje = pendentes.filter((r) => calcularDiasDiferenca(r.dataPrevista) <= 0).length;
  const totalAmanha = pendentes.filter((r) => calcularDiasDiferenca(r.dataPrevista) === 1).length;
  const totalProximas = pendentes.filter((r) => calcularDiasDiferenca(r.dataPrevista) > 1).length;
  const acertos = selecionada?.certas;
  const erros = selecionada?.erradas;
  const percentual = typeof acertos === "number" && typeof erros === "number" && acertos+erros > 0
    ? Math.round(acertos * 100/(acertos+erros)) : null;

  function abrirComplementar() {
    if (!selecionada) return;
    sessionStorage.setItem("pmpe:central-estudos:prefill", JSON.stringify({
      materia: selecionada.materia,
      materiaId: selecionada.materiaId,
      modulo: selecionada.modulo,
      moduloId: selecionada.moduloId,
      assunto: selecionada.assunto,
      assuntoId: selecionada.assuntoId,
      tipo: "questoes",
      objetivo: `Treino complementar de ${selecionada.assunto}`,
      observacao: "Atividade avulsa. Não concluir revisão programada.",
    }));
    navigate("/central-estudos");
  }

  return (
    <section className="rv2-root" aria-label="Prévia do novo painel de revisões">
      <header className="rv2-topbar">
        <div>
          <span className="rv2-eyebrow">STUDY PRO · PRÉVIA DO LAYOUT</span>
          <h1>Revisões</h1>
          <p>Suas revisões reais, organizadas por aula. O novo ciclo V2 ainda não está ativo.</p>
        </div>
        <span className="rv2-protected">Histórico preservado</span>
      </header>

      <div className="rv2-tabs" role="tablist" aria-label="Áreas das revisões">
        <button type="button" role="tab" aria-selected={aba==="revisoes"} className={aba==="revisoes"?"active":""} onClick={()=>setAba("revisoes")}>▤ Minhas Revisões</button>
        <button type="button" role="tab" aria-selected={aba==="catalogo"} className={aba==="catalogo"?"active":""} onClick={()=>setAba("catalogo")}>▱ Catálogo de Assuntos</button>
        <button type="button" role="tab" aria-selected={aba==="historico"} className={aba==="historico"?"active":""} onClick={()=>setAba("historico")}>◷ Histórico</button>
      </div>

      <div className="rv2-layout">
        <div className="rv2-list-panel">
          <div className="rv2-filters">
            {aba === "revisoes" ? (
              <>
                {([["todas",`Todas (${pendentes.length})`],["hoje",`Hoje/atrasadas (${totalHoje})`],["amanha",`Amanhã (${totalAmanha})`],["proximas",`Próximas (${totalProximas})`]] as const).map(([key,label])=>(
                  <button key={key} type="button" className={filtro===key?"active":""} onClick={()=>setFiltro(key)}>{label}</button>
                ))}
              </>
            ) : <span className="rv2-list-heading">{aba==="catalogo"?"Assuntos encontrados nas suas revisões":"Revisões já concluídas"}</span>}
          </div>
          <div className="rv2-search-row">
            <label className="rv2-search">
              <span aria-hidden="true">⌕</span>
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar matéria, assunto ou aula…" aria-label="Buscar revisões" />
            </label>
            <select value={ordem} onChange={e=>setOrdem(e.target.value as "data"|"materia")} aria-label="Ordenar revisões">
              <option value="data">Ordenar: Data</option>
              <option value="materia">Ordenar: Matéria</option>
            </select>
          </div>
          {aba==="catalogo" && <div className="rv2-catalog-explainer">Nomes e códigos de aula são apresentados para conferência. O catálogo definitivo de aliases será validado antes da migração.</div>}
          <div className="rv2-list" role="list">
            {lista.length===0 && <p className="rv2-empty">Nenhum registro encontrado neste filtro.</p>}
            {lista.slice(0,verAntigos?300:60).map(r=>{
              const dias=calcularDiasDiferenca(r.dataPrevista);
              return (
                <button key={r.id} type="button" role="listitem" className={`rv2-entry ${r.id===selecionada?.id?"selected":""}`} onClick={()=>setSelecionadaId(r.id)}>
                  <span className="rv2-entry-code">{codigoLegado(r)}</span>
                  <span className="rv2-entry-main">
                    <strong>{r.assunto}</strong>
                    <small>{nomeDisciplina(r.materia)} · {r.modulo && r.modulo!=="Geral"?r.modulo:"Assunto do curso"}</small>
                    <small className="rv2-entry-stage">{r.concluida?"Concluída":"Etapa legada "+r.etapa} · {formatarDataRevisao(r.concluida?r.dataConclusao||r.dataPrevista:r.dataPrevista)}</small>
                  </span>
                  <span className={`rv2-entry-date ${corPorPrazo(dias)}`}>{r.concluida?"Feita":rotuloPrazo(dias)}</span>
                  <span className="rv2-chevron" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
          {lista.length>60 && <button type="button" className="rv2-showmore" onClick={()=>setVerAntigos(v=>!v)}>{verAntigos?"Mostrar menos":`Ver todos os ${lista.length} registros`}</button>}
        </div>

        <aside className="rv2-details" aria-label="Detalhes da revisão selecionada">
          {selecionada ? (
            <>
              <div className="rv2-details-title">
                <div className="rv2-details-code">{codigoLegado(selecionada)}</div>
                <div><h2>{selecionada.assunto}</h2><p>{nomeDisciplina(selecionada.materia)} › {selecionada.modulo||"Geral"}</p></div>
              </div>
              <div className="rv2-aliases"><strong>Nomes reconhecidos</strong><div>{aliasesSeguros(selecionada).map(a=><span key={a}>{a}</span>)}</div><small>Outros sinônimos só serão aplicados após validação do catálogo.</small></div>
              <section className="rv2-cycle">
                <h3>▣ Ciclo de revisão</h3>
                <p className="rv2-muted">Modelo previsto: D+1 → D+7 → D+14. Seu histórico atual continua no sistema legado.</p>
                <div className="rv2-timeline">
                  {(["Aula","D+1","D+7","D+14"] as const).map((step,i)=>(
                    <div key={step} className={i===Math.min(selecionada.etapa,3)?"is-current":""}>
                      <span className="rv2-dot">{i===0?"✓":i}</span>
                      <strong>{step}</strong>
                      <small>{i===0?"Estudo":i===1?"Teoria":"Questões"}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rv2-result">
                <h3>▥ Resultado registrado</h3>
                <strong>{percentual===null?"Sem resultado numérico":`${acertos} de ${(acertos||0)+(erros||0)} acertos (${percentual}%)`}</strong>
                <small>{registros.filter(r=>r.concluida).length} revisões concluídas nessa aula · {sessoesDoAssunto.length} atividades vinculadas</small>
              </section>
              <section className="rv2-next">
                <h3>◎ Próxima ação</h3>
                <strong>{selecionada.concluida?"Revisão já concluída":rotuloPrazo(calcularDiasDiferenca(selecionada.dataPrevista))}</strong>
                <p>{selecionada.concluida?"Consulte o histórico desta aula.":planejarRevisaoPendente(selecionada).titulo}</p>
                <small>Data no sistema atual: {formatarDataRevisao(selecionada.dataPrevista)}</small>
              </section>
              {!selecionada.concluida && <button className="rv2-primary" type="button" onClick={()=>abrirRevisao(selecionada)}>▷ Executar revisão</button>}
              <div className="rv2-secondary-actions">
                <button type="button" onClick={abrirComplementar}>▤ Estudo complementar</button>
                <button type="button" onClick={()=>{setAba("historico");setBusca(selecionada.assunto);setSelecionadaId(null)}}>◷ Ver histórico</button>
              </div>
              {!selecionada.concluida && <button type="button" className="rv2-questions" onClick={()=>abrirQuestoesIA(selecionada)}>✦ Questões IA desta aula</button>}
            </>
          ) : <p className="rv2-empty">Selecione uma revisão para ver os detalhes.</p>}
        </aside>
      </div>
    </section>
  );
}
