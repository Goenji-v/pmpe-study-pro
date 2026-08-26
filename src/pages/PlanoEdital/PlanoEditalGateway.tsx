import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./PlanoEdital.css";

import { useApp } from "../../context/AppContext";
import {
  type ConfiguracoesComEdital,
  type DiaSemanaId,
  type PrioridadeEdital,
} from "../../types/editalInteligente";
import { calcularDiagnosticoSemanalPlano } from "../../utils/adaptacaoPlano";
import { adaptarPlanoEditalAoDesempenho } from "../../utils/adaptacaoPlanoEdital";
import {
  gerarPlanoEdital,
  mesclarMateriasDoEdital,
  slugEdital,
} from "../../utils/planoEdital";
import PlanoEstudos from "../PlanoEstudos/PlanoEstudos";

export default function PlanoEditalGateway() {
  const {
    configuracoes,
    missoesConcluidas,
    setMissoesConcluidas,
    setMaterias,
    questoes,
    sessoes,
    revisoes,
  } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  const planoArmazenado = config.editalAtivo?.plano;
  const analise = config.editalAtivo?.analise;
  const [modo, setModo] = useState<"edital" | "anterior">("edital");
  const navigate = useNavigate();

  useEffect(() => {
    if (!analise) return;

    setMaterias((atuais) => mesclarMateriasDoEdital(atuais, analise));
  }, [analise, setMaterias]);

  const planoBase = useMemo(() => {
    if (!analise) return planoArmazenado;

    const estruturaAtualizada =
      planoArmazenado?.versao === 3 &&
      planoArmazenado.semanas.every((semana) => semana.dias.length === 7);

    return estruturaAtualizada
      ? planoArmazenado
      : gerarPlanoEdital(analise, config);
  }, [analise, config, planoArmazenado]);

  const materiasDoEdital = useMemo(
    () => new Set((analise?.materias ?? []).map((materia) => slugEdital(materia.nome))),
    [analise]
  );

  const diagnostico = useMemo(() => {
    const pertenceAoEdital = (materia: string) => materiasDoEdital.has(slugEdital(materia));

    return calcularDiagnosticoSemanalPlano({
      questoes: questoes.filter((item) => pertenceAoEdital(item.materia)),
      sessoes: sessoes.filter((item) => pertenceAoEdital(item.materia)),
      revisoes: revisoes.filter((item) => pertenceAoEdital(item.materia)),
      materiasDisponiveis: analise?.materias.map((materia) => materia.nome) ?? [],
    });
  }, [analise, materiasDoEdital, questoes, revisoes, sessoes]);

  const plano = useMemo(
    () =>
      planoBase
        ? adaptarPlanoEditalAoDesempenho(
            planoBase,
            diagnostico,
            missoesConcluidas
          )
        : undefined,
    [diagnostico, missoesConcluidas, planoBase]
  );

  const [semanaSelecionada, setSemanaSelecionada] = useState(1);
  const [diaSelecionado, setDiaSelecionado] = useState<DiaSemanaId>(
    () => plano?.diasEstudo[0] ?? "seg"
  );

  const idsPlano = useMemo(
    () =>
      new Set(
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
            <button type="button" onClick={() => setModo("edital")}>
              Plano do edital
            </button>
            <button
              type="button"
              className="ativo"
              onClick={() => setModo("anterior")}
            >
              Plano anterior
            </button>
          </div>
        )}
        <PlanoEstudos />
      </section>
    );
  }

  const semana =
    plano.semanas.find((item) => item.numero === semanaSelecionada) ??
    plano.semanas[0];
  const dia =
    semana?.dias.find((item) => item.diaSemana === diaSelecionado) ??
    semana?.dias[0];
  const diaAtivo = Boolean(dia && plano.diasEstudo.includes(dia.diaSemana));

  const progresso = idsPlano.size > 0
    ? Math.round((concluidas / idsPlano.size) * 100)
    : 0;

  const idsSemana = semana?.dias.flatMap((item) =>
    item.missoes.map((missao) => missao.id)
  ) ?? [];
  const concluidasSemana = idsSemana.filter((id) =>
    missoesConcluidas.includes(id)
  ).length;
  const progressoSemana = idsSemana.length > 0
    ? Math.round((concluidasSemana / idsSemana.length) * 100)
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
        <button
          type="button"
          className="ativo"
          onClick={() => setModo("edital")}
        >
          Plano do edital
        </button>
        <button type="button" onClick={() => setModo("anterior")}>
          Plano anterior
        </button>
      </div>

      <header className="plano-edital-hero">
        <div>
          <span>PLANO PERSONALIZADO</span>
          <h1>{plano.titulo}</h1>
          <p>
            As duas primeiras semanas equilibram matérias básicas e específicas.
            A partir da semana 3, o Study Pro reorganiza as próximas missões pelo
            seu desempenho recente, sem mexer no que já foi concluído.
          </p>
        </div>
        <button type="button" onClick={() => navigate("/meu-edital")}>
          Editar edital
        </button>
      </header>

      {diagnostico.possuiDados && plano.totalSemanas > 2 && (
        <div className="plano-edital-adaptativo">
          <div>
            <span>ADAPTAÇÃO ATIVA</span>
            <strong>
              {diagnostico.materiaPrioritaria
                ? `${diagnostico.materiaPrioritaria} está recebendo mais prioridade`
                : "Cronograma ajustado pelo desempenho recente"}
            </strong>
          </div>
          <small>
            Janela de {diagnostico.janelaDias} dias · confiança {diagnostico.confianca}%
          </small>
        </div>
      )}

      <div className="plano-edital-resumo">
        <div><span>Blocos de estudo</span><strong>{idsPlano.size}</strong></div>
        <div><span>Semanas</span><strong>{plano.totalSemanas}</strong></div>
        <div><span>Tempo/dia</span><strong>{plano.minutosPorDia} min</strong></div>
        <div><span>Matérias/dia</span><strong>{plano.materiasPorDia}</strong></div>
        <div><span>Revisões/dia</span><strong>{plano.revisoesPorDia}</strong></div>
        <div><span>Progresso</span><strong>{progresso}%</strong></div>
      </div>

      <div className="plano-edital-progresso" aria-label={`Progresso ${progresso}%`}>
        <span style={{ width: `${progresso}%` }} />
      </div>

      <div className="plano-edital-semanas-nav">
        {plano.semanas.map((itemSemana) => {
          const ids = itemSemana.dias.flatMap((itemDia) =>
            itemDia.missoes.map((missao) => missao.id)
          );
          const feitas = ids.filter((id) => missoesConcluidas.includes(id)).length;
          const percentual = ids.length > 0
            ? Math.round((feitas / ids.length) * 100)
            : 0;

          return (
            <button
              key={itemSemana.numero}
              type="button"
              className={
                semanaSelecionada === itemSemana.numero ? "ativo" : ""
              }
              onClick={() => {
                setSemanaSelecionada(itemSemana.numero);
                const primeiroDiaAtivo = itemSemana.dias.find((itemDia) =>
                  plano.diasEstudo.includes(itemDia.diaSemana)
                );
                setDiaSelecionado(primeiroDiaAtivo?.diaSemana ?? "seg");
              }}
            >
              <span>Semana {String(itemSemana.numero).padStart(2, "0")}</span>
              <strong>{percentual}%</strong>
            </button>
          );
        })}
      </div>

      <div className="plano-edital-resumo-semana">
        <div>
          <span>SEMANA {String(semana?.numero ?? 1).padStart(2, "0")}</span>
          <h2>
            {semana && semana.numero > 2 && diagnostico.possuiDados
              ? "Semana adaptada ao seu desempenho"
              : "Escolha o dia e siga as missões na ordem"}
          </h2>
        </div>
        <strong>{progressoSemana}%</strong>
      </div>

      <div className="plano-edital-dias-nav">
        {semana?.dias.map((itemDia) => {
          const feitas = itemDia.missoes.filter((missao) =>
            missoesConcluidas.includes(missao.id)
          ).length;
          const ativoNoPerfil = plano.diasEstudo.includes(itemDia.diaSemana);

          return (
            <button
              key={itemDia.id}
              type="button"
              className={[
                diaSelecionado === itemDia.diaSemana ? "ativo" : "",
                !ativoNoPerfil ? "dia-livre" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setDiaSelecionado(itemDia.diaSemana)}
            >
              <span>{itemDia.nomeDia}</span>
              <small>
                {ativoNoPerfil
                  ? `${feitas}/${itemDia.missoes.length}`
                  : "Livre"}
              </small>
            </button>
          );
        })}
      </div>

      {dia && (
        <section className="plano-edital-conteudo-dia">
          <header className="plano-edital-titulo-dia">
            <div>
              <span>SEMANA {semana?.numero} · {dia.nomeDia.toUpperCase()}</span>
              <h2>{dia.nomeDia}</h2>
              <p>
                {diaAtivo
                  ? `${dia.minutosDisponiveis} min disponíveis · ${dia.revisoesPlanejadas} revisão(ões) planejada(s)`
                  : "Dia não marcado para estudo no seu perfil."}
              </p>
            </div>
            {diaAtivo && (
              <strong>
                {dia.missoes.filter((missao) =>
                  missoesConcluidas.includes(missao.id)
                ).length}/{dia.missoes.length} concluídas
              </strong>
            )}
          </header>

          {!diaAtivo ? (
            <div className="plano-edital-dia-vazio">
              <strong>Dia livre</strong>
              <span>
                Nenhuma matéria foi colocada aqui porque esse dia não está
                selecionado no perfil. Você pode ativá-lo em Configurações.
              </span>
            </div>
          ) : (
            <>
              {dia.missoes.length > 0 ? (
                <div className="plano-edital-missoes-detalhadas">
                  {dia.missoes.map((missao, indice) => {
                    const concluida = missoesConcluidas.includes(missao.id);
                    return (
                      <article
                        key={missao.id}
                        className={concluida ? "concluida" : ""}
                      >
                        <div className="plano-edital-missao-topo">
                          <span>Missão {indice + 1}</span>
                          <span className={`plano-edital-prioridade-texto prioridade-${missao.prioridade}`}>
                            Prioridade {formatarPrioridade(missao.prioridade)}
                          </span>
                        </div>
                        <h3>{missao.materia}</h3>
                        <p>{missao.assunto}</p>
                        <small>
                          {missao.duracaoMinutos} min
                          {missao.metaQuestoes > 0
                            ? ` · ${missao.metaQuestoes} questões`
                            : ""}
                        </small>
                        <button
                          type="button"
                          className={concluida ? "concluida" : ""}
                          onClick={() => alternarMissao(missao.id)}
                        >
                          {concluida ? "↩ Desmarcar" : "✓ Concluir missão"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="plano-edital-dia-vazio">
                  <strong>Sem conteúdo novo neste dia</strong>
                  <span>
                    Use o tempo reservado para limpar a fila de revisões e reforçar
                    os pontos fracos da semana.
                  </span>
                </div>
              )}

              {dia.revisoesPlanejadas > 0 && (
                <div className="plano-edital-revisoes-dia">
                  <strong>🔁 Revisões do dia</strong>
                  <span>
                    Execute até {dia.revisoesPlanejadas} revisão(ões) pendente(s),
                    priorizando as urgentes e antecipadas pelo desempenho.
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}

function formatarPrioridade(prioridade: PrioridadeEdital) {
  if (prioridade === "media") return "Média";
  if (prioridade === "alta") return "Alta";
  return "Baixa";
}
