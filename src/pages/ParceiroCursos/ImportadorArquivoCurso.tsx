import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  importarEstruturaCurso,
  type CursoParceiro,
  type RascunhoImportacaoCurso,
} from "../../services/cursoParceiroService";
import {
  importarCursoDeArquivo,
  type RelatorioImportacaoArquivo,
} from "../../services/importacaoCursoArquivo";
import "./ImportadorArquivoCurso.css";

type Props = {
  parceiroId: string;
  cursoAtual: CursoParceiro | null;
  onImportado: (cursoId: string) => Promise<void> | void;
};

type LeituraArquivo = {
  nomeArquivo: string;
  rascunho: RascunhoImportacaoCurso;
  relatorio: RelatorioImportacaoArquivo;
};

export default function ImportadorArquivoCurso({ parceiroId, cursoAtual, onImportado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [leitura, setLeitura] = useState<LeituraArquivo | null>(null);
  const [destino, setDestino] = useState<"novo" | "atual">("novo");
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const cursoAtualAceitaImportacao = cursoAtual?.status === "rascunho";
  const totais = useMemo(() => {
    if (!leitura) return { disciplinas: 0, modulos: 0, aulas: 0 };
    const disciplinas = leitura.rascunho.disciplinas.length;
    const modulos = leitura.rascunho.disciplinas.reduce((total, disciplina) => total + disciplina.modulos.length, 0);
    const aulas = leitura.rascunho.disciplinas.reduce(
      (total, disciplina) => total + disciplina.modulos.reduce((n, modulo) => n + modulo.aulas.length, 0),
      0,
    );
    return { disciplinas, modulos, aulas };
  }, [leitura]);

  async function selecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const input = evento.currentTarget;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    try {
      setProcessando("ler");
      setErro("");
      setMensagem("");
      const resultado = await importarCursoDeArquivo(arquivo);
      setLeitura({ nomeArquivo: arquivo.name, ...resultado });
      setDestino("novo");
      setMensagem("Arquivo analisado no seu navegador. Revise o resumo antes de importar.");
    } catch (e) {
      setLeitura(null);
      setErro(e instanceof Error ? e.message : "Não foi possível analisar esse arquivo.");
    } finally {
      setProcessando("");
      input.value = "";
    }
  }

  async function aprovar() {
    if (!leitura) return;
    if (!parceiroId) {
      setErro("A parceria ainda não foi identificada.");
      return;
    }
    if (destino === "atual" && !cursoAtualAceitaImportacao) {
      setErro("Por segurança, só é possível adicionar a importação diretamente a um curso em Rascunho.");
      return;
    }

    try {
      setProcessando("aprovar");
      setErro("");
      setMensagem("");
      const cursoId = await importarEstruturaCurso({
        parceiroId,
        rascunho: leitura.rascunho,
        cursoId: destino === "atual" ? cursoAtual?.id : undefined,
        ordemDisciplinaInicial: destino === "atual" ? cursoAtual?.disciplinas.length ?? 0 : 0,
      });
      setMensagem(`Importação concluída: ${totais.disciplinas} disciplinas, ${totais.modulos} módulos e ${totais.aulas} aulas. O conteúdo ficou em Rascunho para sua revisão.`);
      setLeitura(null);
      setDestino("novo");
      await onImportado(cursoId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível importar o arquivo.");
    } finally {
      setProcessando("");
    }
  }

  function atualizarMeta(campo: "nome" | "descricao", valor: string) {
    if (!leitura) return;
    setLeitura({
      ...leitura,
      rascunho: { ...leitura.rascunho, [campo]: valor },
    });
  }

  return (
    <section className="pc-card pc-importador-arquivo">
      <div className="pc-card-cabecalho pc-importador-arquivo-cabecalho">
        <div>
          <span className="pc-importador-novo">NOVO</span>
          <h3>Importar HTML ou ZIP</h3>
          <p>Salve a página do curso e envie o arquivo. O Study Pro procura disciplinas, módulos e links sem precisar abrir F12.</p>
        </div>
        <button type="button" className="pc-botao-secundario" onClick={() => setAberto((valor) => !valor)}>
          {aberto ? "Fechar" : "Usar arquivo"}
        </button>
      </div>

      {aberto && (
        <div className="pc-importador-arquivo-corpo">
          {erro && <div className="pc-erro" role="alert">{erro}</div>}
          {mensagem && <div className="pc-estado" role="status">{mensagem}</div>}

          <div className="pc-importador-arquivo-upload">
            <div>
              <strong>Arquivo da página do curso</strong>
              <p>Aceita .html, .htm ou .zip de até 20 MB. A análise acontece no navegador; vídeos não são baixados.</p>
            </div>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept=".html,.htm,.zip,text/html,application/zip,application/x-zip-compressed"
              onChange={(e) => void selecionarArquivo(e)}
            />
            <button type="button" disabled={processando === "ler"} onClick={() => inputRef.current?.click()}>
              {processando === "ler" ? "Analisando..." : "Selecionar HTML/ZIP"}
            </button>
          </div>

          <div className="pc-importador-arquivo-ajuda">
            <b>Como salvar:</b> abra a grade do curso já logado e use “Salvar página” / “Salvar como HTML”. Se tiver vários HTMLs, compacte em ZIP e envie aqui.
          </div>

          {leitura && (
            <div className="pc-importador-arquivo-revisao">
              <div className="pc-importador-arquivo-topo">
                <div>
                  <small>{leitura.nomeArquivo}</small>
                  <strong>{totais.disciplinas} disciplinas · {totais.modulos} módulos · {totais.aulas} aulas</strong>
                </div>
                <div className="pc-importador-arquivo-metricas">
                  <span>{leitura.relatorio.arquivosHtml} HTML</span>
                  <span>{leitura.relatorio.duplicadasIgnoradas} duplicados removidos</span>
                  <span>{leitura.relatorio.linksInvalidosIgnorados} links ignorados</span>
                </div>
              </div>

              {leitura.relatorio.avisos.length > 0 && (
                <div className="pc-importador-arquivo-avisos">
                  {leitura.relatorio.avisos.map((aviso) => <p key={aviso}>{aviso}</p>)}
                </div>
              )}

              <div className="pc-importador-arquivo-meta">
                <label>
                  Nome do curso
                  <input value={leitura.rascunho.nome} onChange={(e) => atualizarMeta("nome", e.target.value)} />
                </label>
                <label>
                  Descrição
                  <input value={leitura.rascunho.descricao || ""} onChange={(e) => atualizarMeta("descricao", e.target.value)} />
                </label>
              </div>

              <div className="pc-importador-arquivo-destino">
                <label>
                  <input type="radio" checked={destino === "novo"} onChange={() => setDestino("novo")} />
                  Criar novo curso em Rascunho
                </label>
                <label className={!cursoAtualAceitaImportacao ? "inativo" : ""}>
                  <input
                    type="radio"
                    checked={destino === "atual"}
                    disabled={!cursoAtualAceitaImportacao}
                    onChange={() => setDestino("atual")}
                  />
                  Adicionar ao curso atual{cursoAtual ? ` (${cursoAtual.nome})` : ""}
                </label>
                {cursoAtual && !cursoAtualAceitaImportacao && (
                  <small>O curso atual está {cursoAtual.status}. Para proteger os alunos, importe em um novo rascunho ou duplique o curso publicado.</small>
                )}
              </div>

              <div className="pc-importador-arquivo-arvore">
                {leitura.rascunho.disciplinas.map((disciplina, indiceDisciplina) => (
                  <details key={`${indiceDisciplina}-${disciplina.titulo}`}>
                    <summary>
                      <strong>{disciplina.titulo}</strong>
                      <span>{disciplina.modulos.length} módulos</span>
                    </summary>
                    <div>
                      {disciplina.modulos.map((modulo, indiceModulo) => (
                        <div className="pc-importador-arquivo-modulo" key={`${indiceModulo}-${modulo.titulo}`}>
                          <b>{modulo.titulo}</b>
                          <span>{modulo.aulas.length} aulas</span>
                          <ul>
                            {modulo.aulas.slice(0, 8).map((aula, indiceAula) => (
                              <li key={`${indiceAula}-${aula.url}`}>{aula.titulo}</li>
                            ))}
                          </ul>
                          {modulo.aulas.length > 8 && <small>+ {modulo.aulas.length - 8} aulas</small>}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>

              <div className="pc-importador-arquivo-acoes">
                <button type="button" className="pc-botao-secundario" onClick={() => setLeitura(null)}>Descartar</button>
                <button type="button" disabled={processando === "aprovar" || !leitura.rascunho.nome.trim()} onClick={() => void aprovar()}>
                  {processando === "aprovar" ? "Importando..." : "Aprovar e importar"}
                </button>
              </div>

              <p className="pc-importador-arquivo-nota">Se precisar corrigir links ou reorganizar item por item antes da importação, use o importador avançado logo abaixo.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
