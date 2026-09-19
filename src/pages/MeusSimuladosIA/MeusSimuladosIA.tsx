import { armazenamentoLocalDaConta as localStorage } from "../../services/armazenamentoConta";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./MeusSimuladosIA.css";

import {
  ativarCadernoSimuladoIA,
  excluirCadernoSimuladoIA,
  listarCadernosSimuladosIA,
  type CadernoSimuladoIA,
  type EstatisticasCadernoIA,
} from "../../services/cadernosSimuladosIAService";
import { assinaturaCadernoIA } from "../../services/catalogoQuestoesIAUtils";
import { inferirTipoSessaoQuestoesIA } from "../../utils/resultadoQuestoesIA";
import type { QuestaoIA } from "../../types";

type ResultadoLegadoIA = {
  cadernoId?: string;
  data: string;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
  questoes: QuestaoIA[];
};

type FiltroStatus =
  | "todos"
  | "nao_resolvidos"
  | "resolvidos";

type FiltroTipo =
  | "todos"
  | "questoes"
  | "simulado";

const CHAVE_RESULTADOS_IA = "pmpe_resultados_simulados_ia";

export default function MeusSimuladosIA() {
  const navigate = useNavigate();
  const [cadernos, setCadernos] = useState<CadernoSimuladoIA[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [materia, setMateria] = useState("todas");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const encontrados = await listarCadernosSimuladosIA();
      setCadernos(encontrados);
    } catch (error) {
      console.error("Erro ao carregar Caderno de Questões:", error);
      setErro("Não foi possível carregar seus cadernos agora.");
    } finally {
      setCarregando(false);
    }
  }

  function resolver(caderno: CadernoSimuladoIA) {
    ativarCadernoSimuladoIA(caderno);
    navigate("/resolver-simulado-ia/prova");
  }

  async function excluir(caderno: CadernoSimuladoIA) {
    const confirmar = window.confirm(
      `Excluir o caderno “${caderno.nome}”? As questões continuam no Banco de Questões.`
    );

    if (!confirmar) return;

    try {
      setExcluindoId(caderno.id);
      await excluirCadernoSimuladoIA(caderno.id);
      setCadernos((anteriores) =>
        anteriores.filter((item) => item.id !== caderno.id)
      );
    } catch (error) {
      console.error("Erro ao excluir caderno IA:", error);
      setErro("Não foi possível excluir o caderno agora.");
    } finally {
      setExcluindoId(null);
    }
  }

  const totalQuestoes = useMemo(
    () => cadernos.reduce((total, item) => total + item.questoes.length, 0),
    [cadernos]
  );

  const estatisticasPorCaderno = useMemo(
    () => obterEstatisticasPorCaderno(cadernos),
    [cadernos]
  );

  const materias = useMemo(
    () =>
      Array.from(
        new Set(
          cadernos
            .map((caderno) => caderno.materia.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [cadernos]
  );

  const resolvidos = useMemo(
    () =>
      cadernos.filter((caderno) =>
        estatisticasPorCaderno.has(caderno.id)
      ).length,
    [cadernos, estatisticasPorCaderno]
  );

  const naoResolvidos = cadernos.length - resolvidos;

  const cadernosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca);

    return cadernos.filter((caderno) => {
      const estatisticas = estatisticasPorCaderno.get(caderno.id);
      const tipoCaderno =
        caderno.tipo ?? inferirTipoSessaoQuestoesIA(caderno.questoes);

      if (materia !== "todas" && caderno.materia !== materia) {
        return false;
      }

      if (tipo !== "todos" && tipoCaderno !== tipo) {
        return false;
      }

      if (status === "resolvidos" && !estatisticas) {
        return false;
      }

      if (status === "nao_resolvidos" && estatisticas) {
        return false;
      }

      if (!termo) return true;

      return normalizarTexto(
        [
          caderno.nome,
          caderno.materia,
          caderno.modulo,
          caderno.assunto,
          caderno.banca,
          caderno.dificuldade,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(termo);
    });
  }, [
    busca,
    cadernos,
    estatisticasPorCaderno,
    materia,
    status,
    tipo,
  ]);

  const temFiltroAtivo =
    busca.trim() !== "" ||
    materia !== "todas" ||
    status !== "todos" ||
    tipo !== "todos";

  function limparFiltros() {
    setBusca("");
    setMateria("todas");
    setStatus("todos");
    setTipo("todos");
  }

  return (
    <section className="cadernos-ia-container">
      <header className="cadernos-ia-cabecalho">
        <div>
          <span className="cadernos-ia-kicker">HISTÓRICO PERMANENTE</span>
          <h1>Caderno de Questões</h1>
          <p>
            Todas as gerações concluídas ficam guardadas aqui. Filtre por matéria,
            tipo ou status e volte a qualquer caderno quando quiser.
          </p>
        </div>

        <button
          type="button"
          className="cadernos-ia-novo"
          onClick={() => navigate("/gerar-simulado-ia")}
        >
          + Gerar novo
        </button>
      </header>

      <div className="cadernos-ia-resumo">
        <div>
          <span>Cadernos</span>
          <strong>{cadernos.length}</strong>
        </div>
        <div>
          <span>Questões salvas</span>
          <strong>{totalQuestoes}</strong>
        </div>
        <div>
          <span>Resolvidos</span>
          <strong>{resolvidos}</strong>
        </div>
        <div>
          <span>Não resolvidos</span>
          <strong>{naoResolvidos}</strong>
        </div>
      </div>

      {cadernos.length > 0 && (
        <section
          className="cadernos-ia-filtros"
          aria-label="Filtros do Caderno de Questões"
        >
          <label className="cadernos-ia-busca">
            <span>Buscar</span>
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Matéria, assunto, módulo ou banca"
            />
          </label>

          <label>
            <span>Matéria</span>
            <select
              value={materia}
              onChange={(evento) => setMateria(evento.target.value)}
            >
              <option value="todas">Todas</option>
              {materias.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tipo</span>
            <select
              value={tipo}
              onChange={(evento) =>
                setTipo(evento.target.value as FiltroTipo)
              }
            >
              <option value="todos">Todos</option>
              <option value="questoes">Questões</option>
              <option value="simulado">Simulados</option>
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(evento) =>
                setStatus(evento.target.value as FiltroStatus)
              }
            >
              <option value="todos">Todos</option>
              <option value="nao_resolvidos">Não resolvidos</option>
              <option value="resolvidos">Resolvidos</option>
            </select>
          </label>

          {temFiltroAtivo && (
            <button
              type="button"
              className="cadernos-ia-limpar-filtros"
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          )}
        </section>
      )}

      {erro && <div className="cadernos-ia-erro">{erro}</div>}

      {carregando && (
        <div className="cadernos-ia-vazio" role="status">
          Carregando seu Caderno de Questões...
        </div>
      )}

      {!carregando && cadernos.length === 0 ? (
        <div className="cadernos-ia-vazio cadernos-ia-vazio-grande">
          <div className="cadernos-ia-vazio-icone">📚</div>
          <h2>Nenhum caderno salvo</h2>
          <p>
            Gere seu primeiro conjunto de questões. Quando a geração terminar,
            o caderno aparecerá aqui automaticamente.
          </p>
          <button type="button" onClick={() => navigate("/gerar-simulado-ia")}>
            Gerar questões ou simulado
          </button>
        </div>
      ) : !carregando && cadernosFiltrados.length === 0 ? (
        <div className="cadernos-ia-vazio cadernos-ia-vazio-grande">
          <div className="cadernos-ia-vazio-icone">🔎</div>
          <h2>Nenhum caderno encontrado</h2>
          <p>
            Não há cadernos que correspondam aos filtros atuais.
          </p>
          <button type="button" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      ) : !carregando ? (
        <div className="cadernos-ia-grid">
          {cadernosFiltrados.map((caderno) => {
            const estatisticas = estatisticasPorCaderno.get(caderno.id);
            const tipoCaderno =
              caderno.tipo ?? inferirTipoSessaoQuestoesIA(caderno.questoes);
            const resolvido = Boolean(estatisticas);

            return (
              <article key={caderno.id} className="caderno-ia-card">
                <div className="caderno-ia-topo">
                  <div className="caderno-ia-icone">📘</div>
                  <div className="caderno-ia-titulo">
                    <div className="caderno-ia-titulo-linha">
                      <span>{caderno.materia}</span>
                      <span
                        className={
                          resolvido
                            ? "caderno-ia-status resolvido"
                            : "caderno-ia-status pendente"
                        }
                      >
                        {resolvido ? "Resolvido" : "Não resolvido"}
                      </span>
                    </div>
                    <h2>{caderno.assunto}</h2>
                  </div>
                </div>

                <div className="caderno-ia-tags">
                  <span>{tipoCaderno === "simulado" ? "Simulado" : "Questões"}</span>
                  <span>{caderno.questoes.length} questões</span>
                  <span>{caderno.dificuldade}</span>
                  <span>{caderno.banca}</span>
                </div>

                {caderno.modulo && (
                  <p className="caderno-ia-modulo">{caderno.modulo}</p>
                )}

                <div className="caderno-ia-estatisticas">
                  <div>
                    <span>Questões</span>
                    <strong>{caderno.questoes.length}</strong>
                  </div>
                  <div>
                    <span>Acertos</span>
                    <strong>{estatisticas?.acertos ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Erros</span>
                    <strong>{estatisticas?.erros ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Aproveitamento</span>
                    <strong>
                      {estatisticas
                        ? `${estatisticas.aproveitamento}%`
                        : "Não resolvido"}
                    </strong>
                  </div>
                </div>

                {estatisticas && (
                  <div className="caderno-ia-tentativas">
                    {estatisticas.tentativas} tentativa
                    {estatisticas.tentativas === 1 ? "" : "s"} · última em{" "}
                    {formatarData(estatisticas.ultimaTentativaEm)}
                  </div>
                )}

                <div className="caderno-ia-data">
                  Criado em {formatarData(caderno.criadoEm)}
                </div>

                <div className="caderno-ia-acoes">
                  {estatisticas && (
                    <button
                      type="button"
                      className="caderno-ia-revisar"
                      onClick={() =>
                        navigate(
                          `/resolver-simulado-ia/revisao/${caderno.id}`
                        )
                      }
                    >
                      Ver correção
                    </button>
                  )}

                  <button
                    type="button"
                    className="caderno-ia-resolver"
                    onClick={() => resolver(caderno)}
                  >
                    {estatisticas ? "Resolver novamente" : "Resolver"}
                  </button>

                  <button
                    type="button"
                    className="caderno-ia-excluir"
                    disabled={excluindoId === caderno.id}
                    onClick={() => void excluir(caderno)}
                  >
                    {excluindoId === caderno.id
                      ? "Excluindo..."
                      : "Excluir caderno"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function obterEstatisticasPorCaderno(cadernos: CadernoSimuladoIA[]) {
  const mapa = new Map<string, EstatisticasCadernoIA>();
  const resultados = carregarResultadosLegados();

  cadernos.forEach((caderno) => {
    if (caderno.estatisticas) {
      mapa.set(caderno.id, caderno.estatisticas);
      return;
    }

    const assinatura = assinaturaCadernoIA(caderno.questoes);
    const compativeis = resultados
      .filter(
        (resultado) =>
          resultado.cadernoId === caderno.id ||
          assinaturaCadernoIA(resultado.questoes) === assinatura
      )
      .sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

    if (compativeis.length === 0) return;

    const ultima = compativeis[0];
    mapa.set(caderno.id, {
      tentativas: compativeis.length,
      acertos: ultima.certas,
      erros: ultima.erradas,
      emBranco: ultima.emBranco,
      aproveitamento: ultima.percentual,
      ultimaTentativaEm: ultima.data,
    });
  });

  return mapa;
}

function carregarResultadosLegados(): ResultadoLegadoIA[] {
  const salvo = localStorage.getItem(CHAVE_RESULTADOS_IA);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as ResultadoLegadoIA[]) : [];
  } catch {
    return [];
  }
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
