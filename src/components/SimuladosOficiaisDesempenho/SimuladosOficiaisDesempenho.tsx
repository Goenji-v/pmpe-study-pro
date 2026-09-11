import { useEffect, useMemo, useState } from "react";
import { listarResultadosOficiaisDoAluno, type ResultadoOficialHistorico } from "../../services/simuladosOficiaisDesempenhoService";
import "./SimuladosOficiaisDesempenho.css";

export default function SimuladosOficiaisDesempenho() {
  const [resultados, setResultados] = useState<ResultadoOficialHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    listarResultadosOficiaisDoAluno()
      .then((lista) => {
        if (ativo) setResultados(lista);
      })
      .catch(() => {
        if (ativo) setResultados([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const resumo = useMemo(() => {
    const validos = resultados.filter((item) => item.resultado);
    if (!validos.length) return { media: 0, melhor: 0, total: 0 };
    const percentuais = validos.map((item) => Number(item.resultado?.percentual || 0));
    return {
      media: Math.round(percentuais.reduce((total, valor) => total + valor, 0) / percentuais.length),
      melhor: Math.max(...percentuais),
      total: validos.length,
    };
  }, [resultados]);

  return (
    <section className="oficiais-desempenho">
      <div className="oficiais-desempenho__cabecalho">
        <div>
          <span>PROVAS OFICIAIS</span>
          <h2>Desempenho nos simulados oficiais</h2>
          <p>Os resultados oficiais ficam registrados junto ao seu histórico de desempenho.</p>
        </div>
      </div>

      {carregando ? (
        <p>Carregando resultados oficiais...</p>
      ) : resultados.length === 0 ? (
        <div className="oficiais-desempenho__vazio">Você ainda não concluiu nenhum simulado oficial.</div>
      ) : (
        <>
          <div className="oficiais-desempenho__resumo">
            <article><span>Provas concluídas</span><strong>{resumo.total}</strong></article>
            <article><span>Média</span><strong>{resumo.media}%</strong></article>
            <article><span>Melhor resultado</span><strong>{resumo.melhor}%</strong></article>
          </div>

          <div className="oficiais-desempenho__lista">
            {resultados.slice(0, 8).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.banca} · {item.finalizadaEm ? formatarData(item.finalizadaEm) : "Data não informada"}</span>
                </div>
                <div>
                  <b>{item.resultado?.percentual ?? 0}%</b>
                  <span>{item.resultado?.certas ?? 0}/{Math.max(0, (item.resultado?.total ?? 0) - (item.resultado?.anuladas ?? 0))} válidas</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function formatarData(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
