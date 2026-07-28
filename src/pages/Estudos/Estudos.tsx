import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import { criarPrimeiraRevisao } from "../../utils/revisoes";

import type {
  Assunto,
  Materia,
} from "../../types";

export default function Estudos() {
  const {
    materias,
    setMaterias,
    revisoes,
    setRevisoes,
  } = useApp();

  const { showToast } = useToast();

  function alternarConclusao(
    materia: Materia,
    assunto: Assunto
  ) {
    const novoEstado = !assunto.concluido;

    setMaterias((materiasAnteriores) =>
      materiasAnteriores.map((itemMateria) => {
        if (itemMateria.id !== materia.id) {
          return itemMateria;
        }

        return {
          ...itemMateria,
          assuntos: itemMateria.assuntos.map(
            (itemAssunto) =>
              itemAssunto.id === assunto.id
                ? {
                    ...itemAssunto,
                    concluido: novoEstado,
                  }
                : itemAssunto
          ),
        };
      })
    );

    if (novoEstado) {
      agendarPrimeiraRevisao(
        materia,
        assunto
      );

      showToast(
        "Assunto concluído. Revisão agendada para amanhã.",
        "success"
      );
    } else {
      removerRevisoesPendentes(
        materia.id,
        assunto.id
      );

      showToast(
        "Conclusão removida e revisões pendentes canceladas.",
        "info"
      );
    }
  }

  function agendarPrimeiraRevisao(
    materia: Materia,
    assunto: Assunto
  ) {
    const jaExisteRevisaoPendente =
      revisoes.some(
        (revisao) =>
          revisao.materiaId === materia.id &&
          revisao.assuntoId === assunto.id &&
          !revisao.concluida
      );

    if (jaExisteRevisaoPendente) {
      return;
    }

    const novaRevisao =
      criarPrimeiraRevisao({
        materiaId: materia.id,
        assuntoId: assunto.id,
        materia: materia.nome,
        assunto: assunto.nome,
      });

    setRevisoes((revisoesAnteriores) => [
      novaRevisao,
      ...revisoesAnteriores,
    ]);
  }

  function removerRevisoesPendentes(
    materiaId: string,
    assuntoId: string
  ) {
    setRevisoes((revisoesAnteriores) =>
      revisoesAnteriores.filter(
        (revisao) =>
          !(
            revisao.materiaId === materiaId &&
            revisao.assuntoId === assuntoId &&
            !revisao.concluida
          )
      )
    );
  }

  return (
    <section>
      <h1 style={{ marginBottom: 8 }}>
        📚 Estudos
      </h1>

      <p
        style={{
          color: "#94a3b8",
          marginBottom: 30,
        }}
      >
        Marque os assuntos concluídos para
        agendar revisões automaticamente.
      </p>

      {materias.map((materia) => {
        const totalAssuntos =
          materia.assuntos.length;

        const assuntosConcluidos =
          materia.assuntos.filter(
            (assunto) => assunto.concluido
          ).length;

        const progresso =
          totalAssuntos === 0
            ? 0
            : Math.round(
                (assuntosConcluidos /
                  totalAssuntos) *
                  100
              );

        return (
          <div
            key={materia.id}
            style={{
              background: "#1e293b",
              padding: 24,
              borderRadius: 18,
              marginBottom: 25,
              border: "1px solid #334155",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div>
                <h2>{materia.nome}</h2>

                <p
                  style={{
                    color: "#94a3b8",
                    marginTop: 8,
                  }}
                >
                  {assuntosConcluidos} de{" "}
                  {totalAssuntos} assuntos
                  concluídos
                </p>
              </div>

              <strong
                style={{
                  color:
                    progresso === 100
                      ? "#22c55e"
                      : "#60a5fa",
                  fontSize: 20,
                }}
              >
                {progresso}%
              </strong>
            </div>

            <div
              style={{
                background: "#334155",
                height: 10,
                borderRadius: 999,
                marginTop: 16,
                marginBottom: 22,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progresso}%`,
                  height: "100%",
                  background:
                    progresso === 100
                      ? "#22c55e"
                      : "#3b82f6",
                  borderRadius: 999,
                  transition:
                    "width 0.3s ease",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {materia.assuntos.map(
                (assunto) => (
                  <div
                    key={assunto.id}
                    style={{
                      display: "flex",
                      gap: 15,
                      alignItems: "center",
                      background: "#0f172a",
                      padding: 14,
                      borderRadius: 12,
                      border:
                        "1px solid #334155",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        assunto.concluido
                      }
                      onChange={() =>
                        alternarConclusao(
                          materia,
                          assunto
                        )
                      }
                      style={{
                        width: 18,
                        height: 18,
                        cursor: "pointer",
                      }}
                    />

                    <span
                      style={{
                        textDecoration:
                          assunto.concluido
                            ? "line-through"
                            : "none",
                        color:
                          assunto.concluido
                            ? "#64748b"
                            : "#ffffff",
                      }}
                    >
                      {assunto.nome}
                    </span>

                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        padding: "5px 9px",
                        borderRadius: 999,
                        background:
                          assunto.prioridade ===
                          "alta"
                            ? "rgba(220, 38, 38, 0.25)"
                            : assunto.prioridade ===
                                "media"
                              ? "rgba(245, 158, 11, 0.25)"
                              : "rgba(34, 197, 94, 0.25)",
                        color:
                          assunto.prioridade ===
                          "alta"
                            ? "#fca5a5"
                            : assunto.prioridade ===
                                "media"
                              ? "#fcd34d"
                              : "#86efac",
                      }}
                    >
                      {assunto.prioridade}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}