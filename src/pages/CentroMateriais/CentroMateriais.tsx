import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./CentroMateriais.css";

import { useApp } from "../../context/AppContext";

import {
  abrirMaterial,
  baixarMaterial,
  excluirMaterial,
  listarMateriais,
  salvarArquivoMaterial,
  salvarLinkMaterial,
  type MaterialEstudo,
} from "../../services/materiaisService";

type ModoCadastro = "arquivo" | "link";

export default function CentroMateriais() {
  const { materias } = useApp();

  const [materiais, setMateriais] =
    useState<MaterialEstudo[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [modo, setModo] =
    useState<ModoCadastro>("arquivo");

  const [nome, setNome] =
    useState("");

  const [materia, setMateria] =
    useState("");

  const [assunto, setAssunto] =
    useState("");

  const [observacao, setObservacao] =
    useState("");

  const [url, setUrl] =
    useState("");

  const [arquivo, setArquivo] =
    useState<File | null>(null);

  const [pesquisa, setPesquisa] =
    useState("");

  const [filtroMateria, setFiltroMateria] =
    useState("");

  const [salvando, setSalvando] =
    useState(false);

  const [mensagem, setMensagem] =
    useState("");

  const [erro, setErro] =
    useState("");

  const materiaAtual = useMemo(
    () =>
      materias.find(
        (item) => item.nome === materia
      ),
    [materias, materia]
  );

  const assuntosDisponiveis =
    materiaAtual?.assuntos ?? [];

  const materiaisFiltrados = useMemo(() => {
    const termo = normalizar(pesquisa);

    return materiais.filter((material) => {
      const correspondeMateria =
        !filtroMateria ||
        material.materia === filtroMateria;

      const correspondePesquisa =
        !termo ||
        normalizar(
          [
            material.nome,
            material.materia,
            material.assunto,
            material.observacao,
            material.nomeArquivo,
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(termo);

      return correspondeMateria && correspondePesquisa;
    });
  }, [materiais, pesquisa, filtroMateria]);

  const grupos = useMemo(() => {
    const mapa = new Map<
      string,
      Map<string, MaterialEstudo[]>
    >();

    materiaisFiltrados.forEach((material) => {
      if (!mapa.has(material.materia)) {
        mapa.set(material.materia, new Map());
      }

      const assuntos = mapa.get(material.materia);

      if (!assuntos) {
        return;
      }

      if (!assuntos.has(material.assunto)) {
        assuntos.set(material.assunto, []);
      }

      assuntos.get(material.assunto)?.push(material);
    });

    return Array.from(mapa.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [materiaisFiltrados]);

  useEffect(() => {
    carregarMateriais();
  }, []);

  async function carregarMateriais() {
    try {
      setCarregando(true);
      setErro("");

      const lista = await listarMateriais();
      setMateriais(lista);
    } catch (erroCarregamento) {
      setErro(obterMensagemErro(erroCarregamento));
    } finally {
      setCarregando(false);
    }
  }

  function alterarMateria(valor: string) {
    setMateria(valor);
    setAssunto("");
  }

  async function adicionarMaterial() {
    setErro("");
    setMensagem("");

    if (!nome.trim()) {
      setErro("Informe o nome do material.");
      return;
    }

    if (!materia.trim()) {
      setErro("Selecione uma matéria.");
      return;
    }

    if (!assunto.trim()) {
      setErro("Selecione ou informe um assunto.");
      return;
    }

    if (modo === "arquivo" && !arquivo) {
      setErro("Selecione um arquivo.");
      return;
    }

    if (modo === "link" && !url.trim()) {
      setErro("Informe o endereço do link.");
      return;
    }

    try {
      setSalvando(true);

      const novoMaterial =
        modo === "arquivo"
          ? await salvarArquivoMaterial({
              nome,
              materia,
              assunto,
              observacao,
              arquivo: arquivo as File,
            })
          : await salvarLinkMaterial({
              nome,
              materia,
              assunto,
              observacao,
              url,
            });

      setMateriais((anteriores) => [
        novoMaterial,
        ...anteriores,
      ]);

      limparFormulario();
      setMensagem("Material salvo com sucesso.");
    } catch (erroSalvamento) {
      setErro(obterMensagemErro(erroSalvamento));
    } finally {
      setSalvando(false);
    }
  }

  async function abrir(material: MaterialEstudo) {
    try {
      setErro("");
      await abrirMaterial(material);
    } catch (erroAbertura) {
      setErro(obterMensagemErro(erroAbertura));
    }
  }

  async function baixar(material: MaterialEstudo) {
    try {
      setErro("");
      await baixarMaterial(material);
    } catch (erroDownload) {
      setErro(obterMensagemErro(erroDownload));
    }
  }

  async function excluir(material: MaterialEstudo) {
    const confirmar = window.confirm(
      `Excluir "${material.nome}"?`
    );

    if (!confirmar) {
      return;
    }

    try {
      await excluirMaterial(material.id);

      setMateriais((anteriores) =>
        anteriores.filter(
          (item) => item.id !== material.id
        )
      );
    } catch (erroExclusao) {
      setErro(obterMensagemErro(erroExclusao));
    }
  }

  function limparFormulario() {
    setNome("");
    setMateria("");
    setAssunto("");
    setObservacao("");
    setUrl("");
    setArquivo(null);

    const input = document.getElementById(
      "material-arquivo"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  return (
    <section className="materiais-container">
      <div className="materiais-cabecalho">
        <div>
          <h1>📚 Centro de Materiais</h1>

          <p>
            Organize PDFs, documentos, imagens e links
            por matéria e assunto.
          </p>
        </div>

        <div className="materiais-total">
          <span>Materiais salvos</span>
          <strong>{materiais.length}</strong>
        </div>
      </div>

      {erro && (
        <div className="materiais-mensagem materiais-erro">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="materiais-mensagem materiais-sucesso">
          {mensagem}
        </div>
      )}

      <div className="materiais-grid">
        <div className="materiais-cadastro">
          <h2>Adicionar material</h2>

          <div className="materiais-modos">
            <button
              type="button"
              className={modo === "arquivo" ? "ativo" : ""}
              onClick={() => setModo("arquivo")}
            >
              📄 Arquivo
            </button>

            <button
              type="button"
              className={modo === "link" ? "ativo" : ""}
              onClick={() => setModo("link")}
            >
              🔗 Link
            </button>
          </div>

          <div className="materiais-formulario">
            <Campo label="Nome do material">
              <input
                value={nome}
                onChange={(evento) =>
                  setNome(evento.target.value)
                }
                placeholder="Ex.: Resumo Governo de Nassau"
              />
            </Campo>

            <Campo label="Matéria">
              <select
                value={materia}
                onChange={(evento) =>
                  alterarMateria(evento.target.value)
                }
              >
                <option value="">
                  Selecione a matéria
                </option>

                {materias.map((item) => (
                  <option
                    key={item.id}
                    value={item.nome}
                  >
                    {item.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Assunto">
              <select
                value={
                  assuntosDisponiveis.some(
                    (item) => item.nome === assunto
                  )
                    ? assunto
                    : ""
                }
                onChange={(evento) =>
                  setAssunto(evento.target.value)
                }
                disabled={!materia}
              >
                <option value="">
                  {materia
                    ? "Selecione o assunto"
                    : "Selecione primeiro a matéria"}
                </option>

                {assuntosDisponiveis.map((item) => (
                  <option
                    key={item.id}
                    value={item.nome}
                  >
                    {item.nome}
                  </option>
                ))}
              </select>

              <input
                value={assunto}
                onChange={(evento) =>
                  setAssunto(evento.target.value)
                }
                placeholder="Ou digite um assunto"
              />
            </Campo>

            {modo === "arquivo" ? (
              <Campo label="Arquivo">
                <input
                  id="material-arquivo"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={(evento) =>
                    setArquivo(
                      evento.target.files?.[0] ?? null
                    )
                  }
                />

                {arquivo && (
                  <small>
                    {arquivo.name} —{" "}
                    {formatarTamanho(arquivo.size)}
                  </small>
                )}
              </Campo>
            ) : (
              <Campo label="Endereço do link">
                <input
                  value={url}
                  onChange={(evento) =>
                    setUrl(evento.target.value)
                  }
                  placeholder="https://..."
                />
              </Campo>
            )}

            <Campo label="Observação">
              <textarea
                value={observacao}
                onChange={(evento) =>
                  setObservacao(evento.target.value)
                }
                placeholder="Anotação opcional sobre este material"
              />
            </Campo>
          </div>

          <button
            type="button"
            className="materiais-salvar"
            onClick={adicionarMaterial}
            disabled={salvando}
          >
            {salvando
              ? "Salvando..."
              : "+ Adicionar material"}
          </button>
        </div>

        <div className="materiais-biblioteca">
          <div className="materiais-filtros">
            <input
              value={pesquisa}
              onChange={(evento) =>
                setPesquisa(evento.target.value)
              }
              placeholder="Pesquisar material..."
            />

            <select
              value={filtroMateria}
              onChange={(evento) =>
                setFiltroMateria(evento.target.value)
              }
            >
              <option value="">
                Todas as matérias
              </option>

              {materias.map((item) => (
                <option
                  key={item.id}
                  value={item.nome}
                >
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          {carregando ? (
            <div className="materiais-vazio">
              Carregando materiais...
            </div>
          ) : grupos.length === 0 ? (
            <div className="materiais-vazio">
              <h2>Nenhum material encontrado</h2>

              <p>
                Adicione um PDF, documento, imagem ou link.
              </p>
            </div>
          ) : (
            <div className="materiais-grupos">
              {grupos.map(([nomeMateria, assuntos]) => (
                <section
                  key={nomeMateria}
                  className="materiais-materia"
                >
                  <h2>📘 {nomeMateria}</h2>

                  {Array.from(assuntos.entries())
                    .sort(([a], [b]) =>
                      a.localeCompare(b, "pt-BR")
                    )
                    .map(([nomeAssunto, itens]) => (
                      <div
                        key={nomeAssunto}
                        className="materiais-assunto"
                      >
                        <h3>📂 {nomeAssunto}</h3>

                        <div className="materiais-lista">
                          {itens.map((material) => (
                            <article
                              key={material.id}
                              className="material-card"
                            >
                              <div className="material-icone">
                                {iconeMaterial(material)}
                              </div>

                              <div className="material-info">
                                <strong>
                                  {material.nome}
                                </strong>

                                <span>
                                  {material.tipo === "arquivo"
                                    ? `${material.nomeArquivo ?? "Arquivo"} • ${formatarTamanho(material.tamanhoBytes ?? 0)}`
                                    : material.url}
                                </span>

                                {material.observacao && (
                                  <p>
                                    {material.observacao}
                                  </p>
                                )}

                                <small>
                                  Adicionado em{" "}
                                  {formatarData(
                                    material.criadoEm
                                  )}
                                </small>
                              </div>

                              <div className="material-acoes">
                                <button
                                  type="button"
                                  className="material-abrir"
                                  onClick={() => abrir(material)}
                                >
                                  Abrir
                                </button>

                                {material.tipo === "arquivo" && (
                                  <button
                                    type="button"
                                    className="material-baixar"
                                    onClick={() =>
                                      baixar(material)
                                    }
                                  >
                                    Baixar
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="material-excluir"
                                  onClick={() =>
                                    excluir(material)
                                  }
                                >
                                  Excluir
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="materiais-campo">
      <label>{label}</label>
      {children}
    </div>
  );
}

function iconeMaterial(material: MaterialEstudo) {
  if (material.tipo === "link") {
    return "🔗";
  }

  const tipo = material.mimeType ?? "";

  if (tipo.includes("pdf")) {
    return "📕";
  }

  if (tipo.includes("image")) {
    return "🖼️";
  }

  if (
    tipo.includes("word") ||
    tipo.includes("document")
  ) {
    return "📘";
  }

  return "📄";
}

function formatarTamanho(bytes: number) {
  if (bytes <= 0) {
    return "Tamanho desconhecido";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatarData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-BR");
}

function obterMensagemErro(erro: unknown) {
  return erro instanceof Error
    ? erro.message
    : "Ocorreu um erro inesperado.";
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
