import { useState } from "react";
import { useApp } from "../../context/AppContext";
import type { RegistroQuestao } from "../../types";

export default function Historico() {
  const { questoes, setQuestoes, materias } = useApp();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [registroEditado, setRegistroEditado] =
    useState<RegistroQuestao | null>(null);

  function aproveitamento(certas: number, erradas: number) {
    const total = certas + erradas;

    if (total === 0) return 0;

    return Math.round((certas / total) * 100);
  }

  function excluirRegistro(id: string) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir este registro?"
    );

    if (!confirmar) return;

    setQuestoes((registrosAnteriores) =>
      registrosAnteriores.filter((registro) => registro.id !== id)
    );

    if (editandoId === id) {
      cancelarEdicao();
    }
  }

  function duplicarRegistro(id: string) {
    const registroEncontrado = questoes.find(
      (registro) => registro.id === id
    );

    if (!registroEncontrado) return;

    const copia: RegistroQuestao = {
      ...registroEncontrado,
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
    };

    setQuestoes((registrosAnteriores) => [
      copia,
      ...registrosAnteriores,
    ]);
  }

  function iniciarEdicao(registro: RegistroQuestao) {
    setEditandoId(registro.id);
    setRegistroEditado({ ...registro });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setRegistroEditado(null);
  }

  function salvarEdicao() {
    if (!registroEditado) return;

    if (!registroEditado.materia || !registroEditado.assunto) {
      alert("Selecione a matéria e o assunto.");
      return;
    }

    if (
      registroEditado.certas < 0 ||
      registroEditado.erradas < 0 ||
      registroEditado.minutos < 0
    ) {
      alert("Os valores não podem ser negativos.");
      return;
    }

    if (registroEditado.certas + registroEditado.erradas === 0) {
      alert("Informe pelo menos uma questão certa ou errada.");
      return;
    }

    setQuestoes((registrosAnteriores) =>
      registrosAnteriores.map((registro) =>
        registro.id === registroEditado.id
          ? registroEditado
          : registro
      )
    );

    cancelarEdicao();
  }

  const materiaSelecionada = materias.find(
    (materia) => materia.nome === registroEditado?.materia
  );

  return (
    <section>
      <h1 style={{ marginBottom: 8 }}>📋 Histórico</h1>

      <p
        style={{
          color: "#94a3b8",
          marginBottom: 30,
        }}
      >
        Edite, duplique ou exclua seus registros de questões.
      </p>

      {questoes.length === 0 ? (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 18,
            padding: 24,
          }}
        >
          Nenhum registro encontrado.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {questoes.map((registro) => {
            const estaEditando = editandoId === registro.id;

            return (
              <div
                key={registro.id}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 18,
                  padding: 20,
                }}
              >
                {estaEditando && registroEditado ? (
                  <div>
                    <h2 style={{ marginBottom: 20 }}>
                      ✏ Editar registro
                    </h2>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Matéria</label>

                      <select
                        value={registroEditado.materia}
                        onChange={(evento) =>
                          setRegistroEditado({
                            ...registroEditado,
                            materia: evento.target.value,
                            assunto: "",
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="">Selecione</option>

                        {materias.map((materia) => (
                          <option
                            key={materia.id}
                            value={materia.nome}
                          >
                            {materia.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Assunto</label>

                      <select
                        value={registroEditado.assunto}
                        onChange={(evento) =>
                          setRegistroEditado({
                            ...registroEditado,
                            assunto: evento.target.value,
                          })
                        }
                        style={inputStyle}
                        disabled={!registroEditado.materia}
                      >
                        <option value="">Selecione</option>

                        {materiaSelecionada?.assuntos.map(
                          (assunto) => (
                            <option
                              key={assunto.id}
                              value={assunto.nome}
                            >
                              {assunto.nome}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Banca</label>

                      <select
                        value={registroEditado.banca}
                        onChange={(evento) =>
                          setRegistroEditado({
                            ...registroEditado,
                            banca: evento.target.value,
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="AOCP">AOCP</option>
                        <option value="CEBRASPE">CEBRASPE</option>
                        <option value="FGV">FGV</option>
                        <option value="FCC">FCC</option>
                        <option value="VUNESP">VUNESP</option>
                        <option value="IBFC">IBFC</option>
                        <option value="Outra">Outra</option>
                      </select>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Certas</label>

                        <input
                          type="number"
                          min={0}
                          value={registroEditado.certas}
                          onChange={(evento) =>
                            setRegistroEditado({
                              ...registroEditado,
                              certas: Number(evento.target.value),
                            })
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div style={formGroupStyle}>
                        <label style={labelStyle}>Erradas</label>

                        <input
                          type="number"
                          min={0}
                          value={registroEditado.erradas}
                          onChange={(evento) =>
                            setRegistroEditado({
                              ...registroEditado,
                              erradas: Number(evento.target.value),
                            })
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>
                        Tempo gasto em minutos
                      </label>

                      <input
                        type="number"
                        min={0}
                        value={registroEditado.minutos}
                        onChange={(evento) =>
                          setRegistroEditado({
                            ...registroEditado,
                            minutos: Number(evento.target.value),
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div style={formGroupStyle}>
                      <label style={labelStyle}>Observação</label>

                      <textarea
                        value={registroEditado.observacao || ""}
                        onChange={(evento) =>
                          setRegistroEditado({
                            ...registroEditado,
                            observacao: evento.target.value,
                          })
                        }
                        style={{
                          ...inputStyle,
                          minHeight: 90,
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 18,
                      }}
                    >
                      <button
                        onClick={salvarEdicao}
                        style={{
                          ...buttonStyle,
                          background: "#16a34a",
                        }}
                      >
                        💾 Salvar alteração
                      </button>

                      <button
                        onClick={cancelarEdicao}
                        style={{
                          ...buttonStyle,
                          background: "#475569",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <strong style={{ color: "#60a5fa" }}>
                        {registro.materia}
                      </strong>

                      <strong
                        style={{
                          color:
                            aproveitamento(
                              registro.certas,
                              registro.erradas
                            ) >= 80
                              ? "#22c55e"
                              : aproveitamento(
                                  registro.certas,
                                  registro.erradas
                                ) >= 60
                              ? "#f59e0b"
                              : "#ef4444",
                        }}
                      >
                        {aproveitamento(
                          registro.certas,
                          registro.erradas
                        )}
                        %
                      </strong>
                    </div>

                    <p style={{ marginBottom: 8 }}>
                      {registro.assunto}
                    </p>

                    <p style={{ color: "#94a3b8" }}>
                      {registro.banca} • {registro.certas} certas •{" "}
                      {registro.erradas} erradas •{" "}
                      {registro.minutos} min
                    </p>

                    <p
                      style={{
                        color: "#64748b",
                        fontSize: 13,
                        marginTop: 8,
                      }}
                    >
                      {new Date(registro.data).toLocaleString("pt-BR")}
                    </p>

                    {registro.observacao && (
                      <p
                        style={{
                          color: "#cbd5e1",
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 10,
                          background: "#0f172a",
                        }}
                      >
                        {registro.observacao}
                      </p>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 16,
                      }}
                    >
                      <button
                        onClick={() => iniciarEdicao(registro)}
                        style={{
                          ...buttonStyle,
                          background: "#d97706",
                        }}
                      >
                        ✏ Editar
                      </button>

                      <button
                        onClick={() =>
                          duplicarRegistro(registro.id)
                        }
                        style={{
                          ...buttonStyle,
                          background: "#2563eb",
                        }}
                      >
                        📄 Duplicar
                      </button>

                      <button
                        onClick={() =>
                          excluirRegistro(registro.id)
                        }
                        style={{
                          ...buttonStyle,
                          background: "#dc2626",
                        }}
                      >
                        🗑 Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const formGroupStyle = {
  display: "flex",
  flexDirection: "column" as const,
  marginBottom: 14,
};

const labelStyle = {
  color: "#cbd5e1",
  fontSize: 14,
  marginBottom: 6,
};

const inputStyle = {
  background: "#0f172a",
  color: "white",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 12,
  outline: "none",
};

const buttonStyle = {
  color: "white",
  padding: "9px 14px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
};