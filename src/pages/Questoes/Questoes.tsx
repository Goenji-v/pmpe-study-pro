import { useEffect, useState } from "react";
import "./Questoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";
import {
  aplicarRevisaoAdaptativa,
  diagnosticarRevisaoAdaptativa,
  rotuloPrioridadeRevisaoAdaptativa,
} from "../../utils/revisaoAdaptativa";

import type {
  Assunto,
  Materia,
  RegistroQuestao,
} from "../../types";

export default function Questoes() {
  const {
    materias,
    questoes,
    setQuestoes,
    setRevisoes,
  } = useApp();
  const { showToast } = useToast();

  const [materia, setMateria] = useState("");
  const [modulo, setModulo] = useState("");
  const [assunto, setAssunto] = useState("");
  const [banca, setBanca] = useState("AOCP");
  const [certas, setCertas] = useState(0);
  const [erradas, setErradas] = useState(0);
  const [minutos, setMinutos] = useState(0);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    const salvo = sessionStorage.getItem("pmpe:registrar-questoes:prefill");
    if (!salvo) return;
    try {
      const prefill = JSON.parse(salvo) as { materia?: string; modulo?: string; assunto?: string };
      if (prefill.materia) setMateria(prefill.materia);
      if (prefill.modulo) setModulo(prefill.modulo);
      if (prefill.assunto) setAssunto(prefill.assunto);
    } finally {
      sessionStorage.removeItem("pmpe:registrar-questoes:prefill");
    }
  }, []);

  const materiaSelecionada = materias.find(
    (item: Materia) => item.nome === materia
  );

  const modulosDisponiveis = materiaSelecionada
    ? listarModulosDaMateria(materiaSelecionada)
    : [];

  const moduloSelecionado = modulosDisponiveis.find(
    (item) => item.nome === modulo
  );

  const assuntoSelecionado = moduloSelecionado?.assuntos.find(
    (item) => item.nome === assunto
  );

  function salvarRegistro() {
    if (!materia) {
      showToast("Selecione uma matéria.", "warning");
      return;
    }

    if (!modulo) {
      showToast("Selecione um módulo.", "warning");
      return;
    }

    if (!assunto) {
      showToast("Selecione um assunto.", "warning");
      return;
    }

    if (certas < 0 || erradas < 0 || minutos < 0) {
      showToast(
        "Certas, erradas e minutos não podem ser negativos.",
        "error"
      );
      return;
    }

    if (certas + erradas === 0) {
      showToast(
        "Informe pelo menos uma questão certa ou errada.",
        "warning"
      );
      return;
    }

    const novoRegistro: RegistroQuestao = {
      id: crypto.randomUUID(),
      materia,
      materiaId: materiaSelecionada?.id,
      modulo,
      moduloId: moduloSelecionado?.id,
      assunto,
      assuntoId: assuntoSelecionado?.id,
      banca,
      certas,
      erradas,
      minutos,
      observacao: observacao.trim(),
      data: new Date().toISOString(),
    };

    setQuestoes((registrosAnteriores) => [
      novoRegistro,
      ...registrosAnteriores,
    ]);

    const diagnostico = diagnosticarRevisaoAdaptativa(
      certas,
      erradas
    );

    let mensagemSalvamento = "Registro salvo com sucesso.";
    let tipoToast: "success" | "warning" = "success";

    if (
      diagnostico &&
      materiaSelecionada?.id &&
      assuntoSelecionado?.id
    ) {
      setRevisoes((revisoesAnteriores) =>
        aplicarRevisaoAdaptativa({
          revisoes: revisoesAnteriores,
          materiaId: materiaSelecionada.id,
          moduloId: moduloSelecionado?.id,
          assuntoId: assuntoSelecionado.id,
          materia,
          modulo,
          assunto,
          certas,
          erradas,
        }).revisoes
      );

      const quando =
        diagnostico.diasParaRevisao === 0
          ? "para hoje"
          : diagnostico.diasParaRevisao === 1
            ? "para amanhã"
            : `para daqui a ${diagnostico.diasParaRevisao} dias`;

      mensagemSalvamento = `${rotuloPrioridadeRevisaoAdaptativa(
        diagnostico.prioridade
      )} de ${assunto} criada ${quando} (${diagnostico.percentual}% de acerto).`;
    } else if (diagnostico) {
      mensagemSalvamento =
        "Registro salvo, mas não foi possível localizar o assunto para criar a revisão automática.";
      tipoToast = "warning";
    }

    limparFormulario();

    showToast(mensagemSalvamento, tipoToast);
  }

  function limparFormulario() {
    setMateria("");
    setModulo("");
    setAssunto("");
    setBanca("AOCP");
    setCertas(0);
    setErradas(0);
    setMinutos(0);
    setObservacao("");
  }

  function calcularAproveitamento(
    quantidadeCertas: number,
    quantidadeErradas: number
  ) {
    const total = quantidadeCertas + quantidadeErradas;

    if (total === 0) return 0;

    return Math.round((quantidadeCertas / total) * 100);
  }

  function corDoAproveitamento(percentual: number) {
    if (percentual >= 75) return "#22c55e";
    if (percentual >= 60) return "#eab308";
    if (percentual >= 40) return "#f97316";
    return "#ef4444";
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <section className="questoes-container">
      <h1 className="questoes-title">📝 Questões</h1>

      <p className="questoes-subtitle">
        Registre seus blocos de questões por matéria, assunto e banca.
      </p>

      <div className="questoes-grid">
        <div className="questoes-card">
          <h2 style={{ marginBottom: 20 }}>
            Novo registro
          </h2>

          <div className="form-group">
            <label htmlFor="materia">Matéria</label>

            <select
              id="materia"
              value={materia}
              onChange={(evento) => {
                setMateria(evento.target.value);
                setModulo("");
                setAssunto("");
              }}
            >
              <option value="">
                Selecione uma matéria
              </option>

              {materias.map((item: Materia) => (
                <option
                  key={item.id}
                  value={item.nome}
                >
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="modulo">Módulo</label>

            <select
              id="modulo"
              value={modulo}
              onChange={(evento) => {
                setModulo(evento.target.value);
                setAssunto("");
              }}
              disabled={!materia}
            >
              <option value="">
                {materia
                  ? "Selecione um módulo"
                  : "Selecione primeiro uma matéria"}
              </option>

              {modulosDisponiveis.map((item) => (
                <option key={item.id} value={item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="assunto">Assunto</label>

            <select
              id="assunto"
              value={assunto}
              onChange={(evento) =>
                setAssunto(evento.target.value)
              }
              disabled={!modulo}
            >
              <option value="">
                {modulo
                  ? "Selecione um assunto"
                  : "Selecione primeiro um módulo"}
              </option>

              {moduloSelecionado?.assuntos.map(
                (item: Assunto) => (
                  <option
                    key={item.id}
                    value={item.nome}
                  >
                    {item.nome}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="banca">Banca</label>

            <select
              id="banca"
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
              <option value="Outra">Outra</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="certas">Certas</label>

              <input
                id="certas"
                type="number"
                min={0}
                value={certas}
                onChange={(evento) =>
                  setCertas(
                    Math.max(
                      0,
                      Number(evento.target.value)
                    )
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="erradas">
                Erradas
              </label>

              <input
                id="erradas"
                type="number"
                min={0}
                value={erradas}
                onChange={(evento) =>
                  setErradas(
                    Math.max(
                      0,
                      Number(evento.target.value)
                    )
                  )
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="minutos">
              Tempo gasto em minutos
            </label>

            <input
              id="minutos"
              type="number"
              min={0}
              value={minutos}
              onChange={(evento) =>
                setMinutos(
                  Math.max(
                    0,
                    Number(evento.target.value)
                  )
                )
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="observacao">
              Observação
            </label>

            <textarea
              id="observacao"
              value={observacao}
              onChange={(evento) =>
                setObservacao(evento.target.value)
              }
              placeholder="Exemplo: errei muito em interpretação. Revisar amanhã."
            />
          </div>

          <button
            className="btn-salvar"
            onClick={salvarRegistro}
          >
            Salvar registro
          </button>
        </div>

        <div className="questoes-card">
          <h2 style={{ marginBottom: 20 }}>
            Histórico recente
          </h2>

          {questoes.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>
              Nenhum registro salvo ainda.
            </p>
          ) : (
            <div className="historico-lista">
              {questoes
                .slice(0, 10)
                .map((registro: RegistroQuestao) => {
                  const percentual =
                    calcularAproveitamento(
                      registro.certas,
                      registro.erradas
                    );
                  const diagnostico =
                    diagnosticarRevisaoAdaptativa(
                      registro.certas,
                      registro.erradas
                    );

                  return (
                    <div
                      key={registro.id}
                      className="historico-item"
                    >
                      <div className="historico-topo">
                        <span className="historico-materia">
                          {registro.materia}
                        </span>

                        <span
                          className="historico-percentual"
                          style={{
                            color: corDoAproveitamento(percentual),
                          }}
                        >
                          {percentual}%
                        </span>
                      </div>

                      <p>{registro.modulo ? `${registro.modulo} → ${registro.assunto}` : registro.assunto}</p>

                      <p className="historico-info">
                        {registro.banca} •{" "}
                        {registro.certas} certas •{" "}
                        {registro.erradas} erradas •{" "}
                        {registro.minutos} min
                      </p>

                      {diagnostico && (
                        <p
                          className="historico-info"
                          style={{
                            marginTop: 6,
                            fontWeight: 700,
                            color: corDoAproveitamento(percentual),
                          }}
                        >
                          {rotuloPrioridadeRevisaoAdaptativa(
                            diagnostico.prioridade
                          )} automática
                        </p>
                      )}

                      <p
                        className="historico-info"
                        style={{ marginTop: 6 }}
                      >
                        {formatarData(registro.data)}
                      </p>

                      {registro.observacao && (
                        <p
                          className="historico-info"
                          style={{
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 8,
                            background: "#111827",
                          }}
                        >
                          {registro.observacao}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
