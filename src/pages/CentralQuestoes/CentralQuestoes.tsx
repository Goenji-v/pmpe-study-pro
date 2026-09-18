import { useEffect, useMemo, useState } from "react";
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
  Database,
  Eraser,
  FileText,
  FolderPlus,
  LoaderCircle,
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

import { supabase } from "../../lib/supabase";
import "./CentralQuestoes.css";

type StatusFiltro = "todas" | "nao-resolvidas" | "acertei" | "errei";
type PainelQuestao = "gabarito" | "comentarios" | "estatisticas" | null;

type Opcao = {
  letra: string;
  texto: string;
};

type QuestaoCatalogo = {
  id: string;
  materia: string;
  assunto: string;
  subassunto: string | null;
  banca: string;
  ano_origem: number | null;
  dificuldade: string;
  enunciado: string;
  alternativas: unknown;
  resposta_correta_id: string | null;
  explicacao: string | null;
  created_at: string;
};

type LinhaFiltro = {
  materia: string;
  assunto: string;
  banca: string;
  dificuldade: string;
};

type RespostaUltima = {
  resposta: string;
  correta: boolean;
  respondida_em: string;
};

type HistoricoMap = Record<string, RespostaUltima>;

const CAMPOS_QUESTAO =
  "id,materia,assunto,subassunto,banca,ano_origem,dificuldade,enunciado,alternativas,resposta_correta_id,explicacao,created_at";

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

  const [linhasFiltro, setLinhasFiltro] = useState<LinhaFiltro[]>([]);
  const [questoes, setQuestoes] = useState<QuestaoCatalogo[]>([]);
  const [totalEncontrado, setTotalEncontrado] = useState(0);
  const [historico, setHistorico] = useState<HistoricoMap>({});
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroBanco, setErroBanco] = useState("");

  const [selecionadas, setSelecionadas] = useState<Record<string, string>>({});
  const [eliminadas, setEliminadas] = useState<Record<string, string[]>>({});
  const [respondidasSessao, setRespondidasSessao] = useState<Record<string, boolean>>({});
  const [paineis, setPaineis] = useState<Record<string, PainelQuestao>>({});
  const [salvandoResposta, setSalvandoResposta] = useState<string | null>(null);

  const [modalAnotacao, setModalAnotacao] = useState(false);
  const [modalCaderno, setModalCaderno] = useState(false);
  const [questaoModalId, setQuestaoModalId] = useState<string | null>(null);
  const [anotacao, setAnotacao] = useState("");
  const [anotacaoSalva, setAnotacaoSalva] = useState(false);
  const [nomeCaderno, setNomeCaderno] = useState("");
  const [tipoCaderno, setTipoCaderno] = useState("Revisão");
  const [toast, setToast] = useState("");
  const [erroNotificado, setErroNotificado] = useState<Record<string, boolean>>({});

  const disciplinas = useMemo(
    () => unicos(linhasFiltro.map((item) => item.materia)),
    [linhasFiltro]
  );

  const assuntos = useMemo(
    () =>
      unicos(
        linhasFiltro
          .filter((item) => !disciplina || item.materia === disciplina)
          .map((item) => item.assunto)
      ),
    [disciplina, linhasFiltro]
  );

  const bancas = useMemo(
    () => unicos(linhasFiltro.map((item) => item.banca)),
    [linhasFiltro]
  );

  const aproveitamento = useMemo(() => {
    const respostas = Object.values(historico);
    if (respostas.length === 0) return null;
    const certas = respostas.filter((item) => item.correta).length;
    return Math.round((certas / respostas.length) * 100);
  }, [historico]);

  const chips = useMemo(() => {
    const lista = [...exclusoes];
    if (disciplina) lista.push(disciplina);
    if (assunto) lista.push(assunto);
    if (banca) lista.push(banca);
    if (nivel) lista.push(nivel);
    if (palavraChave.trim()) lista.push(`“${palavraChave.trim()}”`);
    return lista;
  }, [assunto, banca, disciplina, exclusoes, nivel, palavraChave]);

  useEffect(() => {
    void inicializarBanco();
  }, []);

  async function inicializarBanco() {
    setCarregando(true);
    setErroBanco("");

    const [{ data: filtros, error: erroFiltros }, { data: authData }] =
      await Promise.all([
        supabase
          .from("questoes_catalogo")
          .select("materia,assunto,banca,dificuldade")
          .eq("status", "ativa")
          .limit(1000),
        supabase.auth.getUser(),
      ]);

    if (erroFiltros) {
      setErroBanco("Não foi possível carregar o catálogo de questões.");
      setCarregando(false);
      return;
    }

    setLinhasFiltro((filtros ?? []) as LinhaFiltro[]);

    const uid = authData.user?.id ?? null;
    setUsuarioId(uid);

    let historicoAtual: HistoricoMap = {};

    if (uid) {
      const { data: respostas } = await supabase
        .from("respostas_questoes_ia")
        .select("questao_id,resposta,correta,respondida_em")
        .eq("user_id", uid)
        .order("respondida_em", { ascending: false })
        .limit(2000);

      historicoAtual = montarHistoricoMaisRecente(
        (respostas ?? []) as Array<{
          questao_id: string;
          resposta: string;
          correta: boolean;
          respondida_em: string;
        }>
      );
      setHistorico(historicoAtual);
    }

    await buscarQuestoes("todas", Number(porPagina), historicoAtual);
  }

  function aplicarFiltros(query: any) {
    let resultado = query.eq("status", "ativa");

    if (disciplina) resultado = resultado.eq("materia", disciplina);
    if (assunto) resultado = resultado.eq("assunto", assunto);
    if (banca) resultado = resultado.eq("banca", banca);
    if (nivel) resultado = resultado.eq("dificuldade", nivel);

    const termo = palavraChave.trim().replace(/[,%()]/g, " ");
    if (termo) {
      resultado = resultado.or(
        `enunciado.ilike.%${termo}%,materia.ilike.%${termo}%,assunto.ilike.%${termo}%,subassunto.ilike.%${termo}%`
      );
    }

    if (ordenacao === "Gabarito comentado") {
      resultado = resultado.not("explicacao", "is", null);
    }

    return resultado;
  }

  function aplicarOrdenacao(query: any) {
    if (ordenacao === "Prova mais antiga") {
      return query
        .order("ano_origem", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
    }

    if (ordenacao === "Adicionadas recentemente") {
      return query.order("created_at", { ascending: false });
    }

    return query
      .order("ano_origem", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  async function buscarQuestoes(
    statusDesejado: StatusFiltro = status,
    limite = Number(porPagina),
    historicoForcado?: HistoricoMap
  ) {
    setCarregando(true);
    setErroBanco("");

    const historicoUsado = historicoForcado ?? historico;

    try {
      if (statusDesejado === "todas") {
        let query = supabase
          .from("questoes_catalogo")
          .select(CAMPOS_QUESTAO, { count: "exact" });

        query = aplicarFiltros(query);
        query = aplicarOrdenacao(query);

        const { data, error, count } = await query.range(0, Math.max(0, limite - 1));

        if (error) throw error;

        setQuestoes((data ?? []) as QuestaoCatalogo[]);
        setTotalEncontrado(count ?? 0);
      } else {
        let idsQuery = supabase.from("questoes_catalogo").select("id");
        idsQuery = aplicarFiltros(idsQuery);

        const { data: idsData, error: idsError } = await idsQuery.limit(1000);
        if (idsError) throw idsError;

        const idsFiltrados = (idsData ?? [])
          .map((item: { id: string }) => item.id)
          .filter((id: string) => {
            const resposta = historicoUsado[id];

            if (statusDesejado === "nao-resolvidas") return !resposta;
            if (statusDesejado === "acertei") return Boolean(resposta?.correta);
            return Boolean(resposta && !resposta.correta);
          });

        setTotalEncontrado(idsFiltrados.length);

        const idsPagina = idsFiltrados.slice(0, limite);
        if (idsPagina.length === 0) {
          setQuestoes([]);
          return;
        }

        let detalhesQuery = supabase
          .from("questoes_catalogo")
          .select(CAMPOS_QUESTAO)
          .in("id", idsPagina);

        detalhesQuery = aplicarOrdenacao(detalhesQuery);

        const { data, error } = await detalhesQuery;
        if (error) throw error;

        setQuestoes((data ?? []) as QuestaoCatalogo[]);
      }
    } catch (erro) {
      console.error("Erro ao filtrar banco de questões:", erro);
      setQuestoes([]);
      setTotalEncontrado(0);
      setErroBanco("Não foi possível aplicar os filtros agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function alternarLista(
    valor: string,
    lista: string[],
    setter: (valor: string[]) => void
  ) {
    setter(
      lista.includes(valor)
        ? lista.filter((item) => item !== valor)
        : [...lista, valor]
    );
  }

  function removerChip(chip: string) {
    if (exclusoes.includes(chip)) {
      setExclusoes(exclusoes.filter((item) => item !== chip));
      return;
    }
    if (chip === disciplina) {
      setDisciplina("");
      setAssunto("");
    }
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
    mostrarToast("Filtros limpos. Clique em Filtrar para atualizar.");
  }

  function mostrarToast(mensagem: string) {
    setToast(mensagem);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function trocarStatus(novoStatus: StatusFiltro) {
    setStatus(novoStatus);
    await buscarQuestoes(novoStatus);
  }

  async function responderQuestao(questao: QuestaoCatalogo) {
    const resposta = selecionadas[questao.id];

    if (!resposta) {
      mostrarToast("Escolha uma alternativa antes de responder.");
      return;
    }

    const correta = resposta === questao.resposta_correta_id;
    setSalvandoResposta(questao.id);

    try {
      if (usuarioId) {
        const { error } = await supabase.from("respostas_questoes_ia").insert({
          user_id: usuarioId,
          questao_id: questao.id,
          resposta,
          correta,
        });

        if (error) throw error;
      }

      const novaResposta: RespostaUltima = {
        resposta,
        correta,
        respondida_em: new Date().toISOString(),
      };

      setHistorico((atual) => ({
        ...atual,
        [questao.id]: novaResposta,
      }));

      setRespondidasSessao((atual) => ({
        ...atual,
        [questao.id]: true,
      }));

      setPaineis((atual) => ({
        ...atual,
        [questao.id]: null,
      }));

      mostrarToast(
        usuarioId
          ? "Resposta registrada no seu histórico."
          : "Resposta registrada somente nesta prévia."
      );
    } catch (erro) {
      console.error("Erro ao registrar resposta:", erro);
      mostrarToast("Não foi possível registrar a resposta.");
    } finally {
      setSalvandoResposta(null);
    }
  }

  function refazerQuestao(questaoId: string) {
    setSelecionadas((atual) => {
      const copia = { ...atual };
      delete copia[questaoId];
      return copia;
    });
    setEliminadas((atual) => ({ ...atual, [questaoId]: [] }));
    setRespondidasSessao((atual) => ({ ...atual, [questaoId]: false }));
    setPaineis((atual) => ({ ...atual, [questaoId]: null }));
  }

  function abrirAnotacao(questaoId: string) {
    setQuestaoModalId(questaoId);
    setModalAnotacao(true);
  }

  function abrirCaderno(questaoId?: string) {
    setQuestaoModalId(questaoId ?? null);
    setModalCaderno(true);
  }

  return (
    <section className="mqp" style={{ fontSize: `${fonte}px` }}>
      {toast && <div className="mqp-toast">{toast}</div>}

      <div className="mqp-breadcrumb">
        <span>Questões</span><b>›</b><span>Concurso</span><b>›</b><strong>Prova Objetiva</strong>
      </div>

      <header className="mqp-hero">
        <div>
          <div className="mqp-kicker">
            <Database size={14} /> BANCO REAL • SUPABASE
          </div>
          <h1>Minhas questões</h1>
          <p>Resolva, revise e evolua com questões reais do catálogo do Study Pro.</p>
        </div>

        <div className="mqp-hero-stats">
          <div className="mqp-mini-stat">
            <Target size={22} />
            <div>
              <strong>{totalEncontrado.toLocaleString("pt-BR")}</strong>
              <span>questões encontradas</span>
            </div>
          </div>
          <div className="mqp-mini-stat mqp-mini-stat-success">
            <BarChart3 size={22} />
            <div>
              <strong>{aproveitamento === null ? "—" : `${aproveitamento}%`}</strong>
              <span>seu aproveitamento</span>
            </div>
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
            onClick={() => void trocarStatus(valor as StatusFiltro)}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      <section className="mqp-filter-card">
        <div className="mqp-filter-grid">
          <label className="mqp-field mqp-field-search">
            <span>Palavras-chave</span>
            <div>
              <Search size={17} />
              <input
                value={palavraChave}
                onChange={(e) => setPalavraChave(e.target.value)}
                placeholder="Ex.: texto, STF, lei..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") void buscarQuestoes();
                }}
              />
            </div>
          </label>

          <CampoSelect
            label="Disciplina"
            valor={disciplina}
            setValor={(valor) => {
              setDisciplina(valor);
              setAssunto("");
            }}
            opcoes={disciplinas}
          />
          <CampoSelect
            label="Assunto"
            valor={assunto}
            setValor={setAssunto}
            opcoes={assuntos}
          />
          <CampoSelect
            label="Banca"
            valor={banca}
            setValor={setBanca}
            opcoes={bancas}
          />
          <CampoSelect
            label="Nível"
            valor={nivel}
            setValor={setNivel}
            opcoesComValor={[
              { rotulo: "Fácil", valor: "facil" },
              { rotulo: "Médio", valor: "media" },
              { rotulo: "Difícil", valor: "dificil" },
            ]}
          />
        </div>

        <div className="mqp-check-columns">
          <GrupoChecks
            titulo="Excluir questões"
            itens={exclusoesIniciais}
            selecionados={exclusoes}
            onToggle={(item) => alternarLista(item, exclusoes, setExclusoes)}
          />
          <GrupoChecks
            titulo="Questões com"
            itens={recursosIniciais}
            selecionados={recursos}
            onToggle={(item) => alternarLista(item, recursos, setRecursos)}
          />
        </div>

        <div className="mqp-chips-row">
          <strong>Filtros aplicados:</strong>
          <div className="mqp-chips">
            {chips.length === 0 && (
              <span className="mqp-sem-filtro">Nenhum filtro aplicado</span>
            )}
            {chips.map((chip) => (
              <button key={chip} type="button" onClick={() => removerChip(chip)}>
                {chip}<X size={13} />
              </button>
            ))}
          </div>
          <button type="button" className="mqp-link" onClick={limparFiltros}>
            Limpar todos
          </button>
        </div>

        <div className="mqp-filter-actions">
          <div>
            <button type="button" className="mqp-btn-outline" onClick={() => abrirCaderno()}>
              <BookOpen size={17} /> Gerar caderno
            </button>
            <button
              type="button"
              className="mqp-btn-outline"
              onClick={() => mostrarToast("Salvar filtro continua em modo de prévia.")}
            >
              <Bookmark size={17} /> Salvar filtro
            </button>
            <button type="button" className="mqp-btn-outline" onClick={limparFiltros}>
              <Eraser size={17} /> Limpar
            </button>
          </div>
          <button
            type="button"
            className="mqp-btn-primary"
            onClick={() => void buscarQuestoes()}
            disabled={carregando}
          >
            {carregando ? <LoaderCircle size={18} className="mqp-spin" /> : <Search size={18} />}
            {carregando ? "Filtrando..." : "Filtrar"}
          </button>
        </div>
      </section>

      <section className="mqp-result-tools">
        <div className="mqp-result-title">
          <strong>{totalEncontrado.toLocaleString("pt-BR")}</strong> questões encontradas
        </div>

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
          <label>
            Questões por página:
            <span className="mqp-select-wrap">
              <select
                value={porPagina}
                onChange={(e) => {
                  const valor = e.target.value;
                  setPorPagina(valor);
                  void buscarQuestoes(status, Number(valor));
                }}
              >
                <option>5</option><option>10</option><option>15</option><option>20</option>
              </select>
              <ChevronDown size={15} />
            </span>
          </label>

          <label className="mqp-sort-main">
            Ordenar por:
            <span className="mqp-select-wrap">
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value)}
              >
                <option>Prova mais recente</option>
                <option>Prova mais antiga</option>
                <option>Adicionadas recentemente</option>
                <option>Mais difíceis</option>
                <option>Relevância das palavras-chave</option>
                <option>Gabarito comentado</option>
              </select>
              <ChevronDown size={15} />
            </span>
          </label>

          <button type="button" className="mqp-date-button">
            <CalendarDays size={16} /> Banco atualizado <ChevronDown size={14} />
          </button>
        </div>
      </section>

      {erroBanco && (
        <div className="mqp-bank-state mqp-bank-error">
          <X size={20} />
          <div><strong>Falha ao consultar o banco</strong><span>{erroBanco}</span></div>
        </div>
      )}

      {carregando && questoes.length === 0 && (
        <div className="mqp-bank-state">
          <LoaderCircle size={24} className="mqp-spin" />
          <div><strong>Buscando questões reais...</strong><span>Consultando o catálogo do Supabase.</span></div>
        </div>
      )}

      {!carregando && !erroBanco && questoes.length === 0 && (
        <div className="mqp-bank-state">
          <Search size={24} />
          <div><strong>Nenhuma questão encontrada</strong><span>Tente retirar algum filtro ou mudar o status selecionado.</span></div>
        </div>
      )}

      <div className="mqp-question-list">
        {questoes.map((questao, index) => (
          <QuestaoCard
            key={questao.id}
            questao={questao}
            indice={index + 1}
            historico={historico[questao.id]}
            selecionada={selecionadas[questao.id] ?? null}
            eliminadas={eliminadas[questao.id] ?? []}
            respondidaSessao={Boolean(respondidasSessao[questao.id])}
            painel={paineis[questao.id] ?? null}
            salvando={salvandoResposta === questao.id}
            erroNotificado={Boolean(erroNotificado[questao.id])}
            onSelecionar={(letra) =>
              setSelecionadas((atual) => ({ ...atual, [questao.id]: letra }))
            }
            onAlternarEliminada={(letra) =>
              setEliminadas((atual) => {
                const atuais = atual[questao.id] ?? [];
                return {
                  ...atual,
                  [questao.id]: atuais.includes(letra)
                    ? atuais.filter((item) => item !== letra)
                    : [...atuais, letra],
                };
              })
            }
            onLimpar={() => {
              setSelecionadas((atual) => ({ ...atual, [questao.id]: "" }));
              setEliminadas((atual) => ({ ...atual, [questao.id]: [] }));
            }}
            onResponder={() => void responderQuestao(questao)}
            onRefazer={() => refazerQuestao(questao.id)}
            onPainel={(novoPainel) =>
              setPaineis((atual) => ({
                ...atual,
                [questao.id]: atual[questao.id] === novoPainel ? null : novoPainel,
              }))
            }
            onCaderno={() => abrirCaderno(questao.id)}
            onAnotacao={() => abrirAnotacao(questao.id)}
            onNotificarErro={() => {
              setErroNotificado((atual) => ({ ...atual, [questao.id]: true }));
              mostrarToast("Notificação marcada na prévia. Persistência entra na próxima etapa.");
            }}
          />
        ))}
      </div>

      {modalAnotacao && (
        <div className="mqp-modal-backdrop" role="presentation" onMouseDown={() => setModalAnotacao(false)}>
          <div className="mqp-modal" role="dialog" aria-modal="true" aria-label="Criar anotação" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <NotebookPen size={20} />
                <span><strong>Minha anotação</strong><small>Privada — somente você pode ver</small></span>
              </div>
              <button type="button" onClick={() => setModalAnotacao(false)}><X size={18} /></button>
            </header>
            <div className="mqp-editor-toolbar">
              <button type="button"><b>B</b></button>
              <button type="button"><i>I</i></button>
              <button type="button">• Lista</button>
            </div>
            <textarea
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
              placeholder="Escreva o que você quer lembrar desta questão..."
              autoFocus
            />
            {anotacaoSalva && <p className="mqp-saved-note"><Check size={15} /> Anotação salva nesta prévia.</p>}
            <footer>
              <button type="button" className="mqp-btn-outline" onClick={() => setModalAnotacao(false)}>Cancelar</button>
              <button
                type="button"
                className="mqp-btn-primary"
                onClick={() => {
                  setAnotacaoSalva(true);
                  mostrarToast(`Anotação da questão ${questaoModalId?.slice(0, 8) ?? ""} salva na prévia.`);
                }}
              >
                <Save size={16} /> Salvar
              </button>
            </footer>
          </div>
        </div>
      )}

      {modalCaderno && (
        <div className="mqp-modal-backdrop" role="presentation" onMouseDown={() => setModalCaderno(false)}>
          <div className="mqp-modal mqp-modal-small" role="dialog" aria-modal="true" aria-label="Adicionar a caderno" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <FolderPlus size={20} />
                <span><strong>Novo caderno</strong><small>Organize suas questões para revisão</small></span>
              </div>
              <button type="button" onClick={() => setModalCaderno(false)}><X size={18} /></button>
            </header>
            <label className="mqp-modal-field">
              <span>Nome do caderno</span>
              <input
                value={nomeCaderno}
                onChange={(e) => setNomeCaderno(e.target.value)}
                placeholder="Ex.: Português — erros da semana"
              />
            </label>
            <label className="mqp-modal-field">
              <span>Tipo</span>
              <select value={tipoCaderno} onChange={(e) => setTipoCaderno(e.target.value)}>
                <option>Revisão</option>
                <option>Acertos e erros</option>
              </select>
            </label>
            <footer>
              <button type="button" className="mqp-btn-outline" onClick={() => setModalCaderno(false)}>Cancelar</button>
              <button
                type="button"
                className="mqp-btn-primary"
                onClick={() => {
                  setModalCaderno(false);
                  mostrarToast(
                    nomeCaderno.trim()
                      ? `Caderno “${nomeCaderno.trim()}” criado na prévia.`
                      : "Caderno de revisão criado na prévia."
                  );
                }}
              >
                <Plus size={16} /> Criar
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

function QuestaoCard({
  questao,
  indice,
  historico,
  selecionada,
  eliminadas,
  respondidaSessao,
  painel,
  salvando,
  erroNotificado,
  onSelecionar,
  onAlternarEliminada,
  onLimpar,
  onResponder,
  onRefazer,
  onPainel,
  onCaderno,
  onAnotacao,
  onNotificarErro,
}: {
  questao: QuestaoCatalogo;
  indice: number;
  historico?: RespostaUltima;
  selecionada: string | null;
  eliminadas: string[];
  respondidaSessao: boolean;
  painel: PainelQuestao;
  salvando: boolean;
  erroNotificado: boolean;
  onSelecionar: (letra: string) => void;
  onAlternarEliminada: (letra: string) => void;
  onLimpar: () => void;
  onResponder: () => void;
  onRefazer: () => void;
  onPainel: (painel: Exclude<PainelQuestao, null>) => void;
  onCaderno: () => void;
  onAnotacao: () => void;
  onNotificarErro: () => void;
}) {
  const opcoes = normalizarAlternativas(questao.alternativas);
  const acertouAgora =
    respondidaSessao && selecionada === questao.resposta_correta_id;
  const resolvidaAntes = Boolean(historico);
  const liberada = respondidaSessao || resolvidaAntes;
  const statusCorreta = respondidaSessao ? acertouAgora : historico?.correta;

  return (
    <article className={`mqp-question-card ${liberada ? "respondida" : ""}`}>
      {acertouAgora && <Confete />}

      <header className="mqp-question-head">
        <div>
          <div className="mqp-question-code">
            <strong>QUESTÃO {indice}</strong>
            <span>#{questao.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="mqp-question-meta">
            <span className="mqp-subject">{questao.materia}</span>
            <span>{questao.assunto}</span>
            {questao.subassunto && <><b>›</b><span>{questao.subassunto}</span></>}
          </div>
        </div>

        <div className="mqp-question-side">
          <span className={`mqp-status-pill ${liberada ? (statusCorreta ? "certa" : "errada") : ""}`}>
            {liberada
              ? statusCorreta
                ? <><CheckCircle2 size={14} /> Resolvida certa</>
                : <><X size={14} /> Resolvida errada</>
              : "Não resolvida"}
          </span>
          <span>{questao.ano_origem ?? "—"} · {questao.banca}</span>
        </div>
      </header>

      <p className="mqp-enunciado mqp-enunciado-real">{questao.enunciado}</p>

      <div className="mqp-options">
        {opcoes.map((opcao) => {
          const eliminada = eliminadas.includes(opcao.letra);
          const selecionou = selecionada === opcao.letra;
          const correta =
            respondidaSessao && opcao.letra === questao.resposta_correta_id;
          const incorretaSelecionada =
            respondidaSessao &&
            selecionou &&
            opcao.letra !== questao.resposta_correta_id;

          return (
            <div
              key={opcao.letra}
              className={`mqp-option ${selecionou ? "selecionada" : ""} ${eliminada ? "eliminada" : ""} ${correta ? "correta" : ""} ${incorretaSelecionada ? "incorreta" : ""}`}
            >
              <button
                type="button"
                className="mqp-option-main"
                disabled={respondidaSessao || eliminada}
                onClick={() => onSelecionar(opcao.letra)}
              >
                <span className="mqp-letter">{opcao.letra}</span>
                <span className="mqp-option-text">{opcao.texto}</span>
                {correta && <CheckCircle2 size={18} />}
                {incorretaSelecionada && <X size={18} />}
              </button>

              {!respondidaSessao && (
                <button
                  type="button"
                  className="mqp-eliminate"
                  title={eliminada ? "Restaurar alternativa" : "Riscar alternativa"}
                  onClick={() => onAlternarEliminada(opcao.letra)}
                >
                  {eliminada ? <RotateCcw size={15} /> : <Minus size={15} />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {respondidaSessao && (
        <div className={`mqp-feedback ${acertouAgora ? "sucesso" : "erro"}`}>
          <div>{acertouAgora ? <CheckCircle2 size={22} /> : <X size={22} />}</div>
          <div>
            <strong>{acertouAgora ? "Você acertou!" : "Você errou."}</strong>
            <span>
              {acertouAgora
                ? "Resposta registrada no seu histórico."
                : `Gabarito: ${questao.resposta_correta_id ?? "não informado"}.`}
            </span>
          </div>
          <button type="button" onClick={onRefazer}>Refazer</button>
        </div>
      )}

      <div className="mqp-answer-actions">
        {!respondidaSessao ? (
          <>
            <button type="button" className="mqp-clear-marks" onClick={onLimpar}>
              <RotateCcw size={16} /> Limpar marcações
            </button>
            <button
              type="button"
              className="mqp-btn-primary mqp-responder"
              onClick={onResponder}
              disabled={salvando}
            >
              {salvando ? <LoaderCircle size={18} className="mqp-spin" /> : <CheckCircle2 size={18} />}
              {salvando ? "Salvando..." : "Responder"}
            </button>
          </>
        ) : <span />}
      </div>

      <div className={`mqp-review-actions ${liberada ? "liberadas" : ""}`}>
        <button type="button" disabled={!liberada} className={painel === "gabarito" ? "ativo" : ""} onClick={() => onPainel("gabarito")}>
          <FileText size={16} /> Gabarito comentado
        </button>
        <button type="button" disabled={!liberada} className={painel === "comentarios" ? "ativo" : ""} onClick={() => onPainel("comentarios")}>
          <MessageCircle size={16} /> Comentários
        </button>
        <button type="button" disabled={!liberada} className={painel === "estatisticas" ? "ativo" : ""} onClick={() => onPainel("estatisticas")}>
          <BarChart3 size={16} /> Estatísticas
        </button>
        <button type="button" disabled={!liberada} onClick={onCaderno}>
          <BookOpen size={16} /> Cadernos
        </button>
        <button type="button" disabled={!liberada} onClick={onAnotacao}>
          <NotebookPen size={16} /> Criar anotação
        </button>
        <button type="button" disabled={!liberada} className={erroNotificado ? "notificado" : ""} onClick={onNotificarErro}>
          <Bell size={16} /> {erroNotificado ? "Erro notificado" : "Notificar erro"}
        </button>
      </div>

      {liberada && painel === "gabarito" && (
        <div className="mqp-detail-panel">
          <div className="mqp-panel-title">
            <span><FileText size={18} /></span>
            <div><strong>Gabarito comentado</strong><small>Comentário armazenado no banco</small></div>
          </div>
          <p>{questao.explicacao || "Esta questão ainda não possui comentário de gabarito."}</p>
        </div>
      )}

      {liberada && painel === "comentarios" && (
        <div className="mqp-detail-panel">
          <div className="mqp-panel-title">
            <span><MessageCircle size={18} /></span>
            <div><strong>Comentários</strong><small>Área preparada para os comentários reais</small></div>
          </div>
          <p>A integração dos comentários por questão será a próxima camada. O catálogo e a resolução já estão usando dados reais.</p>
        </div>
      )}

      {liberada && painel === "estatisticas" && (
        <div className="mqp-detail-panel mqp-stats-panel">
          <div className="mqp-panel-title">
            <span><BarChart3 size={18} /></span>
            <div><strong>Estatísticas da questão</strong><small>Próxima integração do banco</small></div>
          </div>
          <p>
            Para mostrar percentuais globais de A, B, C, D e E sem expor o histórico dos alunos,
            vamos usar uma agregação segura no Supabase. Esta tela já está pronta para receber esses números.
          </p>
        </div>
      )}
    </article>
  );
}

function CampoSelect({
  label,
  valor,
  setValor,
  opcoes = [],
  opcoesComValor,
}: {
  label: string;
  valor: string;
  setValor: (valor: string) => void;
  opcoes?: string[];
  opcoesComValor?: Array<{ rotulo: string; valor: string }>;
}) {
  return (
    <label className="mqp-field">
      <span>{label}</span>
      <div className="mqp-native-select">
        <select value={valor} onChange={(e) => setValor(e.target.value)}>
          <option value="">Todos</option>
          {opcoesComValor
            ? opcoesComValor.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))
            : opcoes.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
        </select>
        <ChevronDown size={16} />
      </div>
    </label>
  );
}

function GrupoChecks({
  titulo,
  itens,
  selecionados,
  onToggle,
}: {
  titulo: string;
  itens: string[];
  selecionados: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div className="mqp-check-group">
      <strong>{titulo}</strong>
      {itens.map((item) => (
        <label key={item}>
          <input
            type="checkbox"
            checked={selecionados.includes(item)}
            onChange={() => onToggle(item)}
          />
          <span className="mqp-checkmark"><Check size={13} /></span>
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

function normalizarAlternativas(valor: unknown): Opcao[] {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const objeto = item as { id?: unknown; letra?: unknown; texto?: unknown };
      const letra = String(
        objeto.id ?? objeto.letra ?? String.fromCharCode(65 + index)
      ).toUpperCase();
      const texto = String(objeto.texto ?? "");
      return { letra, texto };
    })
    .filter((item): item is Opcao => Boolean(item?.texto));
}

function montarHistoricoMaisRecente(
  respostas: Array<{
    questao_id: string;
    resposta: string;
    correta: boolean;
    respondida_em: string;
  }>
): HistoricoMap {
  const mapa: HistoricoMap = {};

  for (const resposta of respostas) {
    if (!mapa[resposta.questao_id]) {
      mapa[resposta.questao_id] = {
        resposta: resposta.resposta,
        correta: resposta.correta,
        respondida_em: resposta.respondida_em,
      };
    }
  }

  return mapa;
}

function unicos(valores: string[]) {
  return Array.from(
    new Set(valores.filter((valor) => Boolean(valor?.trim())))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function Confete() {
  return (
    <div className="mqp-confetti" aria-hidden="true">
      {Array.from({ length: 26 }).map((_, index) => (
        <i
          key={index}
          style={{
            left: `${4 + ((index * 37) % 92)}%`,
            animationDelay: `${(index % 7) * 0.06}s`,
            transform: `rotate(${index * 31}deg)`,
          }}
        />
      ))}
    </div>
  );
}
