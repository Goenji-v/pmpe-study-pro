import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import {
  finalizarTentativaOficial,
  iniciarTentativaOficial,
  listarQuestoesSimuladoOficial,
  listarSimuladosOficiais,
  type QuestaoOficial,
  type ResultadoSimuladoOficial,
  type SimuladoOficial as SimuladoOficialTipo,
  type TentativaOficial,
} from "../../services/simuladosOficiaisService";
import "./SimuladoOficial.css";

export default function SimuladoOficial() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { configuracoes } = useApp();
  const [simulado, setSimulado] = useState<SimuladoOficialTipo | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoOficial[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [eliminadas, setEliminadas] = useState<Record<string, string[]>>({});
  const [indice, setIndice] = useState(0);
  const [tentativa, setTentativa] = useState<TentativaOficial | null>(null);
  const [restante, setRestante] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimuladoOficial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState("");

  const finalizar = useCallback(async () => {
    if (!tentativa || finalizando || resultado) return;
    setFinalizando(true);
    try {
      const retorno = await finalizarTentativaOficial(tentativa.id, respostas);
      setResultado(retorno);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível corrigir o simulado.");
    } finally {
      setFinalizando(false);
    }
  }, [finalizando, respostas, resultado, tentativa]);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setErro("");
        const [lista, questoesDaProva] = await Promise.all([
          listarSimuladosOficiais(configuracoes.concurso),
          listarQuestoesSimuladoOficial(id),
        ]);
        const atual = lista.find((item) => item.id === id);
        if (!atual) throw new Error("Simulado não encontrado para o seu concurso.");
        if (!questoesDaProva.length) throw new Error("Este simulado ainda não possui questões publicadas.");

        const tentativaAtual = await iniciarTentativaOficial(id);
        if (!ativo) return;

        setSimulado(atual);
        setQuestoes(questoesDaProva);
        setTentativa(tentativaAtual);
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível abrir a prova.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [configuracoes.concurso, id]);

  useEffect(() => {
    if (!tentativa || !simulado || resultado) return;

    const atualizar = () => {
      const inicio = new Date(tentativa.iniciada_em).getTime();
      const limite = simulado.duracao_minutos * 60;
      const decorrido = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
      const novoRestante = Math.max(0, limite - decorrido);
      setRestante(novoRestante);
      if (novoRestante === 0) void finalizar();
    };

    atualizar();
    const timer = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(timer);
  }, [finalizar, resultado, simulado, tentativa]);

  useEffect(() => {
    if (!tentativa || resultado) return;

    const impedirSaida = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };

    window.addEventListener("beforeunload", impedirSaida);
    return () => window.removeEventListener("beforeunload", impedirSaida);
  }, [resultado, tentativa]);

  const questao = questoes[indice];
  const selecionada = questao ? respostas[String(questao.numero)] : undefined;
  const eliminadasAtual = questao ? (eliminadas[String(questao.numero)] || []) : [];
  const progresso = questoes.length ? Math.round(((indice + 1) / questoes.length) * 100) : 0;
  const respondidas = Object.keys(respostas).length;

  const materias = useMemo(() => [...new Set(questoes.map((item) => item.materia))], [questoes]);

  function alternarEliminacao(alternativaId: string) {
    if (!questao) return;
    const chave = String(questao.numero);
    setEliminadas((atual) => ({
      ...atual,
      [chave]: eliminadasAtual.includes(alternativaId)
        ? eliminadasAtual.filter((item) => item !== alternativaId)
        : [...eliminadasAtual, alternativaId],
    }));
  }

  function selecionar(alternativaId: string) {
    if (!questao || eliminadasAtual.includes(alternativaId)) return;
    setRespostas((atual) => ({ ...atual, [String(questao.numero)]: alternativaId }));
  }

  if (carregando) {
    return <section className="simulado-oficial"><div className="oficial-carregando">Preparando prova...</div></section>;
  }

  if (erro && !questao) {
    return (
      <section className="simulado-oficial">
        <div className="oficial-erro">
          <strong>{erro}</strong>
          <button type="button" onClick={() => navigate("/simulados")}>Voltar</button>
        </div>
      </section>
    );
  }

  if (resultado && simulado) {
    return (
      <ResultadoOficial
        resultado={resultado}
        simulado={simulado}
        tentativa={tentativa}
        onVoltar={() => navigate("/simulados")}
        materias={materias}
      />
    );
  }

  if (!questao || !simulado || !tentativa) return null;

  return (
    <section className="simulado-oficial">
      <header className="prova-header">
        <div>
          <span>{simulado.concurso_alvo} · {simulado.banca}</span>
          <h1>{simulado.nome}</h1>
          <small>
            Tentativa {tentativa.numero_tentativa} · {tentativa.conta_ranking ? "primeira tentativa oficial" : "treinamento — não entra no ranking"}
          </small>
        </div>
        <div className="cronometro-oficial" aria-label="Tempo restante">{formatarSegundos(restante)}</div>
      </header>

      <div className="progresso-oficial" aria-hidden="true"><span style={{ width: `${progresso}%` }} /></div>

      <div className="prova-layout">
        <main className="questao-oficial">
          <div className="questao-cabecalho">
            <strong>Questão {questao.numero}</strong>
            <span>{questao.materia} · {questao.assunto}</span>
          </div>

          <div className="enunciado-oficial">{questao.enunciado}</div>

          <div className="alternativas-oficial">
            {questao.alternativas.map((alternativa) => {
              const eliminada = eliminadasAtual.includes(alternativa.id);
              const selecionadaAtual = selecionada === alternativa.id;
              return (
                <div
                  key={alternativa.id}
                  className={`alternativa-oficial ${selecionadaAtual ? "selecionada" : ""} ${eliminada ? "eliminada" : ""}`}
                >
                  <button type="button" className="letra-alternativa" onClick={() => selecionar(alternativa.id)}>{alternativa.id}</button>
                  <button type="button" className="texto-alternativa" onClick={() => selecionar(alternativa.id)}>{alternativa.texto}</button>
                  <button type="button" className="tesoura-oficial" title="Eliminar alternativa" aria-label={`Eliminar alternativa ${alternativa.id}`} onClick={() => alternarEliminacao(alternativa.id)}>✂</button>
                </div>
              );
            })}
          </div>

          <div className="navegacao-oficial">
            <button type="button" disabled={indice === 0 || finalizando} onClick={() => setIndice((atual) => Math.max(0, atual - 1))}>← Anterior</button>
            <button type="button" disabled={finalizando} onClick={() => indice === questoes.length - 1 ? void finalizar() : setIndice((atual) => Math.min(questoes.length - 1, atual + 1))}>
              {indice === questoes.length - 1 ? (finalizando ? "Corrigindo..." : "Finalizar prova") : "Próxima →"}
            </button>
          </div>
        </main>

        <aside className="mapa-questoes">
          <strong>Questões</strong>
          <div>
            {questoes.map((item, itemIndex) => {
              const respondida = Boolean(respostas[String(item.numero)]);
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`${itemIndex === indice ? "atual" : ""} ${respondida ? "respondida" : ""}`}
                  onClick={() => setIndice(itemIndex)}
                >
                  {item.numero}
                </button>
              );
            })}
          </div>
          <small>{respondidas}/{questoes.length} respondidas</small>
        </aside>
      </div>
    </section>
  );
}

