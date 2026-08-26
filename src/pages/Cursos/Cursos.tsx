import { useMemo, useState, type ChangeEvent } from "react";

import "./Cursos.css";
import { useApp } from "../../context/AppContext";
import type { CursoImportado, ConfiguracoesComCursos } from "../../types/cursos";
import {
  aplicarCursosAtivosNasMaterias,
  capturaDeTexto,
  criarCodigoCapturadorCurso,
  extrairCursoDeArquivo,
  organizarCapturaCurso,
  sincronizarProgressoCursos,
} from "../../utils/importacaoCurso";

export default function Cursos() {
  const { configuracoes, setConfiguracoes, materias, setMaterias } = useApp();
  const config = configuracoes as ConfiguracoesComCursos;
  const cursos = config.cursos ?? [];
  const ativosIds = config.cursosAtivosIds ?? [];

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoColado, setTextoColado] = useState("");
  const [nomeManual, setNomeManual] = useState("");
  const [preview, setPreview] = useState<CursoImportado | null>(null);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [aba, setAba] = useState<"arquivo" | "capturador">("arquivo");

  const resumo = useMemo(() => ({
    cursos: cursos.length,
    ativos: ativosIds.length,
    materias: cursos.reduce((total, curso) => total + curso.materias.length, 0),
    aulas: cursos.reduce((total, curso) => total + contarAulas(curso), 0),
  }), [ativosIds.length, cursos]);

  async function analisarArquivo() {
    if (!arquivo) {
      setMensagem("Selecione um HTML, MHTML, JSON ou TXT do curso.");
      return;
    }
    setProcessando(true);
    setMensagem("Lendo a página e organizando matérias, módulos, aulas e links...");
    try {
      const curso = await extrairCursoDeArquivo(arquivo);
      setPreview(nomeManual.trim() ? { ...curso, nome: nomeManual.trim() } : curso);
      setMensagem("Estrutura identificada. Confira e edite antes de importar.");
    } catch (erro) {
      setPreview(null);
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível analisar o arquivo.");
    } finally {
      setProcessando(false);
    }
  }

  function analisarTexto() {
    if (!textoColado.trim()) {
      setMensagem("Cole a grade do curso, o cronograma ou a lista de aulas.");
      return;
    }
    try {
      const nome = nomeManual.trim() || "Curso importado";
      const curso = organizarCapturaCurso(capturaDeTexto(textoColado, nome), nome);
      setPreview(curso);
      setMensagem("Texto organizado. Confira a estrutura antes de importar.");
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível organizar o texto.");
    }
  }

  function confirmarImportacao() {
    if (!preview || preview.materias.length === 0) return;
    const cursosComProgresso = sincronizarProgressoCursos(cursos, materias);
    const cursoNovo = { ...preview, atualizadoEm: new Date().toISOString() };
    const novosCursos = [...cursosComProgresso.filter((item) => item.id !== cursoNovo.id), cursoNovo];
    const novosAtivos = Array.from(new Set([...ativosIds, cursoNovo.id]));

    setConfiguracoes((atuais) => ({
      ...atuais,
      cursos: novosCursos,
      cursosAtivosIds: novosAtivos,
    }) as ConfiguracoesComCursos);
    setMaterias((atuais) => aplicarCursosAtivosNasMaterias(atuais, novosCursos, novosAtivos));
    setPreview(null);
    setArquivo(null);
    setTextoColado("");
    setNomeManual("");
    setMensagem(`Curso ${cursoNovo.nome} importado e integrado aos Conteúdos.`);
  }

  function alternarCurso(cursoId: string) {
    const cursosComProgresso = sincronizarProgressoCursos(cursos, materias);
    const novosAtivos = ativosIds.includes(cursoId)
      ? ativosIds.filter((id) => id !== cursoId)
      : [...ativosIds, cursoId];
    setConfiguracoes((atuais) => ({
      ...atuais,
      cursos: cursosComProgresso,
      cursosAtivosIds: novosAtivos,
    }) as ConfiguracoesComCursos);
    setMaterias((atuais) => aplicarCursosAtivosNasMaterias(atuais, cursosComProgresso, novosAtivos));
  }

  function excluirCurso(cursoId: string) {
    if (!window.confirm("Remover este curso do Study Pro? Seus outros conteúdos não serão apagados.")) return;
    const cursosComProgresso = sincronizarProgressoCursos(cursos, materias).filter((curso) => curso.id !== cursoId);
    const novosAtivos = ativosIds.filter((id) => id !== cursoId);
    setConfiguracoes((atuais) => ({
      ...atuais,
      cursos: cursosComProgresso,
      cursosAtivosIds: novosAtivos,
    }) as ConfiguracoesComCursos);
    setMaterias((atuais) => aplicarCursosAtivosNasMaterias(atuais, cursosComProgresso, novosAtivos));
  }

  function exportarCurso(curso: CursoImportado) {
    const blob = new Blob([JSON.stringify(curso, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${curso.nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "curso"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copiarCapturador() {
    try {
      await navigator.clipboard.writeText(criarCodigoCapturadorCurso());
      setMensagem("Capturador copiado. Crie um favorito no navegador e cole esse código no campo URL do favorito.");
    } catch {
      setMensagem("O navegador bloqueou a cópia automática. Selecione o código abaixo e copie manualmente.");
    }
  }

  function escolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] ?? null);
    setPreview(null);
    setMensagem("");
  }

  return (
    <section className="cursos-page">
      <header className="cursos-hero">
        <div>
          <span>MEUS CURSOS</span>
          <h1>Importe a estrutura do seu curso</h1>
          <p>
            O Study Pro separa Matéria → Módulo → Aula, preserva os links originais e permite combinar mais de um curso sem misturar um dentro do outro.
          </p>
        </div>
        <div className="cursos-hero-resumo">
          <div><strong>{resumo.cursos}</strong><span>cursos</span></div>
          <div><strong>{resumo.ativos}</strong><span>ativos</span></div>
          <div><strong>{resumo.aulas}</strong><span>aulas</span></div>
        </div>
      </header>

      <section className="cursos-importador">
        <div className="cursos-tabs">
          <button type="button" className={aba === "arquivo" ? "ativo" : ""} onClick={() => setAba("arquivo")}>Importar arquivo</button>
          <button type="button" className={aba === "capturador" ? "ativo" : ""} onClick={() => setAba("capturador")}>Capturador do navegador</button>
        </div>

        {aba === "arquivo" ? (
          <div className="cursos-importar-grid">
            <div className="cursos-upload-card">
              <h2>1. Página salva</h2>
              <p>Salve a página do curso como HTML/MHTML ou envie o JSON criado pelo Capturador.</p>
              <input value={nomeManual} onChange={(e) => setNomeManual(e.target.value)} placeholder="Nome do curso (opcional)" />
              <label className="cursos-arquivo">
                <input type="file" accept=".html,.htm,.mhtml,.mht,.json,.txt,.zip,.pdf" onChange={escolherArquivo} />
                <strong>{arquivo ? arquivo.name : "Selecionar arquivo"}</strong>
                <small>HTML · MHTML · JSON · TXT</small>
              </label>
              <button type="button" onClick={analisarArquivo} disabled={!arquivo || processando}>
                {processando ? "Analisando..." : "Analisar curso"}
              </button>
            </div>

            <div className="cursos-upload-card">
              <h2>2. Colar grade/cronograma</h2>
              <p>Útil quando o curso fornece a lista em PDF ou quando copiar e colar é mais simples.</p>
              <textarea value={textoColado} onChange={(e) => setTextoColado(e.target.value)} placeholder={'Português\nMódulo 01 - Fonologia\nAula 01 - Fonema e letra\nAula 02 - Dígrafos\n\nRLM\nMódulo 01 - Proposições...'} />
              <button type="button" onClick={analisarTexto} disabled={!textoColado.trim()}>Organizar texto</button>
            </div>
          </div>
        ) : (
          <div className="cursos-capturador">
            <div>
              <h2>Capturar uma plataforma de curso</h2>
              <p>
                Use isso em páginas que carregam as aulas por JavaScript. O capturador coleta somente nomes, ordem e links visíveis da página aberta; vídeos e arquivos do curso não são copiados.
              </p>
              <ol>
                <li>Crie um novo favorito no navegador.</li>
                <li>Clique em “Copiar capturador” e cole o código no campo URL do favorito.</li>
                <li>Abra a página do curso onde aparecem as aulas e execute o favorito.</li>
                <li>Será baixado <b>study-pro-curso.json</b>. Volte aqui e importe esse JSON.</li>
              </ol>
              <button type="button" onClick={copiarCapturador}>Copiar capturador</button>
            </div>
            <textarea readOnly value={criarCodigoCapturadorCurso()} aria-label="Código do capturador" />
          </div>
        )}

        {mensagem && <div className="cursos-mensagem">{mensagem}</div>}
      </section>

      {preview && (
        <section className="cursos-preview">
          <header>
            <div>
              <span>CONFIRA ANTES DE IMPORTAR</span>
              <h2>{preview.nome}</h2>
              <p>{preview.materias.length} matérias · {contarAulas(preview)} aulas encontradas</p>
            </div>
            <input value={preview.nome} onChange={(e) => setPreview({ ...preview, nome: e.target.value })} aria-label="Nome do curso" />
          </header>

          <div className="cursos-preview-lista">
            {preview.materias.map((materia, indiceMateria) => (
              <article key={materia.id} className="curso-materia-card">
                <div className="curso-linha-edicao">
                  <input
                    value={materia.nome}
                    onChange={(e) => atualizarPreviewMateria(preview, setPreview, indiceMateria, e.target.value)}
                  />
                  <button type="button" onClick={() => removerPreviewMateria(preview, setPreview, indiceMateria)}>Excluir matéria</button>
                </div>
                {materia.modulos.map((modulo, indiceModulo) => (
                  <div key={modulo.id} className="curso-modulo-preview">
                    <div className="curso-linha-edicao">
                      <input value={modulo.nome} onChange={(e) => atualizarPreviewModulo(preview, setPreview, indiceMateria, indiceModulo, e.target.value)} />
                      <span>{modulo.aulas.length} aulas</span>
                    </div>
                    <div className="curso-aulas-preview">
                      {modulo.aulas.map((aula, indiceAula) => (
                        <div key={aula.id} className="curso-aula-edicao">
                          <input value={aula.nome} onChange={(e) => atualizarPreviewAula(preview, setPreview, indiceMateria, indiceModulo, indiceAula, "nome", e.target.value)} />
                          <input value={aula.url ?? ""} onChange={(e) => atualizarPreviewAula(preview, setPreview, indiceMateria, indiceModulo, indiceAula, "url", e.target.value)} placeholder="Link da aula" />
                          <button type="button" onClick={() => removerPreviewAula(preview, setPreview, indiceMateria, indiceModulo, indiceAula)}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <div className="cursos-preview-acoes">
            <button type="button" className="secundario" onClick={() => setPreview(null)}>Cancelar</button>
            <button type="button" onClick={confirmarImportacao}>Confirmar importação</button>
          </div>
        </section>
      )}

      <section className="cursos-salvos">
        <header>
          <div><span>BIBLIOTECA</span><h2>Seus cursos</h2></div>
          <small>Ative um ou mais cursos para combiná-los em Conteúdos.</small>
        </header>

        {cursos.length === 0 ? (
          <div className="cursos-vazio">Nenhum curso importado ainda.</div>
        ) : (
          <div className="cursos-cards">
            {cursos.map((curso) => {
              const ativo = ativosIds.includes(curso.id);
              return (
                <article key={curso.id} className={ativo ? "ativo" : ""}>
                  <div className="curso-card-topo">
                    <div><strong>{curso.nome}</strong><span>{curso.materias.length} matérias · {contarAulas(curso)} aulas</span></div>
                    <label className="curso-toggle"><input type="checkbox" checked={ativo} onChange={() => alternarCurso(curso.id)} /><span>{ativo ? "Ativo" : "Inativo"}</span></label>
                  </div>
                  <div className="curso-materias-chips">
                    {curso.materias.slice(0, 8).map((materia) => <span key={materia.id}>{materia.nome}</span>)}
                    {curso.materias.length > 8 && <span>+{curso.materias.length - 8}</span>}
                  </div>
                  <div className="curso-card-acoes">
                    <button type="button" onClick={() => exportarCurso(curso)}>Exportar JSON</button>
                    <button type="button" className="perigo" onClick={() => excluirCurso(curso.id)}>Remover</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function contarAulas(curso: CursoImportado) {
  return curso.materias.reduce((total, materia) => total + materia.modulos.reduce((subtotal, modulo) => subtotal + modulo.aulas.length, 0), 0);
}

function atualizarPreviewMateria(preview: CursoImportado, setPreview: (curso: CursoImportado | null) => void, indiceMateria: number, nome: string) {
  const materias = preview.materias.map((materia, indice) => indice === indiceMateria ? { ...materia, nome } : materia);
  setPreview({ ...preview, materias });
}

function removerPreviewMateria(preview: CursoImportado, setPreview: (curso: CursoImportado | null) => void, indiceMateria: number) {
  setPreview({ ...preview, materias: preview.materias.filter((_, indice) => indice !== indiceMateria) });
}

function atualizarPreviewModulo(preview: CursoImportado, setPreview: (curso: CursoImportado | null) => void, indiceMateria: number, indiceModulo: number, nome: string) {
  const materias = preview.materias.map((materia, indice) => indice !== indiceMateria ? materia : {
    ...materia,
    modulos: materia.modulos.map((modulo, indiceM) => indiceM === indiceModulo ? { ...modulo, nome } : modulo),
  });
  setPreview({ ...preview, materias });
}

function atualizarPreviewAula(
  preview: CursoImportado,
  setPreview: (curso: CursoImportado | null) => void,
  indiceMateria: number,
  indiceModulo: number,
  indiceAula: number,
  campo: "nome" | "url",
  valor: string
) {
  const materias = preview.materias.map((materia, indice) => indice !== indiceMateria ? materia : {
    ...materia,
    modulos: materia.modulos.map((modulo, indiceM) => indiceM !== indiceModulo ? modulo : {
      ...modulo,
      aulas: modulo.aulas.map((aula, indiceA) => indiceA === indiceAula ? { ...aula, [campo]: valor || undefined } : aula),
    }),
  });
  setPreview({ ...preview, materias });
}

function removerPreviewAula(preview: CursoImportado, setPreview: (curso: CursoImportado | null) => void, indiceMateria: number, indiceModulo: number, indiceAula: number) {
  const materias = preview.materias.map((materia, indice) => indice !== indiceMateria ? materia : {
    ...materia,
    modulos: materia.modulos.map((modulo, indiceM) => indiceM !== indiceModulo ? modulo : {
      ...modulo,
      aulas: modulo.aulas.filter((_, indiceA) => indiceA !== indiceAula),
    }).filter((modulo) => modulo.aulas.length > 0),
  }).filter((materia) => materia.modulos.length > 0);
  setPreview({ ...preview, materias });
}
