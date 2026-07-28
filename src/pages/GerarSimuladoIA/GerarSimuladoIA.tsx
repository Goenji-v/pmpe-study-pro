import {
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
  listarSemanasDoPlano,
  pegarAssuntosDaSemana,
} from "../../utils/conteudosSemana";

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

  const { materias } = useApp();

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

  const [gerando, setGerando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState("");

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

  const assuntosDisponiveis =
    materiaAtual?.assuntos ?? [];

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

      const resposta =
        await gerarQuestoesIA({
          origem,

          materia:
            origem === "assunto"
              ? materiaSelecionada
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

          banca:
            banca.trim(),

          dificuldade,

          quantidade,
        });

      localStorage.setItem(
        CHAVE_QUESTOES_IA,
        JSON.stringify(
          resposta.questoes
        )
      );

      if (salvarNoBanco) {
        salvarQuestoesNoBanco(
          resposta.questoes
        );
      }

      setQuestoesGeradas(
        resposta.questoes
      );

      setSucesso(
        `${resposta.questoes.length} questões geradas e salvas com sucesso.`
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
    setAssuntoSelecionado("");
    setSemanaSelecionada(1);
    setBanca("AOCP");
    setDificuldade("Mista");
    setQuantidade(5);
    setSalvarNoBanco(true);
    setErro("");
    setSucesso("");
    setQuestoesGeradas([]);
  }

  return (
    <section className="gerar-ia-container">
      <div className="gerar-ia-cabecalho">
        <div>
          <h1>
            🤖 Gerar Simulado IA
          </h1>

          <p>
            Gere por matéria e assunto
            ou pelos conteúdos de uma
            semana do plano.
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
            Origem das questões
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
              📚 Matéria e assunto
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
              📅 Semana do plano
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
                  !materiaSelecionada
                }
              >
                <option value="">
                  {materiaSelecionada
                    ? "Selecione o assunto"
                    : "Selecione primeiro a matéria"}
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
            no Banco de Questões IA
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
              : "✨ Gerar simulado"}
          </button>
        </div>
      </div>

      {questoesGeradas.length >
        0 && (
        <div className="gerar-ia-resultado">
          <div>
            <h2>
              Simulado pronto
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