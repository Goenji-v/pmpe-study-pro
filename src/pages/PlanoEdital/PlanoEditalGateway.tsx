import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./PlanoEdital.css";

import { useApp } from "../../context/AppContext";
import type { ConfiguracoesComEdital } from "../../types/editalInteligente";
import PlanoEstudos from "../PlanoEstudos/PlanoEstudos";

export default function PlanoEditalGateway() {
  const {
    configuracoes,
    missoesConcluidas,
    setMissoesConcluidas,
  } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  const plano = config.editalAtivo?.plano;
  const [modo, setModo] = useState<"edital" | "anterior">("edital");
  const navigate = useNavigate();

  const idsPlano = useMemo(
    () => new Set(
      plano?.semanas.flatMap((semana) =>
        semana.dias.flatMap((dia) => dia.missoes.map((missao) => missao.id))
      ) ?? []
    ),
    [plano]
  );

  const concluidas = useMemo(
    () => missoesConcluidas.filter((id) => idsPlano.has(id)).length,
    [idsPlano, missoesConcluidas]
  );

  if (!plano || modo === "anterior") {
    return (
      <section className="plano-edital-wrapper">
        {plano && (
          <div className="plano-edital-switch">
            <button type="button" onClick={() => setModo("edital")}>Plano do edital</button>
            <button type="button" className="ativo" onClick={() => setModo("anterior")}>Plano anterior</button>
          </div>
        )}
        <PlanoEstudos />
      </section>
    );
  }

  const progresso = plano.totalAssuntos > 0
    ? Math.round((concluidas / plano.totalAssuntos) * 100)
    : 0;

  function alternarMissao(id: string) {
    setMissoesConcluidas((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id]
    );
  }

  return (
    <section className="plano-edital-page">
      <div className="plano-edital-switch">
        <button type="button" className="ativo" onClick={() => setModo("edital")}>Plano do edital</button>
        <button type="button" onClick={() => setModo("anterior")}>Plano anterior</button>
      </div>

      <header className="plano-edital-hero">
        <div>
          <span>PLANO PERSONALIZADO</span>
          <h1>{plano.titulo}</h1>
          <p>
            Criado a partir do edital confirmado e das regras do seu perfil. Prioridades altas entram antes no ciclo.
          </p>
        </div>
        <button type="button" onClick={() => navigate("/meu-edital")}>Editar edital</button>
      </header>

      <div className="plano-edital-resumo">
        <div><span>Assuntos</span><strong>{plano.totalAssuntos}</strong></div>
        <div><span>Semanas</span><strong>{plano.totalSemanas}</strong></div>
        <div><span>Tempo/dia</span><strong>{plano.minutosPorDia} min</strong></div>
        <div><span>Matérias/dia</span><strong>{plano.materiasPorDia}</strong></div>
        <div><span>Revisões/dia</span><strong>{plano.revisoesPorDia}</strong></div>
        <div><span>Progresso</span><strong>{progresso}%</strong></div>
      </div>

      <div className="plano-edital-progresso" aria-label={`Progresso ${progresso}%`}>
        <span style={{ width: `${progresso}%` }} />
      </div>

      <div className="plano-edital-semanas">
        {plano.semanas.map((semana) => (
          <article key={semana.numero} className="plano-edital-semana">
            <header>
              <span>SEMANA</span>
              <h2>{semana.numero}</h2>
            </header>

            <div className="plano-edital-dias">
              {semana.dias.map((dia) => (
                <section key={dia.id} className="plano-edital-dia">
                  <div className="plano-edital-dia-topo">
                    <div>
                      <strong>{dia.nomeDia}</strong>
                      <small>{dia.minutosDisponiveis} min disponíveis</small>
                    </div>
                    {dia.revisoesPlanejadas > 0 && (
                      <span>{dia.revisoesPlanejadas} revisões</span>
                    )}
                  </div>

                  <div className="plano-edital-missoes">
                    {dia.missoes.map((missao) => {
                      const concluida = missoesConcluidas.includes(missao.id);
                      return (
                        <button
                          type="button"
                          key={missao.id}
                          className={concluida ? "concluida" : ""}
                          onClick={() => alternarMissao(missao.id)}
                        >
                          <span className={`prioridade prioridade-${missao.prioridade}`} />
                          <div>
                            <strong>{missao.materia}</strong>
                            <span>{missao.assunto}</span>
                            <small>
                              {missao.duracaoMinutos} min
                              {missao.metaQuestoes > 0 ? ` · ${missao.metaQuestoes} questões` : ""}
                            </small>
                          </div>
                          <span className="plano-edital-check">{concluida ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
