import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  corrigirQuestaoDenunciada,
  listarDenunciasPendentes,
  moderarDenunciaQuestao,
  type DenunciaQuestaoAdmin,
} from "../../services/questaoComunidadeService";
import "./ModeracaoDenuncias.css";

const ROTULOS = {
  desatualizada: "Questão desatualizada",
  gabarito_incorreto: "Gabarito incorreto",
  multiplos_gabaritos: "Múltiplos gabaritos",
  sem_coerencia: "Sem coerência",
  repetida: "Questão repetida",
  outro: "Outro problema",
} as const;

export default function ModeracaoDenuncias() {
  const { showToast } = useToast();
  const [denuncias, setDenuncias] = useState<DenunciaQuestaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState("");
  const [editando, setEditando] = useState<DenunciaQuestaoAdmin | null>(null);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      setDenuncias(await listarDenunciasPendentes());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as denúncias.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function moderar(item: DenunciaQuestaoAdmin, acao: "restaurar" | "excluir") {
    const texto = acao === "excluir"
      ? "Excluir definitivamente esta questão do catálogo? A denúncia continuará registrada para auditoria."
      : "Restaurar esta questão e marcá-la como denúncia improcedente?";
    if (!window.confirm(texto)) return;

    try {
      setProcessando(item.id);
      await moderarDenunciaQuestao(item.id, acao);
      setDenuncias((atuais) => atuais.filter((d) => d.id !== item.id));
      showToast(acao === "excluir" ? "Questão excluída do catálogo." : "Questão restaurada.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não foi possível moderar a denúncia.", "warning");
    } finally {
      setProcessando("");
    }
  }

  return (
    <section className="moderacao-denuncias" id="denuncias">
      <header className="moderacao-denuncias-topo">
        <div>
          <span>MODERAÇÃO</span>
          <h2>🚩 Questões denunciadas</h2>
          <p>A denúncia retira a questão do banco automaticamente. Só volte a publicá-la depois de revisar o conteúdo.</p>
        </div>
        <div className="moderacao-denuncias-contador">
          <strong>{denuncias.length}</strong>
          <span>pendente{denuncias.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      {erro && <div className="moderacao-denuncias-erro">{erro} <button type="button" onClick={() => void carregar()}>Tentar novamente</button></div>}
      {carregando ? (
        <p className="moderacao-denuncias-vazio">Carregando fila...</p>
      ) : denuncias.length === 0 ? (
        <p className="moderacao-denuncias-vazio">Nenhuma denúncia aguardando análise.</p>
      ) : (
        <div className="moderacao-denuncias-lista">
          {denuncias.map((item) => (
            <CartaoDenuncia
              key={item.id}
              item={item}
              bloqueado={processando === item.id}
              onRestaurar={() => void moderar(item, "restaurar")}
              onExcluir={() => void moderar(item, "excluir")}
              onCorrigir={() => setEditando(item)}
            />
          ))}
        </div>
      )}

      {editando && (
        <EditorDenuncia
          item={editando}
          onFechar={() => setEditando(null)}
          onConcluida={() => {
            setDenuncias((atuais) => atuais.filter((d) => d.id !== editando.id));
            setEditando(null);
            showToast("Questão corrigida e republicada.", "success");
          }}
        />
      )}
    </section>
  );
}

function CartaoDenuncia({
  item,
  bloqueado,
  onRestaurar,
  onExcluir,
  onCorrigir,
}: {
  item: DenunciaQuestaoAdmin;
  bloqueado: boolean;
  onRestaurar: () => void;
  onExcluir: () => void;
  onCorrigir: () => void;
}) {
  const q = item.snapshot;
  return (
    <article className="moderacao-denuncias-card">
      <div className="moderacao-denuncias-card-topo">
        <div>
          <span className="moderacao-denuncias-motivo">{ROTULOS[item.motivo]}</span>
          <strong>{q.materia || "Matéria não informada"} · {q.assunto || "Assunto não informado"}</strong>
          <small>{q.banca || "Banca não informada"} · denunciada em {formatarData(item.criadaEm)}</small>
        </div>
        <span className="moderacao-denuncias-quarentena">Em quarentena</span>
      </div>

      <p className="moderacao-denuncias-enunciado">{q.enunciado || "Enunciado indisponível no snapshot."}</p>
      {item.detalhes && <blockquote><strong>Relato do aluno:</strong> {item.detalhes}</blockquote>}

      <details>
        <summary>Ver questão completa</summary>
        <div className="moderacao-denuncias-alternativas">
          {(q.alternativas ?? []).map((alternativa) => (
            <p key={alternativa.id} className={alternativa.id === q.resposta_correta_id ? "correta" : ""}>
              <strong>{alternativa.id})</strong> {alternativa.texto}
            </p>
          ))}
        </div>
        <p><strong>Gabarito atual:</strong> {q.resposta_correta_id || "—"}</p>
        {q.explicacao && <p><strong>Comentário:</strong> {q.explicacao}</p>}
      </details>

      <div className="moderacao-denuncias-acoes">
        <button type="button" onClick={onRestaurar} disabled={bloqueado}>✓ Improcedente / restaurar</button>
        <button type="button" className="corrigir" onClick={onCorrigir} disabled={bloqueado || !item.questaoId}>✎ Corrigir e republicar</button>
        <button type="button" className="excluir" onClick={onExcluir} disabled={bloqueado || !item.questaoId}>Excluir questão</button>
      </div>
    </article>
  );
}

