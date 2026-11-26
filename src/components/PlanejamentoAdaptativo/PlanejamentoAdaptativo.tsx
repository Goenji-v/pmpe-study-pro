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
  modo: "revisoes" | "calendario";
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
  const [dia, setDia] = useState(hoje);
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
  const itens = plano?.agenda.filter(r => filtro === "hoje" ? r.agendada === hoje :
    filtro === "atrasadas" ? r.ideal < hoje : filtro === "sem-vaga" ? !r.agendada && r.ideal <= somarDia(hoje, 29) :
    filtro === "criticas" ? r.primeira || r.recorrente || (r.retencao ?? 1) < .65 :
    filtro === "proximas" ? r.agendada && r.agendada > hoje : true) ?? [];
  const estados = plano ? [...plano.dados.values()] : [];
  const revisoesFeitas = estados.flatMap(item => item.estado.historico.filter(x => x.log).map(x => ({ ...x, ...item.candidato })))
    .sort((a, b) => Date.parse(b.ocorridoEm) - Date.parse(a.ocorridoEm));
  const diaAtivo = plano?.dias.find(d => d.dia === dia);

  return (
    <section className="plano-adaptativo" aria-label="Planejamento adaptativo">
      <header>
        <div><h2>{props.modo === "calendario" ? "Agenda adaptativa" : "Inteligência de revisões"}</h2>
          <p>{props.demonstracao ? "Demonstração local com dados sintéticos." : "Projeção experimental. A agenda oficial continua disponível abaixo."}</p></div>
        {plano && <span className="plano-estado">{plano.previsoes[0].estado}</span>}
      </header>
      <details>
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
      </details>

      {resultado.erro && <p role="alert">Não foi possível calcular a agenda. Confira os dados e recalcule.</p>}
      {!plano && !resultado.erro && <p role="status">Calculando agenda…</p>}
      {props.checkpoint && <CheckpointAdaptativo escopo={props.checkpoint}
        entrada={resultado.entrada === entrada ? entrada : undefined} plano={plano} />}
      {props.compartilhar && <CheckpointCompartilhado entrada={resultado.entrada === entrada ? entrada : undefined} plano={plano} />}
      {plano && <>
        <div className="plano-previsoes" aria-label="Previsão de carga">
          {plano.previsoes.map(p => <article key={p.horizonte}>
            <strong>{p.horizonte} dias · {p.estado}</strong>
            <p>{p.confirmadas} agendadas · {p.estimadas} futuras estimadas · {p.semVaga} sem vaga</p>
            <small>{p.capacidade} min disponíveis · {p.excesso} dia(s) com conflito</small>
          </article>)}
        </div>
        <p>{plano.previsoes[0].recomendacao}</p>
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
                {nomeDia(d.dia)}<small>{d.revisoes + d.fixos.length} atividade(s)</small></button>)}
            </div>}
          <h3>Atividades de {nomeDia(dia)}</h3>
          {!opcoes.semana.includes(new Date(dia + "T00:00:00Z").getUTCDay()) &&
            !diaAtivo?.fixos.some(c => c.tipo === "descanso") && <p>Dia sem disponibilidade para revisões.</p>}
          {diaAtivo?.fixos.map(c => <p key={c.id}>{c.titulo} · {c.minutos} min</p>)}
          {!!diaAtivo?.estimadas && <p>{diaAtivo.estimadas} revisões futuras estimadas</p>}
          {[...new Set(plano.agenda.filter(r => r.agendada === dia).map(r => r.materia))].map(materia =>
            <details key={materia} open><summary>{materia}</summary>
              {plano.agenda.filter(r => r.agendada === dia && r.materia === materia).map(r => <p key={r.unidadeId}>
                <strong>{r.assunto}</strong> · {r.horarioSugerido && `${r.horarioSugerido} sugerido · `}{r.motivo}</p>)}
            </details>)}

          {!diaAtivo?.fixos.length && !diaAtivo?.revisoes && !diaAtivo?.estimadas && <p>Dia sem atividades planejadas.</p>}
          {plano.previsoes[2].semVaga > 0 && <p>{plano.previsoes[2].semVaga} pendência(s) sem vaga neste período.</p>}
        </> : <>
          <label>Mostrar <select value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="hoje">Hoje</option><option value="proximas">Próximas</option><option value="atrasadas">Atrasadas</option>
            <option value="criticas">Críticas</option><option value="sem-vaga">Sem vaga</option>
            <option value="concluidas">Concluídas</option><option value="todas">Todas</option>
          </select></label>
          {filtro === "concluidas" ? (revisoesFeitas.length ? <ul className="plano-lista">{revisoesFeitas.slice(0, 30).map(h =>
            <li key={h.chave}>{h.materia} · {h.assunto} · {h.avaliacao.motivo}</li>)}</ul> : <p>Sem revisões medidas.</p>) :
            itens.length ? <ul className="plano-lista">{itens.map(r => {
              const info = plano.dados.get(r.unidadeId)!;
              return <li key={r.unidadeId}>
                <div><strong>{r.assunto}</strong><p>{r.materia} · {r.minutos} min · {r.agendada ? nomeDia(r.agendada) : "Sem vaga"}{r.horarioSugerido && ` · ${r.horarioSugerido} sugerido`}</p></div>
                <p>{r.motivo} {info.orientacao.modo}. {info.orientacao.acao}</p>
                <small>Ideal {nomeDia(r.ideal)} · prazo {nomeDia(r.limite)} · {r.retencao === undefined ? "Sem estimativa de retenção" :
                  `Retenção estimada ${Math.round(r.retencao * 100)}%`} {info.estado.cartao && `· Dificuldade ${info.estado.cartao.difficulty.toFixed(1)}`}</small>
                <div className="plano-acoes">
                  {r.limite >= hoje && <label>Preferência de data para {r.assunto} <input type="date" min={r.ideal > hoje ? r.ideal : hoje} max={r.limite}
                    value={ajustes[r.unidadeId] ?? ""} onChange={e => {
                      const datas = { ...ajustes, [r.unidadeId]: e.target.value };
                      setAjustes(datas);
                      props.salvarPreferencias?.({ opcoes, datas });
                    }} /></label>}
                  {props.estudar && <button type="button" onClick={() => props.estudar?.(r, plano)}>Revisar {r.assunto}</button>}
                </div>
              </li>;
            })}</ul> : <p>Nenhuma revisão neste filtro.</p>}
          {!!revisoesFeitas.length && <details><summary>Desempenho por matéria e assunto</summary>
            {[...new Set(estados.map(x => x.candidato.materia))].map(materia => <section key={materia}>
              <h3>{materia}</h3><ul className="plano-lista">{estados.filter(x => x.candidato.materia === materia).map(x =>
                <li key={x.estado.unidadeId}><strong>{x.candidato.assunto}</strong>
                  <p>{x.estado.historico.flatMap(h => h.log ? `${nomeDia(diaEstudo(new Date(h.ocorridoEm)))}: ${Math.round(h.avaliacao.percentual ?? 0)}%` : []).slice(-5).join(" · ") || "Sem evidência medida"}</p>
                </li>)}</ul>
            </section>)}
          </details>}
        </>}
        {!!plano.reconciliacao.pendentes.length && <p>{plano.reconciliacao.pendentes.length} registro(s) aguardam reconciliação.</p>}
      </>}
    </section>
  );
}
