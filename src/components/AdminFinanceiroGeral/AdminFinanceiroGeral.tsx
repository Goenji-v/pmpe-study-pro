import { useEffect, useMemo, useState } from "react";
import {
  listarFinanceiroGeralAdmin,
  type FaturamentoOperacionalParceiro,
} from "../../services/financeiroParceirosService";
import "./AdminFinanceiroGeral.css";

export default function AdminFinanceiroGeral() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [itens, setItens] = useState<FaturamentoOperacionalParceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    void listarFinanceiroGeralAdmin(ano)
      .then((dados) => { if (ativo) setItens(dados); })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o consolidado."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [ano]);

  const resumo = useMemo(() => {
    const validos = itens.filter((item) => item.status !== "cancelado");
    const pendentes = validos.filter((item) => item.status === "pendente");
    const pagos = validos.filter((item) => item.status === "pago");
    return {
      devido: validos.reduce((soma, item) => soma + item.valorDevidoCentavos, 0),
      pendente: pendentes.reduce((soma, item) => soma + item.valorDevidoCentavos, 0),
      pago: pagos.reduce((soma, item) => soma + item.valorDevidoCentavos, 0),
      alunos: validos.reduce((soma, item) => soma + item.alunosAtivos, 0),
      parceiros: new Set(validos.map((item) => item.parceiroId).filter(Boolean)).size,
    };
  }, [itens]);

  return (
    <section className="admin-fin-geral">
      <header>
        <div>
          <span>FINANCEIRO CONSOLIDADO</span>
          <h2>Cobranças das parcerias</h2>
          <p>Visão anual dos fechamentos. Ajustes e pagamentos continuam sendo gerenciados dentro de cada parceria.</p>
        </div>
        <label>Ano<input type="number" min="2024" max="2200" value={ano} onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())} /></label>
      </header>

      <div className="admin-fin-geral-cards">
        <Card titulo="Total fechado" valor={moeda(resumo.devido)} detalhe={`${resumo.parceiros} parceria(s)`} />
        <Card titulo="Em aberto" valor={moeda(resumo.pendente)} detalhe="competências pendentes" />
        <Card titulo="Pago" valor={moeda(resumo.pago)} detalhe={`no ano de ${ano}`} />
        <Card titulo="Alunos faturados" valor={resumo.alunos.toLocaleString("pt-BR")} detalhe="soma dos fechamentos" />
      </div>

      {erro && <div className="admin-fin-geral-erro" role="alert">{erro}</div>}
      {carregando ? <div className="admin-fin-geral-vazio">Carregando consolidado...</div> : itens.length === 0 ? <div className="admin-fin-geral-vazio">Nenhuma competência fechada em {ano}.</div> : (
        <div className="admin-fin-geral-tabela-wrap">
          <div className="admin-fin-geral-tabela cabecalho"><span>Parceiro</span><span>Competência</span><span>Alunos</span><span>Taxa</span><span>Devido</span><span>Status</span></div>
          {itens.slice(0, 100).map((item) => (
            <article className="admin-fin-geral-tabela" key={item.id}>
              <strong>{item.parceiroNome || "Parceria"}</strong>
              <span>{competencia(item.competencia)}</span>
              <span>{item.alunosAtivos}</span>
              <span>{moeda(item.valorUnitarioCentavos)}</span>
              <strong>{moeda(item.valorDevidoCentavos)}</strong>
              <span className={`admin-fin-geral-status ${item.status}`}>{rotulo(item.status)}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return <article><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}
function moeda(centavos: number) { return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function competencia(valor: string) { const [ano, mes] = valor.slice(0, 7).split("-").map(Number); return ano && mes ? new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : valor; }
function rotulo(status: FaturamentoOperacionalParceiro["status"]) { return status === "pago" ? "Pago" : status === "cancelado" ? "Cancelado" : "Pendente"; }