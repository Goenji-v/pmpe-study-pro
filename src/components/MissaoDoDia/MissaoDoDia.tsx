import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import { useMemo } from "react";
import { useApp } from "../../context/AppContext";
import {
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";
import { useNavigate } from "react-router-dom";

import "./MissaoDoDia.css";

import {
  getProximaMissao,
  getSemanaAtual,
  type ProximaMissaoPlano,
} from "../../utils/planoUtils";
import { criarPlanoCalendario, normalizarMissoesPorDia, NOMES_DIAS_PLANO } from "../../utils/planoCalendario";

type MissaoDoDiaProps = {
  atualizacao?: number;
};

export default function MissaoDoDia({
  atualizacao = 0,
}: MissaoDoDiaProps) {
  const navigate = useNavigate();
  const {
    materias,
    missoesConcluidas,
    configuracoes,
  } = useApp();

  const planoCalendario = useMemo(
    () => criarPlanoCalendario(normalizarMissoesPorDia(configuracoes.missoesPorDia ?? 1), configuracoes.planoPadraoAtivo !== false),
    [configuracoes.missoesPorDia, configuracoes.planoPadraoAtivo]
  );

  const semanaAtual = useMemo(
    () => getSemanaAtual(
      missoesConcluidas,
      planoCalendario,
      configuracoes.semanaAtualPlano
    ),
    [missoesConcluidas, planoCalendario, configuracoes.semanaAtualPlano]
  );

  // atualizacao é um token explícito para invalidar o cálculo após eventos externos.
  /* oxlint-disable react-hooks/exhaustive-deps */
  const proxima = useMemo(
    () => getProximaMissao(missoesConcluidas, planoCalendario, semanaAtual),
    [atualizacao, missoesConcluidas, planoCalendario, semanaAtual]
  );
  /* oxlint-enable react-hooks/exhaustive-deps */

  function iniciarMissao(
    dados: ProximaMissaoPlano
  ) {
    const { semana, dia, missao } = dados;

    const materia = materias.find(
      (item) =>
        normalizarTexto(item.nome) ===
        normalizarTexto(missao.materia)
    );

    const modulos = materia
      ? listarModulosDaMateria(materia)
      : [];

    const modulo = modulos.find(
      (item) =>
        item.assuntos.some(
          (assunto) =>
            normalizarTexto(assunto.nome) ===
            normalizarTexto(missao.assunto)
        )
    ) ?? modulos[0];

    const assunto = modulo?.assuntos.find(
      (item) =>
        normalizarTexto(item.nome) ===
        normalizarTexto(missao.assunto)
    );

    const prefillSessao = {
      tipo:
        missao.tipo === "revisao"
          ? "revisao"
          : missao.tipo === "questoes"
            ? "questoes"
            : "aula",
      materia: materia?.nome ?? missao.materia,
      materiaId: materia?.id,
      modulo: modulo?.nome,
      moduloId: modulo?.id,
      assunto: assunto?.nome ?? missao.assunto,
      assuntoId: assunto?.id,
      objetivo:
        `Semana ${semana} — ` +
        `Dia ${dia} — ` +
        `Missão ${missao.numero}`,
      observacao: "",
      missaoId: missao.id,
      semana,
      dia,
      urlAula: missao.urlAula,
      urlQuestoes: missao.urlQuestoes,
    };

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify(prefillSessao)
    );

    navigate("/central-estudos", {
      state: {
        origem: "dashboard",
        prefillSessao,
      },
    });
  }

  if (!proxima) {
    return (
      <section className="missao-dia-card missao-dia-concluida">
        <div>
          <span className="missao-dia-etiqueta">
            MISSÃO DO DIA
          </span>

          <h2>{planoCalendario.length ? "Plano concluído" : "Nenhum plano configurado"}</h2>

          <p>
            {planoCalendario.length ? "Todas as missões cadastradas foram concluídas." : "Importe seu edital para montar suas missões."}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/plano")
          }
        >
          Ver plano
        </button>
      </section>
    );
  }

  const { semana, dia, missao } =
    proxima;

  return (
    <section className="missao-dia-card">
      <div className="missao-dia-topo">
        <div>
          <span className="missao-dia-etiqueta">
            MISSÃO DO DIA
          </span>

          <h2>{missao.materia}</h2>

          <p>{missao.assunto}</p>
        </div>

        <div className="missao-dia-local">
          <span>Semana {semana}</span>
          <span>{NOMES_DIAS_PLANO[dia] ?? `Dia ${dia}`}</span>
          <span>
            Missão {missao.numero}
          </span>
        </div>
      </div>

      <div className="missao-dia-detalhes">
        <Detalhe
          titulo="Tipo"
          valor={formatarTipo(
            missao.tipo
          )}
        />

        <Detalhe
          titulo="Aula"
          valor={
            missao.urlAula
              ? "Disponível"
              : "Sem link"
          }
        />

        <Detalhe
          titulo="Questões"
          valor={
            missao.urlQuestoes
              ? "Disponíveis"
              : "Sem link"
          }
        />
      </div>

      <div className="missao-dia-acoes">
        <button
          type="button"
          className="missao-dia-secundario"
          onClick={() =>
            navigate("/plano")
          }
        >
          Ver plano
        </button>

        <button
          type="button"
          className="missao-dia-primario"
          onClick={() =>
            iniciarMissao(proxima)
          }
        >
          ▶ Iniciar missão
        </button>
      </div>
    </section>
  );
}

function Detalhe({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <article>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function formatarTipo(
  tipo: string
) {
  const nomes: Record<
    string,
    string
  > = {
    conteudo: "Aula",
    revisao: "Revisão",
    questoes: "Questões",
    redacao: "Redação",
    livre: "Livre",
  };

  return nomes[tipo] || tipo;
}
function normalizarTexto(
  valor: string
) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
