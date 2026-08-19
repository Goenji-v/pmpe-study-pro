import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./BancoQuestoes.css";
import "./BancoQuestoesBiblioteca.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";

import type {
  Assunto,
  Dificuldade,
  Materia,
  QuestaoBanco,
  QuestaoIA,
} from "../../types/index";

type QuestaoBiblioteca = QuestaoBanco & {
  favoritada?: boolean;
  revisarDepois?: boolean;
};

type FiltroStatus =
  | "todas"
  | "erradas"
  | "acertadas"
  | "nao_resolvidas"
  | "favoritas"
  | "revisar";

type ResultadoIAHistorico = {
  data?: string;
  respostas?: Record<string, string>;
  questoes?: QuestaoIA[];
};

type EstatisticaQuestao = {
  tentativas: number;
  acertos: number;
  erros: number;
  percentual: number;
  ultima: "acerto" | "erro" | null;
  ultimaData: string | null;
};

const CHAVE_RESULTADOS_IA = "pmpe_resultados_simulados_ia";
const CHAVE_QUESTOES_IA = "pmpe_questoes_ia";

const estatisticaVazia: EstatisticaQuestao = {
  tentativas: 0,
  acertos: 0,
  erros: 0,
  percentual: 0,
  ultima: null,
  ultimaData: null,
};

