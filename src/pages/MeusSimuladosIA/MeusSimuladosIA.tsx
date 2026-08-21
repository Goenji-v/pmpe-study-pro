import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./MeusSimuladosIA.css";

import {
  ativarCadernoSimuladoIA,
  excluirCadernoSimuladoIA,
  listarCadernosSimuladosIA,
  type CadernoSimuladoIA,
} from "../../services/cadernosSimuladosIAService";

export default function MeusSimuladosIA() {
  const navigate = useNavigate();
  const [cadernos, setCadernos] = useState<CadernoSimuladoIA[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

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
      console.error("Erro ao carregar Meus Simulados IA:", error);
      setErro("Não foi possível carregar os cadernos agora.");
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

  if (carregando) {
    return (
      <section className="cadernos-ia-container">
        <div className="cadernos-ia-vazio">Carregando seus simulados IA...</div>
      </section>
    );
  }

  return (
    <section className="cadernos-ia-container">
      <header className="cadernos-ia-cabecalho">
        <div>
          <span className="cadernos-ia-kicker">SIMULADOS IA</span>
          <h1>Meus Simulados IA</h1>
          <p>
            Cada geração fica salva como um caderno separado. Escolha qual matéria e assunto quer resolver.
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
      </div>

      {erro && <div className="cadernos-ia-erro">{erro}</div>}

      {cadernos.length === 0 ? (
        <div className="cadernos-ia-vazio cadernos-ia-vazio-grande">
          <div className="cadernos-ia-vazio-icone">🤖</div>
          <h2>Nenhum simulado IA salvo</h2>
          <p>Gere seu primeiro conjunto de questões. Ele aparecerá aqui automaticamente.</p>
          <button type="button" onClick={() => navigate("/gerar-simulado-ia")}>
            Gerar Simulado IA
          </button>
        </div>
      ) : (
        <div className="cadernos-ia-grid">
          {cadernos.map((caderno) => (
            <article key={caderno.id} className="caderno-ia-card">
              <div className="caderno-ia-topo">
                <div className="caderno-ia-icone">🤖</div>
                <div className="caderno-ia-titulo">
                  <span>{caderno.materia}</span>
                  <h2>{caderno.assunto}</h2>
                </div>
              </div>

              <div className="caderno-ia-tags">
                <span>{caderno.questoes.length} questões</span>
                <span>{caderno.dificuldade}</span>
                <span>{caderno.banca}</span>
              </div>

              {caderno.modulo && (
                <p className="caderno-ia-modulo">{caderno.modulo}</p>
              )}

              <div className="caderno-ia-data">
                Criado em {formatarData(caderno.criadoEm)}
              </div>

              <div className="caderno-ia-acoes">
                <button
                  type="button"
                  className="caderno-ia-resolver"
                  onClick={() => resolver(caderno)}
                >
                  Resolver
                </button>

                <button
                  type="button"
                  className="caderno-ia-excluir"
                  disabled={excluindoId === caderno.id}
                  onClick={() => void excluir(caderno)}
                >
                  {excluindoId === caderno.id ? "Excluindo..." : "Excluir caderno"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