function EditorDenuncia({
  item,
  onFechar,
  onConcluida,
}: {
  item: DenunciaQuestaoAdmin;
  onFechar: () => void;
  onConcluida: () => void;
}) {
  const { showToast } = useToast();
  const letras = ["A", "B", "C", "D", "E"];
  const iniciais = useMemo(() => Object.fromEntries(
    letras.map((letra) => [letra, item.snapshot.alternativas?.find((a) => a.id === letra)?.texto ?? ""])
  ), [item, letras]);
  const [enunciado, setEnunciado] = useState(item.snapshot.enunciado ?? "");
  const [alternativas, setAlternativas] = useState<Record<string, string>>(iniciais);
  const [gabarito, setGabarito] = useState(item.snapshot.resposta_correta_id ?? "A");
  const [explicacao, setExplicacao] = useState(item.snapshot.explicacao ?? "");
  const [respostaAdmin, setRespostaAdmin] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!item.questaoId) return;
    try {
      setSalvando(true);
      await corrigirQuestaoDenunciada(item.questaoId, {
        enunciado,
        alternativas: letras.map((id) => ({ id, texto: alternativas[id] ?? "" })),
        respostaCorretaId: gabarito,
        explicacao,
      });
      await moderarDenunciaQuestao(item.id, "corrigir", respostaAdmin);
      onConcluida();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não foi possível salvar a correção.", "warning");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="moderacao-denuncias-modal" role="dialog" aria-modal="true" aria-label="Corrigir questão denunciada">
      <div className="moderacao-denuncias-editor">
        <header>
          <div><span>CORREÇÃO EDITORIAL</span><h3>Corrigir e republicar</h3></div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </header>

        <label>Enunciado<textarea value={enunciado} onChange={(e) => setEnunciado(e.target.value)} /></label>
        {letras.map((letra) => (
          <label key={letra}>Alternativa {letra}<input value={alternativas[letra] ?? ""} onChange={(e) => setAlternativas((a) => ({ ...a, [letra]: e.target.value }))} /></label>
        ))}
        <label>Gabarito<select value={gabarito} onChange={(e) => setGabarito(e.target.value)}>{letras.map((letra) => <option key={letra}>{letra}</option>)}</select></label>
        <label>Comentário do gabarito<textarea value={explicacao} onChange={(e) => setExplicacao(e.target.value)} /></label>
        <label>Resposta ao denunciante (opcional)<textarea value={respostaAdmin} maxLength={1200} onChange={(e) => setRespostaAdmin(e.target.value)} /></label>

        <footer>
          <button type="button" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="button" className="publicar" onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando..." : "Salvar e republicar"}</button>
        </footer>
      </div>
    </div>
  );
}

function formatarData(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
