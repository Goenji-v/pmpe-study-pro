import { armazenamentoLocalDaConta as localStorage } from "../../services/armazenamentoConta";
import { useMemo, useState } from "react";

import "./DiagnosticoSimuladoIA.css";

import type { QuestaoIA } from "../../types/index";

type LetraAlternativa = "A" | "B" | "C" | "D" | "E";
type RespostasUsuario = Record<string, LetraAlternativa>;

type Props = {
  questoes: QuestaoIA[];
  respostas: RespostasUsuario;
  finalizado: boolean;
  onTreinoCriado: (questoes: QuestaoIA[]) => void;
};

type Diagnostico = {
  chave: string;
  materia: string;
  assunto: string;
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
};

type RevisaoIA = {
  id: string;
  materia: string;
  assunto: string;
  origem: "simulado-ia";
  criadaEm: string;
  concluida: boolean;
};

const CHAVE_REVISOES_IA = "pmpe_revisoes_ia";

export default function DiagnosticoSimuladoIA({
  questoes,
  respostas,
  finalizado,
  onTreinoCriado,
}: Props) {
  const [mensagem, setMensagem] = useState("");

  const diagnostico = useMemo(
    () => calcularDiagnostico(questoes, respostas),
    [questoes, respostas]
  );

  const assuntosCriticos = diagnostico.filter(
    (item) => item.erradas > 0 || item.emBranco > 0
  );

  if (!finalizado) {
    return null;
  }

  function treinarErros() {
    const questoesParaTreino = questoes
      .filter(
        (item) =>
          respostas[item.id] !== item.respostaCorreta
      )
      .map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));

    if (questoesParaTreino.length === 0) {
      setMensagem("Você não possui questões erradas ou em branco.");
      return;
    }

    localStorage.setItem(
      "pmpe_questoes_ia",
      JSON.stringify(questoesParaTreino)
    );

    onTreinoCriado(questoesParaTreino);

    setMensagem(
      `Novo treino criado com ${questoesParaTreino.length} questão${
        questoesParaTreino.length === 1 ? "" : "ões"
      }.`
    );
  }

  function criarRevisoes() {
    if (assuntosCriticos.length === 0) {
      setMensagem("Não há assuntos com erro para revisar.");
      return;
    }

    const revisoesAtuais = carregarRevisoes();
    const chavesAtuais = new Set(
      revisoesAtuais.map((item) =>
        normalizar(`${item.materia}::${item.assunto}`)
      )
    );

    const novasRevisoes: RevisaoIA[] = [];

    assuntosCriticos.forEach((item) => {
      const chave = normalizar(
        `${item.materia}::${item.assunto}`
      );

      if (chavesAtuais.has(chave)) {
        return;
      }

      novasRevisoes.push({
        id: crypto.randomUUID(),
        materia: item.materia,
        assunto: item.assunto,
        origem: "simulado-ia",
        criadaEm: new Date().toISOString(),
        concluida: false,
      });

      chavesAtuais.add(chave);
    });

    localStorage.setItem(
      CHAVE_REVISOES_IA,
      JSON.stringify([...novasRevisoes, ...revisoesAtuais])
    );

    window.dispatchEvent(
      new Event("pmpe-revisoes-ia-atualizadas")
    );

    setMensagem(
      novasRevisoes.length > 0
        ? `${novasRevisoes.length} revisão${
            novasRevisoes.length === 1 ? "" : "ões"
          } criada${novasRevisoes.length === 1 ? "" : "s"}.`
        : "Esses assuntos já estavam na fila de revisões."
    );
  }

  return (
    <section className="diagnostico-ia">
      <div className="diagnostico-ia-topo">
        <div>
          <span>DIAGNÓSTICO</span>
          <h2>Desempenho por assunto</h2>
        </div>

        <div className="diagnostico-ia-acoes">
          <button type="button" onClick={criarRevisoes}>
            🔁 Criar revisões
          </button>

          <button type="button" onClick={treinarErros}>
            🎯 Treinar erros
          </button>
        </div>
      </div>

      {mensagem && (
        <div className="diagnostico-ia-mensagem">
          {mensagem}
        </div>
      )}

      <div className="diagnostico-ia-grid">
        {diagnostico.map((item) => (
          <article
            key={item.chave}
            className={
              item.percentual >= 70
                ? "bom"
                : item.percentual < 50
                  ? "fraco"
                  : "medio"
            }
          >
            <div>
              <strong>{item.materia}</strong>
              <span>{item.assunto}</span>
            </div>

            <div className="diagnostico-ia-numeros">
              <strong>{item.percentual}%</strong>
              <span>
                {item.certas} certas • {item.erradas} erros •{" "}
                {item.emBranco} em branco
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function calcularDiagnostico(
  questoes: QuestaoIA[],
  respostas: RespostasUsuario
): Diagnostico[] {
  const mapa = new Map<
    string,
    Omit<Diagnostico, "percentual">
  >();

  questoes.forEach((questao) => {
    const materia = questao.materia || "Sem matéria";
    const assunto = questao.assunto || "Sem assunto";
    const chave = normalizar(`${materia}::${assunto}`);

    const atual = mapa.get(chave) ?? {
      chave,
      materia,
      assunto,
      total: 0,
      certas: 0,
      erradas: 0,
      emBranco: 0,
    };

    const resposta = respostas[questao.id];
    const acertou = resposta === questao.respostaCorreta;

    mapa.set(chave, {
      ...atual,
      total: atual.total + 1,
      certas: atual.certas + (acertou ? 1 : 0),
      erradas:
        atual.erradas + (resposta && !acertou ? 1 : 0),
      emBranco: atual.emBranco + (!resposta ? 1 : 0),
    });
  });

  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      percentual:
        item.total === 0
          ? 0
          : Math.round((item.certas / item.total) * 100),
    }))
    .sort((a, b) => a.percentual - b.percentual);
}

function carregarRevisoes(): RevisaoIA[] {
  const salvo = localStorage.getItem(CHAVE_REVISOES_IA);

  if (!salvo) {
    return [];
  }

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as RevisaoIA[]) : [];
  } catch {
    return [];
  }
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
