import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Eraser,
  FileText,
  FolderPlus,
  MessageCircle,
  Minus,
  Moon,
  NotebookPen,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import "./CentralQuestoes.css";

type StatusFiltro = "todas" | "nao-resolvidas" | "acertei" | "errei";
type PainelQuestao = "gabarito" | "comentarios" | "estatisticas" | null;

type Opcao = {
  letra: string;
  texto: string;
};

const opcoes: Opcao[] = [
  {
    letra: "A",
    texto: "A tecnologia substitui o papel do professor no processo educacional.",
  },
  {
    letra: "B",
    texto: "O uso da tecnologia na educação apresenta apenas aspectos positivos.",
  },
  {
    letra: "C",
    texto: "A tecnologia deve ser evitada no ambiente escolar.",
  },
  {
    letra: "D",
    texto: "A tecnologia pode contribuir para a educação, desde que utilizada de forma consciente e crítica.",
  },
  {
    letra: "E",
    texto: "O uso da tecnologia na educação depende exclusivamente da infraestrutura das escolas.",
  },
];

const exclusoesIniciais = [
  "Meus cadernos",
  "Meus simulados",
  "Inéditas",
  "Anuladas",
  "Desatualizadas",
];

const recursosIniciais = [
  "Gabarito comentado",
  "Comentários",
  "Meus comentários",
  "Aulas",
  "Minhas anotações",
];

const distribuicao = [
  { letra: "A", quantidade: 74, percentual: 8 },
  { letra: "B", quantidade: 109, percentual: 12 },
  { letra: "C", quantidade: 136, percentual: 15 },
  { letra: "D", quantidade: 563, percentual: 62 },
  { letra: "E", quantidade: 27, percentual: 3 },
];

