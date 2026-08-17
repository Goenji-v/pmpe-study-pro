import { useState } from "react";
import "./BancoQuestoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";

import type {
  Assunto,
  Dificuldade,
  Materia,
  QuestaoBanco,
} from "../../types/index";

export default function BancoQuestoes() {
  const {
    materias,
    bancoQuestoes,
    setBancoQuestoes,
  } = useApp();

  const { showToast } = useToast();

  const [materiaId, setMateriaId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [assuntoId, setAssuntoId] = useState("");
  const [banca, setBanca] = useState("AOCP");
  const [dificuldade, setDificuldade] =
    useState<Dificuldade>("media");
  const [enunciado, setEnunciado] = useState("");
  const [alternativaA, setAlternativaA] = useState("");
  const [alternativaB, setAlternativaB] = useState("");
  const [alternativaC, setAlternativaC] = useState("");
  const [alternativaD, setAlternativaD] = useState("");
  const [alternativaE, setAlternativaE] = useState("");
  const [respostaCorretaId, setRespostaCorretaId] =
    useState("A");
  const [explicacao, setExplicacao] = useState("");

  const materiaSelecionada = materias.find(
    (materia: Materia) => materia.id === materiaId
  );

  const modulosDisponiveis = materiaSelecionada
    ? listarModulosDaMateria(materiaSelecionada)
    : [];

  const moduloSelecionado = modulosDisponiveis.find(
    (modulo) => modulo.id === moduloId
  );

  function salvarQuestao() {
    const assuntoSelecionado =
      moduloSelecionado?.assuntos.find(
        (assunto: Assunto) => assunto.id === assuntoId
      );

    if (!materiaSelecionada) {
      showToast("Selecione uma matéria.", "warning");
      return;
    }

    if (!moduloSelecionado) {
      showToast("Selecione um módulo.", "warning");
      return;
    }

    if (!assuntoSelecionado) {
      showToast("Selecione um assunto.", "warning");
      return;
    }

    if (!enunciado.trim()) {
      showToast("Informe o enunciado.", "warning");
      return;
    }

    const alternativas = [
      { id: "A", texto: alternativaA.trim() },
      { id: "B", texto: alternativaB.trim() },
      { id: "C", texto: alternativaC.trim() },
      { id: "D", texto: alternativaD.trim() },
      { id: "E", texto: alternativaE.trim() },
    ].filter((alternativa) => alternativa.texto);

    if (alternativas.length < 2) {
      showToast(
        "Informe pelo menos duas alternativas.",
        "warning"
      );
      return;
    }

    const respostaExiste = alternativas.some(
      (alternativa) =>
        alternativa.id === respostaCorretaId
    );

    if (!respostaExiste) {
      showToast(
        "A alternativa correta precisa estar preenchida.",
        "warning"
      );
      return;
    }

    const novaQuestao: QuestaoBanco = {
      id: crypto.randomUUID(),
      materiaId: materiaSelecionada.id,
      materia: materiaSelecionada.nome,
      moduloId: moduloSelecionado.id,
      modulo: moduloSelecionado.nome,
      assuntoId: assuntoSelecionado.id,
      assunto: assuntoSelecionado.nome,
      banca,
      dificuldade,
      enunciado: enunciado.trim(),
      alternativas,
      respostaCorretaId,
      explicacao: explicacao.trim(),
      dataCriacao: new Date().toISOString(),
    };

    setBancoQuestoes((anteriores) => [
      novaQuestao,
      ...anteriores,
    ]);

    limparFormulario();

    showToast(
      "Questão adicionada ao banco.",
      "success"
    );
  }

  function excluirQuestao(id: string) {
    const confirmar = window.confirm(
      "Deseja excluir esta questão?"
    );

    if (!confirmar) return;

    setBancoQuestoes((anteriores) =>
      anteriores.filter(
        (questao) => questao.id !== id
      )
    );

    showToast("Questão excluída.", "info");
  }

  function limparFormulario() {
    setMateriaId("");
    setModuloId("");
    setAssuntoId("");
    setBanca("AOCP");
    setDificuldade("media");
    setEnunciado("");
    setAlternativaA("");
    setAlternativaB("");
    setAlternativaC("");
    setAlternativaD("");
    setAlternativaE("");
    setRespostaCorretaId("A");
    setExplicacao("");
  }

  return (
    <section className="banco-container">
      <h1 className="banco-title">
        🧠 Banco de Questões
      </h1>

      <p className="banco-subtitle">
        Cadastre questões completas para gerar
        simulados automáticos.
      </p>

      <div className="banco-resumo">
        <div className="banco-resumo-card">
          <span>Total de questões</span>
          <strong>{bancoQuestoes.length}</strong>
        </div>

        <div className="banco-resumo-card">
          <span>Matérias disponíveis</span>
          <strong>
            {
              new Set(
                bancoQuestoes.map(
                  (questao) => questao.materia
                )
              ).size
            }
          </strong>
        </div>

        <div className="banco-resumo-card">
          <span>Assuntos disponíveis</span>
          <strong>
            {
              new Set(
                bancoQuestoes.map(
                  (questao) =>
                    `${questao.materiaId}-${questao.assuntoId}`
                )
              ).size
            }
          </strong>
        </div>
      </div>

      <div className="banco-grid">
        <div className="banco-card">
          <h2>Nova questão</h2>

          <div className="banco-form-group">
            <label>Matéria</label>

            <select
              value={materiaId}
              onChange={(evento) => {
                setMateriaId(evento.target.value);
                setModuloId("");
                setAssuntoId("");
              }}
            >
              <option value="">
                Selecione uma matéria
              </option>

              {materias.map((materia: Materia) => (
                <option
                  key={materia.id}
                  value={materia.id}
                >
                  {materia.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="banco-form-group">
            <label>Módulo</label>

            <select
              value={moduloId}
              onChange={(evento) => {
                setModuloId(evento.target.value);
                setAssuntoId("");
              }}
              disabled={!materiaId}
            >
              <option value="">
                Selecione um módulo
              </option>

              {modulosDisponiveis.map((modulo) => (
                <option key={modulo.id} value={modulo.id}>
                  {modulo.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="banco-form-group">
            <label>Assunto</label>

            <select
              value={assuntoId}
              onChange={(evento) =>
                setAssuntoId(evento.target.value)
              }
              disabled={!moduloId}
            >
              <option value="">
                Selecione um assunto
              </option>

              {moduloSelecionado?.assuntos.map(
                (assunto: Assunto) => (
                  <option
                    key={assunto.id}
                    value={assunto.id}
                  >
                    {assunto.nome}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="banco-form-row">
            <div className="banco-form-group">
              <label>Banca</label>

              <select
                value={banca}
                onChange={(evento) =>
                  setBanca(evento.target.value)
                }
              >
                <option value="AOCP">AOCP</option>
                <option value="CEBRASPE">
                  CEBRASPE
                </option>
                <option value="FGV">FGV</option>
                <option value="FCC">FCC</option>
                <option value="VUNESP">
                  VUNESP
                </option>
                <option value="IBFC">IBFC</option>
                <option value="IDECAN">
                  IDECAN
                </option>
                <option value="Outra">
                  Outra
                </option>
              </select>
            </div>

            <div className="banco-form-group">
              <label>Dificuldade</label>

              <select
                value={dificuldade}
                onChange={(evento) =>
                  setDificuldade(
                    evento.target.value as Dificuldade
                  )
                }
              >
                <option value="facil">Fácil</option>
                <option value="media">Média</option>
                <option value="dificil">
                  Difícil
                </option>
              </select>
            </div>
          </div>

          <div className="banco-form-group">
            <label>Enunciado</label>

            <textarea
              value={enunciado}
              onChange={(evento) =>
                setEnunciado(evento.target.value)
              }
              placeholder="Digite o enunciado da questão."
            />
          </div>

          <div className="banco-form-group">
            <label>Alternativa A</label>
            <input
              value={alternativaA}
              onChange={(evento) =>
                setAlternativaA(evento.target.value)
              }
            />
          </div>

          <div className="banco-form-group">
            <label>Alternativa B</label>
            <input
              value={alternativaB}
              onChange={(evento) =>
                setAlternativaB(evento.target.value)
              }
            />
          </div>

          <div className="banco-form-group">
            <label>Alternativa C</label>
            <input
              value={alternativaC}
              onChange={(evento) =>
                setAlternativaC(evento.target.value)
              }
            />
          </div>

          <div className="banco-form-group">
            <label>Alternativa D</label>
            <input
              value={alternativaD}
              onChange={(evento) =>
                setAlternativaD(evento.target.value)
              }
            />
          </div>

          <div className="banco-form-group">
            <label>Alternativa E</label>
            <input
              value={alternativaE}
              onChange={(evento) =>
                setAlternativaE(evento.target.value)
              }
            />
          </div>

          <div className="banco-form-group">
            <label>Resposta correta</label>

            <select
              value={respostaCorretaId}
              onChange={(evento) =>
                setRespostaCorretaId(
                  evento.target.value
                )
              }
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
            </select>
          </div>

          <div className="banco-form-group">
            <label>Explicação</label>

            <textarea
              value={explicacao}
              onChange={(evento) =>
                setExplicacao(evento.target.value)
              }
              placeholder="Justificativa ou comentário do gabarito."
            />
          </div>

          <button
            className="banco-salvar"
            onClick={salvarQuestao}
          >
            Salvar questão
          </button>
        </div>

        <div className="banco-card">
          <h2>Questões cadastradas</h2>

          {bancoQuestoes.length === 0 ? (
            <p className="banco-vazio">
              Nenhuma questão cadastrada.
            </p>
          ) : (
            <div className="banco-lista">
              {bancoQuestoes.map(
                (questao: QuestaoBanco) => (
                  <article
                    key={questao.id}
                    className="banco-item"
                  >
                    <div className="banco-item-topo">
                      <div>
                        <strong>
                          {questao.materia}
                        </strong>

                        <p>
                          {questao.assunto} •{" "}
                          {questao.banca}
                        </p>
                      </div>

                      <span
                        className={`banco-dificuldade banco-${questao.dificuldade}`}
                      >
                        {questao.dificuldade}
                      </span>
                    </div>

                    <p className="banco-enunciado">
                      {questao.enunciado}
                    </p>

                    <div className="banco-alternativas">
                      {questao.alternativas.map(
                        (alternativa) => (
                          <p
                            key={alternativa.id}
                            className={
                              alternativa.id ===
                              questao.respostaCorretaId
                                ? "banco-alternativa-correta"
                                : ""
                            }
                          >
                            {alternativa.id}){" "}
                            {alternativa.texto}
                          </p>
                        )
                      )}
                    </div>

                    {questao.explicacao && (
                      <p className="banco-explicacao">
                        <strong>Explicação:</strong>{" "}
                        {questao.explicacao}
                      </p>
                    )}

                    <button
                      className="banco-excluir"
                      onClick={() =>
                        excluirQuestao(questao.id)
                      }
                    >
                      Excluir
                    </button>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}