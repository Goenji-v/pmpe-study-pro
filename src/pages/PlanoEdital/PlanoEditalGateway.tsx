import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./PlanoEdital.css";
import "../PlanoEstudos/PlanoEstudos.css";

import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import { useApp } from "../../context/AppContext";
import type { ConfiguracoesComCursos } from "../../types/cursos";
import {
  type ConfiguracoesComEdital,
  type DiaSemanaId,
  type MissaoPlanoEdital,
} from "../../types/editalInteligente";
import { calcularDiagnosticoSemanalPlano } from "../../utils/adaptacaoPlano";
import { adaptarPlanoEditalAoDesempenho } from "../../utils/adaptacaoPlanoEdital";
import {
  gerarPlanoEdital,
  mesclarMateriasDoEdital,
  slugEdital,
} from "../../utils/planoEdital";
import { sincronizarProgressoCursos } from "../../utils/importacaoCurso";
import {
  encontrarAulasNosConteudos,
  encontrarAulasParaMissao,
  type AulaRelacionadaAoEdital,
} from "../../utils/relacionarCursoEdital";
import PlanoEstudos from "../PlanoEstudos/PlanoEstudos";

export default function PlanoEditalGateway() {
  const {
    configuracoes,
    materias,
    missoesConcluidas,
    setMissoesConcluidas,
    setMaterias,
    questoes,
    sessoes,
    revisoes,
  } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  const configCursos = configuracoes as ConfiguracoesComCursos;
  const cursosAtivosIds = configCursos.cursosAtivosIds ?? [];
  const cursosSincronizados = useMemo(
    () => sincronizarProgressoCursos(configCursos.cursos ?? [], materias),
    [configCursos.cursos, materias]
  );
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
    if (configuracoes.planoPadraoAtivo === false) {
      return (
        <section className="plano-edital-wrapper">
          <h1>Nenhum plano configurado</h1>
          <p>Sua conta começa vazia. Importe seu edital, adicione um curso ou cadastre seus assuntos para começar.</p>
          <div className="plano-edital-switch">
            <button type="button" onClick={() => navigate("/meu-edital")}>Importar edital</button>
            <button type="button" onClick={() => navigate("/cursos")}>Importar curso</button>
            <button type="button" onClick={() => navigate("/estudos")}>Cadastrar assuntos</button>
            {plano && <button type="button" onClick={() => setModo("edital")}>Voltar ao meu plano</button>}
          </div>
        </section>
      );
    }
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

  function iniciarAulaDoCurso(
    missao: MissaoPlanoEdital,
    aula: AulaRelacionadaAoEdital
  ) {
    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify({
        materia: aula.materia,
        modulo: `${aula.curso} · ${aula.modulo}`,
        moduloId: aula.moduloId,
        assunto: aula.aula,
        assuntoId: aula.assuntoId,
        aulaId: aula.aulaId,
        tipo: "aula",
        objetivo: `Estudar ${aula.aula} para cumprir ${missao.assunto}`,
        missaoId: missao.id,
        urlAula: aula.url,
      })
    );

    navigate("/central-estudos");
  }


  function aulasDaMissao(missao: MissaoPlanoEdital) {
    const doCurso = encontrarAulasParaMissao(
      cursosSincronizados,
      cursosAtivosIds,
      missao.materia,
      missao.assunto,
      3
    );
    const dosConteudos = encontrarAulasNosConteudos(
      materias,
      cursosAtivosIds,
      missao.materia,
      missao.assunto,
      3
    );

    const combinadas = [...doCurso, ...dosConteudos]
      .filter(
        (item, indice, lista) =>
          lista.findIndex(
            (outro) =>
              outro.cursoId === item.cursoId &&
              outro.aulaId === item.aulaId
          ) === indice
      )
      .sort((a, b) => {
        const bonusUrlA = a.url ? 0.03 : 0;
        const bonusUrlB = b.url ? 0.03 : 0;
        return b.score + bonusUrlB - (a.score + bonusUrlA);
      });

    return combinadas.slice(0, 3);
  }

  function iniciarMissaoDoPlano(missao: MissaoPlanoEdital) {
    const aulasRelacionadas = aulasDaMissao(missao);

    const primeiraAula =
      aulasRelacionadas.find((aula) => Boolean(aula.url)) ??
      aulasRelacionadas[0];
    if (primeiraAula) {
      iniciarAulaDoCurso(missao, primeiraAula);
      return;
    }

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify({
        materia: missao.materia,
        materiaId: missao.materiaId,
        modulo: "Edital atual",
        assunto: missao.assunto,
        assuntoId: missao.assuntoId,
        tipo: "aula",
        objetivo: `Estudar ${missao.assunto}`,
        missaoId: missao.id,
      })
    );

    navigate("/central-estudos");
  }

  return (
    <section className="plano-edital-wrapper">
      <div className="plano-edital-switch">
        <button
          type="button"
          className="ativo"
          onClick={() => setModo("edital")}
        >
          Plano atual
        </button>
        <button type="button" onClick={() => setModo("anterior")}>
          Plano anterior
        </button>
      </div>

      <section className="plano-container plano-unificado">
        <div className="plano-cabecalho">
          <div>
            <h1>📅 Plano Tático</h1>
            <p>
              {plano.totalSemanas} semanas no seu ritmo atual. Selecione a
              semana, depois o dia, e execute as missões na ordem.
            </p>
          </div>

          <div className="plano-progresso-geral">
            <span>Progresso geral</span>
            <strong>{progresso}%</strong>
          </div>
        </div>

        {cursosAtivosIds.length > 0 && (
          <div className="plano-edital-cursos-ativos plano-unificado-cursos">
            <div>
              <span>CURSO CONECTADO AO PLANO</span>
              <strong>
                {cursosAtivosIds.length} curso(s) ativo(s). O Study Pro tenta
                abrir a aula correspondente à missão.
              </strong>
            </div>
            <button type="button" onClick={() => navigate("/cursos")}>
              Gerenciar cursos
            </button>
          </div>
        )}

        <div className="plano-semanas">
          {plano.semanas.map((itemSemana) => {
            const ids = itemSemana.dias.flatMap((itemDia) =>
              itemDia.missoes.map((missao) => missao.id)
            );
            const feitas = ids.filter((id) =>
              missoesConcluidas.includes(id)
            ).length;
            const percentual =
              ids.length > 0 ? Math.round((feitas / ids.length) * 100) : 0;

            return (
              <button
                key={itemSemana.numero}
                type="button"
                className={`plano-semana-botao ${
                  semanaSelecionada === itemSemana.numero
                    ? "plano-semana-ativa"
                    : ""
                }`}
                onClick={() => {
                  setSemanaSelecionada(itemSemana.numero);
                  const primeiroDiaAtivo = itemSemana.dias.find((itemDia) =>
                    plano.diasEstudo.includes(itemDia.diaSemana)
                  );
                  setDiaSelecionado(primeiroDiaAtivo?.diaSemana ?? "seg");
                }}
              >
                <span>
                  Semana {String(itemSemana.numero).padStart(2, "0")}
                </span>
                <strong>{percentual}%</strong>
              </button>
            );
          })}
        </div>

        <div className="plano-resumo-semana">
          <div>
            <h2>
              Semana {String(semana?.numero ?? 1).padStart(2, "0")}
            </h2>
            <p>Selecione o dia e execute as missões na ordem.</p>
          </div>
          <strong>{progressoSemana}%</strong>
        </div>

        <div className="plano-dias">
          {semana?.dias.map((itemDia) => {
            const feitas = itemDia.missoes.filter((missao) =>
              missoesConcluidas.includes(missao.id)
            ).length;
            const ativoNoPerfil = plano.diasEstudo.includes(
              itemDia.diaSemana
            );

            return (
              <button
                key={itemDia.id}
                type="button"
                className={`plano-dia-botao ${
                  diaSelecionado === itemDia.diaSemana
                    ? "plano-dia-ativo"
                    : ""
                }`}
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
          <div className="plano-conteudo-dia">
            <div className="plano-titulo-dia">
              <h2>
                Semana {semana?.numero} — {dia.nomeDia}
              </h2>
              <span>
                {
                  dia.missoes.filter((missao) =>
                    missoesConcluidas.includes(missao.id)
                  ).length
                }
                /{dia.missoes.length} concluídas
              </span>
            </div>

            {!diaAtivo ? (
              <div className="plano-edital-dia-vazio">
                <strong>Dia livre</strong>
                <span>
                  Esse dia não está marcado para estudo no seu perfil.
                </span>
              </div>
            ) : dia.missoes.length > 0 ? (
              <div className="plano-missoes-grid">
                {dia.missoes.map((missao, indice) => {
                  const concluida = missoesConcluidas.includes(missao.id);
                  const aulasRelacionadas = aulasDaMissao(missao);
                  const aulaPrincipal =
                    aulasRelacionadas.find((aula) => Boolean(aula.url)) ??
                    aulasRelacionadas[0];

                  return (
                    <article
                      key={missao.id}
                      className={`plano-missao-card ${
                        concluida ? "plano-missao-concluida" : ""
                      }`}
                    >
                      <div className="plano-missao-topo">
                        <span>Missão {indice + 1}</span>
                        <span className="plano-tipo">Conteúdo</span>
                      </div>

                      <h3>{missao.materia}</h3>

                      <small className="plano-modulo">
                        Módulo: {aulaPrincipal?.modulo ?? "Edital atual"}
                      </small>

                      <p>{missao.assunto}</p>

                      {aulaPrincipal && (
                        <small className="plano-unificado-aula">
                          {aulaPrincipal.curso} · {aulaPrincipal.aula}
                          {aulaPrincipal.concluida ? " · ✓" : ""}
                        </small>
                      )}

                      <div className="plano-missao-acoes">
                        <button
                          type="button"
                          className="plano-estudar"
                          onClick={() => iniciarMissaoDoPlano(missao)}
                        >
                          ⏱ Estudar
                        </button>

                        <button
                          type="button"
                          className={
                            concluida ? "plano-desmarcar" : "plano-concluir"
                          }
                          onClick={() => alternarMissao(missao.id)}
                        >
                          {concluida ? "↩ Desmarcar" : "✓ Concluir"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="plano-edital-dia-vazio">
                <strong>Sem conteúdo novo neste dia</strong>
                <span>
                  Use o tempo para revisar conteúdos ou resolver questões.
                </span>
              </div>
            )}

            {diaAtivo && dia.revisoesPlanejadas > 0 && (
              <div className="plano-extras">
                <div>
                  <strong>🔁 Revisões</strong>
                  <span>
                    Faça até {dia.revisoesPlanejadas} revisão(ões) pendente(s)
                    neste dia.
                  </span>
                </div>
                <div>
                  <strong>📌 Ritmo do dia</strong>
                  <span>
                    {dia.minutosDisponiveis} min disponíveis ·{" "}
                    {dia.missoes.length} missão(ões)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