export default function CentralQuestoes() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [exclusoes, setExclusoes] = useState<string[]>(exclusoesIniciais);
  const [recursos, setRecursos] = useState<string[]>(recursosIniciais);
  const [palavraChave, setPalavraChave] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [assunto, setAssunto] = useState("");
  const [banca, setBanca] = useState("");
  const [nivel, setNivel] = useState("");
  const [porPagina, setPorPagina] = useState("10");
  const [ordenacao, setOrdenacao] = useState("Prova mais recente");
  const [fonte, setFonte] = useState(15);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [eliminadas, setEliminadas] = useState<string[]>([]);
  const [respondida, setRespondida] = useState(false);
  const [painel, setPainel] = useState<PainelQuestao>(null);
  const [modalAnotacao, setModalAnotacao] = useState(false);
  const [modalCaderno, setModalCaderno] = useState(false);
  const [anotacao, setAnotacao] = useState("");
  const [anotacaoSalva, setAnotacaoSalva] = useState(false);
  const [nomeCaderno, setNomeCaderno] = useState("");
  const [tipoCaderno, setTipoCaderno] = useState("Revisão");
  const [resultadoFiltrado, setResultadoFiltrado] = useState(false);
  const [toast, setToast] = useState("");
  const [erroNotificado, setErroNotificado] = useState(false);

  const acertou = respondida && selecionada === "D";
  const totalEncontrado = resultadoFiltrado ? 1287 : 2438;

  const chips = useMemo(() => {
    const lista = [...exclusoes];
    if (disciplina) lista.push(disciplina);
    if (assunto) lista.push(assunto);
    if (banca) lista.push(banca);
    if (nivel) lista.push(nivel);
    if (palavraChave.trim()) lista.push(`“${palavraChave.trim()}”`);
    return lista;
  }, [assunto, banca, disciplina, exclusoes, nivel, palavraChave]);

  function alternarLista(valor: string, lista: string[], setter: (valor: string[]) => void) {
    setter(lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor]);
  }

  function removerChip(chip: string) {
    if (exclusoes.includes(chip)) {
      setExclusoes(exclusoes.filter((item) => item !== chip));
      return;
    }
    if (chip === disciplina) setDisciplina("");
    if (chip === assunto) setAssunto("");
    if (chip === banca) setBanca("");
    if (chip === nivel) setNivel("");
    if (chip.startsWith("“")) setPalavraChave("");
  }

  function limparFiltros() {
    setStatus("todas");
    setExclusoes([]);
    setRecursos([]);
    setPalavraChave("");
    setDisciplina("");
    setAssunto("");
    setBanca("");
    setNivel("");
    setResultadoFiltrado(false);
    mostrarToast("Filtros limpos");
  }

  function mostrarToast(mensagem: string) {
    setToast(mensagem);
    window.setTimeout(() => setToast(""), 2200);
  }

  function responder() {
    if (!selecionada) {
      mostrarToast("Escolha uma alternativa antes de responder.");
      return;
    }
    setRespondida(true);
    setPainel(null);
  }

  function novaTentativa() {
    setSelecionada(null);
    setEliminadas([]);
    setRespondida(false);
    setPainel(null);
  }

  return (
    <section className="mqp" style={{ fontSize: `${fonte}px` }}>
      {toast && <div className="mqp-toast">{toast}</div>}
      {acertou && <Confete />}

      <div className="mqp-breadcrumb">
        <span>Questões</span><b>›</b><span>Concurso</span><b>›</b><strong>Prova Objetiva</strong>
      </div>

      <header className="mqp-hero">
        <div>
          <div className="mqp-kicker"><Sparkles size={14} /> EXPERIÊNCIA PREMIUM</div>
          <h1>Minhas questões</h1>
          <p>Resolva, revise e evolua com questões de concursos públicos.</p>
        </div>

        <div className="mqp-hero-stats">
          <div className="mqp-mini-stat">
            <Target size={22} />
            <div><strong>{totalEncontrado.toLocaleString("pt-BR")}</strong><span>questões encontradas</span></div>
          </div>
          <div className="mqp-mini-stat mqp-mini-stat-success">
            <BarChart3 size={22} />
            <div><strong>73%</strong><span>de aproveitamento</span></div>
          </div>
        </div>
      </header>

      <nav className="mqp-status-tabs" aria-label="Status das questões">
        {[
          ["todas", "Todas"],
          ["nao-resolvidas", "Não resolvidas"],
          ["acertei", "Acertei"],
          ["errei", "Errei"],
        ].map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            className={status === valor ? "ativo" : ""}
            onClick={() => setStatus(valor as StatusFiltro)}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      <section className="mqp-filter-card">
        <div className="mqp-filter-grid">
          <label className="mqp-field mqp-field-search">
            <span>Palavras-chave</span>
            <div><Search size={17} /><input value={palavraChave} onChange={(e) => setPalavraChave(e.target.value)} placeholder="Ex.: texto, STF, lei..." /></div>
          </label>

          <CampoSelect label="Disciplina" valor={disciplina} setValor={setDisciplina} opcoes={["Português", "Matemática", "Direito Constitucional", "Direito Penal", "Informática"]} />
          <CampoSelect label="Assunto" valor={assunto} setValor={setAssunto} opcoes={["Interpretação de texto", "Coesão e coerência", "Crase", "Concordância", "Lógica proposicional"]} />
          <CampoSelect label="Banca" valor={banca} setValor={setBanca} opcoes={["FGV", "CESPE / Cebraspe", "FCC", "IBFC", "AOCP"]} />
          <CampoSelect label="Nível" valor={nivel} setValor={setNivel} opcoes={["Fundamental", "Médio", "Difícil"]} />
        </div>

        <div className="mqp-check-columns">
          <GrupoChecks titulo="Excluir questões" itens={exclusoesIniciais} selecionados={exclusoes} onToggle={(item) => alternarLista(item, exclusoes, setExclusoes)} />
          <GrupoChecks titulo="Questões com" itens={recursosIniciais} selecionados={recursos} onToggle={(item) => alternarLista(item, recursos, setRecursos)} />
        </div>

        <div className="mqp-chips-row">
          <strong>Filtros aplicados:</strong>
          <div className="mqp-chips">
            {chips.length === 0 && <span className="mqp-sem-filtro">Nenhum filtro aplicado</span>}
            {chips.map((chip) => (
              <button key={chip} type="button" onClick={() => removerChip(chip)}>{chip}<X size={13} /></button>
            ))}
          </div>
          <button type="button" className="mqp-link" onClick={limparFiltros}>Limpar todos</button>
        </div>

        <div className="mqp-filter-actions">
          <div>
            <button type="button" className="mqp-btn-outline" onClick={() => setModalCaderno(true)}><BookOpen size={17} /> Gerar caderno</button>
            <button type="button" className="mqp-btn-outline" onClick={() => mostrarToast("Filtro salvo na prévia Premium.")}><Bookmark size={17} /> Salvar filtro</button>
            <button type="button" className="mqp-btn-outline" onClick={limparFiltros}><Eraser size={17} /> Limpar</button>
          </div>
          <button type="button" className="mqp-btn-primary" onClick={() => { setResultadoFiltrado(true); mostrarToast("Filtro aplicado com sucesso."); }}><Search size={18} /> Filtrar</button>
        </div>
      </section>

      <section className="mqp-result-tools">
        <div className="mqp-result-title"><strong>{totalEncontrado.toLocaleString("pt-BR")}</strong> questões encontradas</div>

        <div className="mqp-toolbar">
          <button type="button" onClick={() => navigate("/simulados")}><FileText size={16} /> Gerar simulado</button>
          <button type="button" onClick={() => mostrarToast("Seus filtros salvos aparecerão aqui.")}><SlidersHorizontal size={16} /> Meus filtros</button>
          <button type="button" onClick={() => navigate("/desempenho")}><BarChart3 size={16} /> Desempenho</button>
          <button type="button" onClick={() => mostrarToast("A prévia Premium já está no modo escuro.")}><Moon size={16} /> Modo escuro</button>
          <button type="button" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
          <button type="button" onClick={() => navigate("/configuracoes")}><Settings size={16} /> Configurações</button>
          <button type="button" aria-label="Diminuir fonte" onClick={() => setFonte((atual) => Math.max(13, atual - 1))}><Minus size={16} /></button>
          <button type="button" aria-label="Aumentar fonte" onClick={() => setFonte((atual) => Math.min(18, atual + 1))}><Plus size={16} /></button>
        </div>

        <div className="mqp-sort-row">
          <label>Questões por página:
            <span className="mqp-select-wrap"><select value={porPagina} onChange={(e) => setPorPagina(e.target.value)}><option>5</option><option>10</option><option>15</option><option>20</option></select><ChevronDown size={15} /></span>
          </label>
          <label className="mqp-sort-main">Ordenar por:
            <span className="mqp-select-wrap"><select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}><option>Prova mais recente</option><option>Prova mais antiga</option><option>Adicionadas recentemente</option><option>Mais difíceis</option><option>Relevância das palavras-chave</option><option>Gabarito comentado</option></select><ChevronDown size={15} /></span>
          </label>
          <button type="button" className="mqp-date-button"><CalendarDays size={16} /> Data da prova <ChevronDown size={14} /></button>
        </div>
      </section>

      <article className={`mqp-question-card ${respondida ? "respondida" : ""}`}>
        <header className="mqp-question-head">
          <div>
            <div className="mqp-question-code"><strong>QUESTÃO 1</strong><span>#SP-002854</span></div>
            <div className="mqp-question-meta">
              <span className="mqp-subject">Português</span>
              <span>Interpretação de texto</span><b>›</b><span>Coesão e coerência</span><b>›</b><span>Noções gerais de compreensão e interpretação de texto</span>
            </div>
          </div>
          <div className="mqp-question-side">
            <span className={`mqp-status-pill ${respondida ? (acertou ? "certa" : "errada") : ""}`}>
              {respondida ? (acertou ? <><CheckCircle2 size={14} /> Resolvida certa</> : <><X size={14} /> Resolvida errada</>) : "Não resolvida"}
            </span>
            <span>2025 · FGV</span>
          </div>
        </header>

        <div className="mqp-associated-text">
          <strong>Texto associado</strong>
          <p>
            A tecnologia, quando bem utilizada, pode ser uma grande aliada na educação. Ferramentas digitais permitem o acesso a conteúdos variados, facilitam a comunicação entre alunos e professores e tornam o aprendizado mais dinâmico. No entanto, é fundamental que seu uso seja acompanhado de uma postura crítica e consciente, para que os benefícios não sejam ofuscados por possíveis distrações e excessos.
          </p>
        </div>

        <p className="mqp-enunciado">Com base no texto, assinale a alternativa que melhor expressa a ideia principal do autor.</p>

        <div className="mqp-options">
          {opcoes.map((opcao) => {
            const eliminada = eliminadas.includes(opcao.letra);
            const selecionou = selecionada === opcao.letra;
            const correta = respondida && opcao.letra === "D";
            const incorretaSelecionada = respondida && selecionou && opcao.letra !== "D";

            return (
              <div key={opcao.letra} className={`mqp-option ${selecionou ? "selecionada" : ""} ${eliminada ? "eliminada" : ""} ${correta ? "correta" : ""} ${incorretaSelecionada ? "incorreta" : ""}`}>
                <button
                  type="button"
                  className="mqp-option-main"
                  disabled={respondida || eliminada}
                  onClick={() => setSelecionada(opcao.letra)}
                >
                  <span className="mqp-letter">{opcao.letra}</span>
                  <span className="mqp-option-text">{opcao.texto}</span>
                  {correta && <CheckCircle2 size={18} />}
                  {incorretaSelecionada && <X size={18} />}
                </button>
                {!respondida && (
                  <button
                    type="button"
                    className="mqp-eliminate"
                    title={eliminada ? "Restaurar alternativa" : "Riscar alternativa"}
                    onClick={() => setEliminadas((atuais) => atuais.includes(opcao.letra) ? atuais.filter((letra) => letra !== opcao.letra) : [...atuais, opcao.letra])}
                  >
                    {eliminada ? <RotateCcw size={15} /> : <Minus size={15} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {respondida && (
          <div className={`mqp-feedback ${acertou ? "sucesso" : "erro"}`}>
            <div>{acertou ? <CheckCircle2 size={22} /> : <X size={22} />}</div>
            <div>
              <strong>{acertou ? "Você acertou!" : "Você errou."}</strong>
              <span>{acertou ? "Boa! A alternativa D expressa a ideia central do texto." : "Gabarito: D. Revise a explicação abaixo para entender o ponto-chave."}</span>
            </div>
            <button type="button" onClick={novaTentativa}>Refazer</button>
          </div>
        )}

        <div className="mqp-answer-actions">
          {!respondida ? (
            <>
              <button type="button" className="mqp-clear-marks" onClick={() => { setSelecionada(null); setEliminadas([]); }}><RotateCcw size={16} /> Limpar marcações</button>
              <button type="button" className="mqp-btn-primary mqp-responder" onClick={responder}><CheckCircle2 size={18} /> Responder</button>
            </>
          ) : <span />}
        </div>

        <div className={`mqp-review-actions ${respondida ? "liberadas" : ""}`}>
          <button type="button" disabled={!respondida} className={painel === "gabarito" ? "ativo" : ""} onClick={() => setPainel(painel === "gabarito" ? null : "gabarito")}><FileText size={16} /> Gabarito comentado</button>
          <button type="button" disabled={!respondida} className={painel === "comentarios" ? "ativo" : ""} onClick={() => setPainel(painel === "comentarios" ? null : "comentarios")}><MessageCircle size={16} /> Comentários</button>
          <button type="button" disabled={!respondida} className={painel === "estatisticas" ? "ativo" : ""} onClick={() => setPainel(painel === "estatisticas" ? null : "estatisticas")}><BarChart3 size={16} /> Estatísticas</button>
          <button type="button" disabled={!respondida} onClick={() => setModalCaderno(true)}><BookOpen size={16} /> Cadernos</button>
          <button type="button" disabled={!respondida} onClick={() => setModalAnotacao(true)}><NotebookPen size={16} /> Criar anotação</button>
          <button type="button" disabled={!respondida} className={erroNotificado ? "notificado" : ""} onClick={() => { setErroNotificado(true); mostrarToast("Erro da questão notificado."); }}><Bell size={16} /> {erroNotificado ? "Erro notificado" : "Notificar erro"}</button>
        </div>

        {respondida && painel === "gabarito" && (
          <div className="mqp-detail-panel">
            <div className="mqp-panel-title"><span><FileText size={18} /></span><div><strong>Gabarito comentado</strong><small>Comentário oficial</small></div></div>
            <p>A alternativa D é a correta porque o texto reconhece os benefícios da tecnologia, mas condiciona seu uso a uma postura crítica e consciente. As demais alternativas apresentam generalizações ou ideias que não são defendidas pelo autor.</p>
          </div>
        )}

        {respondida && painel === "comentarios" && (
          <div className="mqp-detail-panel">
            <div className="mqp-panel-title"><span><MessageCircle size={18} /></span><div><strong>Comentários</strong><small>Discussão pós-resolução</small></div></div>
            <div className="mqp-comment"><b>Professor Study Pro</b><p>Observe o conectivo “No entanto”: ele mostra que o autor defende o uso da tecnologia com equilíbrio, não uma rejeição completa.</p></div>
            <div className="mqp-comment"><b>Aluno</b><p>Eliminei A, B e C pelas palavras absolutas. Isso deixou D e E bem mais fáceis de comparar.</p></div>
          </div>
        )}

        {respondida && painel === "estatisticas" && <PainelEstatisticas />}
      </article>

      <article className="mqp-next-question">
        <div><strong>QUESTÃO 2</strong><span>#SP-002855</span></div>
        <div><b>Matemática</b><span>Raciocínio lógico › Lógica proposicional</span></div>
        <div><span>Não resolvida</span><small>2024 · CESPE</small></div>
      </article>

      {modalAnotacao && (
        <div className="mqp-modal-backdrop" role="presentation" onMouseDown={() => setModalAnotacao(false)}>
          <div className="mqp-modal" role="dialog" aria-modal="true" aria-label="Criar anotação" onMouseDown={(e) => e.stopPropagation()}>
            <header><div><NotebookPen size={20} /><span><strong>Minha anotação</strong><small>Privada — somente você pode ver</small></span></div><button type="button" onClick={() => setModalAnotacao(false)}><X size={18} /></button></header>
            <div className="mqp-editor-toolbar"><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button">• Lista</button></div>
            <textarea value={anotacao} onChange={(e) => setAnotacao(e.target.value)} placeholder="Escreva o que você quer lembrar desta questão..." autoFocus />
            {anotacaoSalva && <p className="mqp-saved-note"><Check size={15} /> Anotação salva nesta prévia.</p>}
            <footer><button type="button" className="mqp-btn-outline" onClick={() => setModalAnotacao(false)}>Cancelar</button><button type="button" className="mqp-btn-primary" onClick={() => { setAnotacaoSalva(true); mostrarToast("Anotação salva."); }}><Save size={16} /> Salvar</button></footer>
          </div>
        </div>
      )}

      {modalCaderno && (
        <div className="mqp-modal-backdrop" role="presentation" onMouseDown={() => setModalCaderno(false)}>
          <div className="mqp-modal mqp-modal-small" role="dialog" aria-modal="true" aria-label="Adicionar a caderno" onMouseDown={(e) => e.stopPropagation()}>
            <header><div><FolderPlus size={20} /><span><strong>Novo caderno</strong><small>Organize suas questões para revisão</small></span></div><button type="button" onClick={() => setModalCaderno(false)}><X size={18} /></button></header>
            <label className="mqp-modal-field"><span>Nome do caderno</span><input value={nomeCaderno} onChange={(e) => setNomeCaderno(e.target.value)} placeholder="Ex.: Português — erros da semana" /></label>
            <label className="mqp-modal-field"><span>Tipo</span><select value={tipoCaderno} onChange={(e) => setTipoCaderno(e.target.value)}><option>Revisão</option><option>Acertos e erros</option></select></label>
            <footer><button type="button" className="mqp-btn-outline" onClick={() => setModalCaderno(false)}>Cancelar</button><button type="button" className="mqp-btn-primary" onClick={() => { setModalCaderno(false); mostrarToast(nomeCaderno.trim() ? `Caderno “${nomeCaderno.trim()}” criado.` : "Caderno de revisão criado."); }}><Plus size={16} /> Criar</button></footer>
          </div>
        </div>
      )}
    </section>
  );
}

function CampoSelect({ label, valor, setValor, opcoes }: { label: string; valor: string; setValor: (valor: string) => void; opcoes: string[] }) {
  return (
    <label className="mqp-field">
      <span>{label}</span>
      <div className="mqp-native-select">
        <select value={valor} onChange={(e) => setValor(e.target.value)}>
          <option value="">Selecione</option>
          {opcoes.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
        </select>
        <ChevronDown size={16} />
      </div>
    </label>
  );
}

function GrupoChecks({ titulo, itens, selecionados, onToggle }: { titulo: string; itens: string[]; selecionados: string[]; onToggle: (item: string) => void }) {
  return (
    <div className="mqp-check-group">
      <strong>{titulo}</strong>
      {itens.map((item) => (
        <label key={item}>
          <input type="checkbox" checked={selecionados.includes(item)} onChange={() => onToggle(item)} />
          <span className="mqp-checkmark"><Check size={13} /></span>
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

function PainelEstatisticas() {
  return (
    <div className="mqp-detail-panel mqp-stats-panel">
      <div className="mqp-panel-title"><span><BarChart3 size={18} /></span><div><strong>Estatísticas da questão</strong><small>Base demonstrativa da prévia Premium</small></div></div>
      <div className="mqp-stats-grid">
        <div className="mqp-donut-wrap">
          <div className="mqp-donut"><div><strong>62%</strong><span>acertos</span></div></div>
          <div className="mqp-donut-legend"><span><i className="acerto" /> 563 acertos</span><span><i className="erro" /> 346 erros</span></div>
        </div>
        <div className="mqp-distribution">
          <strong>Alternativas mais respondidas</strong>
          {distribuicao.map((item) => (
            <div key={item.letra} className={item.letra === "D" ? "gabarito" : ""}>
              <span className="mqp-dist-letter">{item.letra}</span>
              <div className="mqp-dist-track"><i style={{ width: `${item.percentual}%` }} /></div>
              <b>{item.quantidade}</b><small>{item.percentual}%</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Confete() {
  return (
    <div className="mqp-confetti" aria-hidden="true">
      {Array.from({ length: 26 }).map((_, index) => (
        <i key={index} style={{ left: `${4 + ((index * 37) % 92)}%`, animationDelay: `${(index % 7) * 0.06}s`, transform: `rotate(${index * 31}deg)` }} />
      ))}
    </div>
  );
}
