import { useMemo, useState } from "react";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import type {
  Assunto,
  MaterialAssunto,
  Materia,
  Modulo,
  Prioridade,
} from "../../types";

import "./Estudos.css";

type EditorAssunto = {
  materiaId: string;
  moduloId: string;
  assuntoId: string;
} | null;

export default function Estudos() {
  const { materias, setMaterias, definirConclusaoAssunto } = useApp();
  const { showToast } = useToast();

  const [busca, setBusca] = useState("");
  const [nomeMateria, setNomeMateria] = useState("");
  const [materiaNovoModulo, setMateriaNovoModulo] = useState("");
  const [nomeModulo, setNomeModulo] = useState("");
  const [materiaNovoAssunto, setMateriaNovoAssunto] = useState("");
  const [moduloNovoAssunto, setModuloNovoAssunto] = useState("");
  const [nomeAssunto, setNomeAssunto] = useState("");
  const [prioridadeAssunto, setPrioridadeAssunto] = useState<Prioridade>("media");
  const [editor, setEditor] = useState<EditorAssunto>(null);

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
                normalizarTexto(assunto.nome).includes(termo)
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

  return (
    <section className="conteudos-container">
      <header className="conteudos-cabecalho">
        <div>
          <h1>📚 Conteúdos</h1>
          <p>Organize o estudo em Matéria → Módulo → Assunto, mantendo progresso, notas e materiais.</p>
        </div>
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
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
        const todos = (materia.modulos ?? []).flatMap((m) => m.assuntos);
        const concluidos = todos.filter((a) => a.concluido).length;
        const progresso = todos.length ? Math.round((concluidos / todos.length) * 100) : 0;
        return (
          <article key={materia.id} className="conteudos-materia-card">
            <div className="conteudos-materia-topo">
              <div><h2>{materia.nome}</h2><p>{concluidos} de {todos.length} assuntos concluídos</p></div>
              <div className="conteudos-materia-acoes">
                <strong>{progresso}%</strong>
                <button type="button" className="conteudos-excluir" onClick={() => excluirMateria(materia)}>Excluir matéria</button>
              </div>
            </div>
            <div className="conteudos-progresso"><div style={{ width: `${progresso}%` }} /></div>

            <div className="conteudos-modulos">
              {(materia.modulos ?? []).map((modulo) => {
                const feitos = modulo.assuntos.filter((a) => a.concluido).length;
                const pct = modulo.assuntos.length ? Math.round(feitos / modulo.assuntos.length * 100) : 0;
                return (
                  <section key={modulo.id} className="conteudos-modulo-card">
                    <header className="conteudos-modulo-topo">
                      <div><h3>{modulo.nome}</h3><small>{feitos}/{modulo.assuntos.length} concluídos · {pct}%</small></div>
                      <div className="conteudos-modulo-acoes">
                        <button type="button" onClick={() => renomearModulo(materia, modulo)}>Editar</button>
                        <button type="button" className="conteudos-excluir" onClick={() => excluirModulo(materia, modulo)}>Excluir</button>
                      </div>
                    </header>
                    <div className="conteudos-progresso conteudos-progresso-modulo"><div style={{ width: `${pct}%` }} /></div>
                    <div className="conteudos-assuntos">
                      {modulo.assuntos.map((assunto) => (
                        <div key={assunto.id} className="conteudos-assunto-item">
                          <input type="checkbox" checked={assunto.concluido}
                            onChange={() => definirConclusaoAssunto(materia.id, assunto.id, !assunto.concluido)} />
                          <div className="conteudos-assunto-info">
                            <strong className={assunto.concluido ? "concluido" : ""}>{assunto.nome}</strong>
                            <small>{assunto.resumo || assunto.anotacoes ? "Possui anotações salvas" : "Sem anotações"}</small>
                          </div>
                          <span className={`prioridade prioridade-${assunto.prioridade}`}>{assunto.prioridade}</span>
                          <select className="conteudos-mover" value={modulo.id}
                            onChange={(e) => moverAssunto(materia, modulo.id, assunto, e.target.value)}>
                            {(materia.modulos ?? []).map((destino) =>
                              <option key={destino.id} value={destino.id}>Mover: {destino.nome}</option>)}
                          </select>
                          <button type="button" onClick={() => setEditor({ materiaId: materia.id, moduloId: modulo.id, assuntoId: assunto.id })}>
                            📝 Notas
                          </button>
                          <button type="button" className="conteudos-excluir" onClick={() => excluirAssunto(materia, modulo, assunto)}>Excluir</button>
                        </div>
                      ))}
                      {modulo.assuntos.length === 0 && <p className="conteudos-sem-assuntos">Módulo sem assuntos.</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        );
      })}

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
  const [nome, setNome] = useState(assunto.nome);
  const [prioridade, setPrioridade] = useState<Prioridade>(assunto.prioridade);
  const [resumo, setResumo] = useState(assunto.resumo ?? "");
  const [anotacoes, setAnotacoes] = useState(assunto.anotacoes ?? "");
  const [linkNome, setLinkNome] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [materiais, setMateriais] = useState<MaterialAssunto[]>(
    assunto.materiais ?? []
  );

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
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
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
