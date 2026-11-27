import { useEffect, useMemo, useState } from "react";
import { diaEstudo, somarDia, type Agendamento, type Limites } from "../../services/inteligenciaRevisao/agenda";
import { planejarRevisoes, type EntradaPlano, type PlanoAdaptativo } from "../../services/inteligenciaRevisao/plano";
import type { EscopoFsrs } from "../../services/inteligenciaRevisao/checkpoint";
import CheckpointAdaptativo from "./CheckpointAdaptativo";
import CheckpointCompartilhado from "./CheckpointCompartilhado";
import "./PlanejamentoAdaptativo.css";

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const nomeDia = (dia: string) => dia.split("-").reverse().slice(0, 2).join("/");
type Opcoes = Limites & { retencao: number };
export type PreferenciasAdaptativas = { opcoes?: Opcoes; datas?: Record<string, string> };
type Props = EntradaPlano & {
  modo: "revisoes" | "calendario" | "desempenho";
  estudar?: (item: Agendamento, plano: PlanoAdaptativo) => void;
  demonstracao?: boolean;
  preferencias?: PreferenciasAdaptativas;
  checkpoint?: EscopoFsrs;
  compartilhar?: boolean;
  salvarPreferencias?: (preferencias: PreferenciasAdaptativas) => void;
};