function ResultadoOficial({
  resultado,
  simulado,
  tentativa,
  onVoltar,
  materias,
}: {
  resultado: ResultadoSimuladoOficial;
  simulado: SimuladoOficialTipo;
  tentativa: TentativaOficial | null;
  onVoltar: () => void;
  materias: string[];
}) {
  const erros = resultado.questoes.filter((questao) => questao.correta === false);

  return (
    <section className="resultado-oficial">
      <header>
        <span>RESULTADO DO SIMULADO OFICIAL</span>
        <h1>{simulado.nome}</h1>
        <p>{tentativa?.conta_ranking ? "Sua primeira tentativa fica marcada como oficial para a regra de ranking." : "Esta tentativa foi registrada como treinamento."}</p>
      </header>

      <div className="resultado-principal">
        <strong>{resultado.percentual}%</strong>
        <span>{resultado.certas} acertos · {resultado.erradas} erros · {resultado.emBranco} em branco · {resultado.anuladas} anuladas</span>
      </div>

      <section>
        <h2>Desempenho por matéria</h2>
        <div className="resultado-materias">
          {materias.map((materia) => {
            const item = resultado.porMateria.find((linha) => linha.materia === materia);
            return item ? (
              <article key={materia}>
                <strong>{materia}</strong>
                <span>{item.certas}/{item.total} · {item.percentual}%</span>
              </article>
            ) : null;
          })}
        </div>
      </section>

      <section className="resultado-assuntos">
        <h2>Desempenho por assunto</h2>
        {resultado.porAssunto.map((item) => (
          <div key={`${item.materia}-${item.assunto}`}>
            <span>{item.materia} · {item.assunto}</span>
            <strong>{item.certas}/{item.total} · {item.percentual}%</strong>
          </div>
        ))}
      </section>

      <section className="resultado-erros">
        <h2>Questões erradas</h2>
        {erros.length === 0 ? (
          <p>Nenhuma questão errada.</p>
        ) : (
          erros.map((questao) => (
            <article key={questao.numero}>
              <strong>Questão {questao.numero}</strong>
              <span>{questao.materia} · {questao.assunto}</span>
              <p>Marcada: {questao.respostaMarcada || "em branco"} · Gabarito: {questao.respostaCorreta}</p>
            </article>
          ))
        )}
      </section>

      <button type="button" onClick={onVoltar}>Voltar para Simulados</button>
    </section>
  );
}

function formatarSegundos(total: number) {
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  return horas > 0
    ? `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`
    : `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}
