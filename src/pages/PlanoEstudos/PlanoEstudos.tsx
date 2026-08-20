import {
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import "./PlanoEstudos.css";

import {
  obterReferenciasDaMissao,
  type DiaPlano,
  type MissaoPlano,
} from "../../data/planoPMPE";

import {
  useApp,
} from "../../context/AppContext";

import {
  useCronometro,
} from "../../context/CronometroContext";

import { localizarConteudoDaMissao, localizarConteudosDaMissao } from "../../services/conteudos/localizarConteudo";
import { criarDadosSessaoDaMissao } from "../../services/conteudos/sincronizacaoCanonica";
import {
  getProgressoPlano,
  getProgressoSemana,
  getSemanaAtual,
} from "../../utils/planoUtils";
import {
  adaptarMissaoFlexivel,
  calcularDiagnosticoSemanalPlano,
} from "../../utils/adaptacaoPlano";
import {
  criarPlanoCalendario,
  NOMES_DIAS_PLANO,
  normalizarMissoesPorDia,
  obterDiaAtualPlano,
} from "../../utils/planoCalendario";

export default function PlanoEstudos() {
  const navigate = useNavigate();
  const location = useLocation();
  const estadoNavegacao = location.state as { semana?: number; dia?: number } | null;

  const {
    materias,
    questoes,
    sessoes,
    revisoes,
    setSessoes,
    setSimulados,
    missoesConcluidas:
      concluidas,
    setMissoesConcluidas:
      setConcluidas,
    definirConclusaoAssunto,
    definirConclusaoAula,
    configuracoes,
  } = useApp();

  const [temaRedacao, setTemaRedacao] = useState("");
  const [minutosRedacao, setMinutosRedacao] = useState("");
  const [notaRedacao, setNotaRedacao] = useState("");
  const [nomeSimulado, setNomeSimulado] = useState("");
  const [totalSimulado, setTotalSimulado] = useState("");
  const [acertosSimulado, setAcertosSimulado] = useState("");
  const [minutosSimulado, setMinutosSimulado] = useState("");
  const [cadernoUrl, setCadernoUrl] = useState("");
  const [comentadoUrl, setComentadoUrl] = useState("");
  const [mensagemDomingo, setMensagemDomingo] = useState("");

  function marcarMissaoDomingoConcluida(tipo: "redacao" | "simulado") {
    const domingoAtual = planoCalendario
      .find((semana) => semana.numero === semanaSelecionada)
      ?.dias.find((itemDia) => itemDia.numero === 7);
    const missao = domingoAtual?.missoes.find((item) => item.tipo === tipo);

    if (!missao) return;

    setConcluidas((anteriores) =>
      anteriores.includes(missao.id)
        ? anteriores
        : [...anteriores, missao.id]
    );
    window.dispatchEvent(new Event("pmpe-plano-atualizado"));
    window.dispatchEvent(new Event("pmpe-dashboard-atualizado"));
  }

  function salvarRedacaoDomingo() {
    const tema = temaRedacao.trim();
    const minutosTexto = Number(minutosRedacao);
    const nota = notaRedacao.trim() ? Number(notaRedacao) : undefined;
    const domingoAtual = planoCalendario
      .find((semana) => semana.numero === semanaSelecionada)
      ?.dias.find((itemDia) => itemDia.numero === 7);
    const missaoRedacao = domingoAtual?.missoes.find((item) => item.tipo === "redacao");

    if (missaoRedacao && concluidas.includes(missaoRedacao.id)) {
      setMensagemDomingo("A redação deste domingo já foi salva.");
      return;
    }

    if (!tema || !Number.isFinite(minutosTexto) || minutosTexto < 1) {
      setMensagemDomingo("Informe o tema e o tempo da redação.");
      return;
    }
    if (nota !== undefined && (!Number.isFinite(nota) || nota < 0)) {
      setMensagemDomingo("Informe uma nota válida para a redação.");
      return;
    }

    const agora = new Date().toISOString();
    setSessoes((anteriores) => [{
      id: crypto.randomUUID(),
      data: agora,
      tipo: "redacao",
      materia: "Redação",
      assunto: tema,
      objetivo: tema,
      minutos: Math.round(minutosTexto),
      notaRedacao: nota,
      semana: semanaSelecionada,
      dia: 7,
    }, ...anteriores]);

    marcarMissaoDomingoConcluida("redacao");
    setTemaRedacao("");
    setMinutosRedacao("");
    setNotaRedacao("");
    setMensagemDomingo("Redação salva. O simulado pode ser feito e salvo depois.");
  }

  function salvarSimuladoDomingo() {
    const nome = nomeSimulado.trim();
    const total = Number(totalSimulado);
    const acertos = Number(acertosSimulado);
    const minutosSim = Number(minutosSimulado);
    const domingoAtual = planoCalendario
      .find((semana) => semana.numero === semanaSelecionada)
      ?.dias.find((itemDia) => itemDia.numero === 7);
    const missaoSimulado = domingoAtual?.missoes.find((item) => item.tipo === "simulado");

    if (missaoSimulado && concluidas.includes(missaoSimulado.id)) {
      setMensagemDomingo("O simulado deste domingo já foi salvo.");
      return;
    }

    if (!nome || !Number.isInteger(total) || total < 1 || !Number.isInteger(acertos) || acertos < 0 || acertos > total || !Number.isFinite(minutosSim) || minutosSim < 1) {
      setMensagemDomingo("Preencha corretamente o nome, total, acertos e tempo do simulado.");
      return;
    }

    const agora = new Date().toISOString();
    setSimulados((anteriores) => [{
      id: crypto.randomUUID(),
      nome,
      banca: "Misto",
      certas: acertos,
      erradas: total - acertos,
      anuladas: 0,
      totalQuestoes: total,
      minutos: Math.round(minutosSim),
      data: agora,
      cadernoUrl: cadernoUrl.trim() || undefined,
      comentadoUrl: comentadoUrl.trim() || undefined,
    }, ...anteriores]);

    marcarMissaoDomingoConcluida("simulado");
    setNomeSimulado("");
    setTotalSimulado("");
    setAcertosSimulado("");
    setMinutosSimulado("");
    setCadernoUrl("");
    setComentadoUrl("");
    setMensagemDomingo(`Simulado salvo: ${acertos}/${total} questões (${Math.round(acertos / total * 100)}%).`);
  }

  const {
    cronometroAtivo,
  } = useCronometro();

  const missoesPorDia = normalizarMissoesPorDia(
    configuracoes.missoesPorDia ?? 1
  );

  const planoCalendario = useMemo(
    () => criarPlanoCalendario(missoesPorDia),
    [missoesPorDia]
  );

  const semanaInicial = getSemanaAtual(
    concluidas,
    planoCalendario,
    configuracoes.semanaAtualPlano
  );
  const diaCalendarioHoje = obterDiaAtualPlano();
  const semanaInicialDisponivel =
    planoCalendario.find((item) => item.numero === semanaInicial) ?? planoCalendario[0];
  const diaInicial = semanaInicialDisponivel?.dias.some((item) => item.numero === diaCalendarioHoje)
    ? diaCalendarioHoje
    : (semanaInicialDisponivel?.dias[0]?.numero ?? 1);

  const [
    semanaSelecionada,
    setSemanaSelecionada,
  ] = useState(estadoNavegacao?.semana ?? semanaInicial);

  const [
    diaSelecionado,
    setDiaSelecionado,
  ] = useState(estadoNavegacao?.dia ?? diaInicial);

  const semana = planoCalendario.find(
    (item) =>
      item.numero ===
      semanaSelecionada
  );

  const dia = semana?.dias.find(
    (item) =>
      item.numero ===
      diaSelecionado
  );

  const missaoRedacaoDomingo = diaSelecionado === 7
    ? dia?.missoes.find((missao) => missao.tipo === "redacao")
    : undefined;
  const missaoSimuladoDomingo = diaSelecionado === 7
    ? dia?.missoes.find((missao) => missao.tipo === "simulado")
    : undefined;
  const redacaoDomingoConcluida = Boolean(
    missaoRedacaoDomingo && concluidas.includes(missaoRedacaoDomingo.id)
  );
  const simuladoDomingoConcluido = Boolean(
    missaoSimuladoDomingo && concluidas.includes(missaoSimuladoDomingo.id)
  );

  const todasAsMissoes =
    useMemo(
      () =>
        planoCalendario.flatMap(
          (itemSemana) =>
            itemSemana.dias.flatMap(
              (itemDia) =>
                itemDia.missoes
            )
        ),
      [planoCalendario]
    );

  // Etapa 15: Plano e Dashboard usam exatamente o mesmo cálculo de progresso.
  const progressoGeral = useMemo(
    () => getProgressoPlano(concluidas, planoCalendario),
    [concluidas, planoCalendario]
  );

  const progressoSemana = useMemo(
    () => getProgressoSemana(semanaSelecionada, concluidas, planoCalendario),
    [semanaSelecionada, concluidas, planoCalendario]
  );

  const diagnosticoSemanal = useMemo(
    () => calcularDiagnosticoSemanalPlano({
      questoes,
      sessoes,
      revisoes,
      materiasDisponiveis: materias.map((materia) => materia.nome),
    }),
    [questoes, sessoes, revisoes, materias]
  );

  const topPrioridades = diagnosticoSemanal.materias.slice(0, 3);

  function selecionarSemana(
    numeroSemana: number
  ) {
    setSemanaSelecionada(
      numeroSemana
    );

    setDiaSelecionado(1);
  }

  function alternarConclusao(
    id: string
  ) {
    const missao =
      todasAsMissoes.find(
        (item) => item.id === id
      );

    if (!missao) {
      window.alert(
        "Não foi possível localizar esta missão."
      );

      return;
    }

    const concluindo =
      !concluidas.includes(id);

    const materiaRelacionada = materias.find(
      (materia) =>
        normalizarTexto(materia.nome) ===
        normalizarTexto(missao.materia)
    );

    const localizacao = materiaRelacionada
      ? localizarConteudoDaMissao(materiaRelacionada, missao)
      : null;

    if (materiaRelacionada && localizacao?.aula) {
      definirConclusaoAula(
        materiaRelacionada.id,
        localizacao.assunto.id,
        localizacao.aula.id,
        concluindo,
        localizacao.modulo.id
      );
    } else if (materiaRelacionada && localizacao) {
      definirConclusaoAssunto(
        materiaRelacionada.id,
        localizacao.assunto.id,
        concluindo,
        localizacao.modulo.id
      );
    } else {
      setConcluidas((anteriores) =>
        concluindo
          ? Array.from(new Set([...anteriores, id]))
          : anteriores.filter((item) => item !== id)
      );
    }

    window.dispatchEvent(
      new Event(
        "pmpe-plano-atualizado"
      )
    );

    window.dispatchEvent(
      new Event(
        "pmpe-materias-atualizadas"
      )
    );
  }

  function abrirLink(
    url?: string
  ) {
    if (!url) {
      window.alert(
        "Este conteúdo não possui link cadastrado."
      );

      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function iniciarEstudo(
    missao: MissaoPlano
  ) {
    if (cronometroAtivo) {
      navigate(
        "/central-estudos"
      );
      return;
    }

    const dadosSessao = criarDadosSessaoDaMissao(
      materias,
      missao,
      semanaSelecionada,
      diaSelecionado
    );

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify(dadosSessao)
    );

    navigate(
      "/central-estudos",
      {
        state: {
          origem: "plano",
          prefillSessao: dadosSessao,
        },
      }
    );
  }

  return (
    <section className="plano-container">
      <div className="plano-cabecalho">
        <div>
          <h1>
            📅 Plano Tático PMPE
          </h1>

          <p>
            {planoCalendario.length} semanas no ritmo atual de {missoesPorDia} {missoesPorDia === 1 ? "missão" : "missões"} por dia. Domingo é exclusivo para redação e simulado.
          </p>
        </div>

        <div className="plano-progresso-geral">
          <span>
            Progresso geral
          </span>

          <strong>
            {progressoGeral}%
          </strong>
        </div>
      </div>

      <section className="plano-adaptacao">
        <div className="plano-adaptacao-principal">
          <div>
            <span className="plano-adaptacao-etiqueta">ETAPA 17 · ADAPTAÇÃO CONTROLADA</span>
            <h2>Prioridade da semana</h2>
            {diagnosticoSemanal.materiaPrioritaria ? (
              <>
                <strong>{diagnosticoSemanal.materiaPrioritaria}</strong>
                <p>{diagnosticoSemanal.motivos[0] ?? "Prioridade calculada a partir do desempenho recente."}</p>
              </>
            ) : (
              <p>Registre estudo, questões ou revisões para liberar uma prioridade baseada em dados.</p>
            )}
          </div>
          <div className="plano-adaptacao-indices">
            <div><span>Prioridade</span><strong>{diagnosticoSemanal.prioridade}/100</strong></div>
            <div><span>Confiança</span><strong>{diagnosticoSemanal.confianca}%</strong></div>
            <div><span>Janela</span><strong>{diagnosticoSemanal.janelaDias} dias</strong></div>
          </div>
        </div>

        <div className="plano-adaptacao-ranking">
          {topPrioridades.length > 0 ? topPrioridades.map((item, indice) => (
            <article key={item.materia}>
              <span>{indice + 1}</span>
              <div>
                <strong>{item.materia}</strong>
                <small>
                  {item.percentualAcertos !== undefined ? `${item.percentualAcertos}% acertos · ` : ""}
                  {item.questoes} questões · {item.revisoesAtrasadas} revisões atrasadas
                </small>
              </div>
              <b>{item.prioridade}</b>
            </article>
          )) : (
            <p className="plano-adaptacao-vazio">Sem dados suficientes na janela recente.</p>
          )}
        </div>

        <p className="plano-adaptacao-regra">
          A sequência fixa não é alterada. A adaptação atua somente nas missões flexíveis de reforço; domingos continuam exclusivos para redação + simulado.
        </p>
      </section>

      <div className="plano-semanas">
        {planoCalendario.map(
          (itemSemana) => {
            const idsDaSemana =
              itemSemana.dias.flatMap(
                (itemDia) =>
                  itemDia.missoes.map(
                    (missao) =>
                      missao.id
                  )
              );

            const feitas =
              idsDaSemana.filter(
                (id) =>
                  concluidas.includes(
                    id
                  )
              ).length;

            const percentual =
              idsDaSemana.length === 0
                ? 0
                : Math.round(
                    (feitas /
                      idsDaSemana.length) *
                      100
                  );

            return (
              <button
                key={
                  itemSemana.numero
                }
                type="button"
                className={
                  `plano-semana-botao ${
                    semanaSelecionada ===
                    itemSemana.numero
                      ? "plano-semana-ativa"
                      : ""
                  }`
                }
                onClick={() =>
                  selecionarSemana(
                    itemSemana.numero
                  )
                }
              >
                <span>
                  {itemSemana.nome}
                </span>

                <strong>
                  {percentual}%
                </strong>
              </button>
            );
          }
        )}
      </div>

      <div className="plano-resumo-semana">
        <div>
          <h2>
            {semana?.nome ||
              "Semana"}
          </h2>

          <p>
            Selecione o dia e execute
            as missões na ordem.
          </p>
        </div>

        <strong>
          {progressoSemana}%
        </strong>
      </div>

      <div className="plano-dias">
        {semana?.dias.map(
          (itemDia: DiaPlano) => {
            const concluidasDia =
              itemDia.missoes.filter(
                (missao) =>
                  concluidas.includes(
                    missao.id
                  )
              ).length;

            return (
              <button
                key={itemDia.numero}
                type="button"
                className={
                  `plano-dia-botao ${
                    diaSelecionado ===
                    itemDia.numero
                      ? "plano-dia-ativo"
                      : ""
                  }`
                }
                onClick={() =>
                  setDiaSelecionado(
                    itemDia.numero
                  )
                }
              >
                <span>
                  {NOMES_DIAS_PLANO[itemDia.numero] ?? `Dia ${itemDia.numero}`}
                </span>

                <small>
                  {concluidasDia}/
                  {
                    itemDia.missoes
                      .length
                  }
                </small>
              </button>
            );
          }
        )}
      </div>

      {dia && (
        <div className="plano-conteudo-dia">
          <div className="plano-titulo-dia">
            <h2>
              Semana{" "}
              {semanaSelecionada} — {NOMES_DIAS_PLANO[diaSelecionado] ?? `Dia ${diaSelecionado}`}
            </h2>

            <span>
              {
                dia.missoes.filter(
                  (missao) =>
                    concluidas.includes(
                      missao.id
                    )
                ).length
              }
              /{dia.missoes.length}{" "}
              concluídas
            </span>
          </div>

          {diaSelecionado === 7 && (
            <div className="plano-rotina-dia plano-rotina-domingo">
              <header><div><small>Domingo estratégico</small><h3>Redação + Simulado</h3></div><span>Prioridade semanal</span></header>
              <div className="plano-rotina-blocos">
                <article className={redacaoDomingoConcluida ? "plano-domingo-concluido" : ""}>
                  <div className="plano-domingo-cabecalho-missao">
                    <strong>✍️ Missão 1 — Redação</strong>
                    {redacaoDomingoConcluida && <span>✓ Concluída</span>}
                  </div>
                  <div className="plano-domingo-form">
                    <input disabled={redacaoDomingoConcluida} value={temaRedacao} onChange={(e) => setTemaRedacao(e.target.value)} placeholder="Tema da redação" />
                    <div><input disabled={redacaoDomingoConcluida} type="number" min="1" value={minutosRedacao} onChange={(e) => setMinutosRedacao(e.target.value)} placeholder="Tempo (min)" /><input disabled={redacaoDomingoConcluida} type="number" min="0" step="0.1" value={notaRedacao} onChange={(e) => setNotaRedacao(e.target.value)} placeholder="Nota (opcional)" /></div>
                  </div>
                  <div className="plano-domingo-acao-missao">
                    <button type="button" onClick={salvarRedacaoDomingo} disabled={redacaoDomingoConcluida}>
                      {redacaoDomingoConcluida ? "Redação salva" : "Salvar redação"}
                    </button>
                  </div>
                </article>
                <article className={simuladoDomingoConcluido ? "plano-domingo-concluido" : ""}>
                  <div className="plano-domingo-cabecalho-missao">
                    <strong>🎯 Missão 2 — Simulado</strong>
                    {simuladoDomingoConcluido && <span>✓ Concluído</span>}
                  </div>
                  <div className="plano-domingo-form">
                    <input disabled={simuladoDomingoConcluido} value={nomeSimulado} onChange={(e) => setNomeSimulado(e.target.value)} placeholder="Nome do simulado" />
                    <div><input disabled={simuladoDomingoConcluido} type="number" min="1" value={totalSimulado} onChange={(e) => setTotalSimulado(e.target.value)} placeholder="Total" /><input disabled={simuladoDomingoConcluido} type="number" min="0" value={acertosSimulado} onChange={(e) => setAcertosSimulado(e.target.value)} placeholder="Acertos" /><input disabled={simuladoDomingoConcluido} type="number" min="1" value={minutosSimulado} onChange={(e) => setMinutosSimulado(e.target.value)} placeholder="Minutos" /></div>
                    <input disabled={simuladoDomingoConcluido} value={cadernoUrl} onChange={(e) => setCadernoUrl(e.target.value)} placeholder="Link do caderno de questões/PDF" />
                    <input disabled={simuladoDomingoConcluido} value={comentadoUrl} onChange={(e) => setComentadoUrl(e.target.value)} placeholder="Link do simulado comentado/PDF" />
                  </div>
                  <div className="plano-domingo-acao-missao">
                    <button type="button" onClick={salvarSimuladoDomingo} disabled={simuladoDomingoConcluido}>
                      {simuladoDomingoConcluido ? "Simulado salvo" : "Salvar simulado"}
                    </button>
                  </div>
                </article>
              </div>
              <div className="plano-domingo-rodape">
                {mensagemDomingo && <span>{mensagemDomingo}</span>}
              </div>
            </div>
          )}

          {diaSelecionado !== 7 && (
            <div className="plano-missoes-grid">
              {dia.missoes.map((missao: MissaoPlano) => {
                const missaoExibida = adaptarMissaoFlexivel(missao, diagnosticoSemanal);
                const concluida = concluidas.includes(missao.id);
                const materia = materias.find(
                  (item) => normalizarTexto(item.nome) === normalizarTexto(missaoExibida.materia)
                );
                const missaoParaLocalizar = missaoExibida.adaptada ? missaoExibida : missao;
                const localizacoes = materia
                  ? localizarConteudosDaMissao(materia, missaoParaLocalizar)
                  : [];
                const localizacaoAtual = materia
                  ? localizarConteudoDaMissao(materia, missaoParaLocalizar)
                  : null;
                const referencias = obterReferenciasDaMissao(missao);
                const loteAgrupado = referencias.length > 1;
                const itensConcluidos = localizacoes.filter(({ assunto, aula }) =>
                  aula ? aula.concluida : assunto.concluido
                ).length;
                const urlAulaAtual =
                  localizacaoAtual?.aula?.url ??
                  localizacaoAtual?.assunto.aula ??
                  missao.urlAula;

                return (
                  <article
                    key={missao.id}
                    className={`plano-missao-card ${concluida ? "plano-missao-concluida" : ""}`}
                  >
                    <div className="plano-missao-topo">
                      <span>Missão {missao.numero}</span>
                      <span className="plano-tipo">{formatarTipo(missao.tipo)}</span>
                    </div>

                    <h3>{missaoExibida.materia}</h3>

                    {localizacaoAtual && (
                      <small className="plano-modulo">
                        Módulo: {localizacaoAtual.modulo.nome}
                      </small>
                    )}

                    <p>{missaoExibida.assunto}</p>

                    {missaoExibida.adaptada && (
                      <small className="plano-adaptada-badge">⚡ Reforço adaptado automaticamente</small>
                    )}

                    {loteAgrupado && (
                      <small className="plano-modulo">
                        Lote do dia: {itensConcluidos}/{referencias.length} aulas concluídas
                      </small>
                    )}

                    <div className="plano-missao-acoes">
                      {urlAulaAtual && (
                        <button
                          type="button"
                          className="plano-aula"
                          onClick={() => abrirLink(urlAulaAtual)}
                        >
                          🎥 {loteAgrupado ? "Próxima aula" : "Aula RDC"}
                        </button>
                      )}

                      {missao.urlQuestoes && (
                        <button
                          type="button"
                          className="plano-questoes"
                          onClick={() => abrirLink(missao.urlQuestoes)}
                        >
                          📝 Questões
                        </button>
                      )}

                      <button
                        type="button"
                        className="plano-estudar"
                        onClick={() => iniciarEstudo(missaoExibida)}
                      >
                        ⏱ Estudar
                      </button>

                      {!loteAgrupado && (
                        <button
                          type="button"
                          className={concluida ? "plano-desmarcar" : "plano-concluir"}
                          onClick={() => alternarConclusao(missao.id)}
                        >
                          {concluida ? "↩ Desmarcar" : "✓ Concluir"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {diaSelecionado !== 7 && (dia.revisao ||
            dia.atividadeExtra) && (
            <div className="plano-extras">
              {dia.revisao && (
                <div>
                  <strong>
                    🔁 Revisão
                  </strong>

                  <span>
                    {dia.revisao}
                  </span>
                </div>
              )}

              {dia.atividadeExtra && (
                <div>
                  <strong>
                    📌 Atividade extra
                  </strong>

                  <span>
                    {
                      dia.atividadeExtra
                    }
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function normalizarTexto(
  texto: string
) {
  return texto
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

function formatarTipo(
  tipo: MissaoPlano["tipo"]
) {
  const nomes: Record<
    MissaoPlano["tipo"],
    string
  > = {
    conteudo: "Conteúdo",
    revisao: "Revisão",
    questoes: "Questões",
    redacao: "Redação",
    simulado: "Simulado",
    livre: "Livre",
  };

  return nomes[tipo];
}
