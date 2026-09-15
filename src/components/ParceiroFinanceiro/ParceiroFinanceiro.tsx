import { useEffect, useState } from "react";
import {
  listarMeuFaturamentoParceiro,
  type FaturamentoOperacionalParceiro,
  type StatusFinanceiroParceiro,
} from "../../services/financeiroParceirosService";
import "./ParceiroFinanceiro.css";

type Props = {
  alunosAtivos: number;
  valorMensal: number;
};

export default function ParceiroFinanceiro({ alunosAtivos, valorMensal }: Props) {
  const [itens, setItens] = useState<FaturamentoOperacionalParceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void listarMeuFaturamentoParceiro()
      .then((dados) => {
        if (ativo) setItens(dados);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o financeiro.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const pendente = itens
    .filter((item) => item.status === "pendente")
    .reduce((total, item) => total + item.valorDevidoCentavos, 0);

  return (
    <section className="parceiro-financeiro">
      <div className="parceiro-financeiro-topo">
        <div>
          <span>FINANCEIRO DA PARCERIA</span>
          <h2>Competências e repasses</h2>
          <p>O valor mensal acima é uma estimativa. Cada fechamento congela a quantidade de alunos e a taxa usada naquela competência.</p>
        </div>
      </div>

      <div className="parceiro-financeiro-resumo">
        <article>
          <span>Estimativa atual</span>
          <strong>{moedaReais(valorMensal)}</strong>
          <small>{alunosAtivos} aluno(s) ativo(s)</small>
        </article>
        <article>
          <span>Pendente</span>
          <strong>{moedaCentavos(pendente)}</strong>
          <small>{itens.filter((item) => item.status === "pendente").length} competência(s)</small>
        </article>
        <article>
          <span>Fechamentos</span>
          <strong>{itens.length}</strong>
          <small>histórico registrado</small>
        </article>
      </div>

      {erro && <div className="parceiro-financeiro-aviso erro" role="alert">{erro}</div>}

      {carregando ? (
        <div className="parceiro-financeiro-vazio">Carregando financeiro...</div>
      ) : itens.length === 0 ? (
        <div className="parceiro-financeiro-vazio">
          Nenhuma competência fechada ainda. O valor acima é somente uma estimativa até o primeiro fechamento mensal.
        </div>
      ) : (
        <div className="parceiro-financeiro-lista">
          {itens.map((item) => (
            <article className="parceiro-financeiro-item" key={item.id}>
              <div className="parceiro-financeiro-item-topo">
                <div>
                  <span className={`parceiro-financeiro-status ${item.status}`}>{rotuloStatus(item.status)}</span>
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
          ))}
        </div>
      )}
    </section>
  );
}

function moedaReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moedaCentavos(valor: number) {
  return (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moedaAssinada(valor: number) {
  return `${valor > 0 ? "+" : ""}${moedaCentavos(valor)}`;
}

function formatarCompetencia(valor: string) {
  const [ano, mes] = valor.slice(0, 7).split("-").map(Number);
  if (!ano || !mes) return valor;
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatarData(valor: string) {
  const [ano, mes, dia] = valor.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return valor;
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

function formatarDataHora(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function rotuloStatus(status: StatusFinanceiroParceiro) {
  if (status === "pago") return "Pago";
  if (status === "cancelado") return "Cancelado";
  return "Pendente";
}
