import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  atualizarFaturamentoParceiroAdmin,
  atualizarValorParceriaAdmin,
  fecharCompetenciaParceiroAdmin,
  listarFaturamentoParceiroAdmin,
  type FaturamentoOperacionalParceiro,
  type StatusFinanceiroParceiro,
} from "../../services/financeiroParceirosService";
import "./AdminFinanceiroParceiro.css";

type Props = { parceiroId: string; valorAlunoCentavos: number };

export default function AdminFinanceiroParceiro({ parceiroId, valorAlunoCentavos }: Props) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<FaturamentoOperacionalParceiro[]>([]);
  const [taxaCentavos, setTaxaCentavos] = useState(valorAlunoCentavos);
  const [taxaReais, setTaxaReais] = useState((valorAlunoCentavos / 100).toFixed(2));
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [editando, setEditando] = useState<FaturamentoOperacionalParceiro | null>(null);
  const [ajusteEdicao, setAjusteEdicao] = useState("0.00");
  const [vencimentoEdicao, setVencimentoEdicao] = useState("");
  const [observacaoEdicao, setObservacaoEdicao] = useState("");

  useEffect(() => {
    setTaxaCentavos(valorAlunoCentavos);
    setTaxaReais((valorAlunoCentavos / 100).toFixed(2));
  }, [valorAlunoCentavos]);

  const carregar = useCallback(async () => {
    try { setCarregando(true); setErro(""); setItens(await listarFaturamentoParceiroAdmin(parceiroId)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o financeiro."); }
    finally { setCarregando(false); }
  }, [parceiroId]);

  useEffect(() => { if (aberto) void carregar(); }, [aberto, carregar]);

  async function salvarTaxa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const centavos = reaisParaCentavos(taxaReais);
    try {
      setProcessando("taxa"); setErro(""); setMensagem("");
      await atualizarValorParceriaAdmin(parceiroId, centavos);
      setTaxaCentavos(centavos);
      setTaxaReais((centavos / 100).toFixed(2));
      setMensagem("Taxa atualizada. Ela será usada nos próximos fechamentos ou recálculos; meses já fechados permanecem com o valor registrado.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível atualizar a taxa."); }
    finally { setProcessando(""); }
  }

  async function fechar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const competencia = String(form.get("competencia") || "");
    if (!competencia) return;
    try {
      setProcessando("fechar"); setErro(""); setMensagem("");
      await fecharCompetenciaParceiroAdmin({ parceiroId, competencia, ajusteCentavos: reaisParaCentavos(form.get("ajuste")), vencimentoEm: textoOuNulo(form.get("vencimento")), observacao: textoOuNulo(form.get("observacao")) });
      setMensagem("Competência fechada. A quantidade de alunos e a taxa ficaram registradas neste fechamento.");
      evento.currentTarget.reset();
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível fechar a competência."); }
    finally { setProcessando(""); }
  }

  async function mudarStatus(item: FaturamentoOperacionalParceiro, status: StatusFinanceiroParceiro) {
    try {
      setProcessando(`${status}-${item.id}`); setErro(""); setMensagem("");
      await atualizarFaturamentoParceiroAdmin({ faturamentoId: item.id, status, ajusteCentavos: item.ajusteCentavos, vencimentoEm: item.vencimentoEm, observacao: item.observacao });
      setMensagem(status === "pago" ? "Cobrança marcada como paga." : status === "cancelado" ? "Competência cancelada." : "Competência voltou para pendente.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível atualizar o status."); }
    finally { setProcessando(""); }
  }

  function abrirEdicao(item: FaturamentoOperacionalParceiro) {
    setEditando(item); setAjusteEdicao((item.ajusteCentavos / 100).toFixed(2)); setVencimentoEdicao(item.vencimentoEm?.slice(0, 10) || ""); setObservacaoEdicao(item.observacao || ""); setErro(""); setMensagem("");
  }

  async function salvarEdicao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (!editando) return;
    try {
      setProcessando(`editar-${editando.id}`); setErro(""); setMensagem("");
      await atualizarFaturamentoParceiroAdmin({ faturamentoId: editando.id, status: editando.status, ajusteCentavos: reaisParaCentavos(ajusteEdicao), vencimentoEm: vencimentoEdicao || null, observacao: observacaoEdicao.trim() || null });
      setMensagem("Ajuste financeiro atualizado."); setEditando(null); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar o ajuste."); }
    finally { setProcessando(""); }
  }

  return (
    <section className="admin-financeiro">
      <button type="button" className="admin-financeiro-toggle" onClick={() => setAberto((valor) => !valor)}><span>FINANCEIRO</span><strong>{aberto ? "Ocultar financeiro" : "Gerenciar financeiro"}</strong></button>
      {aberto && (
        <div className="admin-financeiro-conteudo">
          <p className="admin-financeiro-regra">O fechamento registra uma fotografia do mês. Taxa atual: <b>{moeda(taxaCentavos)}</b> por aluno ativo.</p>
          {erro && <div className="admin-financeiro-aviso erro" role="alert">{erro}</div>}
          {mensagem && <div className="admin-financeiro-aviso sucesso" role="status">{mensagem}</div>}

          <form className="admin-financeiro-taxa" onSubmit={salvarTaxa}>
            <label>Taxa por aluno (R$)<input value={taxaReais} onChange={(e) => setTaxaReais(e.target.value)} type="number" min="0" step="0.01" required /></label>
            <div><small>Aplica-se aos próximos fechamentos e recálculos.</small><button disabled={processando === "taxa"}>{processando === "taxa" ? "Salvando..." : "Salvar taxa"}</button></div>
          </form>

          <form className="admin-financeiro-form" onSubmit={fechar}>
            <label>Competência<input name="competencia" type="month" required defaultValue={mesAtual()} /></label>
            <label>Ajuste (R$)<input name="ajuste" type="number" step="0.01" defaultValue="0.00" /></label>
            <label>Vencimento<input name="vencimento" type="date" /></label>
            <label className="admin-financeiro-observacao">Observação<input name="observacao" placeholder="Opcional" /></label>
            <button disabled={processando === "fechar"}>{processando === "fechar" ? "Fechando..." : "Fechar / recalcular competência"}</button>
          </form>

          {carregando ? <div className="admin-financeiro-vazio">Carregando histórico...</div> : itens.length === 0 ? <div className="admin-financeiro-vazio">Nenhuma competência fechada ainda.</div> : (
            <div className="admin-financeiro-lista">{itens.map((item) => (
              <article key={item.id} className="admin-financeiro-item">
                <div className="admin-financeiro-item-topo"><div><span className={`admin-financeiro-status ${item.status}`}>{rotuloStatus(item.status)}</span><strong>{formatarCompetencia(item.competencia)}</strong><small>{item.alunosAtivos} aluno(s) × {moeda(item.valorUnitarioCentavos)}</small></div><div className="admin-financeiro-valores"><small>Base {moeda(item.valorBaseCentavos)}</small><small>Ajuste {moedaAssinada(item.ajusteCentavos)}</small><strong>{moeda(item.valorDevidoCentavos)}</strong></div></div>
                <div className="admin-financeiro-detalhes">{item.vencimentoEm && <span>Vence {formatarData(item.vencimentoEm)}</span>}{item.pagoEm && <span>Pago em {formatarDataHora(item.pagoEm)}</span>}{item.observacao && <span>{item.observacao}</span>}</div>
                {editando?.id === item.id ? (
                  <form className="admin-financeiro-edicao" onSubmit={salvarEdicao}><label>Ajuste (R$)<input value={ajusteEdicao} onChange={(e) => setAjusteEdicao(e.target.value)} type="number" step="0.01" /></label><label>Vencimento<input value={vencimentoEdicao} onChange={(e) => setVencimentoEdicao(e.target.value)} type="date" /></label><label>Observação<input value={observacaoEdicao} onChange={(e) => setObservacaoEdicao(e.target.value)} /></label><div><button disabled={processando === `editar-${item.id}`}>Salvar</button><button type="button" className="secundario" onClick={() => setEditando(null)}>Cancelar edição</button></div></form>
                ) : (
                  <div className="admin-financeiro-acoes"><button type="button" onClick={() => abrirEdicao(item)}>Editar ajuste</button>{item.status !== "pago" && <button type="button" disabled={!!processando} onClick={() => void mudarStatus(item, "pago")}>Marcar pago</button>}{item.status !== "pendente" && <button type="button" disabled={!!processando} onClick={() => void mudarStatus(item, "pendente")}>Voltar pendente</button>}{item.status === "pendente" && <button type="button" className="perigo" disabled={!!processando} onClick={() => void mudarStatus(item, "cancelado")}>Cancelar competência</button>}</div>
                )}
              </article>
            ))}</div>
          )}
        </div>
      )}
    </section>
  );
}

function reaisParaCentavos(valor: FormDataEntryValue | string | null) { const numero = Number(String(valor ?? "0").replace(",", ".")); return Number.isFinite(numero) ? Math.round(numero * 100) : 0; }
function textoOuNulo(valor: FormDataEntryValue | null) { const texto = String(valor ?? "").trim(); return texto || null; }
function mesAtual() { const data = new Date(); return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`; }
function moeda(centavos: number) { return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function moedaAssinada(centavos: number) { return `${centavos > 0 ? "+" : ""}${moeda(centavos)}`; }
function formatarCompetencia(valor: string) { const [ano, mes] = valor.slice(0, 7).split("-").map(Number); return ano && mes ? new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : valor; }
function formatarData(valor: string) { const [ano, mes, dia] = valor.slice(0, 10).split("-").map(Number); return ano && mes && dia ? new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR") : valor; }
function formatarDataHora(valor: string) { return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function rotuloStatus(status: StatusFinanceiroParceiro) { if (status === "pago") return "Pago"; if (status === "cancelado") return "Cancelado"; return "Pendente"; }