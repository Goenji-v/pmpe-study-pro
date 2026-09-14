import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "../../lib/supabase";
import {
  importarEstruturaCurso,
  type AulaImportacaoCurso,
  type CursoParceiro,
  type DisciplinaImportacaoCurso,
  type ModuloImportacaoCurso,
  type RascunhoImportacaoCurso,
} from "../../services/cursoParceiroService";

type Props = {
  parceiroId: string;
  cursoAtual: CursoParceiro | null;
  onImportado: (cursoId: string) => Promise<void> | void;
};

const CURSO_VAZIO: RascunhoImportacaoCurso = {
  nome: "Curso importado",
  descricao: "",
  disciplinas: [],
};

export default function CursoImportador({ parceiroId, cursoAtual, onImportado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [urlPublica, setUrlPublica] = useState("");
  const [captura, setCaptura] = useState("");
  const [rascunho, setRascunho] = useState<RascunhoImportacaoCurso | null>(null);
  const [destino, setDestino] = useState<"novo" | "atual">("novo");
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const arquivoInputRef = useRef<HTMLInputElement>(null);

  const totais = useMemo(() => {
    if (!rascunho) return { disciplinas: 0, modulos: 0, aulas: 0 };
    const modulos = rascunho.disciplinas.reduce((n, d) => n + d.modulos.length, 0);
    const aulas = rascunho.disciplinas.reduce(
      (n, d) => n + d.modulos.reduce((m, modulo) => m + modulo.aulas.length, 0),
      0,
    );
    return { disciplinas: rascunho.disciplinas.length, modulos, aulas };
  }, [rascunho]);

  async function lerPaginaPublica() {
    const url = urlPublica.trim();
    if (!/^https:\/\//i.test(url)) {
      setErro("Informe um link HTTPS público do curso.");
      return;
    }
    try {
      setProcessando("url");
      setErro("");
      setMensagem("");
      const { data, error } = await supabase.functions.invoke("importar-curso-publico", {
        body: { url },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const convertido = normalizarRascunho(data?.rascunho ?? data);
      setRascunho(convertido);
      setMensagem("Estrutura encontrada. Revise tudo antes de aprovar.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler essa página.");
    } finally {
      setProcessando("");
    }
  }

  async function carregarArquivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const input = evento.currentTarget;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    try {
      setProcessando("arquivo");
      setErro("");
      setMensagem("");

      if (arquivo.size > 5 * 1024 * 1024) {
        throw new Error("O arquivo JSON é muito grande. O limite para importação é 5 MB.");
      }

      const conteudo = await arquivo.text();
      const convertido = normalizarRascunho(JSON.parse(conteudo));
      setRascunho(convertido);
      setCaptura("");
      setMensagem(`Arquivo “${arquivo.name}” carregado por completo. Revise a estrutura e aprove a importação.`);
    } catch (e) {
      setErro(
        e instanceof SyntaxError
          ? "Esse arquivo JSON está incompleto ou inválido. Baixe novamente o arquivo original e tente selecionar o arquivo inteiro."
          : e instanceof Error
            ? e.message
            : "Não foi possível ler o arquivo JSON.",
      );
    } finally {
      setProcessando("");
      input.value = "";
    }
  }

  function processarCaptura() {
    try {
      setErro("");
      setMensagem("");
      const convertido = normalizarRascunho(JSON.parse(captura));
      setRascunho(convertido);
      setMensagem("Captura carregada. Ajuste a estrutura e aprove quando estiver pronta.");
    } catch (e) {
      setErro(
        e instanceof SyntaxError
          ? "O JSON colado está incompleto ou inválido. No celular, prefira Selecionar arquivo JSON para evitar cortes no texto."
          : e instanceof Error
            ? e.message
            : "A captura não está em um formato válido.",
      );
    }
  }

  async function copiarScript() {
    try {
      await navigator.clipboard.writeText(SCRIPT_CAPTURA_CURSO);
      setMensagem("Script copiado. Abra o curso logado, pressione F12, cole no Console e execute. Depois cole aqui o JSON copiado.");
      setErro("");
    } catch {
      setErro("O navegador não permitiu copiar automaticamente. Tente novamente pelo botão de copiar.");
    }
  }

  async function aprovarImportacao() {
    if (!rascunho) return;
    if (!parceiroId) {
      setErro("A parceria ainda não foi identificada.");
      return;
    }
    if (destino === "atual" && !cursoAtual) {
      setErro("Selecione um curso existente antes de adicionar o conteúdo.");
      return;
    }
    try {
      setProcessando("aprovar");
      setErro("");
      setMensagem("");
      const cursoId = await importarEstruturaCurso({
        parceiroId,
        rascunho,
        cursoId: destino === "atual" ? cursoAtual?.id : undefined,
        ordemDisciplinaInicial: destino === "atual" ? cursoAtual?.disciplinas.length ?? 0 : 0,
      });
      setMensagem(`Importação concluída: ${totais.disciplinas} disciplinas, ${totais.modulos} módulos e ${totais.aulas} aulas.`);
      setRascunho(null);
      setCaptura("");
      setUrlPublica("");
      await onImportado(cursoId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aprovar a importação.");
    } finally {
      setProcessando("");
    }
  }

  function atualizarDisciplina(indice: number, valor: DisciplinaImportacaoCurso) {
    if (!rascunho) return;
    const disciplinas = [...rascunho.disciplinas];
    disciplinas[indice] = valor;
    setRascunho({ ...rascunho, disciplinas });
  }

  function removerDisciplina(indice: number) {
    if (!rascunho) return;
    setRascunho({ ...rascunho, disciplinas: rascunho.disciplinas.filter((_, i) => i !== indice) });
  }

  function adicionarDisciplina() {
    const base = rascunho ?? CURSO_VAZIO;
    setRascunho({
      ...base,
      disciplinas: [...base.disciplinas, { titulo: "Nova disciplina", descricao: "", modulos: [] }],
    });
  }

  function moverDisciplina(indice: number, direcao: -1 | 1) {
    if (!rascunho) return;
    const proximo = indice + direcao;
    if (proximo < 0 || proximo >= rascunho.disciplinas.length) return;
    const disciplinas = [...rascunho.disciplinas];
    [disciplinas[indice], disciplinas[proximo]] = [disciplinas[proximo], disciplinas[indice]];
    setRascunho({ ...rascunho, disciplinas });
  }

  return (
    <section className="pc-card pc-importador">
      <div className="pc-card-cabecalho pc-importador-cabecalho">
        <div>
          <h3>Importar curso</h3>
          <p>Traga a estrutura pronta, revise nomes, ordem e links e só depois publique no Study Pro.</p>
        </div>
        <button type="button" className="pc-botao-secundario" onClick={() => setAberto((valor) => !valor)}>
          {aberto ? "Fechar importador" : "Importar curso"}
        </button>
      </div>

      {aberto && (
        <div className="pc-importador-corpo">
          {erro && <div className="pc-erro" role="alert">{erro}</div>}
          {mensagem && <div className="pc-estado" role="status">{mensagem}</div>}

          <div className="pc-importador-fontes">
            <article>
              <strong>1. Link público</strong>
              <p>Se a grade do curso abre sem login, cole o endereço e o Study Pro tenta separar títulos e links.</p>
              <div className="pc-importador-linha">
                <input
                  value={urlPublica}
                  onChange={(e) => setUrlPublica(e.target.value)}
                  placeholder="https://site-do-curso.com/portugues"
                  type="url"
                />
                <button type="button" disabled={processando === "url"} onClick={() => void lerPaginaPublica()}>
                  {processando === "url" ? "Lendo..." : "Ler página"}
                </button>
              </div>
            </article>

            <article>
              <strong>2. Arquivo JSON</strong>
              <p>No celular, selecione o arquivo .json completo. O Study Pro lê o arquivo direto, sem depender de copiar e colar textos grandes.</p>
              <input
                ref={arquivoInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => void carregarArquivoJson(e)}
              />
              <div className="pc-importador-acoes">
                <button
                  type="button"
                  className="pc-botao-secundario"
                  disabled={processando === "arquivo"}
                  onClick={() => arquivoInputRef.current?.click()}
                >
                  {processando === "arquivo" ? "Lendo arquivo..." : "Selecionar arquivo JSON"}
                </button>
              </div>
            </article>

            <article>
              <strong>3. Curso com login</strong>
              <p>Entre normalmente na plataforma do parceiro e use o script de captura. Ele copia apenas a estrutura visível e os links, não baixa vídeos.</p>
              <div className="pc-importador-acoes">
                <button type="button" className="pc-botao-secundario" onClick={() => void copiarScript()}>Copiar script de captura</button>
                <button type="button" className="pc-botao-secundario" disabled={!captura.trim()} onClick={processarCaptura}>Carregar captura</button>
              </div>
              <textarea
                className="pc-importador-captura"
                value={captura}
                onChange={(e) => setCaptura(e.target.value)}
                placeholder="Cole aqui o JSON que o script copiou..."
              />
            </article>
          </div>

          {rascunho && (
            <div className="pc-importador-revisao">
              <div className="pc-importador-resumo">
                <div>
                  <span>Rascunho para revisão</span>
                  <strong>{totais.disciplinas} disciplinas · {totais.modulos} módulos · {totais.aulas} aulas</strong>
                </div>
                <div className="pc-importador-destino">
                  <label>
                    <input type="radio" name="destino-importacao" checked={destino === "novo"} onChange={() => setDestino("novo")} />
                    Criar novo curso
                  </label>
                  <label className={!cursoAtual ? "inativo" : ""}>
                    <input type="radio" name="destino-importacao" checked={destino === "atual"} disabled={!cursoAtual} onChange={() => setDestino("atual")} />
                    Adicionar ao curso atual{cursoAtual ? ` (${cursoAtual.nome})` : ""}
                  </label>
                </div>
              </div>

              <div className="pc-importador-meta">
                <input
                  value={rascunho.nome}
                  onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                  placeholder="Nome do curso"
                />
                <input
                  value={rascunho.descricao || ""}
                  onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                  placeholder="Descrição do curso (opcional)"
                />
              </div>

              <div className="pc-importador-arvore">
                {rascunho.disciplinas.map((disciplina, indiceDisciplina) => (
                  <DisciplinaEditor
                    key={`${indiceDisciplina}-${disciplina.titulo}`}
                    disciplina={disciplina}
                    indice={indiceDisciplina}
                    total={rascunho.disciplinas.length}
                    onChange={(valor) => atualizarDisciplina(indiceDisciplina, valor)}
                    onRemove={() => removerDisciplina(indiceDisciplina)}
                    onMove={(direcao) => moverDisciplina(indiceDisciplina, direcao)}
                  />
                ))}
              </div>

              <div className="pc-importador-rodape">
                <button type="button" className="pc-botao-secundario" onClick={adicionarDisciplina}>+ Disciplina</button>
                <button type="button" className="pc-botao-secundario" onClick={() => setRascunho(null)}>Descartar rascunho</button>
                <button type="button" disabled={processando === "aprovar" || totais.disciplinas === 0} onClick={() => void aprovarImportacao()}>
                  {processando === "aprovar" ? "Importando..." : "Aprovar e importar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DisciplinaEditor({
  disciplina,
  indice,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  disciplina: DisciplinaImportacaoCurso;
  indice: number;
  total: number;
  onChange: (valor: DisciplinaImportacaoCurso) => void;
  onRemove: () => void;
  onMove: (direcao: -1 | 1) => void;
}) {
  function atualizarModulo(indiceModulo: number, valor: ModuloImportacaoCurso) {
    const modulos = [...disciplina.modulos];
    modulos[indiceModulo] = valor;
    onChange({ ...disciplina, modulos });
  }
  function adicionarModulo() {
    onChange({ ...disciplina, modulos: [...disciplina.modulos, { titulo: "Novo módulo", descricao: "", aulas: [] }] });
  }
  function removerModulo(indiceModulo: number) {
    onChange({ ...disciplina, modulos: disciplina.modulos.filter((_, i) => i !== indiceModulo) });
  }
  function moverModulo(indiceModulo: number, direcao: -1 | 1) {
    const proximo = indiceModulo + direcao;
    if (proximo < 0 || proximo >= disciplina.modulos.length) return;
    const modulos = [...disciplina.modulos];
    [modulos[indiceModulo], modulos[proximo]] = [modulos[proximo], modulos[indiceModulo]];
    onChange({ ...disciplina, modulos });
  }

  return (
    <article className="pc-importador-disciplina">
      <header>
        <span>DISCIPLINA {indice + 1}</span>
        <div className="pc-importador-mini-acoes">
          <button type="button" disabled={indice === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" disabled={indice === total - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="perigo" onClick={onRemove}>Excluir</button>
        </div>
      </header>
      <div className="pc-importador-meta">
        <input value={disciplina.titulo} onChange={(e) => onChange({ ...disciplina, titulo: e.target.value })} placeholder="Nome da disciplina" />
        <input value={disciplina.descricao || ""} onChange={(e) => onChange({ ...disciplina, descricao: e.target.value })} placeholder="Descrição (opcional)" />
      </div>
      <div className="pc-importador-modulos">
        {disciplina.modulos.map((modulo, indiceModulo) => (
          <ModuloEditor
            key={`${indiceModulo}-${modulo.titulo}`}
            modulo={modulo}
            indice={indiceModulo}
            total={disciplina.modulos.length}
            onChange={(valor) => atualizarModulo(indiceModulo, valor)}
            onRemove={() => removerModulo(indiceModulo)}
            onMove={(direcao) => moverModulo(indiceModulo, direcao)}
          />
        ))}
      </div>
      <button type="button" className="pc-botao-secundario" onClick={adicionarModulo}>+ Módulo</button>
    </article>
  );
}

function ModuloEditor({
  modulo,
  indice,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  modulo: ModuloImportacaoCurso;
  indice: number;
  total: number;
  onChange: (valor: ModuloImportacaoCurso) => void;
  onRemove: () => void;
  onMove: (direcao: -1 | 1) => void;
}) {
  function atualizarAula(indiceAula: number, valor: AulaImportacaoCurso) {
    const aulas = [...modulo.aulas];
    aulas[indiceAula] = valor;
    onChange({ ...modulo, aulas });
  }
  function adicionarAula() {
    onChange({
      ...modulo,
      aulas: [...modulo.aulas, { titulo: "Nova aula", tipo: "video", url: "https://", descricao: "", duracaoMinutos: null }],
    });
  }
  function removerAula(indiceAula: number) {
    onChange({ ...modulo, aulas: modulo.aulas.filter((_, i) => i !== indiceAula) });
  }
  function moverAula(indiceAula: number, direcao: -1 | 1) {
    const proximo = indiceAula + direcao;
    if (proximo < 0 || proximo >= modulo.aulas.length) return;
    const aulas = [...modulo.aulas];
    [aulas[indiceAula], aulas[proximo]] = [aulas[proximo], aulas[indiceAula]];
    onChange({ ...modulo, aulas });
  }

  return (
    <section className="pc-importador-modulo">
      <header>
        <strong>Módulo {indice + 1}</strong>
        <div className="pc-importador-mini-acoes">
          <button type="button" disabled={indice === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" disabled={indice === total - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="perigo" onClick={onRemove}>Excluir</button>
        </div>
      </header>
      <div className="pc-importador-meta">
        <input value={modulo.titulo} onChange={(e) => onChange({ ...modulo, titulo: e.target.value })} placeholder="Nome do módulo" />
        <input value={modulo.descricao || ""} onChange={(e) => onChange({ ...modulo, descricao: e.target.value })} placeholder="Descrição (opcional)" />
      </div>
      <div className="pc-importador-aulas">
        {modulo.aulas.map((aula, indiceAula) => (
          <AulaEditor
            key={`${indiceAula}-${aula.url}`}
            aula={aula}
            indice={indiceAula}
            total={modulo.aulas.length}
            onChange={(valor) => atualizarAula(indiceAula, valor)}
            onRemove={() => removerAula(indiceAula)}
            onMove={(direcao) => moverAula(indiceAula, direcao)}
          />
        ))}
      </div>
      <button type="button" className="pc-botao-secundario" onClick={adicionarAula}>+ Aula</button>
    </section>
  );
}

function AulaEditor({
  aula,
  indice,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  aula: AulaImportacaoCurso;
  indice: number;
  total: number;
  onChange: (valor: AulaImportacaoCurso) => void;
  onRemove: () => void;
  onMove: (direcao: -1 | 1) => void;
}) {
  return (
    <div className="pc-importador-aula">
      <span>{indice + 1}</span>
      <input value={aula.titulo} onChange={(e) => onChange({ ...aula, titulo: e.target.value })} placeholder="Título da aula" />
      <select value={aula.tipo || "video"} onChange={(e) => onChange({ ...aula, tipo: e.target.value as AulaImportacaoCurso["tipo"] })}>
        <option value="video">Videoaula</option>
        <option value="material">Material</option>
        <option value="link">Link</option>
        <option value="texto">Texto</option>
      </select>
      <input value={aula.url} onChange={(e) => onChange({ ...aula, url: e.target.value })} placeholder="https://..." />
      <input
        type="number"
        min="1"
        max="1440"
        value={aula.duracaoMinutos ?? ""}
        onChange={(e) => onChange({ ...aula, duracaoMinutos: e.target.value ? Number(e.target.value) : null })}
        placeholder="Min"
      />
      <div className="pc-importador-mini-acoes">
        <button type="button" disabled={indice === 0} onClick={() => onMove(-1)}>↑</button>
        <button type="button" disabled={indice === total - 1} onClick={() => onMove(1)}>↓</button>
        <button type="button" className="perigo" onClick={onRemove}>Excluir</button>
      </div>
    </div>
  );
}

function normalizarRascunho(valor: unknown): RascunhoImportacaoCurso {
  const objeto = registro(valor);
  const disciplinasBrutas = arrayRegistros(objeto.disciplinas);
  const disciplinas = disciplinasBrutas.map((disciplina, indiceDisciplina) => ({
    titulo: texto(disciplina.titulo) || `Disciplina ${indiceDisciplina + 1}`,
    descricao: texto(disciplina.descricao),
    modulos: arrayRegistros(disciplina.modulos).map((modulo, indiceModulo) => ({
      titulo: texto(modulo.titulo) || `Módulo ${indiceModulo + 1}`,
      descricao: texto(modulo.descricao),
      aulas: arrayRegistros(modulo.aulas).map((aula, indiceAula) => ({
        titulo: texto(aula.titulo) || `Aula ${indiceAula + 1}`,
        descricao: texto(aula.descricao),
        tipo: normalizarTipo(texto(aula.tipo)),
        url: texto(aula.url),
        duracaoMinutos: numeroOpcional(aula.duracaoMinutos ?? aula.duracao_minutos),
      })),
    })),
  }));
  if (!disciplinas.length) throw new Error("Nenhuma disciplina foi encontrada. Use a captura logada ou ajuste a página de origem.");
  return {
    nome: texto(objeto.nome) || "Curso importado",
    descricao: texto(objeto.descricao),
    disciplinas,
  };
}

function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
function arrayRegistros(valor: unknown) {
  return Array.isArray(valor) ? valor.map(registro).filter((item) => Object.keys(item).length > 0) : [];
}
function texto(valor: unknown) { return typeof valor === "string" ? valor.trim() : ""; }
function numeroOpcional(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 1 ? Math.min(1440, Math.floor(n)) : null;
}
function normalizarTipo(valor: string): AulaImportacaoCurso["tipo"] {
  return valor === "material" || valor === "link" || valor === "texto" ? valor : "video";
}

const SCRIPT_CAPTURA_CURSO = `(() => {
  const limpar = (texto) => (texto || '').replace(/\\s+/g, ' ').trim();
  const ignorar = /^(início|inicio|home|perfil|conta|sair|logout|suporte|ajuda|configurações|configuracoes|voltar|próximo|proximo|anterior)$/i;
  const raiz = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
  const resultado = { nome: limpar(document.querySelector('h1')?.textContent) || limpar(document.title) || 'Curso importado', descricao: '', disciplinas: [] };
  let disciplina = null;
  let modulo = null;
  const links = new Set();
  const novaDisciplina = (titulo) => {
    disciplina = { titulo: limpar(titulo) || ('Disciplina ' + (resultado.disciplinas.length + 1)), descricao: '', modulos: [] };
    resultado.disciplinas.push(disciplina);
    modulo = null;
  };
  const novoModulo = (titulo) => {
    if (!disciplina) novaDisciplina('Conteúdo importado');
    modulo = { titulo: limpar(titulo) || ('Módulo ' + (disciplina.modulos.length + 1)), descricao: '', aulas: [] };
    disciplina.modulos.push(modulo);
  };
  const adicionarAula = (titulo, url) => {
    const nome = limpar(titulo);
    if (!nome || nome.length < 2 || ignorar.test(nome) || links.has(url)) return;
    if (!/^https:\\/\\//i.test(url)) return;
    if (!disciplina) novaDisciplina('Conteúdo importado');
    if (!modulo) novoModulo('Módulo 1');
    links.add(url);
    modulo.aulas.push({ titulo: nome.slice(0, 200), descricao: '', tipo: 'video', url, duracaoMinutos: null });
  };
  const elementos = [...raiz.querySelectorAll('h2,h3,h4,a[href]')];
  for (const el of elementos) {
    if (el.matches('h2')) novaDisciplina(el.textContent);
    else if (el.matches('h3,h4')) novoModulo(el.textContent);
    else if (el.matches('a[href]')) {
      try { adicionarAula(el.textContent || el.getAttribute('aria-label') || el.title, new URL(el.href, location.href).href); } catch {}
    }
    if (links.size >= 500) break;
  }
  resultado.disciplinas = resultado.disciplinas
    .map((d) => ({ ...d, modulos: d.modulos.filter((m) => m.aulas.length) }))
    .filter((d) => d.modulos.length);
  const json = JSON.stringify(resultado, null, 2);
  navigator.clipboard.writeText(json).then(() => console.log('Study Pro: estrutura copiada com', links.size, 'links. Cole no importador.'));
  return resultado;
})()`;
