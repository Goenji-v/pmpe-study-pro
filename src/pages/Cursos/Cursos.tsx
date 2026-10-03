import {
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import "./Cursos.css";
import "./ClassificacaoCursos.css";
import { useApp } from "../../context/AppContext";
import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import { analisarMidiasDoCurso } from "../../services/cursoMidiaService";
import { criarCodigoCapturadorCurso } from "../../utils/capturadorCurso";
import type { CategoriaCursoMateria, CursoImportado, ConfiguracoesComCursos } from "../../types/cursos";
import type { ConfiguracoesComEdital } from "../../types/editalInteligente";
import {
  aplicarCursosAtivosNasMaterias,
  capturaDeHtml,
  capturaDeTexto,
  extrairCursoDeArquivo,
  encontrarCursoExistente,
  mesclarCursoRecebido,
  organizarCapturaCurso,
  sincronizarProgressoCursos,
} from "../../utils/importacaoCurso";

export default function Cursos() {
  const navigate = useNavigate();
  const { configuracoes, setConfiguracoes, materias, setMaterias } = useApp();
  const config = configuracoes as ConfiguracoesComCursos;
  const analiseEdital =
    (configuracoes as ConfiguracoesComEdital).editalAtivo?.analise;
  const cursos = config.cursos ?? [];
  const ativosIds = config.cursosAtivosIds ?? [];

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [midiasCurso, setMidiasCurso] = useState<File[]>([]);
  const [textoColado, setTextoColado] = useState("");
  const [nomeManual, setNomeManual] = useState("");
  const [preview, setPreview] = useState<CursoImportado | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [aba, setAba] = useState<"arquivo" | "capturador">("arquivo");

  const resumo = {
    cursos: cursos.length,
    ativos: ativosIds.length,
    materias: cursos.reduce((total, curso) => total + curso.materias.length, 0),
    aulas: cursos.reduce((total, curso) => total + contarAulas(curso), 0),
  };

  async function analisarMidiasSelecionadas() {
    if (midiasCurso.length === 0) {
      setMensagem("Selecione prints, fotos ou um PDF onde a grade do curso esteja visível.");
      return;
    }

    setProcessando(true);
    setEditandoId(null);
    setMensagem(
      "Lendo as telas e montando Matéria → Módulo → Aula..."
    );

    try {
      const curso = await analisarMidiasDoCurso(
        midiasCurso,
        nomeManual
      );
      setPreview(curso);
      setMensagem(
        "Trilha identificada. Confira a estrutura abaixo antes de importar."
      );
    } catch (erro) {
      setPreview(null);
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Não foi possível ler as imagens/PDF do curso."
      );
    } finally {
      setProcessando(false);
    }
  }

  function escolherMidias(
    evento: ChangeEvent<HTMLInputElement>
  ) {
    const arquivos = Array.from(evento.target.files ?? []).slice(0, 12);
    setMidiasCurso(arquivos);
    setPreview(null);
    setMensagem(
      arquivos.length
        ? `${arquivos.length} arquivo(s) selecionado(s). Agora clique em “Ler e montar trilha”.`
        : ""
    );
  }

  async function analisarArquivo() {
    if (!arquivo) {
      setMensagem("Selecione um HTML, MHTML, JSON ou TXT do curso.");
      return;
    }
    setProcessando(true);
    setEditandoId(null);
    setMensagem("Lendo a página e organizando matérias, módulos, aulas e links...");
    try {
      const curso = await extrairCursoDeArquivo(arquivo);
      setPreview(nomeManual.trim() ? { ...curso, nome: nomeManual.trim() } : curso);
      setMensagem(curso.relatorioCaptura?.pendencias.length ? "Captura parcial: confira as pendências e a estrutura antes de importar." : "Estrutura identificada. Confira os avisos e edite antes de importar.");
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
      setEditandoId(null);
      const curso = organizarCapturaCurso(capturaDeTexto(textoColado, nome), nome);
      setPreview(curso);
      setMensagem("Texto organizado. Confira a estrutura antes de importar.");
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível organizar o texto.");
    }
  }


  function organizarConteudoCopiado(
    html: string,
    texto: string
  ) {
    if (!html.trim() && !texto.trim()) {
      throw new Error(
        "Nada foi encontrado. Abra o curso, use Ctrl+A e Ctrl+C e tente novamente."
      );
    }

    const nome = nomeManual.trim() || "Curso importado";
    const captura = html.trim()
      ? capturaDeHtml(html, undefined, nome)
      : capturaDeTexto(texto, nome);
    const curso = organizarCapturaCurso(captura, nome);

    if (curso.materias.length === 0) {
      throw new Error(
        "O conteúdo foi copiado, mas o Study Pro não conseguiu identificar matérias e aulas. Tente copiar somente a área da grade do curso ou use uma opção avançada."
      );
    }

    setPreview(curso);
    setEditandoId(null);
    setMensagem(
      html.trim()
        ? "Curso identificado. Confira a trilha abaixo e importe."
        : "Estrutura identificada pelo texto. Confira a trilha abaixo e importe."
    );
  }

  async function analisarAreaTransferencia() {
    setProcessando(true);
    setEditandoId(null);
    setMensagem("Lendo o que você copiou da plataforma do curso...");

    try {
      let html = "";
      let texto = "";

      if (navigator.clipboard?.read) {
        const itens = await navigator.clipboard.read();

        for (const item of itens) {
          if (!html && item.types.includes("text/html")) {
            html = await (await item.getType("text/html")).text();
          }

          if (!texto && item.types.includes("text/plain")) {
            texto = await (await item.getType("text/plain")).text();
          }
        }
      } else if (navigator.clipboard?.readText) {
        texto = await navigator.clipboard.readText();
      } else {
        throw new Error(
          "Seu navegador bloqueou a leitura automática. Use a área 'Ctrl+V' logo abaixo."
        );
      }

      organizarConteudoCopiado(html, texto);
    } catch (erro) {
      setPreview(null);
      setMensagem(
        erro instanceof Error
          ? `${erro.message} Se o botão não funcionar, clique na área de colagem e aperte Ctrl+V.`
          : "Não foi possível ler o curso. Use a área de colagem e aperte Ctrl+V."
      );
    } finally {
      setProcessando(false);
    }
  }

  function analisarColagemManual(
    evento: ClipboardEvent<HTMLDivElement>
  ) {
    evento.preventDefault();
    setProcessando(true);
    setMensagem("Organizando a trilha copiada...");

    try {
      const html =
        evento.clipboardData.getData("text/html");
      const texto =
        evento.clipboardData.getData("text/plain");

      organizarConteudoCopiado(html, texto);
    } catch (erro) {
      setPreview(null);
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Não foi possível organizar o conteúdo colado."
      );
    } finally {
      setProcessando(false);
    }
  }

  function abrirCursoNaCentral(curso: CursoImportado) {
    const cursoAtualizado =
      sincronizarProgressoCursos([curso], materias)[0] ?? curso;
    const etapa = obterProximaEtapaCurso(cursoAtualizado);

    if (!etapa) {
      setMensagem(
        "Este curso não possui uma aula de matéria pronta para iniciar. Confira a classificação do curso."
      );
      return;
    }

    sessionStorage.setItem(
      "pmpe:central-estudos:prefill",
      JSON.stringify({
        materia: etapa.materia.nome,
        modulo: `${curso.nome} · ${etapa.modulo.nome}`,
        moduloId: `curso:${curso.id}:modulo:${etapa.modulo.id}`,
        assunto: etapa.aula.nome,
        assuntoId: `curso:${curso.id}:aula:${etapa.aula.id}`,
        tipo: "aula",
        objetivo: `Estudar ${etapa.aula.nome}`,
        urlAula: etapa.aula.url,
      })
    );

    navigate("/central-estudos");
  }

  function continuarCurso(curso: CursoImportado) {
    if (!ativosIds.includes(curso.id)) {
      const cursosComProgresso =
        sincronizarProgressoCursos(cursos, materias);
      const novosAtivos =
        Array.from(new Set([...ativosIds, curso.id]));

      setConfiguracoes((atuais) => ({
        ...atuais,
        cursos: cursosComProgresso,
        cursosAtivosIds: novosAtivos,
      }) as ConfiguracoesComCursos);

      setMaterias((atuais) =>
        aplicarCursosAtivosNasMaterias(
          atuais,
          cursosComProgresso,
          novosAtivos,
          analiseEdital
        )
      );
    }

    abrirCursoNaCentral(curso);
  }

  function confirmarImportacao(comecarAgora = false) {
    if (!preview || preview.materias.length === 0) return;

    const cursosComProgresso =
      sincronizarProgressoCursos(cursos, materias);
    const cursoNovo = {
      ...(editandoId
        ? preview
        : mesclarCursoRecebido(cursosComProgresso, preview)),
      atualizadoEm: new Date().toISOString(),
    };
    const novosCursos = [
      ...cursosComProgresso.filter(
        (item) => item.id !== cursoNovo.id
      ),
      cursoNovo,
    ];
    const novosAtivos =
      Array.from(new Set([...ativosIds, cursoNovo.id]));

    setConfiguracoes((atuais) => ({
      ...atuais,
      cursos: novosCursos,
      cursosAtivosIds: novosAtivos,
    }) as ConfiguracoesComCursos);

    setMaterias((atuais) =>
      aplicarCursosAtivosNasMaterias(
        atuais,
        novosCursos,
        novosAtivos,
        analiseEdital
      )
    );

    setPreview(null);
    setEditandoId(null);
    setArquivo(null);
    setMidiasCurso([]);
    setTextoColado("");
    setNomeManual("");
    setMensagem(
      `Curso ${cursoNovo.nome} pronto. A trilha está ativa em Conteúdos e disponível no Plano Tático para os assuntos correspondentes ao edital.`
    );

    if (comecarAgora) {
      abrirCursoNaCentral(cursoNovo);
    }
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
    setMaterias((atuais) =>
      aplicarCursosAtivosNasMaterias(
        atuais,
        cursosComProgresso,
        novosAtivos,
        analiseEdital
      )
    );
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
    setMaterias((atuais) =>
      aplicarCursosAtivosNasMaterias(
        atuais,
        cursosComProgresso,
        novosAtivos,
        analiseEdital
      )
    );
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
      setMensagem("Capturador V3 copiado. Substitua todo o campo URL do favorito antigo por este código. Execute na página principal da plataforma do curso, não aqui.");
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
            Traga o curso, confira a estrutura e comece. O Study Pro transforma o conteúdo em uma trilha Matéria → Módulo → Aula, preserva os links e acompanha seu progresso.
          </p>
        </div>
        <div className="cursos-hero-resumo">
          <div><strong>{resumo.cursos}</strong><span>cursos</span></div>
          <div><strong>{resumo.ativos}</strong><span>ativos</span></div>
          <div><strong>{resumo.aulas}</strong><span>aulas</span></div>
        </div>
      </header>

      <section className="cursos-importador">
        <div className="cursos-importacao-facil">
          <div>
            <span>RECOMENDADO · PC E CELULAR</span>
            <h2>Enviar prints, fotos ou PDF da grade</h2>
            <p>
              Tire prints das telas onde aparecem as matérias, módulos e aulas do curso.
              No computador ou no celular, selecione as imagens aqui. Se a plataforma permitir
              imprimir/salvar a grade em PDF, você também pode enviar o PDF.
            </p>
          </div>

          <div className="cursos-importacao-passos" aria-label="Como importar seu curso">
            <span><b>1</b> Abra a grade e tire os prints</span>
            <span><b>2</b> Selecione as imagens ou PDF</span>
            <span><b>3</b> Confira e comece a trilha</span>
          </div>

          <div className="cursos-importacao-facil-acoes">
            <input
              value={nomeManual}
              onChange={(e) => setNomeManual(e.target.value)}
              placeholder="Nome do curso (opcional)"
              aria-label="Nome do curso para importação rápida"
            />
          </div>

          <label className="cursos-midia-upload">
            <input
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              onChange={escolherMidias}
            />
            <strong>
              {midiasCurso.length
                ? `${midiasCurso.length} arquivo(s) selecionado(s)`
                : "Selecionar prints, fotos ou PDF"}
            </strong>
            <span>
              {midiasCurso.length
                ? midiasCurso.slice(0, 3).map((arquivo) => arquivo.name).join(" · ") +
                  (midiasCurso.length > 3 ? ` · +${midiasCurso.length - 3}` : "")
                : "Até 12 arquivos por análise"}
            </span>
          </label>

          <button
            type="button"
            className="cursos-colar-curso"
            onClick={() => void analisarMidiasSelecionadas()}
            disabled={processando || midiasCurso.length === 0}
          >
            {processando ? "Lendo grade..." : "Ler e montar trilha"}
          </button>

          <small>
            Não precisa copiar código nem informar sua senha. Prints montam a trilha mesmo sem links;
            links só são adicionados quando estiverem realmente disponíveis na fonte.
          </small>

          <details className="cursos-copia-opcional">
            <summary>Já consegue copiar a grade? Tentar copiar/colar</summary>

            <p>
              Essa opção pode funcionar em algumas plataformas no computador, mas não é obrigatória.
            </p>

            <div className="cursos-importacao-facil-acoes">
              <button
                type="button"
                onClick={() => void analisarAreaTransferencia()}
                disabled={processando}
              >
                {processando ? "Lendo curso..." : "Ler o que copiei"}
              </button>
            </div>

            <div
              className="cursos-colar-zona"
              role="button"
              tabIndex={0}
              onPaste={analisarColagemManual}
              aria-label="Clique aqui e pressione Control V para colar o curso"
            >
              <strong>No computador: clique aqui e aperte Ctrl+V</strong>
              <span>Se a plataforma não copiar a grade completa, use os prints acima.</span>
            </div>
          </details>
        </div>

        <details className="cursos-metodos-avancados">
          <summary>Outras formas de importar</summary>

          <div className="cursos-tabs">
            <button type="button" className={aba === "arquivo" ? "ativo" : ""} onClick={() => setAba("arquivo")}>Arquivo ou texto</button>
            <button type="button" className={aba === "capturador" ? "ativo" : ""} onClick={() => setAba("capturador")}>Capturador avançado</button>
          </div>

        {aba === "arquivo" ? (
          <div className="cursos-importar-grid">
            <div className="cursos-upload-card">
              <h2>1. Página salva</h2>
              <p>Salve a página do curso como HTML/MHTML ou envie o JSON criado pelo Capturador.</p>
              <input value={nomeManual} onChange={(e) => setNomeManual(e.target.value)} placeholder="Nome do curso (opcional)" />
              <label className="cursos-arquivo">
                <input type="file" accept=".html,.htm,.mhtml,.mht,.json,.txt" onChange={escolherArquivo} />
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
              <h2>Capturador V3 · Uma execução, um JSON</h2>
              <p>
                Na página principal do RDC/Tutor LMS, o capturador percorre os cartões das matérias e reúne suas grades em um único arquivo. Usa o login já aberto no seu navegador e não altera seu progresso.
              </p>
              <ol>
                <li>Crie um favorito ou edite o favorito do capturador antigo.</li>
                <li>Clique em “Copiar capturador” e substitua todo o campo URL do favorito pelo código novo.</li>
                <li>Com login feito na plataforma do curso, abra a página principal com todos os cartões das matérias e execute o favorito uma vez.</li>
                <li>Acompanhe a leitura no painel. Você pode cancelar e salvar o resultado parcial.</li>
                <li>Será baixado <b>study-pro-curso-v3.json</b>. Se necessário, use “Baixar JSON único”. Volte aqui, analise esse arquivo e confira as pendências antes de confirmar.</li>
              </ol>
              <p>Captura nomes, módulos e links das aulas; não baixa vídeos nem PDFs internos. Em outras plataformas, captura apenas a página aberta e informa essa limitação.</p>
              <p>A importação identifica matérias pelos links originais. Mentoria, cronograma e encontros gerais ficam como complementares; itens sem identificação aguardam confirmação.</p>
              <button type="button" onClick={copiarCapturador}>Copiar capturador</button>
            </div>
            <textarea readOnly value={criarCodigoCapturadorCurso()} aria-label="Código do capturador" />
          </div>
        )}
        </details>

        {mensagem && <div className="cursos-mensagem">{mensagem}</div>}
      </section>

      {preview && (
        <section className="cursos-preview">
          <header>
            <div>
              <span>CONFIRA ANTES DE IMPORTAR</span>
              <h2>{preview.nome}</h2>
              <p>{preview.materias.filter(m => !m.categoria || m.categoria === "disciplina").length} matérias · {preview.materias.filter(m => m.categoria === "complementar").length} grupos complementares · {preview.materias.filter(m => m.categoria === "pendente").length} a confirmar · {contarAulas(preview)} entradas</p>
            </div>
            <input value={preview.nome} onChange={(e) => setPreview({ ...preview, nome: e.target.value })} aria-label="Nome do curso" />
          </header>

          {preview.relatorioCaptura && (
            <div className="cursos-mensagem" role="status">
              <p>{preview.relatorioCaptura.origensLidas}/{preview.relatorioCaptura.origensEncontradas} fonte(s) analisada(s) · {preview.relatorioCaptura.pendencias.length} pendência(s)</p>
              {preview.relatorioCaptura.cancelada && <p>Captura cancelada: este arquivo contém apenas o resultado obtido até a interrupção.</p>}
              {preview.relatorioCaptura.avisos.map((aviso, i) => <p key={i}>{aviso}</p>)}
              {preview.relatorioCaptura.pendencias.length > 0 && (
                <details open>
                  <summary>Matérias que precisam de atenção</summary>
                  <ul>{preview.relatorioCaptura.pendencias.map((pendencia, i) => <li key={i}><strong>{pendencia.nome}:</strong> {pendencia.motivo}</li>)}</ul>
                </details>
              )}
            </div>
          )}

          <div className="cursos-preview-lista">
            {!editandoId && encontrarCursoExistente(cursos, preview) && <p className="cursos-mensagem">Este curso já está salvo. A importação acrescentará somente entradas novas, sem duplicar aulas nem apagar o progresso e os conteúdos anteriores.</p>}
            <p>Somente grupos marcados como “Matéria” entram em Conteúdos. Ajuste a classificação abaixo se necessário.</p>
            {preview.materias.map((materia, indiceMateria) => (
              <article key={materia.id} className="curso-materia-card">
                <label className="curso-classificacao">Classificação
                  <select aria-label={`Classificação de ${materia.nome}`} value={materia.categoria ?? "disciplina"} onChange={e => setPreview({ ...preview, materias: preview.materias.map((m, i) => i === indiceMateria ? { ...m, categoria: e.target.value as CategoriaCursoMateria, classificacaoManual: true } : m) })}>
                    <option value="disciplina">Matéria</option>
                    <option value="complementar">Complementar (fora dos Conteúdos)</option>
                    <option value="pendente">A confirmar (fora dos Conteúdos)</option>
                  </select>
                </label>
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
            <button type="button" className="secundario" onClick={() => confirmarImportacao(false)}>Só importar</button>
            <button type="button" className="principal" onClick={() => confirmarImportacao(true)}>Importar e começar</button>
          </div>
        </section>
      )}

      <section className="cursos-salvos">
        <header>
          <div><span>BIBLIOTECA</span><h2>Seus cursos</h2></div>
          <small>Ative um ou mais cursos para usá-los em Conteúdos e como material do Plano Tático.</small>
        </header>

        {cursos.length === 0 ? (
          <div className="cursos-vazio">Nenhum curso importado ainda.</div>
        ) : (
          <div className="cursos-cards">
            {cursos.map((curso) => {
              const ativo = ativosIds.includes(curso.id);
              const cursoAtualizado =
                sincronizarProgressoCursos([curso], materias)[0] ?? curso;
              const progresso = obterProgressoCurso(cursoAtualizado);
              const proximaEtapa = obterProximaEtapaCurso(cursoAtualizado);

              return (
                <article key={curso.id} className={ativo ? "ativo" : ""}>
                  <div className="curso-card-topo">
                    <div><strong>{curso.nome}</strong><span>{curso.materias.filter(m => !m.categoria || m.categoria === "disciplina").length} matérias · {contarAulas(curso)} entradas</span></div>
                    <label className="curso-toggle"><input type="checkbox" checked={ativo} onChange={() => alternarCurso(curso.id)} /><span>{ativo ? "Ativo" : "Inativo"}</span></label>
                  </div>
                  <div className="curso-materias-chips">
                    {curso.materias.slice(0, 8).map((materia) => <span key={materia.id}>{materia.nome}{materia.categoria === "complementar" ? " · Complementar" : materia.categoria === "pendente" ? " · A confirmar" : ""}</span>)}
                    {curso.materias.length > 8 && <span>+{curso.materias.length - 8}</span>}
                  </div>

                  <div className="curso-progresso-trilha">
                    <div>
                      <span>Trilha do curso</span>
                      <strong>{progresso.concluidas}/{progresso.total} aulas · {progresso.percentual}%</strong>
                    </div>
                    <div className="curso-progresso-barra" aria-label={`Progresso de ${progresso.percentual}%`}>
                      <div style={{ width: `${progresso.percentual}%` }} />
                    </div>
                    {proximaEtapa && (
                      <small>
                        Próxima: {proximaEtapa.materia.nome} · {proximaEtapa.aula.nome}
                      </small>
                    )}
                  </div>

                  <div className="curso-card-acoes">
                    <button
                      type="button"
                      className="principal"
                      onClick={() => continuarCurso(cursoAtualizado)}
                      disabled={!proximaEtapa}
                    >
                      {progresso.percentual >= 100 ? "↻ Revisar curso" : progresso.concluidas > 0 ? "▶ Continuar curso" : "▶ Começar curso"}
                    </button>
                    <button type="button" onClick={() => { setPreview(structuredClone(curso)); setEditandoId(curso.id); }}>Revisar classificação</button>
                    <button type="button" onClick={() => exportarCurso(curso)}>Exportar JSON</button>
                    <button type="button" className="perigo" onClick={() => excluirCurso(curso.id)}>Remover</button>
                  </div>
                  {curso.materias.some(m => m.categoria && m.categoria !== "disciplina") && <details className="curso-complementares">
                    <summary>Complementares e itens a confirmar</summary>
                    <p>Guardados neste curso, sem entrar no progresso das matérias.</p>
                    {curso.materias.filter(m => m.categoria && m.categoria !== "disciplina").map(m => <section key={m.id}><h3>{m.nome}</h3>{m.modulos.map(modulo => <details key={modulo.id}><summary>{modulo.nome}</summary><ul>{modulo.aulas.map(a => <li key={a.id}>{a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer">{a.nome}</a> : a.nome}</li>)}</ul></details>)}</section>)}
                  </details>}
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

function obterAulasDaTrilha(curso: CursoImportado) {
  return curso.materias
    .filter(
      (materia) =>
        !materia.categoria ||
        materia.categoria === "disciplina"
    )
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((materia) =>
      materia.modulos
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .flatMap((modulo) =>
          modulo.aulas
            .slice()
            .sort((a, b) => a.ordem - b.ordem)
            .map((aula) => ({
              materia,
              modulo,
              aula,
            }))
        )
    );
}

function obterProgressoCurso(curso: CursoImportado) {
  const aulas = obterAulasDaTrilha(curso);
  const concluidas =
    aulas.filter(({ aula }) => aula.concluida).length;
  const total = aulas.length;

  return {
    concluidas,
    total,
    percentual:
      total > 0
        ? Math.round((concluidas / total) * 100)
        : 0,
  };
}

function obterProximaEtapaCurso(curso: CursoImportado) {
  const aulas = obterAulasDaTrilha(curso);
  return (
    aulas.find(({ aula }) => !aula.concluida) ??
    aulas[0]
  );
}

function atualizarPreviewMateria(preview: CursoImportado, setPreview: (curso: CursoImportado | null) => void, indiceMateria: number, nome: string) {
  const materias = preview.materias.map((materia, indice) => indice === indiceMateria ? { ...materia, nome, classificacaoManual: true } : materia);
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