export default function PlanejamentoAdaptativo(props: Props) {
  const [opcoesLocais, setOpcoes] = useState<Opcoes>();
  const [ajustesLocais, setAjustes] = useState<Record<string, string>>({});
  const limitesIniciais = useMemo(() => ({ ...props.limites, retencao: props.diario.retencao }),
    [props.limites, props.diario.retencao]);
  const opcoes = opcoesLocais ?? props.preferencias?.opcoes ?? limitesIniciais;
  const ajustes = props.preferencias?.datas ?? ajustesLocais;
  const [resultado, setResultado] = useState<{ plano?: PlanoAdaptativo; entrada?: EntradaPlano; erro?: boolean }>({});
  const [filtro, setFiltro] = useState("hoje");
  const [periodo, setPeriodo] = useState(7);
  const hoje = diaEstudo(props.agora);
  const [diaSelecionado, setDia] = useState(hoje);
  const dia = diaSelecionado < hoje ? hoje : diaSelecionado;
  const { materias, revisoes, diario, compromissos, agora, prova, edital } = props;

  const entrada = useMemo(() => ({ materias, revisoes, diario: { ...diario, retencao: opcoes.retencao },
    compromissos, agora, prova, edital, limites: opcoes, preferenciaDatas: ajustes }),
  [materias, revisoes, diario, compromissos, agora, prova, edital, opcoes, ajustes]);
  useEffect(() => {
    let ativo = true;
    planejarRevisoes(entrada)
      .then(plano => { if (ativo) setResultado({ plano, entrada }); }, () => { if (ativo) setResultado({ erro: true }); });
    return () => { ativo = false; };
  }, [entrada]);

  const plano = resultado.plano;
  const filtrar = (r: Agendamento, filtro: string) => filtro === "hoje" ? r.agendada === hoje :
    filtro === "atrasadas" ? (r.dueAt ? Date.parse(r.dueAt) < +agora : r.ideal < hoje) :
    filtro === "sem-vaga" ? !r.agendada && r.ideal <= somarDia(hoje, 29) :
    filtro === "criticas" ? r.primeira || r.recorrente || (r.retencao ?? 1) < .65 :
    filtro === "proximas" ? !!r.agendada && r.agendada > hoje : true;
  const itens = plano?.agenda.filter(r => filtrar(r, filtro)) ?? [];
  const estados = plano ? [...plano.dados.values()] : [];
  const revisoesFeitas = estados.flatMap(item => item.estado.historico.filter(x => x.log).map(x => ({ ...x, ...item.candidato })))
    .sort((a, b) => Date.parse(b.ocorridoEm) - Date.parse(a.ocorridoEm));
  const diaAtivo = plano?.dias.find(d => d.dia === dia);
  const pronto = (item: Agendamento) => !!item.agendadaEm && item.agendada === hoje &&
    (!item.dueAt || Date.parse(item.dueAt) <= +agora);
  const horarioAtual = (item: Agendamento) => item.agendadaEm && Date.parse(item.agendadaEm) >= +agora
    ? item.horarioSugerido : undefined;
  const desempenho = props.modo === "desempenho";
  const indicadores = [
    ["hoje", "Hoje"], ["proximas", "Próximas"], ["atrasadas", "Atrasadas"], ["criticas", "Atenção"], ["concluidas", "Avaliações feitas"],
  ];
  const historico = <ul className="plano-lista plano-historico">{revisoesFeitas.slice(0, 30).map(h =>
    <li key={h.chave}><strong>{h.assunto}</strong>
      <p>{nomeDia(diaEstudo(new Date(h.ocorridoEm)))} · {h.materia} · {h.avaliacao.motivo}</p>
      {h.avaliacao.percentual !== undefined && <BarraIndicador valor={h.avaliacao.percentual} rotulo="Acertos medidos" />}</li>)}</ul>;

  const mapaMemoria = <section className="plano-memoria">
    <h3>Mapa da memória</h3><p>Estimativa atual por unidade de aprendizagem. Não é uma medida de acertos.</p>
    {estados.length ? <ul className="plano-lista plano-memoria-grid">{estados.map(({ candidato, estado }) =>
      <li key={estado.unidadeId}><strong>{candidato.assunto}</strong><small>{candidato.materia}</small>
        {candidato.retencao !== undefined ? <BarraIndicador valor={Math.round(candidato.retencao * 100)} rotulo="Retenção estimada" /> :
          <span className="plano-sem-medida">Sem evidência medida</span>}</li>)}</ul> : <p>Aguardando as primeiras avaliações válidas.</p>}
  </section>;

  return (
    <section className="plano-adaptativo" aria-label={desempenho ? "Desempenho nas revisões adaptativas" : "Planejamento adaptativo"}>
      <header className="plano-cabecalho">
        <div><span className="plano-eyebrow">ESTUDE PRO · PILOTO FSRS</span><h2>{desempenho ? "Desempenho nas revisões adaptativas" : props.modo === "calendario" ? "Agenda adaptativa" : "Inteligência de revisões"}</h2>
          {!desempenho && <p>{props.demonstracao ? "Demonstração local com dados sintéticos." :
            "Projeção experimental no horário de Brasília. A agenda oficial continua disponível abaixo."}</p>}</div>
        {plano && !desempenho && <span className="plano-estado">{plano.previsoes[0].estado}</span>}
      </header>
      {plano && props.modo === "revisoes" && <div className="plano-indicadores" aria-label="Resumo das revisões adaptativas">
        {indicadores.map(([chave, rotulo]) => <button key={chave} type="button" className="plano-kpi" data-tipo={chave}
          aria-pressed={filtro === chave} onClick={() => setFiltro(chave)}><span>{rotulo}</span><strong>{chave === "concluidas" ?
          revisoesFeitas.length : plano.agenda.filter(r => filtrar(r, chave)).length}</strong></button>)}
      </div>}
      {!desempenho && <details className="plano-configuracoes">
        <summary>Configurar disponibilidade e retenção</summary>
        <form className="plano-opcoes" onSubmit={e => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setResultado({});
          const atualizadas = { minutos: Number(form.get("minutos")), revisoes: Number(form.get("revisoes")),
            inicio: String(form.get("inicio") ?? ""), fim: String(form.get("fim") ?? ""),
            retencao: Number(form.get("retencao")) / 100, semana: form.getAll("dia").map(Number) };
          setOpcoes(atualizadas);
          if ((!atualizadas.inicio && !atualizadas.fim) ||
              (atualizadas.inicio && atualizadas.fim > atualizadas.inicio))
            props.salvarPreferencias?.({ opcoes: atualizadas, datas: ajustes });
        }}>
          <label>Minutos por dia <input name="minutos" type="number" min="0" max="720" required defaultValue={opcoes.minutos} /></label>
          <label>Revisões por dia <input name="revisoes" type="number" min="0" max="100" required defaultValue={opcoes.revisoes} /></label>
          <label>Retenção desejada (%) <input name="retencao" type="number" min="70" max="97" required defaultValue={Math.round(opcoes.retencao * 100)} /></label>
          <label>Início da janela <input name="inicio" type="time" defaultValue={opcoes.inicio} /></label>
          <label>Fim da janela <input name="fim" type="time" defaultValue={opcoes.fim} /></label>
          <fieldset><legend>Dias disponíveis</legend>{diasSemana.map((nome, i) => <label key={nome}>
            <input type="checkbox" name="dia" value={i} defaultChecked={opcoes.semana.includes(i)} />{nome}</label>)}</fieldset>
          <button type="submit">Recalcular agenda</button>
        </form>
      </details>}

      {resultado.erro && <p role="alert">Não foi possível calcular a agenda. Confira os dados e recalcule.</p>}
      {!plano && !resultado.erro && <p role="status">Calculando agenda…</p>}
      {!desempenho && props.checkpoint && <CheckpointAdaptativo escopo={props.checkpoint}
        entrada={resultado.entrada === entrada ? entrada : undefined} plano={plano} />}
      {!desempenho && props.compartilhar && <CheckpointCompartilhado entrada={resultado.entrada === entrada ? entrada : undefined} plano={plano} />}
      {plano && (desempenho ? <>{mapaMemoria}<h3>Histórico de avaliações</h3>{revisoesFeitas.length ? historico : <p>Sem revisões medidas.</p>}</> : <>
        <div className="plano-secao-titulo"><h3>Previsão de carga</h3><span>Meta de retenção: {Math.round(opcoes.retencao * 100)}%</span></div>
        <div className="plano-previsoes" aria-label="Previsão de carga">
          {plano.previsoes.map(p => <article key={p.horizonte}>
            <strong>{p.horizonte} dias · {p.estado}</strong>
            <div className="plano-previsao-numeros">
              <span><b>{p.confirmadas}</b>Agendadas</span><span><b>{p.estimadas}</b>Estimadas</span><span><b>{p.semVaga}</b>Sem vaga</span>
            </div>
            <small>{p.capacidade} min disponíveis · {p.excesso} dia(s) com conflito</small>
          </article>)}
        </div>
        <p className="plano-recomendacao">{plano.previsoes[0].recomendacao}</p>
        {props.modo === "calendario" ? <>
          <label>Visualização <select value={periodo} onChange={e => {
            const proximo = Number(e.target.value);
            setPeriodo(proximo);
            if (dia >= somarDia(hoje, proximo)) setDia(hoje);
          }}>
            <option value={1}>Dia</option><option value={7}>Semana</option><option value={30}>30 dias</option>
          </select></label>
          {periodo === 1 ? <label>Dia da agenda <input type="date" value={dia} min={hoje} max={somarDia(hoje, 29)}
            onChange={e => { if (e.target.value) setDia(e.target.value); }} /></label> :
            <div className="plano-dias" aria-label="Dias da agenda">
              {plano.dias.slice(0, periodo).map(d => <button key={d.dia} type="button" aria-pressed={dia === d.dia} onClick={() => setDia(d.dia)}>
                <span>{diasSemana[new Date(d.dia + "T00:00:00Z").getUTCDay()]}</span><strong>{nomeDia(d.dia)}</strong>
                <small>{d.revisoes + d.fixos.length} atividade(s)</small>{!!d.estimadas && <small>+{d.estimadas} estimada(s)</small>}
              </button>)}
            </div>}
          <h3>Atividades de {nomeDia(dia)}</h3>
          {!opcoes.semana.includes(new Date(dia + "T00:00:00Z").getUTCDay()) &&
            !diaAtivo?.fixos.some(c => c.tipo === "descanso") && <p>Dia sem disponibilidade para revisões.</p>}
          {diaAtivo?.fixos.map(c => <p key={c.id}>{c.titulo} · {c.minutos} min</p>)}
          {!!diaAtivo?.estimadas && <p>{diaAtivo.estimadas} revisões futuras estimadas</p>}
          {[...new Set(plano.agenda.filter(r => r.agendada === dia).map(r => r.materia))].map(materia =>
            <details key={materia} open><summary>{materia}</summary>
              {plano.agenda.filter(r => r.agendada === dia && r.materia === materia)
                .sort((a, b) => (a.agendadaEm ?? "").localeCompare(b.agendadaEm ?? "")).map(r => <div key={r.unidadeId}>
                  <p><strong>{r.assunto}</strong> · {horarioAtual(r) && `${horarioAtual(r)} sugerido · `}{r.motivo}</p>
                  {props.estudar && pronto(r) && <button type="button" onClick={() => props.estudar?.(r, plano)}>Revisar {r.assunto}</button>}
                </div>)}
            </details>)}

          {!diaAtivo?.fixos.length && !diaAtivo?.revisoes && !diaAtivo?.estimadas && <p>Dia sem atividades planejadas.</p>}
          {plano.previsoes[2].semVaga > 0 && <p>{plano.previsoes[2].semVaga} pendência(s) sem vaga neste período.</p>}
        </> : <>
          <div className="plano-secao-titulo"><h3>Sua fila de revisões</h3><label>Mostrar <select value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="hoje">Hoje</option><option value="proximas">Próximas</option><option value="atrasadas">Atrasadas</option>
            <option value="criticas">Críticas</option><option value="sem-vaga">Sem vaga</option>
            <option value="concluidas">Concluídas</option><option value="todas">Todas</option>
          </select></label></div>
          {filtro === "concluidas" ? (revisoesFeitas.length ? historico : <p>Sem revisões medidas.</p>) :
            itens.length ? <ul className="plano-lista plano-fila">{itens.map(r => {
              const info = plano.dados.get(r.unidadeId)!;
              return <li key={r.unidadeId} className="plano-revisao-card" data-risco={r.primeira || r.recorrente || (r.retencao ?? 1) < .65 ? "atencao" : "normal"}>
                <div className="plano-revisao-topo"><div><small>{r.materia}</small><strong>{r.assunto}</strong></div>
                  <span className="plano-tag">{info.orientacao.modo}</span></div>
                <p className="plano-meta">{r.minutos} min · {r.agendada ? nomeDia(r.agendada) : "Sem vaga"}{horarioAtual(r) && ` · ${horarioAtual(r)} sugerido`}</p>
                <p className="plano-orientacao">{r.motivo} {info.orientacao.modo}. {info.orientacao.acao}</p>
                <small>Ideal {nomeDia(r.ideal)} · prazo {nomeDia(r.limite)} · {r.retencao === undefined ? "Sem estimativa de retenção" :
                  `Retenção estimada ${Math.round(r.retencao * 100)}%`} {info.estado.cartao && `· Dificuldade ${info.estado.cartao.difficulty.toFixed(1)}`}</small>
                {r.retencao !== undefined && <BarraIndicador valor={Math.round(r.retencao * 100)} rotulo="Retenção estimada" />}
                <div className="plano-acoes">
                  {r.limite >= hoje && <label>Preferência de data para {r.assunto} <input type="date" min={r.ideal > hoje ? r.ideal : hoje} max={r.limite}
                    value={ajustes[r.unidadeId] ?? ""} onChange={e => {
                      const datas = { ...ajustes, [r.unidadeId]: e.target.value };
                      setAjustes(datas);
                      props.salvarPreferencias?.({ opcoes, datas });
                    }} /></label>}
                  {props.estudar && pronto(r) && <button type="button" onClick={() => props.estudar?.(r, plano)}>Revisar {r.assunto}</button>}
                </div>
              </li>;
            })}</ul> : <p>Nenhuma revisão neste filtro.</p>}
          {!!revisoesFeitas.length && <details className="plano-configuracoes"><summary>Desempenho por matéria e assunto</summary>
            {[...new Set(estados.map(x => x.candidato.materia))].map(materia => <section key={materia}>
              <h3>{materia}</h3><ul className="plano-lista">{estados.filter(x => x.candidato.materia === materia).map(x =>
                <li key={x.estado.unidadeId}><strong>{x.candidato.assunto}</strong>
                  <p>{x.estado.historico.flatMap(h => h.log ? `${nomeDia(diaEstudo(new Date(h.ocorridoEm)))}: ${Math.round(h.avaliacao.percentual ?? 0)}%` : []).slice(-5).join(" · ") || "Sem evidência medida"}</p>
                </li>)}</ul>
            </section>)}
          </details>}
        </>}
        {props.modo === "revisoes" && mapaMemoria}
        {!!plano.reconciliacao.pendentes.length && <p>{plano.reconciliacao.pendentes.length} registro(s) aguardam reconciliação.</p>}
      </>)}
    </section>
  );
}

function BarraIndicador({ valor, rotulo }: { valor: number; rotulo: string }) {
  const p = Math.max(0, Math.min(100, valor));
  return <div className="plano-medidor"><div><span>{rotulo}</span><b>{p.toFixed(0)}%</b></div>
    <div className="plano-trilho" role="meter" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
      <span style={{ width: `${p}%` }} data-nivel={p < 60 ? "baixo" : p < 80 ? "medio" : "alto"} />
    </div></div>;
}
