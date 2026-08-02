import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import {
  formatarMinutos,
  gerarRelatorioInteligente,
  type ComparacaoIndicador,
  type RecomendacaoInteligente,
} from "../../services/inteligencia/relatorioInteligenteService";

import "./RelatorioInteligente.css";

export default function RelatorioInteligente() {
  const navigate = useNavigate();
  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
  } = useApp();

  const relatorio = useMemo(
    () =>
      gerarRelatorioInteligente({
        questoes,
        sessoes,
        revisoes,
        simulados,
        metaMinutosDiaria: configuracoes.metaMinutosDiaria,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
      configuracoes.metaMinutosDiaria,
    ]
  );

  return (
    <section className="ri-container">
      <header className="ri-cabecalho">
        <div>
          <span className="ri-etiqueta">V3.0 · ANÁLISE COMPARATIVA</span>
          <h1>📈 Relatório Inteligente</h1>
          <p>
            Comparação automática entre as duas últimas semanas, com diagnóstico
            e ações prioritárias.
          </p>
        </div>

        <div className="ri-indice">
          <span>Índice de consistência</span>
          <strong>{relatorio.indiceConsistencia}%</strong>
          <small>{classificarIndice(relatorio.indiceConsistencia)}</small>
        </div>
      </header>

      <article className="ri-resumo-executivo">
        <div className="ri-resumo-icone">🧠</div>
        <div>
          <h2>Resumo executivo</h2>
          <p>{relatorio.resumoExecutivo}</p>
        </div>
      </article>

      <div className="ri-cards">
        <CardComparacao
          titulo="Tempo estudado"
          valor={formatarMinutos(relatorio.semanaAtual.minutos)}
          comparacao={relatorio.comparacoes.minutos}
          formatarAnterior={formatarMinutos}
        />
        <CardComparacao
          titulo="Questões resolvidas"
          valor={String(relatorio.semanaAtual.questoes)}
          comparacao={relatorio.comparacoes.questoes}
        />
        <CardComparacao
          titulo="Aproveitamento"
          valor={`${relatorio.semanaAtual.aproveitamento}%`}
          comparacao={relatorio.comparacoes.aproveitamento}
          sufixoAnterior="%"
        />
        <CardComparacao
          titulo="Dias ativos"
          valor={String(relatorio.semanaAtual.diasAtivos)}
          comparacao={relatorio.comparacoes.diasAtivos}
        />
      </div>

      <div className="ri-grid-duplo">
        <section className="ri-painel">
          <div className="ri-painel-topo">
            <div>
              <h2>🎯 Recomendações prioritárias</h2>
              <p>Ações calculadas com base no desempenho registrado.</p>
            </div>
          </div>

          <div className="ri-recomendacoes">
            {relatorio.recomendacoes.map((recomendacao, indice) => (
              <RecomendacaoCard
                key={recomendacao.id}
                recomendacao={recomendacao}
                numero={indice + 1}
                abrir={() => navigate(recomendacao.rota)}
              />
            ))}
          </div>
        </section>

        <section className="ri-painel">
          <div className="ri-painel-topo">
            <div>
              <h2>⚠ Diagnóstico atual</h2>
              <p>Pontos que mais afetam sua preparação neste momento.</p>
            </div>
          </div>

          <div className="ri-diagnostico-lista">
            <DiagnosticoItem
              titulo="Matéria crítica"
              valor={
                relatorio.materiaCritica
                  ? `${relatorio.materiaCritica.materia} · ${relatorio.materiaCritica.aproveitamento}%`
                  : "Dados insuficientes"
              }
              nivel="critico"
            />
            <DiagnosticoItem
              titulo="Matéria esquecida"
              valor={
                relatorio.materiaEsquecida &&
                relatorio.materiaEsquecida.diasSemEstudar !== null
                  ? `${relatorio.materiaEsquecida.materia} · ${relatorio.materiaEsquecida.diasSemEstudar} dias`
                  : "Dados insuficientes"
              }
              nivel="atencao"
            />
            <DiagnosticoItem
              titulo="Revisões atrasadas"
              valor={String(relatorio.revisoesAtrasadas)}
              nivel={relatorio.revisoesAtrasadas > 0 ? "critico" : "bom"}
            />
            <DiagnosticoItem
              titulo="Melhor matéria"
              valor={
                relatorio.melhorMateria
                  ? `${relatorio.melhorMateria.materia} · ${relatorio.melhorMateria.aproveitamento}%`
                  : "Dados insuficientes"
              }
              nivel="bom"
            />
          </div>
        </section>
      </div>

      <section className="ri-painel">
        <div className="ri-painel-topo">
          <div>
            <h2>📚 Radar por matéria</h2>
            <p>Volume, aproveitamento, tempo e última atividade.</p>
          </div>
        </div>

        {relatorio.materias.length === 0 ? (
          <div className="ri-vazio">Ainda não existem dados por matéria.</div>
        ) : (
          <div className="ri-tabela-wrap">
            <table className="ri-tabela">
              <thead>
                <tr>
                  <th>Matéria</th>
                  <th>Questões</th>
                  <th>Acertos</th>
                  <th>Aproveitamento</th>
                  <th>Tempo</th>
                  <th>Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.materias.map((materia) => (
                  <tr key={materia.materia}>
                    <td><strong>{materia.materia}</strong></td>
                    <td>{materia.questoes}</td>
                    <td>{materia.certas}</td>
                    <td>
                      <span className={`ri-percentual ${classePercentual(materia.aproveitamento)}`}>
                        {materia.aproveitamento}%
                      </span>
                    </td>
                    <td>{formatarMinutos(materia.minutos)}</td>
                    <td>
                      {materia.diasSemEstudar === null
                        ? "Sem registro"
                        : materia.diasSemEstudar === 0
                          ? "Hoje"
                          : `${materia.diasSemEstudar} dias`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function CardComparacao({
  titulo,
  valor,
  comparacao,
  formatarAnterior = String,
  sufixoAnterior = "",
}: {
  titulo: string;
  valor: string;
  comparacao: ComparacaoIndicador;
  formatarAnterior?: (valor: number) => string;
  sufixoAnterior?: string;
}) {
  const simbolo = comparacao.tendencia === "subindo"
    ? "↑"
    : comparacao.tendencia === "caindo"
      ? "↓"
      : "→";

  return (
    <article className="ri-card-comparacao">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <div className={`ri-tendencia ri-${comparacao.tendencia}`}>
        {simbolo} {Math.abs(comparacao.variacaoPercentual)}%
      </div>
      <small>
        Semana anterior: {formatarAnterior(comparacao.anterior)}{sufixoAnterior}
      </small>
    </article>
  );
}

function RecomendacaoCard({
  recomendacao,
  numero,
  abrir,
}: {
  recomendacao: RecomendacaoInteligente;
  numero: number;
  abrir: () => void;
}) {
  return (
    <article className={`ri-recomendacao ri-prioridade-${recomendacao.prioridade}`}>
      <div className="ri-recomendacao-numero">{numero}</div>
      <div>
        <strong>{recomendacao.titulo}</strong>
        <p>{recomendacao.descricao}</p>
      </div>
      <button type="button" onClick={abrir}>Abrir</button>
    </article>
  );
}

function DiagnosticoItem({
  titulo,
  valor,
  nivel,
}: {
  titulo: string;
  valor: string;
  nivel: "critico" | "atencao" | "bom";
}) {
  return (
    <article className={`ri-diagnostico ri-diagnostico-${nivel}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function classificarIndice(indice: number) {
  if (indice >= 85) return "Consistência excelente";
  if (indice >= 70) return "Boa consistência";
  if (indice >= 50) return "Consistência intermediária";
  return "Constância insuficiente";
}

function classePercentual(percentual: number) {
  if (percentual >= 80) return "ri-percentual-bom";
  if (percentual >= 60) return "ri-percentual-medio";
  return "ri-percentual-critico";
}
