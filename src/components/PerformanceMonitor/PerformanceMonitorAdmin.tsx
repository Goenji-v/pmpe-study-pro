import { useEffect, useMemo, useState } from "react";

import {
  listarMetricasPerformance,
  type RegistroPerformance,
} from "../../services/performanceService";
import {
  calcularPercentil,
  classificarMetrica,
  formatarValorMetrica,
  rotuloMetrica,
  type NomeMetricaPerformance,
} from "../../utils/performanceMetrics";
import "./PerformanceMonitorAdmin.css";

const METRICAS: NomeMetricaPerformance[] = ["LCP", "INP", "CLS", "TTFB"];

type FiltroDispositivo = "mobile" | "todos";

export default function PerformanceMonitorAdmin() {
  const [registros, setRegistros] = useState<RegistroPerformance[]>([]);
  const [filtro, setFiltro] = useState<FiltroDispositivo>("mobile");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      setRegistros(await listarMetricasPerformance());
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar métricas de performance.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const filtrados = useMemo(
    () => registros.filter((item) => filtro === "todos" || item.dispositivo === "mobile"),
    [filtro, registros]
  );

  const percentis = useMemo(() => {
    return new Map(
      METRICAS.map((metrica) => [
        metrica,
        calcularPercentil(
          filtrados.filter((item) => item.metrica === metrica).map((item) => item.valor)
        ),
      ])
    );
  }, [filtrados]);

  const rotas = useMemo(() => {
    const grupos = new Map<string, RegistroPerformance[]>();
    filtrados.forEach((item) => grupos.set(item.rota, [...(grupos.get(item.rota) ?? []), item]));

    return [...grupos.entries()]
      .map(([rota, itens]) => {
        const valores = new Map<NomeMetricaPerformance, number | null>();
        METRICAS.forEach((metrica) => {
          valores.set(
            metrica,
            calcularPercentil(itens.filter((item) => item.metrica === metrica).map((item) => item.valor))
          );
        });

        const classificacoes = METRICAS.flatMap((metrica) => {
          const valor = valores.get(metrica);
          return valor === null || valor === undefined ? [] : [classificarMetrica(metrica, valor)];
        });
        const status = classificacoes.includes("ruim")
          ? "ruim"
          : classificacoes.includes("atencao")
            ? "atencao"
            : "bom";

        return {
          rota,
          valores,
          status,
          sessoes: new Set(itens.map((item) => item.session_id)).size,
          atualizadoEm: Math.max(...itens.map((item) => new Date(item.updated_at).getTime())),
        };
      })
      .sort((a, b) => {
        const peso = { ruim: 2, atencao: 1, bom: 0 } as const;
        return peso[b.status] - peso[a.status] || b.atualizadoEm - a.atualizadoEm;
      });
  }, [filtrados]);

  const sessoes = new Set(filtrados.map((item) => item.session_id)).size;

  return (
    <section className="performance-admin">
      <header className="performance-admin-topo">
        <div>
          <span>PERFORMANCE REAL</span>
          <h2>Desempenho nos dispositivos dos usuários</h2>
          <p>Percentil 75 dos últimos 30 dias. O foco padrão é celular.</p>
        </div>
        <div className="performance-admin-controles">
          <select value={filtro} onChange={(evento) => setFiltro(evento.target.value as FiltroDispositivo)} aria-label="Filtrar dispositivo">
            <option value="mobile">Somente celular</option>
            <option value="todos">Todos os dispositivos</option>
          </select>
          <button type="button" onClick={() => void carregar()} disabled={carregando}>
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {erro && <div className="performance-admin-erro">{erro}</div>}

      <div className="performance-admin-cards">
        {METRICAS.map((metrica) => {
          const valor = percentis.get(metrica) ?? null;
          const classificacao = valor === null ? "sem-dados" : classificarMetrica(metrica, valor);
          return (
            <article key={metrica} className={`performance-admin-card ${classificacao}`}>
              <span>{rotuloMetrica(metrica)}</span>
              <strong>{formatarValorMetrica(metrica, valor)}</strong>
              <small>{rotuloClassificacao(classificacao)}</small>
            </article>
          );
        })}
      </div>

      <div className="performance-admin-resumo">
        <strong>{sessoes}</strong> sessões reais · <strong>{filtrados.length}</strong> medições · <strong>{rotas.length}</strong> rotas
      </div>

      {carregando ? (
        <div className="performance-admin-vazio">Carregando métricas...</div>
      ) : rotas.length === 0 ? (
        <div className="performance-admin-vazio">Ainda não há dados suficientes. As métricas começarão a aparecer conforme usuários acessarem a nova versão em produção.</div>
      ) : (
        <div className="performance-admin-tabela-area">
          <div className="performance-admin-tabela cabecalho">
            <span>Rota</span><span>Sessões</span><span>LCP p75</span><span>INP p75</span><span>CLS p75</span><span>TTFB p75</span><span>Status</span>
          </div>
          {rotas.slice(0, 20).map((item) => (
            <article className="performance-admin-tabela" key={item.rota}>
              <strong>{item.rota}</strong>
              <span>{item.sessoes}</span>
              <span>{formatarValorMetrica("LCP", item.valores.get("LCP") ?? null)}</span>
              <span>{formatarValorMetrica("INP", item.valores.get("INP") ?? null)}</span>
              <span>{formatarValorMetrica("CLS", item.valores.get("CLS") ?? null)}</span>
              <span>{formatarValorMetrica("TTFB", item.valores.get("TTFB") ?? null)}</span>
              <span className={`performance-admin-status ${item.status}`}>{rotuloClassificacao(item.status)}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function rotuloClassificacao(classificacao: "bom" | "atencao" | "ruim" | "sem-dados") {
  if (classificacao === "bom") return "Bom";
  if (classificacao === "atencao") return "Atenção";
  if (classificacao === "ruim") return "Ruim";
  return "Aguardando dados";
}
