import { useMemo, useState } from "react";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import type {
  Assunto,
  MaterialAssunto,
  Materia,
  Prioridade,
} from "../../types";

import "./Estudos.css";

type EditorAssunto = {
  materiaId: string;
  assuntoId: string;
} | null;

export default function Estudos() {
  const {
    materias,
    setMaterias,
    definirConclusaoAssunto,
  } = useApp();

  const { showToast } = useToast();

  const [busca, setBusca] = useState("");
  const [nomeMateria, setNomeMateria] = useState("");
  const [materiaNovoAssunto, setMateriaNovoAssunto] = useState("");
  const [nomeAssunto, setNomeAssunto] = useState("");
  const [prioridadeAssunto, setPrioridadeAssunto] =
    useState<Prioridade>("media");
  const [editor, setEditor] = useState<EditorAssunto>(null);

  const materiasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca);

    if (!termo) return materias;

    return materias
      .map((materia) => ({
        ...materia,
        assuntos: materia.assuntos.filter(
          (assunto) =>
            normalizarTexto(materia.nome).includes(termo) ||
            normalizarTexto(assunto.nome).includes(termo)
        ),
      }))
      .filter((materia) => materia.assuntos.length > 0);
  }, [materias, busca]);

  const assuntoEmEdicao = useMemo(() => {
    if (!editor) return null;

    const materia = materias.find((item) => item.id === editor.materiaId);
    const assunto = materia?.assuntos.find((item) => item.id === editor.assuntoId);

    return materia && assunto ? { materia, assunto } : null;
  }, [editor, materias]);

  function adicionarMateria() {
    const nome = nomeMateria.trim();

    if (!nome) {
      showToast("Informe o nome da matéria.", "warning");
      return;
    }

    const duplicada = materias.some(
      (materia) => normalizarTexto(materia.nome) === normalizarTexto(nome)
    );

    if (duplicada) {
      showToast("Essa matéria já existe.", "warning");
      return;
    }

    const novaMateria: Materia = {
      id: criarIdUnico(nome),
      nome,
      assuntos: [],
    };

    setMaterias((anteriores) => [...anteriores, novaMateria]);
    setNomeMateria("");
    setMateriaNovoAssunto(novaMateria.id);
    showToast("Matéria adicionada.", "success");
  }

  function adicionarAssunto() {
    const nome = nomeAssunto.trim();
    const materia = materias.find((item) => item.id === materiaNovoAssunto);

    if (!materia) {
      showToast("Selecione uma matéria.", "warning");
      return;
    }

    if (!nome) {
      showToast("Informe o nome do assunto.", "warning");
      return;
    }

    const duplicado = materia.assuntos.some(
      (assunto) => normalizarTexto(assunto.nome) === normalizarTexto(nome)
    );

    if (duplicado) {
      showToast("Esse assunto já existe nessa matéria.", "warning");
      return;
    }

    const novoAssunto: Assunto = {
      id: criarIdUnico(`${materia.nome}-${nome}`),
      nome,
      concluido: false,
      prioridade: prioridadeAssunto,
      resumo: "",
      anotacoes: "",
      materiais: [],
      atualizadoEm: new Date().toISOString(),
    };

    setMaterias((anteriores) =>
      anteriores.map((item) =>
        item.id !== materia.id
          ? item
          : { ...item, assuntos: [...item.assuntos, novoAssunto] }
      )
    );

    setNomeAssunto("");
    setPrioridadeAssunto("media");
    showToast("Assunto adicionado.", "success");
  }

  function excluirMateria(materia: Materia) {
    if (
      !window.confirm(
        `Excluir a matéria "${materia.nome}" e todos os assuntos dela?`
      )
    ) {
      return;
    }

    setMaterias((anteriores) =>
      anteriores.filter((item) => item.id !== materia.id)
    );

    showToast("Matéria excluída.", "info");
  }

  function excluirAssunto(materia: Materia, assunto: Assunto) {
    if (!window.confirm(`Excluir o assunto "${assunto.nome}"?`)) return;

    definirConclusaoAssunto(materia.id, assunto.id, false);

    setMaterias((anteriores) =>
      anteriores.map((item) =>
        item.id !== materia.id
          ? item
          : {
              ...item,
              assuntos: item.assuntos.filter(
                (itemAssunto) => itemAssunto.id !== assunto.id
              ),
            }
      )
    );

    showToast("Assunto excluído.", "info");
  }

  function salvarAssunto(
    materiaId: string,
    assuntoId: string,
    alteracoes: Partial<Assunto>
  ) {
    setMaterias((anteriores) =>
      anteriores.map((materia) =>
        materia.id !== materiaId
          ? materia
          : {
              ...materia,
              assuntos: materia.assuntos.map((assunto) =>
                assunto.id !== assuntoId
                  ? assunto
                  : {
                      ...assunto,
                      ...alteracoes,
                      atualizadoEm: new Date().toISOString(),
                    }
              ),
            }
      )
    );
  }

  return (
    <section className="conteudos-container">
      <header className="conteudos-cabecalho">
        <div>
          <h1>📚 Conteúdos</h1>
          <p>
            Organize matérias e assuntos, marque o progresso e salve resumos,
            bizus e materiais relacionados.
          </p>
        </div>

        <input
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Pesquisar matéria ou assunto"
        />
      </header>

      <div className="conteudos-cadastros">
        <article className="conteudos-painel-form">
          <h2>Nova matéria</h2>
          <div className="conteudos-linha-form">
            <input
              value={nomeMateria}
              onChange={(evento) => setNomeMateria(evento.target.value)}
              placeholder="Ex.: Direito Administrativo"
            />
            <button type="button" onClick={adicionarMateria}>
              Adicionar matéria
            </button>
          </div>
        </article>

        <article className="conteudos-painel-form">
          <h2>Novo assunto</h2>
          <div className="conteudos-grid-form">
            <select
              value={materiaNovoAssunto}
              onChange={(evento) => setMateriaNovoAssunto(evento.target.value)}
            >
              <option value="">Selecione a matéria</option>
              {materias.map((materia) => (
                <option key={materia.id} value={materia.id}>
                  {materia.nome}
                </option>
              ))}
            </select>

            <input
              value={nomeAssunto}
              onChange={(evento) => setNomeAssunto(evento.target.value)}
              placeholder="Ex.: Artigo 5º"
            />

            <select
              value={prioridadeAssunto}
              onChange={(evento) =>
                setPrioridadeAssunto(evento.target.value as Prioridade)
              }
            >
              <option value="baixa">Prioridade baixa</option>
              <option value="media">Prioridade média</option>
              <option value="alta">Prioridade alta</option>
            </select>

            <button type="button" onClick={adicionarAssunto}>
              Adicionar assunto
            </button>
          </div>
        </article>
      </div>

      {materiasFiltradas.length === 0 && (
        <div className="conteudos-vazio">Nenhum conteúdo encontrado.</div>
      )}

      {materiasFiltradas.map((materia) => {
        const concluidos = materia.assuntos.filter(
          (assunto) => assunto.concluido
        ).length;
        const progresso =
          materia.assuntos.length === 0
            ? 0
            : Math.round((concluidos / materia.assuntos.length) * 100);

        return (
          <article key={materia.id} className="conteudos-materia-card">
            <div className="conteudos-materia-topo">
              <div>
                <h2>{materia.nome}</h2>
                <p>
                  {concluidos} de {materia.assuntos.length} assuntos concluídos
                </p>
              </div>

              <div className="conteudos-materia-acoes">
                <strong>{progresso}%</strong>
                <button
                  type="button"
                  className="conteudos-excluir"
                  onClick={() => excluirMateria(materia)}
                >
                  Excluir matéria
                </button>
              </div>
            </div>

            <div className="conteudos-progresso">
              <div style={{ width: `${progresso}%` }} />
            </div>

            <div className="conteudos-assuntos">
              {materia.assuntos.map((assunto) => (
                <div key={assunto.id} className="conteudos-assunto-item">
                  <input
                    type="checkbox"
                    checked={assunto.concluido}
                    onChange={() =>
                      definirConclusaoAssunto(
                        materia.id,
                        assunto.id,
                        !assunto.concluido
                      )
                    }
                  />

                  <div className="conteudos-assunto-info">
                    <strong className={assunto.concluido ? "concluido" : ""}>
                      {assunto.nome}
                    </strong>
                    <small>
                      {assunto.resumo || assunto.anotacoes
                        ? "Possui anotações salvas"
                        : "Sem anotações"}
                    </small>
                  </div>

                  <span className={`prioridade prioridade-${assunto.prioridade}`}>
                    {assunto.prioridade}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setEditor({ materiaId: materia.id, assuntoId: assunto.id })
                    }
                  >
                    📝 Anotações e materiais
                  </button>

                  <button
                    type="button"
                    className="conteudos-excluir"
                    onClick={() => excluirAssunto(materia, assunto)}
                  >
                    Excluir
                  </button>
                </div>
              ))}

              {materia.assuntos.length === 0 && (
                <p className="conteudos-sem-assuntos">
                  Esta matéria ainda não possui assuntos.
                </p>
              )}
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
            salvarAssunto(
              assuntoEmEdicao.materia.id,
              assuntoEmEdicao.assunto.id,
              alteracoes
            );
            setEditor(null);
            showToast("Anotações e materiais salvos.", "success");
          }}
        />
      )}
    </section>
  );
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
