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

import type {
  QuestaoIA,
} from "../../types/index";

type OrigemGeracao =
  | "assunto"
  | "semana";

const CHAVE_QUESTOES_IA =
  "pmpe_questoes_ia";

const CHAVE_BANCO_IA =
  "pmpe_banco_questoes_ia";

export default function GerarSimuladoIA() {
  const navigate = useNavigate();

  const { materias, configuracoes } = useApp();

  const [
    origem,
    setOrigem,
  ] =
    useState<OrigemGeracao>(
      "assunto"
    );

  const [
    materiaSelecionada,
    setMateriaSelecionada,
  ] = useState("");

  const [
    moduloSelecionado,
    setModuloSelecionado,
  ] = useState("");

  const [
    assuntoSelecionado,
    setAssuntoSelecionado,
  ] = useState("");

  const [
    semanaSelecionada,
    setSemanaSelecionada,
  ] = useState(1);

  const [banca, setBanca] =
    useState("AOCP");

  const [
    dificuldade,
    setDificuldade,
  ] =
    useState<DificuldadeIA>(
      "Mista"
    );

  const [
    quantidade,
    setQuantidade,
  ] = useState(5);

  const [
    salvarNoBanco,
    setSalvarNoBanco,
  ] = useState(true);

  const [
    preferenciaReuso,
    setPreferenciaReuso,
  ] = useState<PreferenciaReusoIA>(
    "nao_respondidas"
  );

  const [gerando, setGerando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState("");

  useEffect(() => {
    const modoSolicitado = sessionStorage.getItem("pmpe:gerar-ia:modo");
    if (modoSolicitado === "simulado") setOrigem("semana");
    if (modoSolicitado === "questoes") setOrigem("assunto");
    sessionStorage.removeItem("pmpe:gerar-ia:modo");

    const salvo = sessionStorage.getItem("pmpe:gerar-ia:prefill");
    if (!salvo) return;
    try {
      const prefill = JSON.parse(salvo) as { materia?: string; modulo?: string; assunto?: string };
      setOrigem("assunto");
      if (prefill.materia) setMateriaSelecionada(prefill.materia);
      if (prefill.modulo) setModuloSelecionado(prefill.modulo);
      if (prefill.assunto) setAssuntoSelecionado(prefill.assunto);
    } finally {
      sessionStorage.removeItem("pmpe:gerar-ia:prefill");
    }
  }, []);

  const [
    questoesGeradas,
    setQuestoesGeradas,
  ] = useState<QuestaoIA[]>([]);

  const semanas =
    useMemo(
      () =>
        listarSemanasDoPlano(),
      []
    );

  const materiaAtual =
    useMemo(
      () =>
        materias.find(
          (materia) =>
            materia.nome ===
            materiaSelecionada
        ),
      [
        materias,
        materiaSelecionada,
      ]
    );

  const modulosDisponiveis =
    materiaAtual
      ? listarModulosDaMateria(
          materiaAtual
        )
      : [];

  const moduloAtual =
    modulosDisponiveis.find(
      (modulo) =>
        modulo.nome ===
        moduloSelecionado
    );

  const assuntosDisponiveis =
    moduloAtual?.assuntos ?? [];

  const assuntoAtual =
    assuntosDisponiveis.find(
      (assunto) =>
        assunto.nome ===
        assuntoSelecionado
    );

  const conteudosSemana =
    useMemo(
      () =>
        pegarAssuntosDaSemana(
          semanaSelecionada
        ),
      [semanaSelecionada]
    );

  const resumoPorMateria =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          string[]
        >();

      conteudosSemana.forEach(
        (conteudo) => {
          const assuntos =
            mapa.get(
              conteudo.materia
            ) ?? [];

          if (
            !assuntos.includes(
              conteudo.assunto
            )
          ) {
            assuntos.push(
              conteudo.assunto
            );
          }

          mapa.set(
            conteudo.materia,
            assuntos
          );
        }
      );

      return Array.from(
        mapa.entries()
      );
    }, [conteudosSemana]);

  function alterarOrigem(
    novaOrigem: OrigemGeracao
  ) {
    if (gerando) {
      return;
    }

    setOrigem(novaOrigem);
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
  }

  function alterarMateria(
    novaMateria: string
  ) {
    setMateriaSelecionada(
      novaMateria
    );

    setModuloSelecionado("");
    setAssuntoSelecionado("");
    setErro("");
    setSucesso("");
  }

  async function gerarSimulado() {
    setErro("");
    setSucesso("");

    if (
      origem === "assunto" &&
      !materiaSelecionada.trim()
    ) {
      setErro(
        "Selecione uma matéria."
      );

      return;
    }

    if (
      origem === "assunto" &&
      !moduloSelecionado.trim()
    ) {
      setErro(
        "Selecione um módulo."
      );

      return;
    }

    if (
      origem === "assunto" &&
      !assuntoSelecionado.trim()
    ) {
      setErro(
        "Selecione ou informe um assunto."
      );

      return;
    }

    if (
      origem === "semana" &&
      conteudosSemana.length === 0
    ) {
      setErro(
        "A semana selecionada não possui conteúdos válidos."
      );

      return;
    }

    if (!banca.trim()) {
      setErro(
        "Informe a banca."
      );

      return;
    }

    if (
      quantidade < 1 ||
      quantidade > 60
    ) {
      setErro(
        "A quantidade deve ficar entre 1 e 60."
      );

      return;
    }

    try {
      setGerando(true);
      setQuestoesGeradas([]);

      const parametrosGeracao = {
        origem,
        materia:
          origem === "assunto"
            ? materiaSelecionada
            : undefined,
        modulo:
          origem === "assunto"
            ? moduloSelecionado
            : undefined,
        moduloId:
          origem === "assunto"
            ? moduloAtual?.id
            : undefined,
        assunto:
          origem === "assunto"
            ? assuntoSelecionado
            : undefined,
        semana:
          origem === "semana"
            ? semanaSelecionada
            : undefined,
        conteudosSemana:
          origem === "semana"
            ? conteudosSemana
            : undefined,
        banca: banca.trim(),
        dificuldade,
        quantidade,
      };

      const selecaoCatalogo =
        origem === "assunto"
          ? await selecionarDoCatalogoIA({
              materia: materiaSelecionada,
              materiaId: materiaAtual?.id,
              modulo: moduloSelecionado,
              moduloId: moduloAtual?.id,
              assunto: assuntoSelecionado,
              assuntoId: assuntoAtual?.id,
              banca: banca.trim(),
              dificuldade,
              quantidade,
              preferencia: preferenciaReuso,
            })
          : {
              reutilizadas: [] as QuestaoIA[],
              quantidadeGerar: quantidade,
            };

      let novasQuestoes: QuestaoIA[] = [];

      if (
        selecaoCatalogo.quantidadeGerar > 0
      ) {
        const resposta =
          await gerarQuestoesIA({
            ...parametrosGeracao,
            quantidade:
              selecaoCatalogo.quantidadeGerar,
            enunciadosEvitar:
              selecaoCatalogo.reutilizadas.map(
                (questao) =>
                  questao.enunciado
              ),
          });

        novasQuestoes =
          resposta.questoes;
      }

      if (
        salvarNoBanco &&
        novasQuestoes.length > 0
      ) {
        novasQuestoes =
          await salvarQuestoesGeradasNoCatalogo(
            novasQuestoes,
            {
              concursoAlvo:
                configuracoes.concurso ||
                "Geral",
              editalAlvo:
                configuracoes.concurso ||
                "Geral",
              materiaId:
                materiaAtual?.id,
              assuntoId:
                assuntoAtual?.id,
            }
          );
      }

      const tipoSessao =
        origem === "assunto" ? "questoes" : "simulado";

      const questoesFinais =
        embaralhar([
          ...selecaoCatalogo.reutilizadas,
          ...novasQuestoes,
        ])
          .slice(0, quantidade)
          .map((questao) => ({
            ...questao,
            materiaId:
              origem === "assunto"
                ? materiaAtual?.id ?? questao.materiaId
                : questao.materiaId,
            moduloId:
              origem === "assunto"
                ? moduloAtual?.id ?? questao.moduloId
                : questao.moduloId,
            assuntoId:
              origem === "assunto"
                ? assuntoAtual?.id ?? questao.assuntoId
                : questao.assuntoId,
          }));

      localStorage.setItem(
        CHAVE_QUESTOES_IA,
        JSON.stringify(
          questoesFinais
        )
      );

      if (salvarNoBanco) {
        salvarQuestoesNoBanco(
          questoesFinais
        );
      }

      definirTipoSessaoQuestoesIAAtiva(tipoSessao);
      await registrarQuestoesAtuaisComoCaderno(tipoSessao);

      setQuestoesGeradas(
        questoesFinais
      );

      setSucesso(
        `${questoesFinais.length} questões prontas: ${selecaoCatalogo.reutilizadas.length} reutilizadas do banco e ${novasQuestoes.length} novas geradas por IA.`
      );

      window.dispatchEvent(
        new Event(
          "pmpe-questoes-ia-atualizadas"
        )
      );
    } catch (erroGeracao) {
      const mensagem =
        erroGeracao instanceof Error
          ? erroGeracao.message
          : "Erro desconhecido ao gerar questões.";

      console.error(
        "Erro ao gerar simulado:",
        erroGeracao
      );

      setErro(mensagem);
    } finally {
      setGerando(false);
    }
  }

  function resolverAgora() {
    if (
      questoesGeradas.length === 0
    ) {
      setErro(
        "Gere as questões antes de abrir o simulado."
      );

      return;
    }

    navigate(
      "/resolver-simulado-ia"
    );
  }

  function limparFormulario() {
    if (gerando) {
      return;
    }

    setOrigem("assunto");
    setMateriaSelecionada("");
    setModuloSelecionado("");
    setAssuntoSelecionado("");
    setSemanaSelecionada(1);
    setBanca("AOCP");
    setDificuldade("Mista");
    setQuantidade(5);
    setSalvarNoBanco(true);
    setPreferenciaReuso(
      "nao_respondidas"
    );
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
  }

  return (
    <section className="gerar-ia-container">
      <div className="gerar-ia-cabecalho">
        <div>
          <h1>
            🤖 Questões e Simulados IA
          </h1>

          <p>
            Pratique um assunto específico
            ou monte um simulado com os
            conteúdos da semana.
          </p>
        </div>

        <div className="gerar-ia-status">
          <span>
            Banco disponível
          </span>

          <strong>
            {
              carregarBancoIA()
                .length
            }{" "}
            questões
          </strong>
        </div>
      </div>

      {erro && (
        <div className="gerar-ia-mensagem gerar-ia-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="gerar-ia-mensagem gerar-ia-sucesso">
          {sucesso}
        </div>
      )}

      <div className="gerar-ia-card">
        <div className="gerar-ia-origem">
          <h2>
            Modo de treino
          </h2>

          <div>
            <button
              type="button"
              className={
                origem === "assunto"
                  ? "ativo"
                  : ""
              }
              onClick={() =>
                alterarOrigem(
                  "assunto"
                )
              }
              disabled={gerando}
            >
              📝 Questões por assunto
            </button>

            <button
              type="button"
              className={
                origem === "semana"
                  ? "ativo"
                  : ""
              }
              onClick={() =>
                alterarOrigem(
                  "semana"
                )
              }
              disabled={gerando}
            >
              🎯 Simulado da semana
            </button>
          </div>
        </div>

        {origem === "assunto" ? (
          <div className="gerar-ia-form-grid">
            <div className="gerar-ia-campo">
              <label>
                Matéria
              </label>

              <select
                value={
                  materiaSelecionada
                }
                onChange={(evento) =>
                  alterarMateria(
                    evento.target
                      .value
                  )
                }
                disabled={gerando}
              >
                <option value="">
                  Selecione a matéria
                </option>

                {materias.map(
                  (materia) => (
                    <option
                      key={materia.id}
                      value={
                        materia.nome
                      }
                    >
                      {
                        materia.nome
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="gerar-ia-campo">
              <label>
                Módulo
              </label>

              <select
                value={
                  moduloSelecionado
                }
                onChange={(evento) => {
                  setModuloSelecionado(
                    evento.target.value
                  );
                  setAssuntoSelecionado("");
                }}
                disabled={
                  gerando ||
                  !materiaSelecionada
                }
              >
                <option value="">
                  {materiaSelecionada
                    ? "Selecione o módulo"
                    : "Selecione primeiro a matéria"}
                </option>

                {modulosDisponiveis.map(
                  (modulo) => (
                    <option
                      key={modulo.id}
                      value={modulo.nome}
                    >
                      {modulo.nome}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="gerar-ia-campo">
              <label>
                Assunto
              </label>

              <select
                value={
                  assuntosDisponiveis.some(
                    (assunto) =>
                      assunto.nome ===
                      assuntoSelecionado
                  )
                    ? assuntoSelecionado
                    : ""
                }
                onChange={(evento) =>
                  setAssuntoSelecionado(
                    evento.target
                      .value
                  )
                }
                disabled={
                  gerando ||
                  !moduloSelecionado
                }
              >
                <option value="">
                  {moduloSelecionado
                    ? "Selecione o assunto"
                    : "Selecione primeiro o módulo"}
                </option>

                {assuntosDisponiveis.map(
                  (assunto) => (
                    <option
                      key={assunto.id}
                      value={
                        assunto.nome
                      }
                    >
                      {
                        assunto.nome
                      }
                    </option>
                  )
                )}
              </select>

              <input
                value={
                  assuntoSelecionado
                }
                onChange={(evento) =>
                  setAssuntoSelecionado(
                    evento.target
                      .value
                  )
                }
                disabled={gerando}
                placeholder="Ou digite um assunto"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="gerar-ia-form-grid">
              <div className="gerar-ia-campo">
                <label>
                  Semana
                </label>

                <select
                  value={
                    semanaSelecionada
                  }
                  onChange={(evento) =>
                    setSemanaSelecionada(
                      Number(
                        evento.target
                          .value
                      )
                    )
                  }
                  disabled={gerando}
                >
                  {semanas.map(
                    (semana) => (
                      <option
                        key={
                          semana.numero
                        }
                        value={
                          semana.numero
                        }
                      >
                        {semana.nome}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="gerar-ia-campo">
                <label>
                  Conteúdos encontrados
                </label>

                <div className="gerar-ia-contador">
                  <strong>
                    {
                      conteudosSemana.length
                    }
                  </strong>

                  <span>
                    matéria
                    {conteudosSemana.length ===
                    1
                      ? "/assunto"
                      : "s/assuntos"}
                  </span>
                </div>
              </div>
            </div>

            <div className="gerar-ia-conteudos-semana">
              <h2>
                Conteúdos da Semana{" "}
                {semanaSelecionada}
              </h2>

              {resumoPorMateria.length ===
              0 ? (
                <p>
                  Nenhum conteúdo válido
                  foi encontrado.
                </p>
              ) : (
                <div>
                  {resumoPorMateria.map(
                    ([
                      materia,
                      assuntos,
                    ]) => (
                      <article
                        key={
                          materia
                        }
                      >
                        <strong>
                          {materia}
                        </strong>

                        <ul>
                          {assuntos.map(
                            (assunto) => (
                              <li
                                key={
                                  assunto
                                }
                              >
                                {assunto}
                              </li>
                            )
                          )}
                        </ul>
                      </article>
                    )
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="gerar-ia-form-grid gerar-ia-opcoes">
          <div className="gerar-ia-campo">
            <label>
              Banca
            </label>

            <input
              value={banca}
              onChange={(evento) =>
                setBanca(
                  evento.target.value
                )
              }
              disabled={gerando}
              placeholder="Ex.: AOCP"
            />
          </div>

          <div className="gerar-ia-campo">
            <label>
              Dificuldade
            </label>

            <select
              value={dificuldade}
              onChange={(evento) =>
                setDificuldade(
                  evento.target
                    .value as DificuldadeIA
                )
              }
              disabled={gerando}
            >
              <option value="Fácil">
                Fácil
              </option>

              <option value="Média">
                Média
              </option>

              <option value="Difícil">
                Difícil
              </option>

              <option value="Mista">
                Mista
              </option>
            </select>
          </div>

          <div className="gerar-ia-campo">
            <label>
              Quantidade
            </label>

            <select
              value={quantidade}
              onChange={(evento) =>
                setQuantidade(
                  Number(
                    evento.target
                      .value
                  )
                )
              }
              disabled={gerando}
            >
              {[5, 10, 20, 30, 40, 50, 60].map(
                (valor) => (
                  <option
                    key={valor}
                    value={valor}
                  >
                    {valor} questões
                  </option>
                )
              )}
            </select>
          </div>

          <div className="gerar-ia-campo">
            <label>
              Seleção do banco
            </label>

            <select
              value={preferenciaReuso}
              onChange={(evento) =>
                setPreferenciaReuso(
                  evento.target.value as PreferenciaReusoIA
                )
              }
              disabled={
                gerando ||
                origem === "semana"
              }
            >
              <option value="nao_respondidas">
                Somente não respondidas
              </option>
              <option value="misturar">
                Misturar com já respondidas
              </option>
            </select>
          </div>
        </div>

        <label className="gerar-ia-checkbox">
          <input
            type="checkbox"
            checked={salvarNoBanco}
            onChange={(evento) =>
              setSalvarNoBanco(
                evento.target
                  .checked
              )
            }
            disabled={gerando}
          />

          <span>
            Salvar automaticamente
            no banco compartilhado de questões IA
          </span>
        </label>

        {gerando && (
          <div className="gerar-ia-carregando">
            <div className="gerar-ia-spinner" />

            <div>
              <strong>
                Gerando questões...
              </strong>

              <span>
                Não feche a página.
              </span>
            </div>
          </div>
        )}

        <div className="gerar-ia-acoes">
          <button
            type="button"
            className="gerar-ia-limpar"
            onClick={
              limparFormulario
            }
            disabled={gerando}
          >
            Limpar
          </button>

          <button
            type="button"
            className="gerar-ia-gerar"
            onClick={
              gerarSimulado
            }
            disabled={gerando}
          >
            {gerando
              ? "Gerando..."
              : origem === "assunto"
                ? "✨ Gerar questões"
                : "✨ Gerar simulado"}
          </button>
        </div>
      </div>

      {questoesGeradas.length >
        0 && (
        <div className="gerar-ia-resultado">
          <div>
            <h2>
              {origem === "assunto"
                ? "Questões prontas"
                : "Simulado pronto"}
            </h2>

            <p>
              {
                questoesGeradas.length
              }{" "}
              questões foram salvas.
            </p>
          </div>

          <button
            type="button"
            onClick={resolverAgora}
          >
            Resolver agora →
          </button>
        </div>
      )}
    </section>
  );
}

function carregarBancoIA():
  QuestaoIA[] {
  const salvo =
    localStorage.getItem(
      CHAVE_BANCO_IA
    );

  if (!salvo) {
    return [];
  }

  try {
    const valor: unknown =
      JSON.parse(salvo);

    return Array.isArray(valor)
      ? (valor as QuestaoIA[])
      : [];
  } catch {
    return [];
  }
}

function salvarQuestoesNoBanco(
  novasQuestoes: QuestaoIA[]
) {
  const atuais =
    carregarBancoIA();

  const mapa =
    new Map<string, QuestaoIA>();

  atuais.forEach((questao) => {
    mapa.set(
      gerarChaveQuestao(
        questao
      ),
      questao
    );
  });

  novasQuestoes.forEach(
    (questao) => {
      const chave =
        gerarChaveQuestao(
          questao
        );

      if (!mapa.has(chave)) {
        mapa.set(
          chave,
          questao
        );
      }
    }
  );

  localStorage.setItem(
    CHAVE_BANCO_IA,
    JSON.stringify(
      Array.from(
        mapa.values()
      )
    )
  );
}

function gerarChaveQuestao(
  questao: QuestaoIA
) {
  return [
    questao.materia,
    questao.assunto,
    questao.enunciado,
  ]
    .join("::")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
