import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { calcularProgressoAssuntos } from "../../services/conteudos/navegarConteudos";

import type {
  Assunto,
  AulaAssunto,
  MaterialAssunto,
  Materia,
  Modulo,
  Prioridade,
  TarefaAssunto,
  TipoTarefaAssunto,
} from "../../types";

import "./Estudos.css";

type EditorAssunto = {
  materiaId: string;
  moduloId: string;
  assuntoId: string;
} | null;

export default function Estudos() {
  const {
    materias,
    setMaterias,
    definirConclusaoAssunto,
    definirConclusaoAula,
    importarProgressoMateria,
    questoes,
    sessoes,
    revisoes,
  } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const buscaRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState("");

  useEffect(() => {
    const estado = location.state as { focoBusca?: boolean; termoBusca?: string } | null;
    const rotaDeBusca = ["/buscar", "/pesquisa", "/search"].includes(location.pathname);

    if (estado?.termoBusca) {
      setBusca(estado.termoBusca);
    }

    if (estado?.focoBusca || rotaDeBusca) {
      window.setTimeout(() => {
        buscaRef.current?.focus();
      }, 0);
    }
  }, [location.pathname, location.state]);
  const [nomeMateria, setNomeMateria] = useState("");
  const [materiaNovoModulo, setMateriaNovoModulo] = useState("");
  const [nomeModulo, setNomeModulo] = useState("");
  const [materiaNovoAssunto, setMateriaNovoAssunto] = useState("");
  const [moduloNovoAssunto, setModuloNovoAssunto] = useState("");
  const [nomeAssunto, setNomeAssunto] = useState("");
  const [prioridadeAssunto, setPrioridadeAssunto] = useState<Prioridade>("media");
  const [editor, setEditor] = useState<EditorAssunto>(null);
  const [importarAberto, setImportarAberto] = useState(false);
  const [moduloImportacao, setModuloImportacao] = useState("");
  const [assuntoImportacao, setAssuntoImportacao] = useState("");
  const [modulosFechados, setModulosFechados] = useState<Record<string, boolean>>({});
  const [assuntosExpandidos, setAssuntosExpandidos] = useState<Record<string, boolean>>({});

  const materiasComModulos = useMemo(
    () => materias.map(normalizarMateriaComModulos),
    [materias]
  );

  const materiasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return materiasComModulos;

    return materiasComModulos
      .map((materia) => ({
        ...materia,
        modulos: (materia.modulos ?? [])
          .map((modulo) => ({
            ...modulo,
            assuntos: modulo.assuntos.filter(
              (assunto) =>
                normalizarTexto(materia.nome).includes(termo) ||
                normalizarTexto(modulo.nome).includes(termo) ||
                normalizarTexto(assunto.nome).includes(termo) ||
                (assunto.aulas ?? []).some((aula) => normalizarTexto(aula.nome).includes(termo)) ||
                (assunto.tarefas ?? []).some((tarefa) => normalizarTexto(tarefa.nome).includes(termo))
            ),
          }))
          .filter(
            (modulo) =>
              modulo.assuntos.length > 0 ||
              normalizarTexto(materia.nome).includes(termo) ||
              normalizarTexto(modulo.nome).includes(termo)
          ),
      }))
      .filter((materia) => (materia.modulos ?? []).length > 0);
  }, [materiasComModulos, busca]);

  const assuntoEmEdicao = useMemo(() => {
    if (!editor) return null;
    const materia = materiasComModulos.find((item) => item.id === editor.materiaId);
    const modulo = materia?.modulos?.find((item) => item.id === editor.moduloId);
    const assunto = modulo?.assuntos.find((item) => item.id === editor.assuntoId);
    return materia && modulo && assunto ? { materia, modulo, assunto } : null;
  }, [editor, materiasComModulos]);


  function alternarModulo(materiaId: string, moduloId: string) {
    const chave = `${materiaId}:${moduloId}`;
    setModulosFechados((atual) => {
      const fechadoAtual = atual[chave] ?? true;
      return { ...atual, [chave]: !fechadoAtual };
    });
  }

  function alternarAssunto(assuntoId: string) {
    setAssuntosExpandidos((atual) => ({ ...atual, [assuntoId]: !atual[assuntoId] }));
  }

  function metricasAssunto(
  materia: Materia,
  _modulo: Modulo,
  assunto: Assunto
) {
    const sessoesDoAssunto = sessoes.filter((sessao) =>
      (sessao.assuntoId && sessao.assuntoId === assunto.id) ||
      (!sessao.assuntoId && sessao.materia === materia.nome && sessao.assunto === assunto.nome)
    );
    const registros = questoes.filter((registro) =>
      (registro.assuntoId && registro.assuntoId === assunto.id) ||
      (!registro.assuntoId && registro.materia === materia.nome && registro.assunto === assunto.nome)
    );
    const revisoesDoAssunto = revisoes.filter((revisao) =>
      (revisao.assuntoId && revisao.assuntoId === assunto.id) ||
      (!revisao.assuntoId && revisao.materia === materia.nome && revisao.assunto === assunto.nome)
    );
    const minutos = sessoesDoAssunto.reduce((total, sessao) => total + sessao.minutos, 0) +
      registros.reduce((total, registro) => total + registro.minutos, 0);
    const certas = registros.reduce((total, registro) => total + registro.certas, 0);
    const erradas = registros.reduce((total, registro) => total + registro.erradas, 0);
    const totalQuestoes = certas + erradas;
    const aproveitamento = totalQuestoes ? Math.round((certas / totalQuestoes) * 100) : 0;
    const revisoesPendentes = revisoesDoAssunto.filter((revisao) => !revisao.concluida).length;
    return { minutos, certas, erradas, totalQuestoes, aproveitamento, revisoesPendentes };
  }

  function abrirCentral(materia: Materia, modulo: Modulo, assunto: Assunto) {
    const proximaAula = (assunto.aulas ?? [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .find((aula) => !aula.concluida) ?? assunto.aulas?.[0];
    sessionStorage.setItem("pmpe:central-estudos:prefill", JSON.stringify({
      materia: materia.nome, materiaId: materia.id, modulo: modulo.nome, moduloId: modulo.id,
      assunto: assunto.nome, assuntoId: assunto.id, tipo: "aula",
      objetivo: proximaAula ? `Estudar ${assunto.nome} · ${proximaAula.nome}` : `Estudar ${assunto.nome}`,
      urlAula: proximaAula?.url ?? assunto.aula,
      urlQuestoes: assunto.questoes,
    }));
    navigate("/central-estudos");
  }

  function abrirIA(materia: Materia, modulo: Modulo, assunto: Assunto) {
    sessionStorage.setItem("pmpe:gerar-ia:prefill", JSON.stringify({
      materia: materia.nome, modulo: modulo.nome, assunto: assunto.nome,
    }));
    navigate("/gerar-simulado-ia");
  }

  function atualizarMateria(materiaId: string, transformador: (materia: Materia) => Materia) {
    setMaterias((anteriores) =>
      anteriores.map((item) => {
        if (item.id !== materiaId) return item;
        const atualizada = transformador(normalizarMateriaComModulos(item));
        return sincronizarEspelhoLegado(atualizada);
      })
    );
  }

  function adicionarMateria() {
    const nome = nomeMateria.trim();
    if (!nome) return showToast("Informe o nome da matéria.", "warning");
    if (materias.some((m) => normalizarTexto(m.nome) === normalizarTexto(nome))) {
      return showToast("Essa matéria já existe.", "warning");
    }

    const id = criarIdUnico(nome);
    const moduloGeral: Modulo = { id: `modulo-geral-${id}`, nome: "Geral", ordem: 0, assuntos: [] };
    const novaMateria: Materia = { id, nome, modulos: [moduloGeral], assuntos: [] };
    setMaterias((anteriores) => [...anteriores, novaMateria]);
    setNomeMateria("");
    setMateriaNovoModulo(id);
    setMateriaNovoAssunto(id);
    setModuloNovoAssunto(moduloGeral.id);
    showToast("Matéria adicionada.", "success");
  }

  function adicionarModulo() {
    const materia = materiasComModulos.find((m) => m.id === materiaNovoModulo);
    const nome = nomeModulo.trim();
    if (!materia) return showToast("Selecione uma matéria.", "warning");
    if (normalizarTexto(materia.nome) === "portugues") {
      return showToast("Português usa a trilha oficial do curso e não aceita módulos extras.", "warning");
    }
    if (!nome) return showToast("Informe o nome do módulo.", "warning");
    if ((materia.modulos ?? []).some((m) => normalizarTexto(m.nome) === normalizarTexto(nome))) {
      return showToast("Esse módulo já existe nessa matéria.", "warning");
    }
    const novo: Modulo = {
      id: criarIdUnico(`${materia.nome}-${nome}`),
      nome,
      ordem: materia.modulos?.length ?? 0,
      assuntos: [],
    };
    atualizarMateria(materia.id, (m) => ({ ...m, modulos: [...(m.modulos ?? []), novo] }));
    setNomeModulo("");
    setMateriaNovoAssunto(materia.id);
    setModuloNovoAssunto(novo.id);
    showToast("Módulo adicionado.", "success");
  }

  function adicionarAssunto() {
    const materia = materiasComModulos.find((m) => m.id === materiaNovoAssunto);
    const modulo = materia?.modulos?.find((m) => m.id === moduloNovoAssunto);
    const nome = nomeAssunto.trim();
    if (!materia) return showToast("Selecione uma matéria.", "warning");
    if (normalizarTexto(materia.nome) === "portugues") {
      return showToast("Português usa a trilha oficial do curso e não aceita aulas extras.", "warning");
    }
    if (!modulo) return showToast("Selecione um módulo.", "warning");
    if (!nome) return showToast("Informe o nome do assunto.", "warning");
    if (modulo.assuntos.some((a) => normalizarTexto(a.nome) === normalizarTexto(nome))) {
      return showToast("Esse assunto já existe nesse módulo.", "warning");
    }
    const novoAssunto: Assunto = {
      id: criarIdUnico(`${materia.nome}-${modulo.nome}-${nome}`),
      nome,
      concluido: false,
      prioridade: prioridadeAssunto,
      resumo: "",
      anotacoes: "",
      materiais: [],
      atualizadoEm: new Date().toISOString(),
    };
    atualizarMateria(materia.id, (m) => ({
      ...m,
      modulos: (m.modulos ?? []).map((mod) =>
        mod.id === modulo.id ? { ...mod, assuntos: [...mod.assuntos, novoAssunto] } : mod
      ),
    }));
    setNomeAssunto("");
    setPrioridadeAssunto("media");
    showToast("Assunto adicionado.", "success");
  }

  function renomearModulo(materia: Materia, modulo: Modulo) {
    const nome = window.prompt("Novo nome do módulo:", modulo.nome)?.trim();
    if (!nome || nome === modulo.nome) return;
    atualizarMateria(materia.id, (m) => ({
      ...m,
      modulos: (m.modulos ?? []).map((mod) => mod.id === modulo.id ? { ...mod, nome } : mod),
    }));
    showToast("Módulo atualizado.", "success");
  }

  function excluirModulo(materia: Materia, modulo: Modulo) {
    if (modulo.assuntos.length > 0) {
      showToast("Mova ou exclua os assuntos deste módulo antes de removê-lo.", "warning");
      return;
    }
    if (!window.confirm(`Excluir o módulo "${modulo.nome}"?`)) return;
    atualizarMateria(materia.id, (m) => ({
      ...m,
      modulos: (m.modulos ?? []).filter((mod) => mod.id !== modulo.id),
    }));
    showToast("Módulo excluído.", "info");
  }

  function moverAssunto(materia: Materia, origemId: string, assunto: Assunto, destinoId: string) {
    if (!destinoId || destinoId === origemId) return;
    atualizarMateria(materia.id, (m) => ({
      ...m,
      modulos: (m.modulos ?? []).map((mod) => {
        if (mod.id === origemId) return { ...mod, assuntos: mod.assuntos.filter((a) => a.id !== assunto.id) };
        if (mod.id === destinoId) return { ...mod, assuntos: [...mod.assuntos, assunto] };
        return mod;
      }),
    }));
    showToast("Assunto movido.", "success");
  }

  function excluirMateria(materia: Materia) {
    if (!window.confirm(`Excluir a matéria "${materia.nome}" e todo o conteúdo dela?`)) return;
    setMaterias((anteriores) => anteriores.filter((item) => item.id !== materia.id));
    showToast("Matéria excluída.", "info");
  }

  function excluirAssunto(materia: Materia, modulo: Modulo, assunto: Assunto) {
    if (!window.confirm(`Excluir o assunto "${assunto.nome}"?`)) return;
    definirConclusaoAssunto(materia.id, assunto.id, false);
    atualizarMateria(materia.id, (m) => ({
      ...m,
      modulos: (m.modulos ?? []).map((mod) =>
        mod.id === modulo.id
          ? { ...mod, assuntos: mod.assuntos.filter((a) => a.id !== assunto.id) }
          : mod
      ),
    }));
    showToast("Assunto excluído.", "info");
  }

  function salvarAssunto(materiaId: string, moduloId: string, assuntoId: string, alteracoes: Partial<Assunto>) {
    atualizarMateria(materiaId, (m) => ({
      ...m,
      modulos: (m.modulos ?? []).map((mod) =>
        mod.id !== moduloId ? mod : {
          ...mod,
          assuntos: mod.assuntos.map((assunto) =>
            assunto.id !== assuntoId ? assunto : {
              ...assunto, ...alteracoes, atualizadoEm: new Date().toISOString(),
            }
          ),
        }
      ),
    }));
  }

  function abrirImportacao(materia: Materia) {
    const primeiroModulo = (materia.modulos ?? []).slice().sort((a, b) => a.ordem - b.ordem)[0];
    setModuloImportacao(primeiroModulo?.id ?? "");
    setAssuntoImportacao(primeiroModulo?.assuntos[0]?.id ?? "");
    setImportarAberto(true);
  }

  function confirmarImportacao(materia: Materia) {
    if (!moduloImportacao || !assuntoImportacao) {
      showToast("Selecione até qual aula você já estudou.", "warning");
      return;
    }

    const quantidade = importarProgressoMateria(
      materia.id,
      moduloImportacao,
      assuntoImportacao
    );

    if (quantidade <= 0) {
      showToast("Não foi possível localizar essa aula na trilha.", "error");
      return;
    }

    setImportarAberto(false);
    showToast(
      `${quantidade} assunto${quantidade === 1 ? "" : "s"} marcado${quantidade === 1 ? "" : "s"} como já estudado${quantidade === 1 ? "" : "s"}, sem gerar revisões.`,
      "success"
    );
  }

  return (
    <section className="conteudos-container">
      <header className="conteudos-cabecalho">
        <div>
          <h1>📚 Conteúdos</h1>
          <p>Organize o estudo em Matéria → Módulo → Assunto → Aulas e Tarefas, mantendo progresso, notas e materiais.</p>
        </div>
        <input ref={buscaRef} type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar matéria, módulo ou assunto" />
      </header>

      <div className="conteudos-cadastros conteudos-cadastros-3">
        <article className="conteudos-painel-form">
          <h2>Nova matéria</h2>
          <div className="conteudos-linha-form">
            <input value={nomeMateria} onChange={(e) => setNomeMateria(e.target.value)}
              placeholder="Ex.: Direito Administrativo" />
            <button type="button" onClick={adicionarMateria}>Adicionar</button>
          </div>
        </article>

        <article className="conteudos-painel-form">
          <h2>Novo módulo</h2>
          <div className="conteudos-grid-form conteudos-grid-form-modulo">
            <select value={materiaNovoModulo} onChange={(e) => setMateriaNovoModulo(e.target.value)}>
              <option value="">Selecione a matéria</option>
              {materiasComModulos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <input value={nomeModulo} onChange={(e) => setNomeModulo(e.target.value)}
              placeholder="Ex.: Direitos Fundamentais" />
            <button type="button" onClick={adicionarModulo}>Adicionar módulo</button>
          </div>
        </article>

        <article className="conteudos-painel-form">
          <h2>Novo assunto</h2>
          <div className="conteudos-grid-form conteudos-grid-form-assunto">
            <select value={materiaNovoAssunto} onChange={(e) => {
              setMateriaNovoAssunto(e.target.value);
              const mat = materiasComModulos.find((m) => m.id === e.target.value);
              setModuloNovoAssunto(mat?.modulos?.[0]?.id ?? "");
            }}>
              <option value="">Matéria</option>
              {materiasComModulos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <select value={moduloNovoAssunto} onChange={(e) => setModuloNovoAssunto(e.target.value)}>
              <option value="">Módulo</option>
              {materiasComModulos.find((m) => m.id === materiaNovoAssunto)?.modulos?.map((mod) =>
                <option key={mod.id} value={mod.id}>{mod.nome}</option>)}
            </select>
            <input value={nomeAssunto} onChange={(e) => setNomeAssunto(e.target.value)} placeholder="Ex.: Artigo 5º" />
            <select value={prioridadeAssunto} onChange={(e) => setPrioridadeAssunto(e.target.value as Prioridade)}>
              <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
            </select>
            <button type="button" onClick={adicionarAssunto}>Adicionar assunto</button>
          </div>
        </article>
      </div>

      {materiasFiltradas.length === 0 && <div className="conteudos-vazio">Nenhum conteúdo encontrado.</div>}

      {materiasFiltradas.map((materia) => {
        const trilhaFixa = normalizarTexto(materia.nome) === "portugues";
        const todos = (materia.modulos ?? []).flatMap((m) => m.assuntos);
        const concluidos = todos.filter((a) => a.concluido).length;
        const progresso = calcularProgressoAssuntos(todos).percentual;
        return (
          <article key={materia.id} className="conteudos-materia-card">
            <div className="conteudos-materia-topo">
              <div><h2>{materia.nome}</h2><p>{concluidos} de {todos.length} assuntos concluídos · {progresso}% das aulas</p></div>
              <div className="conteudos-materia-acoes">
                <strong>{progresso}%</strong>
                {trilhaFixa && (
                  <button type="button" className="conteudos-importar" onClick={() => abrirImportacao(materia)}>Importar progresso</button>
                )}
                {!trilhaFixa && (
                  <button type="button" className="conteudos-excluir" onClick={() => excluirMateria(materia)}>Excluir matéria</button>
                )}
              </div>
            </div>
            <div className="conteudos-progresso"><div style={{ width: `${progresso}%` }} /></div>

            <div className="conteudos-modulos">
              {(materia.modulos ?? []).map((modulo) => {
                const feitos = modulo.assuntos.filter((a) => a.concluido).length;
                const pct = calcularProgressoAssuntos(modulo.assuntos).percentual;
                const chaveModulo = `${materia.id}:${modulo.id}`;
                const moduloFechado = modulosFechados[chaveModulo] ?? true;
                return (
                  <section key={modulo.id} className={`conteudos-modulo-card${moduloFechado ? " fechado" : ""}`}>
                    <header className="conteudos-modulo-topo">
                      <button
                        type="button"
                        className="conteudos-modulo-toggle"
                        onClick={() => alternarModulo(materia.id, modulo.id)}
                        aria-expanded={!moduloFechado}
                        aria-label={`${moduloFechado ? "Expandir" : "Recolher"} ${modulo.nome}`}
                      >
                        <span className={`conteudos-modulo-seta${moduloFechado ? " fechada" : ""}`}>⌄</span>
                        <span className="conteudos-modulo-resumo">
                          <h3>{modulo.nome}</h3>
                          <small>{feitos}/{modulo.assuntos.length} assuntos concluídos · {pct}% das aulas{trilhaFixa ? ` · ${modulo.assuntos.reduce((t, a) => t + metricasAssunto(materia, modulo, a).minutos, 0)} min` : ""}</small>
                        </span>
                      </button>
                      <div className="conteudos-modulo-acoes">
                        {trilhaFixa ? (
                          <span className="conteudos-trilha-fixa">Trilha oficial</span>
                        ) : (
                          <>
                            <button type="button" onClick={() => renomearModulo(materia, modulo)}>Editar</button>
                            <button type="button" className="conteudos-excluir" onClick={() => excluirModulo(materia, modulo)}>Excluir</button>
                          </>
                        )}
                      </div>
                    </header>
                    {!moduloFechado && (
                      <>
                        <div className="conteudos-progresso conteudos-progresso-modulo"><div style={{ width: `${pct}%` }} /></div>
                        <div className="conteudos-assuntos">
                          {modulo.assuntos.map((assunto) => (
                        <div key={assunto.id} className="conteudos-assunto-item">
                          <label className="conteudos-status-assunto" title={assunto.concluido ? "Reabrir o assunto inteiro" : "Marcar o assunto inteiro como concluído"}>
                            <input
                              type="checkbox"
                              checked={assunto.concluido}
                              onChange={() => definirConclusaoAssunto(materia.id, assunto.id, !assunto.concluido, modulo.id)}
                            />
                          </label>

                          <div className="conteudos-assunto-info">
                            <div className="conteudos-assunto-titulo-linha">
                              <strong className={assunto.concluido ? "concluido" : ""}>{assunto.nome}</strong>
                              <StatusAssunto assunto={assunto} />
                            </div>
                            {(() => {
                              const totalAulas = assunto.aulas?.length ?? 0;
                              const aulasConcluidas = assunto.aulas?.filter((aula) => aula.concluida).length ?? 0;
                              const percentualAulas = totalAulas > 0
                                ? Math.round((aulasConcluidas / totalAulas) * 100)
                                : (assunto.concluido ? 100 : 0);
                              return totalAulas > 0 ? (
                                <div className="conteudos-progresso-assunto">
                                  <div className="conteudos-progresso-assunto-topo">
                                    <span>{aulasConcluidas} de {totalAulas} aulas</span>
                                    <strong>{percentualAulas}%</strong>
                                  </div>
                                  <div className="conteudos-progresso-assunto-barra">
                                    <div style={{ width: `${percentualAulas}%` }} />
                                  </div>
                                </div>
                              ) : null;
                            })()}
                            {((assunto.aulas?.length ?? 0) > 0 || (assunto.tarefas?.length ?? 0) > 0) && (
                              <button
                                type="button"
                                className="conteudos-detalhes-toggle"
                                onClick={() => alternarAssunto(assunto.id)}
                                aria-expanded={Boolean(assuntosExpandidos[assunto.id])}
                              >
                                {assuntosExpandidos[assunto.id] ? "Ocultar etapas" : `Ver ${assunto.aulas?.length ?? 0} aula${assunto.aulas?.length === 1 ? "" : "s"} e ${assunto.tarefas?.length ?? 0} tarefa${assunto.tarefas?.length === 1 ? "" : "s"}`}
                              </button>
                            )}
                            {(() => {
                              const m = metricasAssunto(materia, modulo, assunto);
                              return (
                                <div className="conteudos-metricas-aula">
                                  <span>⏱ {m.minutos} min</span>
                                  <span>❓ {m.totalQuestoes} questões</span>
                                  {m.totalQuestoes > 0 && <span>◎ {m.aproveitamento}%</span>}
                                  {m.revisoesPendentes > 0 && <span>↻ {m.revisoesPendentes} revisão{m.revisoesPendentes === 1 ? "" : "ões"}</span>}
                                </div>
                              );
                            })()}
                          </div>

                          <span className={`prioridade prioridade-${assunto.prioridade}`}>{assunto.prioridade}</span>

                          <div className="conteudos-acoes-aula conteudos-acoes-unificadas">
                            <button type="button" onClick={() => abrirCentral(materia, modulo, assunto)}>▶ Estudar</button>

                            {(assunto.aulas?.[0]?.url || assunto.aula) && (
                              <button type="button" onClick={() => window.open(
                                assunto.aulas?.find((aula) => !aula.concluida)?.url ?? assunto.aulas?.[0]?.url ?? assunto.aula,
                                "_blank",
                                "noopener,noreferrer"
                              )}>🎥 Próxima aula</button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEditor({ materiaId: materia.id, moduloId: modulo.id, assuntoId: assunto.id })}
                            >
                              📝 Notas
                            </button>

                            <button type="button" onClick={() => abrirIA(materia, modulo, assunto)}>🤖 IA</button>

                            {!trilhaFixa && (materia.modulos ?? []).length > 1 && (
                              <select
                                className="conteudos-mover conteudos-mover-compacto"
                                value={modulo.id}
                                aria-label={`Mover ${assunto.nome} para outro módulo`}
                                onChange={(e) => moverAssunto(materia, modulo.id, assunto, e.target.value)}
                              >
                                {(materia.modulos ?? []).map((destino) => (
                                  <option key={destino.id} value={destino.id}>Mover → {destino.nome}</option>
                                ))}
                              </select>
                            )}

                            {!trilhaFixa && (
                              <button
                                type="button"
                                className="conteudos-excluir-compacto"
                                title="Excluir assunto"
                                aria-label={`Excluir ${assunto.nome}`}
                                onClick={() => excluirAssunto(materia, modulo, assunto)}
                              >
                                🗑
                              </button>
                            )}
                          </div>

                          {assuntosExpandidos[assunto.id] && (
                            <div className="conteudos-etapas-assunto">
                              {(assunto.aulas ?? []).length > 0 && (
                                <section>
                                  <h4>Videoaulas</h4>
                                  {(assunto.aulas ?? []).slice().sort((a, b) => a.ordem - b.ordem).map((aula, indice) => (
                                    <div key={aula.id} className="conteudos-etapa-linha">
                                      <label className="conteudos-check-aula">
                                        <input
                                          type="checkbox"
                                          checked={aula.concluida}
                                          onChange={() => definirConclusaoAula(
                                            materia.id,
                                            assunto.id,
                                            aula.id,
                                            !aula.concluida,
                                            modulo.id
                                          )}
                                        />
                                        <span className={aula.concluida ? "concluida" : ""}>{indice + 1}. {aula.nome}</span>
                                      </label>
                                      {aula.url && <button type="button" onClick={() => window.open(aula.url, "_blank", "noopener,noreferrer")}>Abrir aula</button>}
                                    </div>
                                  ))}
                                </section>
                              )}
                              {(assunto.tarefas ?? []).length > 0 && (
                                <section>
                                  <h4>Tarefas de apoio <small>não contam no edital</small></h4>
                                  {(assunto.tarefas ?? []).slice().sort((a, b) => a.ordem - b.ordem).map((tarefa) => (
                                    <div key={tarefa.id} className="conteudos-etapa-linha">
                                      <span className={tarefa.concluida ? "concluida" : ""}>{rotuloTipoTarefa(tarefa.tipo)} · {tarefa.nome}</span>
                                    </div>
                                  ))}
                                </section>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                          {modulo.assuntos.length === 0 && <p className="conteudos-sem-assuntos">Módulo sem assuntos.</p>}
                        </div>
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          </article>
        );
      })}

      {importarAberto && (() => {
        const portugues = materiasComModulos.find((materia) => normalizarTexto(materia.nome) === "portugues");
        if (!portugues) return null;
        const moduloSelecionado = portugues.modulos?.find((modulo) => modulo.id === moduloImportacao);
        return (
          <div className="conteudos-modal-fundo" role="presentation">
            <section className="conteudos-modal conteudos-modal-importacao" role="dialog" aria-modal="true">
              <header>
                <div>
                  <small>Português · migração de progresso</small>
                  <h2>Até onde você já estudou?</h2>
                </div>
                <button type="button" onClick={() => setImportarAberto(false)}>✕</button>
              </header>

              <p className="conteudos-importacao-aviso">
                Todos os assuntos até o escolhido serão marcados como concluídos sem criar revisões. As aulas internas desses assuntos serão preservadas para a próxima etapa da migração.
              </p>

              <label>
                Módulo
                <select
                  value={moduloImportacao}
                  onChange={(e) => {
                    const id = e.target.value;
                    setModuloImportacao(id);
                    const modulo = portugues.modulos?.find((item) => item.id === id);
                    setAssuntoImportacao(modulo?.assuntos[0]?.id ?? "");
                  }}
                >
                  {(portugues.modulos ?? []).slice().sort((a, b) => a.ordem - b.ordem).map((modulo) => (
                    <option key={modulo.id} value={modulo.id}>{modulo.nome}</option>
                  ))}
                </select>
              </label>

              <label>
                Último assunto já estudado
                <select value={assuntoImportacao} onChange={(e) => setAssuntoImportacao(e.target.value)}>
                  {(moduloSelecionado?.assuntos ?? []).map((assunto, indice) => (
                    <option key={assunto.id} value={assunto.id}>{indice + 1}. {assunto.nome}</option>
                  ))}
                </select>
              </label>

              <footer>
                <button type="button" className="secundario" onClick={() => setImportarAberto(false)}>Cancelar</button>
                <button type="button" onClick={() => confirmarImportacao(portugues)}>Importar sem revisões</button>
              </footer>
            </section>
          </div>
        );
      })()}

      {assuntoEmEdicao && (
        <EditorAssuntoModal
          materia={assuntoEmEdicao.materia}
          assunto={assuntoEmEdicao.assunto}
          onClose={() => setEditor(null)}
          onSave={(alteracoes) => {
            salvarAssunto(assuntoEmEdicao.materia.id, assuntoEmEdicao.modulo.id, assuntoEmEdicao.assunto.id, alteracoes);
            setEditor(null);
            showToast("Anotações e materiais salvos.", "success");
          }}
        />
      )}
    </section>
  );
}

function normalizarMateriaComModulos(materia: Materia): Materia {
  if (materia.modulos && materia.modulos.length > 0) return sincronizarEspelhoLegado(materia);
  const modulo: Modulo = {
    id: `modulo-geral-${materia.id}`,
    nome: "Geral",
    ordem: 0,
    assuntos: materia.assuntos ?? [],
  };
  return { ...materia, modulos: [modulo], assuntos: modulo.assuntos };
}

function StatusAssunto({ assunto }: { assunto: Assunto }) {
  const aulas = assunto.aulas ?? [];
  const feitas = aulas.filter((aula) => aula.concluida).length;
  const status = assunto.concluido || (aulas.length > 0 && feitas === aulas.length)
    ? "concluido"
    : feitas > 0
      ? "andamento"
      : "pendente";

  const rotulo = status === "concluido"
    ? "Concluído"
    : status === "andamento"
      ? "Em andamento"
      : "Pendente";

  return <span className={`conteudos-status-badge status-${status}`}>{rotulo}</span>;
}

function sincronizarEspelhoLegado(materia: Materia): Materia {
  return {
    ...materia,
    assuntos: (materia.modulos ?? []).flatMap((modulo) => modulo.assuntos),
  };
}

function EditorAssuntoModal({
  materia,
  assunto,
  onClose,
  onSave,
}: {
  materia: Materia;
  assunto: Assunto;
  onClose: () => void;
  onSave: (alteracoes: Partial<Assunto>) => void;
}) {
  const trilhaFixa = normalizarTexto(materia.nome) === "portugues";
  const [nome, setNome] = useState(assunto.nome);
  const [prioridade, setPrioridade] = useState<Prioridade>(assunto.prioridade);
  const [resumo, setResumo] = useState(assunto.resumo ?? "");
  const [anotacoes, setAnotacoes] = useState(assunto.anotacoes ?? "");
  const [linkNome, setLinkNome] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [materiais, setMateriais] = useState<MaterialAssunto[]>(
    assunto.materiais ?? []
  );
  const [aulas, setAulas] = useState<AulaAssunto[]>(assunto.aulas ?? []);
  const [tarefas, setTarefas] = useState<TarefaAssunto[]>(assunto.tarefas ?? []);
  const [novaAulaNome, setNovaAulaNome] = useState("");
  const [novaAulaUrl, setNovaAulaUrl] = useState("");
  const [novaTarefaNome, setNovaTarefaNome] = useState("");
  const [novaTarefaTipo, setNovaTarefaTipo] = useState<TipoTarefaAssunto>("questoes");

  function adicionarLink() {
    const url = linkUrl.trim();
    if (!url) return;

    const material: MaterialAssunto = {
      id: crypto.randomUUID(),
      tipo: "link",
      nome: linkNome.trim() || "Material externo",
      url,
      criadoEm: new Date().toISOString(),
    };

    setMateriais((anteriores) => [...anteriores, material]);
    setLinkNome("");
    setLinkUrl("");
  }

  function adicionarAula() {
    const nomeAula = novaAulaNome.trim();
    if (!nomeAula) return;
    setAulas((anteriores) => [...anteriores, {
      id: criarIdUnico(`${assunto.id}-${nomeAula}`),
      nome: nomeAula,
      url: novaAulaUrl.trim() || undefined,
      ordem: anteriores.length,
      concluida: false,
    }]);
    setNovaAulaNome("");
    setNovaAulaUrl("");
  }

  function adicionarTarefa() {
    const nomeTarefa = novaTarefaNome.trim();
    if (!nomeTarefa) return;
    setTarefas((anteriores) => [...anteriores, {
      id: criarIdUnico(`${assunto.id}-${nomeTarefa}`),
      nome: nomeTarefa,
      tipo: novaTarefaTipo,
      ordem: anteriores.length,
      concluida: false,
    }]);
    setNovaTarefaNome("");
  }

  return (
    <div className="conteudos-modal-fundo" role="presentation">
      <section className="conteudos-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <small>{materia.nome}</small>
            <h2>Anotações e materiais</h2>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </header>

        <label>
          Nome do assunto
          <input
            value={nome}
            disabled={normalizarTexto(materia.nome) === "portugues"}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>

        <label>
          Prioridade
          <select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </label>

        <label>
          Resumo
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="Escreva seu resumo do assunto"
          />
        </label>

        <label>
          Bizus e anotações
          <textarea
            value={anotacoes}
            onChange={(e) => setAnotacoes(e.target.value)}
            placeholder="Cole macetes, observações e pontos importantes"
          />
        </label>

        <div className="conteudos-editor-bloco">
          <h3>Videoaulas do assunto</h3>
          <p>As aulas são etapas internas e não aparecem como assuntos separados no edital.</p>
          {aulas.map((aula, indice) => (
            <div key={aula.id} className="conteudos-editor-item">
              <span>{indice + 1}. {aula.nome}</span>
              {!trilhaFixa && <button type="button" onClick={() => setAulas((atuais) => atuais.filter((item) => item.id !== aula.id))}>Remover</button>}
            </div>
          ))}
          {!trilhaFixa && (
            <div className="conteudos-editor-adicionar">
              <input value={novaAulaNome} onChange={(e) => setNovaAulaNome(e.target.value)} placeholder="Nome da aula ou parte" />
              <input value={novaAulaUrl} onChange={(e) => setNovaAulaUrl(e.target.value)} placeholder="Link da videoaula (opcional)" />
              <button type="button" onClick={adicionarAula}>Adicionar aula</button>
            </div>
          )}
        </div>

        <div className="conteudos-editor-bloco">
          <h3>Tarefas de apoio</h3>
          <p>Questões, leituras e revisões ficam vinculadas ao assunto, mas não aumentam o progresso do edital.</p>
          {tarefas.map((tarefa) => (
            <div key={tarefa.id} className="conteudos-editor-item">
              <span>{rotuloTipoTarefa(tarefa.tipo)} · {tarefa.nome}</span>
              <button type="button" onClick={() => setTarefas((atuais) => atuais.filter((item) => item.id !== tarefa.id))}>Remover</button>
            </div>
          ))}
          <div className="conteudos-editor-adicionar conteudos-editor-adicionar-tarefa">
            <select value={novaTarefaTipo} onChange={(e) => setNovaTarefaTipo(e.target.value as TipoTarefaAssunto)}>
              <option value="teoria">Teoria</option>
              <option value="leitura">Leitura</option>
              <option value="questoes">Questões</option>
              <option value="revisao">Revisão</option>
              <option value="redacao">Redação</option>
              <option value="outra">Outra</option>
            </select>
            <input value={novaTarefaNome} onChange={(e) => setNovaTarefaNome(e.target.value)} placeholder="Nome da tarefa" />
            <button type="button" onClick={adicionarTarefa}>Adicionar tarefa</button>
          </div>
        </div>

        <div className="conteudos-material-form">
          <input
            value={linkNome}
            onChange={(e) => setLinkNome(e.target.value)}
            placeholder="Nome do material"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link do PDF, imagem, vídeo ou site"
          />
          <button type="button" onClick={adicionarLink}>Adicionar link</button>
        </div>

        <div className="conteudos-materiais-lista">
          {materiais.map((material) => (
            <article key={material.id}>
              <a href={material.url} target="_blank" rel="noreferrer">
                {material.nome}
              </a>
              <button
                type="button"
                onClick={() =>
                  setMateriais((anteriores) =>
                    anteriores.filter((item) => item.id !== material.id)
                  )
                }
              >
                Remover
              </button>
            </article>
          ))}
        </div>

        <footer>
          <button type="button" className="secundario" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                nome: nome.trim() || assunto.nome,
                prioridade,
                resumo,
                anotacoes,
                materiais,
                aulas: aulas.map((aula, ordem) => ({ ...aula, ordem })),
                tarefas: tarefas.map((tarefa, ordem) => ({ ...tarefa, ordem })),
                aula: aulas[0]?.url,
              })
            }
          >
            Salvar alterações
          </button>
        </footer>
      </section>
    </div>
  );
}

function rotuloTipoTarefa(tipo: TipoTarefaAssunto) {
  const rotulos: Record<TipoTarefaAssunto, string> = {
    teoria: "Teoria",
    leitura: "Leitura",
    questoes: "Questões",
    revisao: "Revisão",
    redacao: "Redação",
    outra: "Outra",
  };
  return rotulos[tipo];
}

function criarIdUnico(texto: string) {
  const base = normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "item"}-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