export default function BancoQuestoes() {
  const navigate = useNavigate();
  const {
    materias,
    bancoQuestoes,
    setBancoQuestoes,
  } = useApp();

  const { showToast } = useToast();

  const questoesBiblioteca = bancoQuestoes as QuestaoBiblioteca[];

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroMateria, setFiltroMateria] = useState("");
  const [filtroDificuldade, setFiltroDificuldade] = useState("");
  const [busca, setBusca] = useState("");
  const [quantidadeTreino, setQuantidadeTreino] = useState(10);

  const [materiaId, setMateriaId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [assuntoId, setAssuntoId] = useState("");
  const [banca, setBanca] = useState("AOCP");
  const [dificuldade, setDificuldade] = useState<Dificuldade>("media");
  const [enunciado, setEnunciado] = useState("");
  const [alternativaA, setAlternativaA] = useState("");
  const [alternativaB, setAlternativaB] = useState("");
  const [alternativaC, setAlternativaC] = useState("");
  const [alternativaD, setAlternativaD] = useState("");
  const [alternativaE, setAlternativaE] = useState("");
  const [respostaCorretaId, setRespostaCorretaId] = useState("A");
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

  const estatisticasPorQuestao = useMemo(
    () => carregarEstatisticasQuestoes(),
    [bancoQuestoes]
  );

  const estatisticaDaQuestao = (questao: QuestaoBanco) =>
    estatisticasPorQuestao.get(chaveQuestao(questao)) ?? estatisticaVazia;

  const contagens = useMemo(() => {
    let erradas = 0;
    let acertadas = 0;
    let naoResolvidas = 0;
    let favoritas = 0;
    let revisar = 0;

    questoesBiblioteca.forEach((questao) => {
      const estatistica = estatisticasPorQuestao.get(chaveQuestao(questao)) ?? estatisticaVazia;
      if (estatistica.tentativas === 0) naoResolvidas += 1;
      if (estatistica.ultima === "erro") erradas += 1;
      if (estatistica.ultima === "acerto") acertadas += 1;
      if (questao.favoritada) favoritas += 1;
      if (questao.revisarDepois) revisar += 1;
    });

    return {
      todas: questoesBiblioteca.length,
      erradas,
      acertadas,
      naoResolvidas,
      favoritas,
      revisar,
    };
  }, [estatisticasPorQuestao, questoesBiblioteca]);

  const materiasDisponiveis = useMemo(
    () => Array.from(new Set(questoesBiblioteca.map((questao) => questao.materia))).sort(),
    [questoesBiblioteca]
  );

  const questoesFiltradas = useMemo(() => {
    const termo = normalizar(busca);

    return questoesBiblioteca.filter((questao) => {
      const estatistica = estatisticasPorQuestao.get(chaveQuestao(questao)) ?? estatisticaVazia;

      if (filtroMateria && questao.materia !== filtroMateria) return false;
      if (filtroDificuldade && questao.dificuldade !== filtroDificuldade) return false;

      if (filtroStatus === "erradas" && estatistica.ultima !== "erro") return false;
      if (filtroStatus === "acertadas" && estatistica.ultima !== "acerto") return false;
      if (filtroStatus === "nao_resolvidas" && estatistica.tentativas > 0) return false;
      if (filtroStatus === "favoritas" && !questao.favoritada) return false;
      if (filtroStatus === "revisar" && !questao.revisarDepois) return false;

      if (!termo) return true;

      return normalizar(
        `${questao.materia} ${questao.modulo ?? ""} ${questao.assunto} ${questao.banca} ${questao.enunciado}`
      ).includes(termo);
    });
  }, [
    busca,
    estatisticasPorQuestao,
    filtroDificuldade,
    filtroMateria,
    filtroStatus,
    questoesBiblioteca,
  ]);

  function salvarQuestao() {
    const assuntoSelecionado = moduloSelecionado?.assuntos.find(
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
      showToast("Informe pelo menos duas alternativas.", "warning");
      return;
    }

    if (!alternativas.some((alternativa) => alternativa.id === respostaCorretaId)) {
      showToast("A alternativa correta precisa estar preenchida.", "warning");
      return;
    }

    const novaQuestao: QuestaoBiblioteca = {
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
      favoritada: false,
      revisarDepois: false,
    };

    setBancoQuestoes((anteriores) => [novaQuestao, ...anteriores]);
    limparFormulario();
    showToast("Questão adicionada à biblioteca.", "success");
  }

  function excluirQuestao(id: string) {
    if (!window.confirm("Deseja excluir esta questão da biblioteca?")) return;

    setBancoQuestoes((anteriores) =>
      anteriores.filter((questao) => questao.id !== id)
    );

    showToast("Questão excluída.", "info");
  }

  function alternarMarcacao(
    id: string,
    campo: "favoritada" | "revisarDepois"
  ) {
    setBancoQuestoes((anteriores) =>
      anteriores.map((questao) => {
        if (questao.id !== id) return questao;
        const atual = questao as QuestaoBiblioteca;
        return {
          ...atual,
          [campo]: !atual[campo],
        };
      })
    );
  }

  function iniciarTreino(lista: QuestaoBiblioteca[]) {
    if (lista.length === 0) {
      showToast("Nenhuma questão disponível neste filtro.", "warning");
      return;
    }

    const quantidade = Math.min(Math.max(1, quantidadeTreino), lista.length);
    const sorteadas = embaralhar(lista).slice(0, quantidade);
    const questoesIA = sorteadas.map(converterParaQuestaoIA);

    localStorage.setItem(CHAVE_QUESTOES_IA, JSON.stringify(questoesIA));
    navigate("/resolver-simulado-ia/prova");
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
    <section className="banco-container banco-biblioteca">
      <header className="banco-biblioteca-cabecalho">
        <div>
          <span className="banco-biblioteca-kicker">BIBLIOTECA DE TREINO</span>
          <h1 className="banco-title">🧠 Banco de Questões</h1>
          <p className="banco-subtitle">
            Guarde questões, acompanhe seu histórico e monte treinos direcionados.
          </p>
        </div>
        <button
          type="button"
          className="banco-treinar-principal"
          onClick={() => iniciarTreino(questoesFiltradas)}
          disabled={questoesFiltradas.length === 0}
        >
          ▶ Treinar filtradas
        </button>
      </header>

      <div className="banco-biblioteca-resumo">
        <Resumo titulo="Total" valor={contagens.todas} />
        <Resumo titulo="Erradas" valor={contagens.erradas} classe="erro" />
        <Resumo titulo="Nunca respondidas" valor={contagens.naoResolvidas} classe="neutro" />
        <Resumo titulo="Favoritas" valor={contagens.favoritas} classe="favorita" />
        <Resumo titulo="Revisar depois" valor={contagens.revisar} classe="revisar" />
      </div>

      <section className="banco-biblioteca-filtros">
        <div className="banco-status-tabs" role="tablist" aria-label="Filtrar questões por desempenho">
          <FiltroBotao ativo={filtroStatus === "todas"} onClick={() => setFiltroStatus("todas")}>Todas {contagens.todas}</FiltroBotao>
          <FiltroBotao ativo={filtroStatus === "erradas"} onClick={() => setFiltroStatus("erradas")}>Erradas {contagens.erradas}</FiltroBotao>
          <FiltroBotao ativo={filtroStatus === "acertadas"} onClick={() => setFiltroStatus("acertadas")}>Acertadas {contagens.acertadas}</FiltroBotao>
          <FiltroBotao ativo={filtroStatus === "nao_resolvidas"} onClick={() => setFiltroStatus("nao_resolvidas")}>Nunca respondidas {contagens.naoResolvidas}</FiltroBotao>
          <FiltroBotao ativo={filtroStatus === "favoritas"} onClick={() => setFiltroStatus("favoritas")}>★ Favoritas {contagens.favoritas}</FiltroBotao>
          <FiltroBotao ativo={filtroStatus === "revisar"} onClick={() => setFiltroStatus("revisar")}>⚑ Revisar {contagens.revisar}</FiltroBotao>
        </div>

        <div className="banco-filtros-linha">
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar questão, matéria ou assunto..."
            aria-label="Buscar no banco de questões"
          />

          <select value={filtroMateria} onChange={(evento) => setFiltroMateria(evento.target.value)}>
            <option value="">Todas as matérias</option>
            {materiasDisponiveis.map((materia) => (
              <option key={materia} value={materia}>{materia}</option>
            ))}
          </select>

          <select value={filtroDificuldade} onChange={(evento) => setFiltroDificuldade(evento.target.value)}>
            <option value="">Todas as dificuldades</option>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
          </select>

          <label className="banco-quantidade-treino">
            Treino
            <select
              value={quantidadeTreino}
              onChange={(evento) => setQuantidadeTreino(Number(evento.target.value))}
            >
              {[5, 10, 20, 30, 50].map((quantidade) => (
                <option key={quantidade} value={quantidade}>{quantidade} questões</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="banco-biblioteca-contagem">
        <strong>{questoesFiltradas.length}</strong> questão{questoesFiltradas.length === 1 ? "" : "ões"} neste filtro
      </div>

      {questoesFiltradas.length === 0 ? (
        <div className="banco-vazio banco-vazio-biblioteca">
          Nenhuma questão corresponde aos filtros selecionados.
        </div>
      ) : (
        <div className="banco-biblioteca-lista">
          {questoesFiltradas.map((questao) => {
            const estatistica = estatisticaDaQuestao(questao);

            return (
              <article key={questao.id} className="banco-biblioteca-item">
                <div className="banco-biblioteca-item-topo">
                  <div>
                    <span>{questao.materia}</span>
                    <strong>{questao.assunto}</strong>
                    <small>{questao.banca} · {rotuloDificuldade(questao.dificuldade)}</small>
                  </div>
                  <div className="banco-biblioteca-tags">
                    {estatistica.tentativas === 0 ? (
                      <span className="nunca">Nunca respondida</span>
                    ) : (
                      <span className={estatistica.ultima === "acerto" ? "acerto" : "erro"}>
                        Última: {estatistica.ultima === "acerto" ? "Acerto" : "Erro"}
                      </span>
                    )}
                    {questao.favoritada && <span className="favorita">★ Favorita</span>}
                    {questao.revisarDepois && <span className="revisar">⚑ Revisar</span>}
                  </div>
                </div>

                <p className="banco-biblioteca-enunciado">{questao.enunciado}</p>

                <div className="banco-biblioteca-desempenho">
                  <span><strong>{estatistica.tentativas}</strong> tentativa{estatistica.tentativas === 1 ? "" : "s"}</span>
                  <span className="positivo"><strong>{estatistica.acertos}</strong> acerto{estatistica.acertos === 1 ? "" : "s"}</span>
                  <span className="negativo"><strong>{estatistica.erros}</strong> erro{estatistica.erros === 1 ? "" : "s"}</span>
                  <span><strong>{estatistica.percentual}%</strong> aproveitamento</span>
                </div>

                <details className="banco-biblioteca-gabarito">
                  <summary>Ver gabarito e explicação</summary>
                  <div className="banco-alternativas">
                    {questao.alternativas.map((alternativa) => (
                      <p
                        key={alternativa.id}
                        className={
                          alternativa.id === questao.respostaCorretaId
                            ? "banco-alternativa-correta"
                            : ""
                        }
                      >
                        {alternativa.id}) {alternativa.texto}
                      </p>
                    ))}
                  </div>
                  {questao.explicacao && (
                    <p className="banco-explicacao">
                      <strong>Explicação:</strong> {questao.explicacao}
                    </p>
                  )}
                </details>

                <div className="banco-biblioteca-acoes">
                  <button
                    type="button"
                    className={questao.favoritada ? "ativo favorita" : ""}
                    onClick={() => alternarMarcacao(questao.id, "favoritada")}
                  >
                    {questao.favoritada ? "★ Favorita" : "☆ Favoritar"}
                  </button>
                  <button
                    type="button"
                    className={questao.revisarDepois ? "ativo revisar" : ""}
                    onClick={() => alternarMarcacao(questao.id, "revisarDepois")}
                  >
                    {questao.revisarDepois ? "⚑ Marcada" : "⚐ Revisar depois"}
                  </button>
                  <button type="button" className="treinar" onClick={() => iniciarTreino([questao])}>
                    ▶ Treinar esta
                  </button>
                  <button type="button" className="excluir" onClick={() => excluirQuestao(questao.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <details className="banco-cadastro-manual">
        <summary>＋ Cadastrar questão manualmente</summary>
        <div className="banco-card banco-cadastro-conteudo">
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
              <option value="">Selecione uma matéria</option>
              {materias.map((materia: Materia) => (
                <option key={materia.id} value={materia.id}>{materia.nome}</option>
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
              <option value="">Selecione um módulo</option>
              {modulosDisponiveis.map((modulo) => (
                <option key={modulo.id} value={modulo.id}>{modulo.nome}</option>
              ))}
            </select>
          </div>

          <div className="banco-form-group">
            <label>Assunto</label>
            <select
              value={assuntoId}
              onChange={(evento) => setAssuntoId(evento.target.value)}
              disabled={!moduloId}
            >
              <option value="">Selecione um assunto</option>
              {moduloSelecionado?.assuntos.map((assunto: Assunto) => (
                <option key={assunto.id} value={assunto.id}>{assunto.nome}</option>
              ))}
            </select>
          </div>

          <div className="banco-form-row">
            <div className="banco-form-group">
              <label>Banca</label>
              <select value={banca} onChange={(evento) => setBanca(evento.target.value)}>
                {['AOCP', 'CEBRASPE', 'FGV', 'FCC', 'VUNESP', 'IBFC', 'IDECAN', 'Outra'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="banco-form-group">
              <label>Dificuldade</label>
              <select
                value={dificuldade}
                onChange={(evento) => setDificuldade(evento.target.value as Dificuldade)}
              >
                <option value="facil">Fácil</option>
                <option value="media">Média</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
          </div>

          <div className="banco-form-group">
            <label>Enunciado</label>
            <textarea value={enunciado} onChange={(evento) => setEnunciado(evento.target.value)} placeholder="Digite o enunciado da questão." />
          </div>

          {[
            ["A", alternativaA, setAlternativaA],
            ["B", alternativaB, setAlternativaB],
            ["C", alternativaC, setAlternativaC],
            ["D", alternativaD, setAlternativaD],
            ["E", alternativaE, setAlternativaE],
          ].map(([letra, valor, setter]) => (
            <div className="banco-form-group" key={String(letra)}>
              <label>Alternativa {String(letra)}</label>
              <input
                value={String(valor)}
                onChange={(evento) => (setter as React.Dispatch<React.SetStateAction<string>>)(evento.target.value)}
              />
            </div>
          ))}

          <div className="banco-form-group">
            <label>Resposta correta</label>
            <select value={respostaCorretaId} onChange={(evento) => setRespostaCorretaId(evento.target.value)}>
              {['A', 'B', 'C', 'D', 'E'].map((letra) => <option key={letra} value={letra}>{letra}</option>)}
            </select>
          </div>

          <div className="banco-form-group">
            <label>Explicação</label>
            <textarea value={explicacao} onChange={(evento) => setExplicacao(evento.target.value)} placeholder="Justificativa ou comentário do gabarito." />
          </div>

          <button className="banco-salvar" type="button" onClick={salvarQuestao}>
            Salvar questão
          </button>
        </div>
      </details>
    </section>
  );
}

function Resumo({
  titulo,
  valor,
  classe = "",
}: {
  titulo: string;
  valor: number;
  classe?: string;
}) {
  return (
    <article className={`banco-biblioteca-resumo-card ${classe}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function FiltroBotao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={ativo ? "ativo" : ""} onClick={onClick}>
      {children}
    </button>
  );
}

function carregarEstatisticasQuestoes() {
  const mapa = new Map<string, EstatisticaQuestao>();
  const salvo = localStorage.getItem(CHAVE_RESULTADOS_IA);
  if (!salvo) return mapa;

  let resultados: ResultadoIAHistorico[] = [];
  try {
    const valor: unknown = JSON.parse(salvo);
    resultados = Array.isArray(valor) ? (valor as ResultadoIAHistorico[]) : [];
  } catch {
    return mapa;
  }

  resultados.forEach((resultado) => {
    (resultado.questoes ?? []).forEach((questao) => {
      const resposta = resultado.respostas?.[questao.id];
      if (!resposta) return;

      const chave = chaveQuestaoIA(questao);
      const atual = mapa.get(chave) ?? { ...estatisticaVazia };
      const correta = resposta === questao.respostaCorreta;
      const data = resultado.data ?? null;
      const ehMaisRecente = !atual.ultimaData || !data || new Date(data).getTime() >= new Date(atual.ultimaData).getTime();

      const proxima: EstatisticaQuestao = {
        tentativas: atual.tentativas + 1,
        acertos: atual.acertos + (correta ? 1 : 0),
        erros: atual.erros + (correta ? 0 : 1),
        percentual: 0,
        ultima: ehMaisRecente ? (correta ? "acerto" : "erro") : atual.ultima,
        ultimaData: ehMaisRecente ? data : atual.ultimaData,
      };

      proxima.percentual = Math.round((proxima.acertos / proxima.tentativas) * 100);
      mapa.set(chave, proxima);
    });
  });

  return mapa;
}

function converterParaQuestaoIA(questao: QuestaoBanco): QuestaoIA {
  const alternativas = Object.fromEntries(
    questao.alternativas.map((alternativa) => [alternativa.id, alternativa.texto])
  ) as Record<string, string>;

  return {
    id: questao.id,
    materia: questao.materia,
    modulo: questao.modulo,
    moduloId: questao.moduloId,
    assunto: questao.assunto,
    banca: questao.banca,
    dificuldade:
      questao.dificuldade === "facil"
        ? "Fácil"
        : questao.dificuldade === "dificil"
          ? "Difícil"
          : "Média",
    enunciado: questao.enunciado,
    alternativas: {
      A: alternativas.A ?? "",
      B: alternativas.B ?? "",
      C: alternativas.C ?? "",
      D: alternativas.D ?? "",
      E: alternativas.E ?? "",
    },
    respostaCorreta: questao.respostaCorretaId as QuestaoIA["respostaCorreta"],
    explicacao: questao.explicacao ?? "",
  };
}

function chaveQuestao(questao: QuestaoBanco) {
  return normalizar(`${questao.materia}::${questao.assunto}::${questao.enunciado}`);
}

function chaveQuestaoIA(questao: QuestaoIA) {
  return normalizar(`${questao.materia}::${questao.assunto}::${questao.enunciado}`);
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function rotuloDificuldade(dificuldade: Dificuldade) {
  if (dificuldade === "facil") return "Fácil";
  if (dificuldade === "dificil") return "Difícil";
  return "Média";
}

function embaralhar<T>(lista: T[]) {
  const copia = [...lista];
  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const sorteado = Math.floor(Math.random() * (indice + 1));
    [copia[indice], copia[sorteado]] = [copia[sorteado], copia[indice]];
  }
  return copia;
}
