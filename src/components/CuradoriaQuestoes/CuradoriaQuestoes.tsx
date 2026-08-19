import { useEffect, useMemo, useState } from "react";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";
import {
  analisarProvaPdf,
  ErroImportacaoProva,
  type MetadadosImportacaoProva,
  type ResultadoAnaliseProva,
} from "../../services/importacaoProvaService";
import {
  atualizarQuestaoCuradoria,
  listarQuestoesCuradoria,
  salvarLoteNaCuradoria,
} from "../../services/catalogoQuestoesService";

import type {
  CompatibilidadeEdital,
  ConfiancaClassificacao,
  Dificuldade,
  QuestaoBanco,
  StatusEditorialQuestao,
} from "../../types";

import "./CuradoriaQuestoes.css";

const statusDisponiveis: StatusEditorialQuestao[] = [
  "pendente",
  "ativa",
  "anulada",
  "desatualizada",
  "duvidosa",
  "arquivada",
];

const compatibilidades: CompatibilidadeEdital[] = [
  "direta",
  "implicita",
  "relacionada",
  "fora",
  "incerta",
];

export default function CuradoriaQuestoes() {
  const { materias, configuracoes } = useApp();
  const { showToast } = useToast();

  const [prova, setProva] = useState<File | null>(null);
  const [gabarito, setGabarito] = useState<File | null>(null);
  const [metadados, setMetadados] = useState<MetadadosImportacaoProva>({
    concursoAlvo: configuracoes.concurso || "PMPE",
    editalAlvo: "PMPE 2024",
    concursoOrigem: "PMPE",
    cargoOrigem: "Soldado",
    anoOrigem: 2024,
    banca: "AOCP",
    fonteNome: "",
  });
  const [analisando, setAnalisando] = useState(false);
  const [salvandoLote, setSalvandoLote] = useState(false);
  const [analise, setAnalise] = useState<ResultadoAnaliseProva | null>(null);
  const [erroAnalise, setErroAnalise] = useState<{
    mensagem: string;
    diagnosticoId: string;
  } | null>(null);
  const [fila, setFila] = useState<QuestaoBanco[]>([]);
  const [carregandoFila, setCarregandoFila] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusEditorialQuestao | "todos">("pendente");
  const [salvandoId, setSalvandoId] = useState("");

  const mapaEdital = useMemo(
    () => materias.flatMap((materia) =>
      listarModulosDaMateria(materia).flatMap((modulo) =>
        modulo.assuntos.map((assunto) => ({
          materiaId: materia.id,
          materia: materia.nome,
          moduloId: modulo.id,
          modulo: modulo.nome,
          assuntoId: assunto.id,
          assunto: assunto.nome,
        }))
      )
    ),
    [materias]
  );

  const filaFiltrada = useMemo(
    () => filtroStatus === "todos"
      ? fila
      : fila.filter((questao) => questao.statusEditorial === filtroStatus),
    [fila, filtroStatus]
  );

  const contagemStatus = useMemo(() => {
    return Object.fromEntries(
      statusDisponiveis.map((status) => [
        status,
        fila.filter((questao) => questao.statusEditorial === status).length,
      ])
    ) as Record<StatusEditorialQuestao, number>;
  }, [fila]);

  useEffect(() => {
    void carregarFila();
  }, []);

  async function carregarFila() {
    try {
      setCarregandoFila(true);
      setFila(await listarQuestoesCuradoria());
    } catch (erro) {
      showToast(mensagemErro(erro), "error");
    } finally {
      setCarregandoFila(false);
    }
  }

  async function executarAnalise() {
    if (!prova || !gabarito) {
      showToast("Selecione a prova e o gabarito definitivo em PDF.", "warning");
      return;
    }

    try {
      setAnalisando(true);
      setAnalise(null);
      setErroAnalise(null);

      const resultado = await analisarProvaPdf({
        prova,
        gabarito,
        metadados: {
          ...metadados,
          fonteNome: prova.name,
        },
        mapaEdital,
      });

      setAnalise(resultado);
      setErroAnalise(null);
      showToast(
        `${resultado.totalDetectadas}/${resultado.totalEsperadas} questões extraídas para conferência.`,
        "success"
      );
    } catch (erro) {
      const mensagem = mensagemErro(erro);
      setErroAnalise({
        mensagem,
        diagnosticoId: erro instanceof ErroImportacaoProva
          ? erro.diagnosticoId
          : "erro-local",
      });
      showToast(mensagem, "error");
    } finally {
      setAnalisando(false);
    }
  }

  async function enviarParaCuradoria() {
    if (!analise || !prova) return;

    try {
      setSalvandoLote(true);
      const quantidade = await salvarLoteNaCuradoria(analise.questoes, {
        ...metadados,
        fonteNome: prova.name,
      });

      setAnalise(null);
      setProva(null);
      setGabarito(null);
      setFiltroStatus("pendente");
      await carregarFila();
      showToast(`${quantidade} questões adicionadas à fila editorial.`, "success");
    } catch (erro) {
      showToast(mensagemErro(erro), "error");
    } finally {
      setSalvandoLote(false);
    }
  }

  function editarQuestao(id: string, alteracoes: Partial<QuestaoBanco>) {
    setFila((atual) => atual.map((questao) =>
      questao.id === id ? { ...questao, ...alteracoes } : questao
    ));
  }

  async function salvarQuestao(
    questao: QuestaoBanco,
    statusEditorial = questao.statusEditorial ?? "pendente"
  ) {
    if (statusEditorial === "ativa") {
      if (!questao.respostaCorretaId || !/[A-E]/.test(questao.respostaCorretaId)) {
        showToast("Informe um gabarito entre A e E antes de ativar.", "warning");
        return;
      }

      if (!questao.compatibilidadeEdital || !["direta", "implicita"].includes(questao.compatibilidadeEdital)) {
        showToast("Somente questões direta ou implicitamente previstas podem ser ativadas.", "warning");
        return;
      }
    }

    try {
      setSalvandoId(questao.id);
      const atualizada = await atualizarQuestaoCuradoria(questao.id, {
        materiaId: questao.materiaId,
        materia: questao.materia,
        moduloId: questao.moduloId ?? "",
        modulo: questao.modulo ?? "",
        assuntoId: questao.assuntoId,
        assunto: questao.assunto,
        subassunto: questao.subassunto ?? "",
        dificuldade: questao.dificuldade,
        respostaCorretaId: questao.respostaCorretaId,
        explicacao: questao.explicacao ?? "",
        statusEditorial,
        compatibilidadeEdital: questao.compatibilidadeEdital ?? "incerta",
        confiancaClassificacao: questao.confiancaClassificacao ?? "baixa",
        norma: questao.norma ?? "",
        dispositivo: questao.dispositivo ?? "",
        motivoStatus: questao.motivoStatus ?? "",
      });

      setFila((atual) => atual.map((item) => item.id === atualizada.id ? atualizada : item));
      showToast(statusEditorial === "ativa" ? "Questão publicada no banco oficial." : "Revisão salva.", "success");
    } catch (erro) {
      showToast(mensagemErro(erro), "error");
    } finally {
      setSalvandoId("");
    }
  }

  return (
    <section className="curadoria-questoes">
      <header className="curadoria-cabecalho">
        <div>
          <span>CATÁLOGO GLOBAL</span>
          <h2>Curadoria de questões oficiais</h2>
          <p>A IA extrai e classifica. Nenhuma questão entra nos treinos antes da sua aprovação.</p>
        </div>
        <div className="curadoria-regra">
          <strong>{contagemStatus.ativa}</strong>
          <span>publicadas</span>
        </div>
      </header>

      <details className="curadoria-importador" open={fila.length === 0}>
        <summary>Importar prova oficial em PDF</summary>
        <div className="curadoria-importador-conteudo">
          <div className="curadoria-grade-metadados">
            <Campo texto="Concurso-alvo">
              <input value={metadados.concursoAlvo} onChange={(evento) => setMetadados({ ...metadados, concursoAlvo: evento.target.value })} />
            </Campo>
            <Campo texto="Edital usado no filtro">
              <input value={metadados.editalAlvo} onChange={(evento) => setMetadados({ ...metadados, editalAlvo: evento.target.value })} />
            </Campo>
            <Campo texto="Concurso de origem">
              <input value={metadados.concursoOrigem} onChange={(evento) => setMetadados({ ...metadados, concursoOrigem: evento.target.value })} />
            </Campo>
            <Campo texto="Cargo de origem">
              <input value={metadados.cargoOrigem} onChange={(evento) => setMetadados({ ...metadados, cargoOrigem: evento.target.value })} />
            </Campo>
            <Campo texto="Ano">
              <input type="number" min="1980" max="2100" value={metadados.anoOrigem} onChange={(evento) => setMetadados({ ...metadados, anoOrigem: Number(evento.target.value) })} />
            </Campo>
            <Campo texto="Banca">
              <input value={metadados.banca} onChange={(evento) => setMetadados({ ...metadados, banca: evento.target.value })} />
            </Campo>
          </div>

          <div className="curadoria-arquivos">
            <Campo texto="PDF da prova">
              <input type="file" accept="application/pdf,.pdf" onChange={(evento) => setProva(evento.target.files?.[0] ?? null)} />
            </Campo>
            <Campo texto="PDF do gabarito definitivo">
              <input type="file" accept="application/pdf,.pdf" onChange={(evento) => setGabarito(evento.target.files?.[0] ?? null)} />
            </Campo>
          </div>

          <div className="curadoria-importar-rodape">
            <span>{mapaEdital.length} assuntos do edital serão usados na classificação.</span>
            <button type="button" onClick={executarAnalise} disabled={analisando}>
              {analisando ? "Analisando PDFs..." : "Analisar prova com IA"}
            </button>
          </div>

          {erroAnalise && (
            <div className="curadoria-erro-analise" role="alert" aria-live="assertive">
              <strong>A análise não foi concluída.</strong>
              <p>{erroAnalise.mensagem}</p>
              <small>
                Nenhuma questão foi salva. Código de diagnóstico: <b>{erroAnalise.diagnosticoId}</b>
              </small>
            </div>
          )}

          {analise && (
            <div className="curadoria-resultado-analise">
              <div className="curadoria-resultado-cards">
                <Indicador texto="Extraídas" valor={`${analise.totalDetectadas}/${analise.totalEsperadas}`} />
                <Indicador texto="Com gabarito" valor={analise.totalComGabarito} />
                <Indicador texto="Anuladas" valor={analise.anuladasDetectadas} />
                <Indicador texto="Fora do edital" valor={analise.foraDoEdital} />
              </div>
              {analise.alertas.length > 0 && (
                <ul>
                  {deduplicarAlertas(analise.alertas).map((alerta) => <li key={alerta}>{alerta}</li>)}
                </ul>
              )}
              <button type="button" onClick={enviarParaCuradoria} disabled={salvandoLote}>
                {salvandoLote ? "Salvando..." : "Enviar todas para revisão humana"}
              </button>
            </div>
          )}
        </div>
      </details>

      <section className="curadoria-fila">
        <div className="curadoria-fila-topo">
          <div>
            <h3>Fila editorial</h3>
            <p>Anuladas, desatualizadas e fora do edital permanecem arquivadas e nunca pontuam.</p>
          </div>
          <select value={filtroStatus} onChange={(evento) => setFiltroStatus(evento.target.value as StatusEditorialQuestao | "todos")}>
            <option value="todos">Todos ({fila.length})</option>
            {statusDisponiveis.map((status) => (
              <option key={status} value={status}>{rotuloStatus(status)} ({contagemStatus[status]})</option>
            ))}
          </select>
        </div>

        {carregandoFila ? (
          <div className="curadoria-vazio">Carregando fila editorial...</div>
        ) : filaFiltrada.length === 0 ? (
          <div className="curadoria-vazio">Nenhuma questão neste estado.</div>
        ) : (
          <div className="curadoria-lista">
            {filaFiltrada.map((questao) => (
              <article className="curadoria-item" key={questao.id}>
                <div className="curadoria-item-topo">
                  <div>
                    <span>Questão {questao.numeroOriginal ?? "—"} · {questao.concursoOrigem} {questao.anoOrigem}</span>
                    <strong>{questao.materia} — {questao.assunto}</strong>
                    <small>{questao.banca} · confiança {questao.confiancaClassificacao ?? "baixa"}</small>
                  </div>
                  <span className={`curadoria-status status-${questao.statusEditorial}`}>{rotuloStatus(questao.statusEditorial ?? "pendente")}</span>
                </div>

                <p className="curadoria-enunciado">{questao.enunciado}</p>

                <details>
                  <summary>Ver alternativas e classificação</summary>
                  <div className="curadoria-alternativas">
                    {questao.alternativas.map((alternativa) => (
                      <p key={alternativa.id}>{alternativa.id}) {alternativa.texto}</p>
                    ))}
                  </div>

                  <div className="curadoria-edicao">
                    <Campo texto="Matéria">
                      <input value={questao.materia} onChange={(evento) => editarQuestao(questao.id, { materia: evento.target.value })} />
                    </Campo>
                    <Campo texto="Assunto">
                      <input value={questao.assunto} onChange={(evento) => editarQuestao(questao.id, { assunto: evento.target.value })} />
                    </Campo>
                    <Campo texto="Subassunto">
                      <input value={questao.subassunto ?? ""} onChange={(evento) => editarQuestao(questao.id, { subassunto: evento.target.value })} />
                    </Campo>
                    <Campo texto="Compatibilidade">
                      <select value={questao.compatibilidadeEdital ?? "incerta"} onChange={(evento) => editarQuestao(questao.id, { compatibilidadeEdital: evento.target.value as CompatibilidadeEdital })}>
                        {compatibilidades.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </Campo>
                    <Campo texto="Confiança">
                      <select value={questao.confiancaClassificacao ?? "baixa"} onChange={(evento) => editarQuestao(questao.id, { confiancaClassificacao: evento.target.value as ConfiancaClassificacao })}>
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                    </Campo>
                    <Campo texto="Dificuldade">
                      <select value={questao.dificuldade} onChange={(evento) => editarQuestao(questao.id, { dificuldade: evento.target.value as Dificuldade })}>
                        <option value="facil">Fácil</option>
                        <option value="media">Média</option>
                        <option value="dificil">Difícil</option>
                      </select>
                    </Campo>
                    <Campo texto="Gabarito">
                      <input maxLength={1} value={questao.respostaCorretaId} onChange={(evento) => editarQuestao(questao.id, { respostaCorretaId: evento.target.value.toUpperCase() })} />
                    </Campo>
                    <Campo texto="Norma">
                      <input value={questao.norma ?? ""} onChange={(evento) => editarQuestao(questao.id, { norma: evento.target.value })} />
                    </Campo>
                    <Campo texto="Dispositivo">
                      <input value={questao.dispositivo ?? ""} onChange={(evento) => editarQuestao(questao.id, { dispositivo: evento.target.value })} />
                    </Campo>
                  </div>

                  <Campo texto="Motivo, risco ou observação editorial">
                    <textarea value={questao.motivoStatus ?? ""} onChange={(evento) => editarQuestao(questao.id, { motivoStatus: evento.target.value })} />
                  </Campo>
                </details>

                <div className="curadoria-acoes">
                  <button type="button" onClick={() => salvarQuestao(questao)} disabled={salvandoId === questao.id}>Salvar análise</button>
                  <button type="button" className="publicar" onClick={() => salvarQuestao(questao, "ativa")} disabled={salvandoId === questao.id}>Publicar</button>
                  <button type="button" className="anular" onClick={() => salvarQuestao(questao, "anulada")} disabled={salvandoId === questao.id}>Anulada</button>
                  <button type="button" className="bloquear" onClick={() => salvarQuestao(questao, "desatualizada")} disabled={salvandoId === questao.id}>Desatualizada</button>
                  <button type="button" onClick={() => salvarQuestao(questao, "arquivada")} disabled={salvandoId === questao.id}>Arquivar</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function Campo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="curadoria-campo">
      <span>{texto}</span>
      {children}
    </label>
  );
}

function Indicador({ texto, valor }: { texto: string; valor: number | string }) {
  return <div><span>{texto}</span><strong>{valor}</strong></div>;
}

function deduplicarAlertas(alertas: string[]) {
  const vistos = new Set<string>();

  return alertas.filter((alerta) => {
    const chave = alerta.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function rotuloStatus(status: StatusEditorialQuestao) {
  const rotulos: Record<StatusEditorialQuestao, string> = {
    pendente: "Pendente",
    ativa: "Publicada",
    anulada: "Anulada",
    desatualizada: "Desatualizada",
    duvidosa: "Duvidosa",
    arquivada: "Arquivada",
  };
  return rotulos[status];
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Ocorreu um erro inesperado.";
}
