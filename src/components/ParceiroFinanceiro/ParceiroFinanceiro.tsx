import { useEffect, useMemo, useState } from "react";
import {
  carregarResumoFinanceiroMeuParceiro,
  listarMeuFaturamentoParceiro,
  type FaturamentoOperacionalParceiro,
  type ResumoFinanceiroMeuParceiro,
  type StatusFinanceiroParceiro,
} from "../../services/financeiroParceirosService";
import "./ParceiroFinanceiro.css";

type Props = { alunosAtivos?: number; valorMensal?: number };

export default function ParceiroFinanceiro(_: Props) {
  const [itens, setItens] = useState<FaturamentoOperacionalParceiro[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiroMeuParceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void Promise.all([listarMeuFaturamentoParceiro(), carregarResumoFinanceiroMeuParceiro()])
      .then(([historico, atual]) => {
        if (!ativo) return;
        setItens(historico);
        setResumo(atual);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o financeiro.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  const indicadores = useMemo(() => {
    const pendentes = itens.filter((item) => item.status === "pendente");
    const pagos = itens.filter((item) => item.status === "pago");
    return {
      pendente: pendentes.reduce((total, item) => total + item.valorDevidoCentavos, 0),
      pago: pagos.reduce((total, item) => total + item.valorDevidoCentavos, 0),
      vencidos: pendentes.filter((item) => item.vencimentoEm && new Date(`${item.vencimentoEm}T23:59:59`) < new Date()).length,
    };
  }, [itens]);

  return (
    <section className="parceiro-financeiro">
      <div className="parceiro-financeiro-topo">
        <div>
          <span>FINANCEIRO DA PARCERIA</span>
          <h2>Cobranças da plataforma</h2>
          <p>A estimativa acompanha os alunos ativos de hoje. Quando uma competência é fechada, quantidade de alunos, taxa, ajustes e vencimento ficam registrados naquele mês.</p>
        </div>
      </div>

      <div className="parceiro-financeiro-resumo">
        <article><span>Estimativa atual</span><strong>{moedaCentavos(resumo?.estimativaAtualCentavos ?? 0)}</strong><small>{resumo?.alunosAtivos ?? 0} aluno(s) ativo(s)</small></article>
        <article><span>Taxa atual</span><strong>{moedaCentavos(resumo?.valorUnitarioCentavos ?? 0)}</strong><small>por aluno ativo / mês</small></article>
        <article><span>Em aberto</span><strong>{moedaCentavos(indicadores.pendente)}</strong><small>{indicadores.vencidos ? `${indicadores.vencidos} competência(s) vencida(s)` : "nenhuma competência vencida"}</small></article>
        <article><span>Pago no histórico</span><strong>{moedaCentavos(indicadores.pago)}</strong><small>{itens.filter((item) => item.status === "pago").length} competência(s)</small></article>
      </div>

      {erro && <div className="parceiro-financeiro-aviso erro" role="alert">{erro}</div>}

      {carregando ? (
        <div className="parceiro-financeiro-vazio">Carregando financeiro...</div>
      ) : itens.length === 0 ? (
        <div className="parceiro-financeiro-vazio">Nenhuma competência fechada ainda. A estimativa atual não é uma cobrança até o fechamento mensal.</div>
      ) : (
        <div className="parceiro-financeiro-lista">
          {itens.map((item) => {
            const vencido = item.status === "pendente" && !!item.vencimentoEm && new Date(`${item.vencimentoEm}T23:59:59`) < new Date();
            return (
              <article className="parceiro-financeiro-item" key={item.id}>
                <div className="parceiro-financeiro-item-topo">
                  <div>
                    <span className={`parceiro-financeiro-status ${item.status} ${vencido ? "vencido" : ""}`}>{vencido ? "Vencido" : rotuloStatus(item.status)}</span>
                    <strong>{formatarCompetencia(item.competencia)}</strong>
                    <small>{item.alunosAtivos} aluno(s) × {moedaCentavos(item.valorUnitarioCentavos)}</small>
                  </div>
                  <strong className="parceiro-financeiro-total">{moedaCentavos(item.valorDevidoCentavos)}</strong>
                </div>
                <div className="parceiro-financeiro-valores">
                  <span>Base <b>{moedaCentavos(item.valorBaseCentavos)}</b></span>
                  <span>Ajuste <b>{moedaAssinada(item.ajusteCentavos)}</b></span>
                  {item.vencimentoEm && <span>Vencimento <b>{formatarData(item.vencimentoEm)}</b></span>}
                  {item.pagoEm && <span>Pagamento <b>{formatarDataHora(item.pagoEm)}</b></span>}
                </div>
                {item.observacao && <p className="parceiro-financeiro-observacao">{item.observacao}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function moedaCentavos(valor: number) { return (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function moedaAssinada(valor: number) { return `${valor > 0 ? "+" : ""}${moedaCentavos(valor)}`; }
function formatarCompetencia(valor: string) { const [ano, mes] = valor.slice(0, 7).split("-").map(Number); return ano && mes ? new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : valor; }
function formatarData(valor: string) { const [ano, mes, dia] = valor.slice(0, 10).split("-").map(Number); return ano && mes && dia ? new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR") : valor; }
function formatarDataHora(valor: string) { return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function rotuloStatus(status: StatusFinanceiroParceiro) { if (status === "pago") return "Pago"; if (status === "cancelado") return "Cancelado"; return "Pendente"; }