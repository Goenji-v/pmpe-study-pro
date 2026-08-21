import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

import "./InteligenciaHub.css";

const CentralInteligencia = lazy(
  () => import("../CentralInteligencia/CentralInteligencia")
);
const RelatorioInteligente = lazy(
  () => import("../RelatorioInteligente/RelatorioInteligente")
);
const IACoach = lazy(
  () => import("../IACoach/IACoach")
);

type AbaInteligencia = "visao-geral" | "relatorio" | "coach";

const ABAS: Array<{
  id: AbaInteligencia;
  titulo: string;
  descricao: string;
}> = [
  {
    id: "visao-geral",
    titulo: "Visão geral",
    descricao: "Desempenho e prioridades",
  },
  {
    id: "relatorio",
    titulo: "Relatório",
    descricao: "Diagnóstico detalhado",
  },
  {
    id: "coach",
    titulo: "IA Coach",
    descricao: "Próxima ação recomendada",
  },
];

export default function InteligenciaHub() {
  const [parametros, setParametros] = useSearchParams();
  const valorAba = parametros.get("aba");
  const abaAtiva: AbaInteligencia =
    valorAba === "relatorio" || valorAba === "coach"
      ? valorAba
      : "visao-geral";

  function selecionarAba(aba: AbaInteligencia) {
    if (aba === "visao-geral") {
      setParametros({});
      return;
    }

    setParametros({ aba });
  }

  return (
    <section className="inteligencia-hub">
      <nav className="inteligencia-hub-abas" aria-label="Áreas da inteligência">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            type="button"
            className={abaAtiva === aba.id ? "ativo" : ""}
            aria-current={abaAtiva === aba.id ? "page" : undefined}
            onClick={() => selecionarAba(aba.id)}
          >
            <strong>{aba.titulo}</strong>
            <span>{aba.descricao}</span>
          </button>
        ))}
      </nav>

      <div className="inteligencia-hub-conteudo">
        <Suspense fallback={<div className="inteligencia-hub-carregando">Carregando análise...</div>}>
          {abaAtiva === "visao-geral" && <CentralInteligencia />}
          {abaAtiva === "relatorio" && <RelatorioInteligente />}
          {abaAtiva === "coach" && <IACoach />}
        </Suspense>
      </div>
    </section>
  );
}
