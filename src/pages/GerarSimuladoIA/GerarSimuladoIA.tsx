import { armazenamentoLocalDaConta as localStorage, armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import "./GerarSimuladoIA.css";

import { useApp } from "../../context/AppContext";

import {
  gerarQuestoesIA,
  type DificuldadeIA,
} from "../../services/gemini";

import {
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";

import {
  listarSemanasDoPlano,
  pegarAssuntosDaSemana,
} from "../../utils/conteudosSemana";

import {
  definirTipoSessaoQuestoesIAAtiva,
  registrarQuestoesAtuaisComoCaderno,
} from "../../services/cadernosSimuladosIAService";

import {
  salvarQuestoesGeradasNoCatalogo,
  selecionarDoCatalogoIA,
} from "../../services/catalogoQuestoesIAService";

import {
  embaralhar,
  type PreferenciaReusoIA,
} from "../../services/catalogoQuestoesIAUtils";

import {
  calcularTotalQuestoesMultiAssunto,
  consolidarBlocosMultiAssunto,
  LIMITE_QUESTOES_SESSAO,
  validarGeracaoMultiAssunto,
} from "../../utils/geracaoMultiAssunto";

import type {
  QuestaoIA,
} from "../../types/index";

type OrigemGeracao =
  | "assunto"
  | "semana";

type AssuntoSelecionavel = {
  chave: string;
  modulo: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
};

type PrefillPendente = {
  modulo?: string;
  assunto: string;
};

const CHAVE_QUESTOES_IA = "pmpe_questoes_ia";
const CHAVE_BANCO_IA = "pmpe_banco_questoes_ia";
const QUANTIDADES_DISPONIVEIS = [5, 10, 15, 20, 30, 40, 50, 60];

export default function GerarSimuladoIA() {
  const navigate = useNavigate();
  const { materias, configuracoes } = useApp();

  const [origem, setOrigem] = useState<OrigemGeracao>("assunto");
  const [materiaSelecionada, setMateriaSelecionada] = useState("");
  const [assuntosSelecionados, setAssuntosSelecionados] = useState<string[]>([]);
  const [assuntoPersonalizado, setAssuntoPersonalizado] = useState("");
  const [prefillPendente, setPrefillPendente] = useState<PrefillPendente | null>(null);
  const [semanaSelecionada, setSemanaSelecionada] = useState(1);
  const [banca, setBanca] = useState("AOCP");
  const [dificuldade, setDificuldade] = useState<DificuldadeIA>("Mista");
  const [quantidade, setQuantidade] = useState(5);
  const [salvarNoBanco, setSalvarNoBanco] = useState(true);
  const [preferenciaReuso, setPreferenciaReuso] =
    useState<PreferenciaReusoIA>("nao_respondidas");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [questoesGeradas, setQuestoesGeradas] = useState<QuestaoIA[]>([]);

  useEffect(() => {
    const modoSolicitado = sessionStorage.getItem("pmpe:gerar-ia:modo");
    if (modoSolicitado === "simulado") setOrigem("semana");
    if (modoSolicitado === "questoes") setOrigem("assunto");
    sessionStorage.removeItem("pmpe:gerar-ia:modo");

    const salvo = sessionStorage.getItem("pmpe:gerar-ia:prefill");
    if (!salvo) return;

    try {
      const prefill = JSON.parse(salvo) as {
        materia?: string;
        modulo?: string;
        assunto?: string;
      };

      setOrigem("assunto");
      if (prefill.materia) setMateriaSelecionada(prefill.materia);
      if (prefill.assunto) {
        setPrefillPendente({
          modulo: prefill.modulo,
          assunto: prefill.assunto,
        });
      }
    } finally {
      sessionStorage.removeItem("pmpe:gerar-ia:prefill");
    }
  }, []);

  const semanas = useMemo(
    () => listarSemanasDoPlano(),
    []
  );

  const materiaAtual = useMemo(
    () =>
      materias.find(
        (materia) => materia.nome === materiaSelecionada
      ),
    [materias, materiaSelecionada]
  );

  const modulosDisponiveis = useMemo(
    () =>
      materiaAtual
        ? listarModulosDaMateria(materiaAtual)
        : [],
    [materiaAtual]
  );

  const opcoesAssuntos = useMemo<AssuntoSelecionavel[]>(
    () =>
      modulosDisponiveis.flatMap((modulo) =>
        modulo.assuntos.map((assunto) => ({
          chave: `${modulo.id}::${assunto.id}`,
          modulo: modulo.nome,
          moduloId: modulo.id,
          assunto: assunto.nome,
          assuntoId: assunto.id,
        }))
      ),
    [modulosDisponiveis]
  );

  useEffect(() => {
    if (!prefillPendente || opcoesAssuntos.length === 0) return;

    const correspondencia =
      opcoesAssuntos.find(
        (item) =>
          normalizarTexto(item.assunto) ===
            normalizarTexto(prefillPendente.assunto) &&
          (!prefillPendente.modulo ||
            normalizarTexto(item.modulo) ===
              normalizarTexto(prefillPendente.modulo))
      ) ??
      opcoesAssuntos.find(
        (item) =>
          normalizarTexto(item.assunto) ===
          normalizarTexto(prefillPendente.assunto)
      );

    if (correspondencia) {
      setAssuntosSelecionados([correspondencia.chave]);
      setAssuntoPersonalizado("");
    } else {
      setAssuntoPersonalizado(prefillPendente.assunto);
    }

    setPrefillPendente(null);
  }, [opcoesAssuntos, prefillPendente]);

  const assuntosParaGerar = useMemo<AssuntoSelecionavel[]>(() => {
    const chaves = new Set(assuntosSelecionados);
    const selecionados = opcoesAssuntos.filter((item) => chaves.has(item.chave));
    const livre = assuntoPersonalizado.trim();

    if (
      livre &&
      !selecionados.some(
        (item) => normalizarTexto(item.assunto) === normalizarTexto(livre)
      )
    ) {
      selecionados.push({
        chave: `personalizado::${normalizarTexto(livre)}`,
        modulo: "Geral",
        assunto: livre,
      });
    }

    return selecionados;
  }, [assuntoPersonalizado, assuntosSelecionados, opcoesAssuntos]);

  const validacaoMultiAssunto = useMemo(
    () =>
      validarGeracaoMultiAssunto(
        assuntosParaGerar.length,
        quantidade
      ),
    [assuntosParaGerar.length, quantidade]
  );

  const quantidadeTotalPrevista =
    origem === "assunto"
      ? validacaoMultiAssunto.total
      : quantidade;

  const conteudosSemana = useMemo(
    () => pegarAssuntosDaSemana(semanaSelecionada),
    [semanaSelecionada]
  );

  const resumoPorMateria = useMemo(() => {
    const mapa = new Map<string, string[]>();

    conteudosSemana.forEach((conteudo) => {
      const assuntos = mapa.get(conteudo.materia) ?? [];
      if (!assuntos.includes(conteudo.assunto)) {
        assuntos.push(conteudo.assunto);
      }
      mapa.set(conteudo.materia, assuntos);
    });

    return Array.from(mapa.entries());
  }, [conteudosSemana]);

  function alterarOrigem(novaOrigem: OrigemGeracao) {
    if (gerando) return;
    setOrigem(novaOrigem);
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
  }

  function alterarMateria(novaMateria: string) {
    setMateriaSelecionada(novaMateria);
    setAssuntosSelecionados([]);
    setAssuntoPersonalizado("");
    setPrefillPendente(null);
    setErro("");
    setSucesso("");
  }

  function alternarAssunto(chave: string) {
    setAssuntosSelecionados((atuais) =>
      atuais.includes(chave)
        ? atuais.filter((item) => item !== chave)
        : [...atuais, chave]
    );
    setErro("");
    setSucesso("");
  }

  function selecionarTodosAssuntos() {
    const totalSeSelecionarTodos = calcularTotalQuestoesMultiAssunto(
      opcoesAssuntos.length + (assuntoPersonalizado.trim() ? 1 : 0),
      quantidade
    );

    if (totalSeSelecionarTodos > LIMITE_QUESTOES_SESSAO) {
      setErro(
        `Selecionar todos criaria ${totalSeSelecionarTodos} questões. O limite da sessão é ${LIMITE_QUESTOES_SESSAO}.`
      );
      return;
    }

    setAssuntosSelecionados(opcoesAssuntos.map((item) => item.chave));
    setErro("");
  }

  async function gerarBlocoAssunto(
    item: AssuntoSelecionavel
  ): Promise<{
    questoes: QuestaoIA[];
    reutilizadas: number;
    novas: number;
  }> {
    const concursoAlvo = configuracoes.concurso || "PMPE";

    const selecaoCatalogo = await selecionarDoCatalogoIA({
      materia: materiaSelecionada,
      materiaId: materiaAtual?.id,
      modulo: item.modulo,
      moduloId: item.moduloId,
      assunto: item.assunto,
      assuntoId: item.assuntoId,
      banca: banca.trim(),
      dificuldade,
      quantidade,
      preferencia: preferenciaReuso,
      concursoAlvo,
    });

    let novasQuestoes: QuestaoIA[] = [];

    if (selecaoCatalogo.quantidadeGerar > 0) {
      const resposta = await gerarQuestoesIA({
        origem: "assunto",
        materia: materiaSelecionada,
        modulo: item.modulo,
        moduloId: item.moduloId,
        assunto: item.assunto,
        banca: banca.trim(),
        dificuldade,
        quantidade: selecaoCatalogo.quantidadeGerar,
        enunciadosEvitar: selecaoCatalogo.reutilizadas.map(
          (questao) => questao.enunciado
        ),
      });

      novasQuestoes = resposta.questoes;
    }

    if (salvarNoBanco && novasQuestoes.length > 0) {
      novasQuestoes = await salvarQuestoesGeradasNoCatalogo(
        novasQuestoes,
        {
          concursoAlvo,
          editalAlvo: concursoAlvo,
          materiaId: materiaAtual?.id,
          assuntoId: item.assuntoId,
        }
      );
    }

    const questoes = [
      ...selecaoCatalogo.reutilizadas,
      ...novasQuestoes,
    ]
      .slice(0, quantidade)
      .map((questao) => ({
        ...questao,
        materia: materiaSelecionada,
        materiaId: materiaAtual?.id ?? questao.materiaId,
        modulo: item.modulo,
        moduloId: item.moduloId ?? questao.moduloId,
        assunto: item.assunto,
        assuntoId: item.assuntoId ?? questao.assuntoId,
      }));

    if (questoes.length !== quantidade) {
      throw new Error(
        `O subassunto “${item.assunto}” ficou com ${questoes.length} questões, mas eram esperadas ${quantidade}. Tente gerar novamente.`
      );
    }

    return {
      questoes,
      reutilizadas: selecaoCatalogo.reutilizadas.length,
      novas: novasQuestoes.length,
    };
  }

  async function gerarSimulado() {
    setErro("");
    setSucesso("");

    if (origem === "assunto" && !materiaSelecionada.trim()) {
      setErro("Selecione uma matéria.");
      return;
    }

    if (origem === "assunto" && !validacaoMultiAssunto.valida) {
      setErro(validacaoMultiAssunto.mensagem);
      return;
    }

    if (origem === "semana" && conteudosSemana.length === 0) {
      setErro("A semana selecionada não possui conteúdos válidos.");
      return;
    }

    if (!banca.trim()) {
      setErro("Informe a banca.");
      return;
    }

    if (quantidade < 1 || quantidade > LIMITE_QUESTOES_SESSAO) {
      setErro(`A quantidade deve ficar entre 1 e ${LIMITE_QUESTOES_SESSAO}.`);
      return;
    }

    try {
      setGerando(true);
      setQuestoesGeradas([]);

      let questoesFinais: QuestaoIA[] = [];
      let totalReutilizadas = 0;
      let totalNovas = 0;

      if (origem === "assunto") {
        const blocos: QuestaoIA[][] = [];

        for (const item of assuntosParaGerar) {
          const bloco = await gerarBlocoAssunto(item);
          blocos.push(bloco.questoes);
          totalReutilizadas += bloco.reutilizadas;
          totalNovas += bloco.novas;
        }

        questoesFinais = embaralhar(
          consolidarBlocosMultiAssunto(blocos, quantidade)
        );
      } else {
        const resposta = await gerarQuestoesIA({
          origem: "semana",
          semana: semanaSelecionada,
          conteudosSemana,
          banca: banca.trim(),
          dificuldade,
          quantidade,
        });

        let novasQuestoes = resposta.questoes;

        if (salvarNoBanco && novasQuestoes.length > 0) {
          const concursoAlvo = configuracoes.concurso || "PMPE";
          novasQuestoes = await salvarQuestoesGeradasNoCatalogo(
            novasQuestoes,
            {
              concursoAlvo,
              editalAlvo: concursoAlvo,
            }
          );
        }

        totalNovas = novasQuestoes.length;
        questoesFinais = embaralhar(novasQuestoes).slice(0, quantidade);
      }

      localStorage.setItem(
        CHAVE_QUESTOES_IA,
        JSON.stringify(questoesFinais)
      );

      if (salvarNoBanco) {
        salvarQuestoesNoBanco(questoesFinais);
      }

      const tipoSessao = origem === "assunto" ? "questoes" : "simulado";
      definirTipoSessaoQuestoesIAAtiva(tipoSessao);
      await registrarQuestoesAtuaisComoCaderno(tipoSessao);

      setQuestoesGeradas(questoesFinais);

      setSucesso(
        origem === "assunto"
          ? `${questoesFinais.length} questões prontas em ${assuntosParaGerar.length} subassunto(s): ${totalReutilizadas} reutilizadas do banco e ${totalNovas} novas geradas por IA.`
          : `${questoesFinais.length} questões prontas para o simulado da semana.`
      );

      window.dispatchEvent(
        new Event("pmpe-questoes-ia-atualizadas")
      );
    } catch (erroGeracao) {
      const mensagem =
        erroGeracao instanceof Error
          ? erroGeracao.message
          : "Erro desconhecido ao gerar questões.";

      console.error("Erro ao gerar questões:", erroGeracao);
      setErro(mensagem);
    } finally {
      setGerando(false);
    }
  }

  function resolverAgora() {
    if (questoesGeradas.length === 0) {
      setErro("Gere as questões antes de abrir a sessão.");
      return;
    }

    navigate("/resolver-simulado-ia");
  }

  function limparFormulario() {
    if (gerando) return;

    setOrigem("assunto");
    setMateriaSelecionada("");
    setAssuntosSelecionados([]);
    setAssuntoPersonalizado("");
    setPrefillPendente(null);
    setSemanaSelecionada(1);
    setBanca("AOCP");
    setDificuldade("Mista");
    setQuantidade(5);
    setSalvarNoBanco(true);
    setPreferenciaReuso("nao_respondidas");
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
  }

  const todosSelecionados =
    opcoesAssuntos.length > 0 &&
    opcoesAssuntos.every((item) => assuntosSelecionados.includes(item.chave));

  return (
    <section className="gerar-ia-container">
      <div className="gerar-ia-cabecalho">
        <div>
          <h1>🤖 Questões e Simulados IA</h1>
          <p>
            Pratique um ou vários subassuntos da mesma matéria ou monte um
            simulado com os conteúdos da semana.
          </p>
        </div>

        <div className="gerar-ia-status">
          <span>Banco disponível</span>
          <strong>{carregarBancoIA().length} questões</strong>
        </div>
      </div>

      {erro && (
        <div className="gerar-ia-mensagem gerar-ia-erro" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="gerar-ia-mensagem gerar-ia-sucesso" role="status">
          {sucesso}
        </div>
      )}

      <div className="gerar-ia-card">
        <div className="gerar-ia-origem">
          <h2>Modo de treino</h2>
          <div>
            <button
              type="button"
              className={origem === "assunto" ? "ativo" : ""}
              onClick={() => alterarOrigem("assunto")}
              disabled={gerando}
            >
              📝 Questões por assunto
            </button>

            <button
              type="button"
              className={origem === "semana" ? "ativo" : ""}
              onClick={() => alterarOrigem("semana")}
              disabled={gerando}
            >
              🎯 Simulado da semana
            </button>
          </div>
        </div>

        {origem === "assunto" ? (
          <>
            <div className="gerar-ia-form-grid gerar-ia-materia-grid">
              <div className="gerar-ia-campo">
                <label htmlFor="gerar-ia-materia">Matéria</label>
                <select
                  id="gerar-ia-materia"
                  value={materiaSelecionada}
                  onChange={(evento) => alterarMateria(evento.target.value)}
                  disabled={gerando}
                >
                  <option value="">Selecione a matéria</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.nome}>
                      {materia.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gerar-ia-campo">
                <label>Seleção atual</label>
                <div className="gerar-ia-contador">
                  <strong>{assuntosParaGerar.length}</strong>
                  <span>
                    subassunto{assuntosParaGerar.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            <section className="gerar-ia-multiassunto" aria-label="Seleção de subassuntos">
              <div className="gerar-ia-multiassunto-topo">
                <div>
                  <h2>Subassuntos</h2>
                  <p>
                    Marque um ou mais tópicos da mesma matéria. Eles podem estar
                    em módulos diferentes.
                  </p>
                </div>

                {materiaSelecionada && opcoesAssuntos.length > 0 && (
                  <div className="gerar-ia-multiassunto-acoes">
                    <button
                      type="button"
                      onClick={selecionarTodosAssuntos}
                      disabled={gerando || todosSelecionados}
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssuntosSelecionados([])}
                      disabled={gerando || assuntosSelecionados.length === 0}
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </div>

              {!materiaSelecionada ? (
                <p className="gerar-ia-multiassunto-vazio">
                  Selecione uma matéria para ver os subassuntos disponíveis.
                </p>
              ) : opcoesAssuntos.length === 0 ? (
                <p className="gerar-ia-multiassunto-vazio">
                  Essa matéria ainda não possui subassuntos cadastrados.
                </p>
              ) : (
                <div className="gerar-ia-modulos-assuntos">
                  {modulosDisponiveis.map((modulo) => (
                    <article key={modulo.id}>
                      <strong>{modulo.nome}</strong>
                      <div className="gerar-ia-assuntos-grid">
                        {modulo.assuntos.map((assunto) => {
                          const chave = `${modulo.id}::${assunto.id}`;
                          const marcado = assuntosSelecionados.includes(chave);

                          return (
                            <label
                              key={chave}
                              className={
                                marcado
                                  ? "gerar-ia-assunto-chip selecionado"
                                  : "gerar-ia-assunto-chip"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternarAssunto(chave)}
                                disabled={gerando}
                              />
                              <span>{assunto.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="gerar-ia-campo gerar-ia-assunto-personalizado">
                <label htmlFor="gerar-ia-assunto-livre">
                  Outro subassunto (opcional)
                </label>
                <input
                  id="gerar-ia-assunto-livre"
                  value={assuntoPersonalizado}
                  onChange={(evento) => setAssuntoPersonalizado(evento.target.value)}
                  disabled={gerando || !materiaSelecionada}
                  placeholder="Digite um tópico que ainda não está cadastrado"
                />
              </div>

              {assuntosParaGerar.length > 0 && (
                <div
                  className={
                    validacaoMultiAssunto.valida
                      ? "gerar-ia-resumo-multi"
                      : "gerar-ia-resumo-multi invalido"
                  }
                  role="status"
                >
                  <strong>
                    {assuntosParaGerar.length} subassunto(s) × {quantidade} questões
                  </strong>
                  <span>{validacaoMultiAssunto.total} questões no total</span>
                  {!validacaoMultiAssunto.valida && (
                    <small>{validacaoMultiAssunto.mensagem}</small>
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="gerar-ia-form-grid">
              <div className="gerar-ia-campo">
                <label htmlFor="gerar-ia-semana">Semana</label>
                <select
                  id="gerar-ia-semana"
                  value={semanaSelecionada}
                  onChange={(evento) =>
                    setSemanaSelecionada(Number(evento.target.value))
                  }
                  disabled={gerando}
                >
                  {semanas.map((semana) => (
                    <option key={semana.numero} value={semana.numero}>
                      {semana.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gerar-ia-campo">
                <label>Conteúdos encontrados</label>
                <div className="gerar-ia-contador">
                  <strong>{conteudosSemana.length}</strong>
                  <span>
                    conteúdo{conteudosSemana.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            <div className="gerar-ia-conteudos-semana">
              <h2>Conteúdos da Semana {semanaSelecionada}</h2>
              {resumoPorMateria.length === 0 ? (
                <p>Nenhum conteúdo válido foi encontrado.</p>
              ) : (
                <div>
                  {resumoPorMateria.map(([materia, assuntos]) => (
                    <article key={materia}>
                      <strong>{materia}</strong>
                      <ul>
                        {assuntos.map((assunto) => (
                          <li key={assunto}>{assunto}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="gerar-ia-form-grid gerar-ia-opcoes">
          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-banca">Banca</label>
            <input
              id="gerar-ia-banca"
              value={banca}
              onChange={(evento) => setBanca(evento.target.value)}
              disabled={gerando}
              placeholder="Ex.: AOCP"
            />
          </div>

          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-dificuldade">Dificuldade</label>
            <select
              id="gerar-ia-dificuldade"
              value={dificuldade}
              onChange={(evento) =>
                setDificuldade(evento.target.value as DificuldadeIA)
              }
              disabled={gerando}
            >
              <option value="Fácil">Fácil</option>
              <option value="Média">Média</option>
              <option value="Difícil">Difícil</option>
              <option value="Mista">Mista</option>
            </select>
          </div>

          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-quantidade">
              {origem === "assunto"
                ? "Questões por subassunto"
                : "Quantidade total"}
            </label>
            <select
              id="gerar-ia-quantidade"
              value={quantidade}
              onChange={(evento) => setQuantidade(Number(evento.target.value))}
              disabled={gerando}
            >
              {QUANTIDADES_DISPONIVEIS.map((valor) => {
                const total = calcularTotalQuestoesMultiAssunto(
                  assuntosParaGerar.length,
                  valor
                );
                const excede =
                  origem === "assunto" &&
                  assuntosParaGerar.length > 0 &&
                  total > LIMITE_QUESTOES_SESSAO;

                return (
                  <option key={valor} value={valor} disabled={excede}>
                    {valor} {origem === "assunto" ? "por subassunto" : "questões"}
                    {excede ? ` — ${total} no total` : ""}
                  </option>
                );
              })}
            </select>
            {origem === "assunto" && assuntosParaGerar.length > 0 && (
              <small className="gerar-ia-ajuda-campo">
                Total atual: {quantidadeTotalPrevista} de {LIMITE_QUESTOES_SESSAO}
              </small>
            )}
          </div>

          <div className="gerar-ia-campo">
            <label htmlFor="gerar-ia-reuso">Seleção do banco</label>
            <select
              id="gerar-ia-reuso"
              value={preferenciaReuso}
              onChange={(evento) =>
                setPreferenciaReuso(evento.target.value as PreferenciaReusoIA)
              }
              disabled={gerando || origem === "semana"}
            >
              <option value="nao_respondidas">Somente não respondidas</option>
              <option value="misturar">Misturar com já respondidas</option>
            </select>
          </div>
        </div>

        <label className="gerar-ia-checkbox">
          <input
            type="checkbox"
            checked={salvarNoBanco}
            onChange={(evento) => setSalvarNoBanco(evento.target.checked)}
            disabled={gerando}
          />
          <span>Salvar automaticamente no banco compartilhado de questões IA</span>
        </label>

        {gerando && (
          <div className="gerar-ia-carregando">
            <div className="gerar-ia-spinner" />
            <div>
              <strong>Gerando {quantidadeTotalPrevista} questões...</strong>
              <span>
                {origem === "assunto"
                  ? "Os subassuntos são montados separadamente e misturados no final."
                  : "Não feche a página."}
              </span>
            </div>
          </div>
        )}

        <div className="gerar-ia-acoes">
          <button
            type="button"
            className="gerar-ia-limpar"
            onClick={limparFormulario}
            disabled={gerando}
          >
            Limpar
          </button>

          <button
            type="button"
            className="gerar-ia-gerar"
            onClick={gerarSimulado}
            disabled={
              gerando ||
              (origem === "assunto" && !validacaoMultiAssunto.valida)
            }
          >
            {gerando
              ? "Gerando..."
              : origem === "assunto"
                ? `✨ Gerar ${quantidadeTotalPrevista || ""} questões`.trim()
                : "✨ Gerar simulado"}
          </button>
        </div>
      </div>

      {questoesGeradas.length > 0 && (
        <div className="gerar-ia-resultado">
          <div>
            <h2>{origem === "assunto" ? "Questões prontas" : "Simulado pronto"}</h2>
            <p>{questoesGeradas.length} questões foram salvas.</p>
          </div>
          <button type="button" onClick={resolverAgora}>
            Resolver agora →
          </button>
        </div>
      )}
    </section>
  );
}

function carregarBancoIA(): QuestaoIA[] {
  const salvo = localStorage.getItem(CHAVE_BANCO_IA);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as QuestaoIA[]) : [];
  } catch {
    return [];
  }
}

function salvarQuestoesNoBanco(novasQuestoes: QuestaoIA[]) {
  const atuais = carregarBancoIA();
  const mapa = new Map<string, QuestaoIA>();

  atuais.forEach((questao) => {
    mapa.set(gerarChaveQuestao(questao), questao);
  });

  novasQuestoes.forEach((questao) => {
    const chave = gerarChaveQuestao(questao);
    if (!mapa.has(chave)) mapa.set(chave, questao);
  });

  localStorage.setItem(
    CHAVE_BANCO_IA,
    JSON.stringify(Array.from(mapa.values()))
  );
}

function gerarChaveQuestao(questao: QuestaoIA) {
  return normalizarTexto(
    [questao.materia, questao.assunto, questao.enunciado].join("::")
  );
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
