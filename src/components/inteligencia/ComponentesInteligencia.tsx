import type { MissaoDia } from "../../services/inteligencia/types";
import { limitarNumero } from "../../services/inteligencia/utils";

type ResumoCardProps = {
  titulo: string;
  valor: string;
  detalhe: string;
};

export function ResumoCard({ titulo, valor, detalhe }: ResumoCardProps) {
  return (
    <article className="inteligencia-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

type DadoSemanaProps = {
  titulo: string;
  valor: string;
};

export function DadoSemana({ titulo, valor }: DadoSemanaProps) {
  return (
    <div className="inteligencia-dado-semana">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

type AlertaProps = {
  titulo: string;
  descricao: string;
  nivel: "alto" | "medio" | "baixo";
};

export function Alerta({ titulo, descricao, nivel }: AlertaProps) {
  return (
    <article className={`inteligencia-alerta alerta-${nivel}`}>
      <strong>{titulo}</strong>
      <p>{descricao}</p>
    </article>
  );
}

type LinhaDesempenhoProps = {
  nome: string;
  percentual: number;
  detalhe: string;
};

export function LinhaDesempenho({
  nome,
  percentual,
  detalhe,
}: LinhaDesempenhoProps) {
  return (
    <div className="inteligencia-linha-desempenho">
      <div className="inteligencia-linha-topo">
        <div>
          <strong>{nome}</strong>
          <small>{detalhe}</small>
        </div>
        <span>{percentual}%</span>
      </div>

      <BarraProgresso percentual={percentual} />
    </div>
  );
}

export function BarraProgresso({ percentual }: { percentual: number }) {
  const valor = limitarNumero(percentual, 0, 100);

  return (
    <div className="inteligencia-barra">
      <div
        className={classeBarra(valor)}
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

function classeBarra(percentual: number) {
  if (percentual >= 80) {
    return "inteligencia-barra-preenchimento barra-bom";
  }
  if (percentual >= 60) {
    return "inteligencia-barra-preenchimento barra-medio";
  }
  return "inteligencia-barra-preenchimento barra-critico";
}

export type { MissaoDia };
