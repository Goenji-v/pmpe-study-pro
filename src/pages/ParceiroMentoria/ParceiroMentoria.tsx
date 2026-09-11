import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { carregarGestaoParceiro, type TurmaParceiro } from "../../services/parceriasService";
import {
  listarTrilhasMentoriaDoParceiro,
  salvarTrilhaMentoria,
  type EntradaItemTrilhaMentoria,
  type TipoItemTrilhaMentoria,
  type TrilhaMentoria,
} from "../../services/mentoriaService";
import "./ParceiroMentoria.css";

type ItemForm = EntradaItemTrilhaMentoria & {
  minutosEstimados: number;
  questoesAlvo: number;
  prioridade: number;
  obrigatorio: boolean;
  tipo: TipoItemTrilhaMentoria;
};

type FormTrilha = {
  turmaId: string;
  nome: string;
  minutosPadrao: number;
  materiasPorDia: number;
  questoesPorSessao: number;
  revisoesPorDia: number;
  intervalosRevisao: string;
  simuladoCadaDias: string;
  percentualTeoria: number;
  itens: ItemForm[];
};

function itemVazio(): ItemForm {
  return {
    materia: "",
    assunto: "",
    minutosEstimados: 60,
    questoesAlvo: 20,
    prioridade: 50,
    obrigatorio: true,
    tipo: "misto",
    instrucoes: null,
    materialUrl: null,
  };
}

const FORM_INICIAL: FormTrilha = {
  turmaId: "",
  nome: "Trilha principal",
  minutosPadrao: 60,
  materiasPorDia: 1,
  questoesPorSessao: 20,
  revisoesPorDia: 10,
  intervalosRevisao: "1, 7, 30",
  simuladoCadaDias: "",
  percentualTeoria: 67,
  itens: [itemVazio()],
};

export default function ParceiroMentoria() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const [turmas, setTurmas] = useState<TurmaParceiro[]>([]);
  const [trilhas, setTrilhas] = useState<TrilhaMentoria[]>([]);
  const [form, setForm] = useState<FormTrilha>(FORM_INICIAL);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const podeGerenciar =
    contexto?.papel === "proprietario" ||
    contexto?.papel === "gestor" ||
    contexto?.papel === "professor";

  const trilhaDaTurma = useMemo(
    () => trilhas.find((item) => item.turmaId === form.turmaId) ?? null,
    [trilhas, form.turmaId]
  );

  useEffect(() => {
    if (!podeGerenciar) {
      setCarregando(false);
      return;
    }
    void carregar();
  }, [podeGerenciar]);

  useEffect(() => {
    if (!form.turmaId) return;
    const existente = trilhas.find((item) => item.turmaId === form.turmaId);
    if (!existente) {
      setForm((anterior) => ({ ...FORM_INICIAL, turmaId: anterior.turmaId }));
      return;
    }

    setForm({
      turmaId: existente.turmaId,
      nome: existente.nome,
      minutosPadrao: existente.minutosPadrao,
      materiasPorDia: existente.materiasPorDia,
      questoesPorSessao: existente.questoesPorSessao,
      revisoesPorDia: existente.revisoesPorDia,
      intervalosRevisao: existente.intervalosRevisao.join(", "),
      simuladoCadaDias: existente.simuladoCadaDias ? String(existente.simuladoCadaDias) : "",
      percentualTeoria: existente.percentualTeoria,
      itens: existente.itens.length
        ? existente.itens.map((item) => ({
            id: item.id,
            materia: item.materia,
            assunto: item.assunto,
            minutosEstimados: item.minutosEstimados,
            questoesAlvo: item.questoesAlvo,
            prioridade: item.prioridade,
            obrigatorio: item.obrigatorio,
            tipo: item.tipo,
            instrucoes: item.instrucoes,
            materialUrl: item.materialUrl,
          }))
        : [itemVazio()],
    });
  }, [form.turmaId, trilhas]);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const [gestao, trilhasAtuais] = await Promise.all([
        carregarGestaoParceiro(),
        listarTrilhasMentoriaDoParceiro(),
      ]);
      const turmasAtivas = gestao.turmas.filter((turma) => turma.ativa);
      setTurmas(turmasAtivas);
      setTrilhas(trilhasAtuais);
      setForm((anterior) => ({
        ...anterior,
        turmaId: anterior.turmaId || turmasAtivas[0]?.id || "",
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a mentoria.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizarItem<K extends keyof ItemForm>(indice: number, campo: K, valor: ItemForm[K]) {
    setForm((anterior) => ({
      ...anterior,
      itens: anterior.itens.map((item, atual) => atual === indice ? { ...item, [campo]: valor } : item),
    }));
  }

  function adicionarItem() {
    setForm((anterior) => ({
      ...anterior,
      itens: [...anterior.itens, { ...itemVazio(), questoesAlvo: anterior.questoesPorSessao }],
    }));
  }

  function removerItem(indice: number) {
    setForm((anterior) => ({
      ...anterior,
      itens: anterior.itens.length === 1 ? [itemVazio()] : anterior.itens.filter((_, atual) => atual !== indice),
    }));
  }

  function moverItem(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= form.itens.length) return;
    setForm((anterior) => {
      const itens = [...anterior.itens];
      [itens[indice], itens[destino]] = [itens[destino], itens[indice]];
      return { ...anterior, itens };
    });
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!contexto?.parceiroId) return;

    const intervalos = form.intervalosRevisao
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0 && item <= 365)
      .slice(0, 8);

    if (intervalos.length === 0) {
      setErro("Informe pelo menos um intervalo de revisão, por exemplo: 1, 7, 30.");
      return;
    }

    try {
      setSalvando(true);
      setErro("");
      setMensagem("");
      await salvarTrilhaMentoria({
        parceiroId: contexto.parceiroId,
        turmaId: form.turmaId,
        nome: form.nome,
        minutosPadrao: form.minutosPadrao,
        materiasPorDia: form.materiasPorDia,
        questoesPorSessao: form.questoesPorSessao,
        revisoesPorDia: form.revisoesPorDia,
        intervalosRevisao: intervalos,
        simuladoCadaDias: form.simuladoCadaDias ? Number(form.simuladoCadaDias) : null,
        percentualTeoria: form.percentualTeoria,
        itens: form.itens,
      });
      setMensagem("Trilha salva com histórico preservado. O motor de cronograma já pode distribuir esses conteúdos para os alunos da turma.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a trilha.");
    } finally {
      setSalvando(false);
    }
  }

  if (verificando) return <div className="mentoria-estado">Verificando perfil do professor...</div>;
  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="mentoria-pagina">
      <header className="mentoria-cabecalho">
        <div>
          <span>MENTORIA</span>
          <h1>Trilha de estudos da turma</h1>
          <p>Defina o conteúdo e as regras pedagógicas. O sistema cruza esta trilha com a disponibilidade de cada aluno e gera o cronograma automaticamente.</p>
        </div>
        <Link to="/parceiro">Voltar à área do professor</Link>
      </header>

      {erro && <div className="mentoria-alerta erro">{erro}</div>}
      {mensagem && <div className="mentoria-alerta sucesso">{mensagem}</div>}

      {carregando ? <div className="mentoria-estado">Carregando trilhas...</div> : turmas.length === 0 ? (
        <div className="mentoria-estado">Crie uma turma antes de configurar a trilha da mentoria.</div>
      ) : (
        <div className="mentoria-grid">
          <form className="mentoria-card" onSubmit={salvar}>
            <div className="mentoria-card-topo">
              <div><span>CONFIGURAÇÃO DA TURMA</span><h2>{trilhaDaTurma ? "Editar trilha" : "Nova trilha"}</h2></div>
              <b>{trilhaDaTurma ? `${trilhaDaTurma.alunos ?? 0} aluno(s)` : "Nova"}</b>
            </div>

            <div className="mentoria-campos">
              <label>Turma<select value={form.turmaId} onChange={(e) => setForm((a) => ({ ...a, turmaId: e.target.value }))} required>{turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}</select></label>
              <label>Nome da trilha<input value={form.nome} onChange={(e) => setForm((a) => ({ ...a, nome: e.target.value }))} placeholder="Ex.: Rota PMPE 2027" required /></label>
              <label>Tempo de referência/dia<input type="number" min={20} max={600} value={form.minutosPadrao} onChange={(e) => setForm((a) => ({ ...a, minutosPadrao: Number(e.target.value) }))} /><small>Serve como padrão; a disponibilidade do aluno prevalece.</small></label>
              <label>Matérias principais/dia<input type="number" min={1} max={4} value={form.materiasPorDia} onChange={(e) => setForm((a) => ({ ...a, materiasPorDia: Number(e.target.value) }))} /></label>
              <label>Questões por sessão<input type="number" min={0} max={100} value={form.questoesPorSessao} onChange={(e) => setForm((a) => ({ ...a, questoesPorSessao: Number(e.target.value) }))} /></label>
              <label>Revisões por dia<input type="number" min={0} max={50} value={form.revisoesPorDia} onChange={(e) => setForm((a) => ({ ...a, revisoesPorDia: Number(e.target.value) }))} /></label>
              <label>Revisões após (dias)<input value={form.intervalosRevisao} onChange={(e) => setForm((a) => ({ ...a, intervalosRevisao: e.target.value }))} placeholder="1, 7, 30" /><small>Ao concluir um conteúdo, as revisões são criadas automaticamente.</small></label>
              <label>Simulado a cada N dias<input type="number" min={1} max={365} value={form.simuladoCadaDias} onChange={(e) => setForm((a) => ({ ...a, simuladoCadaDias: e.target.value }))} placeholder="Opcional" /></label>
              <label>Percentual inicial de teoria<input type="number" min={0} max={100} value={form.percentualTeoria} onChange={(e) => setForm((a) => ({ ...a, percentualTeoria: Number(e.target.value) }))} /><small>Ex.: 67% teoria e 33% questões em tarefas mistas.</small></label>
            </div>

            <div className="mentoria-assuntos-topo">
              <div><span>ORDEM DE ESTUDO</span><h3>Matérias e assuntos</h3><p>Os IDs dos conteúdos são preservados ao editar, então progresso e reforços antigos continuam válidos.</p></div>
              <button type="button" onClick={adicionarItem}>+ Adicionar assunto</button>
            </div>

            <div className="mentoria-itens">
              {form.itens.map((item, indice) => (
                <article className="mentoria-item mentoria-item-avancado" key={item.id ?? `novo-${indice}`}>
                  <div className="mentoria-item-linha-principal">
                    <span className="mentoria-ordem">{indice + 1}</span>
                    <input value={item.materia} onChange={(e) => atualizarItem(indice, "materia", e.target.value)} placeholder="Matéria — ex.: Português" aria-label={`Matéria ${indice + 1}`} />
                    <input value={item.assunto} onChange={(e) => atualizarItem(indice, "assunto", e.target.value)} placeholder="Assunto — ex.: Morfologia" aria-label={`Assunto ${indice + 1}`} />
                    <div className="mentoria-item-acoes">
                      <button type="button" onClick={() => moverItem(indice, -1)} disabled={indice === 0} aria-label="Mover para cima">↑</button>
                      <button type="button" onClick={() => moverItem(indice, 1)} disabled={indice === form.itens.length - 1} aria-label="Mover para baixo">↓</button>
                      <button type="button" className="perigo" onClick={() => removerItem(indice)} aria-label="Remover assunto">×</button>
                    </div>
                  </div>
                  <div className="mentoria-item-detalhes">
                    <label>Tipo<select value={item.tipo} onChange={(e) => atualizarItem(indice, "tipo", e.target.value as TipoItemTrilhaMentoria)}><option value="misto">Teoria + questões</option><option value="teoria">Teoria</option><option value="questoes">Questões</option></select></label>
                    <label>Minutos<input type="number" min={5} max={600} value={item.minutosEstimados} onChange={(e) => atualizarItem(indice, "minutosEstimados", Number(e.target.value))} /></label>
                    <label>Questões<input type="number" min={0} max={200} value={item.questoesAlvo} onChange={(e) => atualizarItem(indice, "questoesAlvo", Number(e.target.value))} /></label>
                    <label>Prioridade<input type="number" min={1} max={100} value={item.prioridade} onChange={(e) => atualizarItem(indice, "prioridade", Number(e.target.value))} /></label>
                    <label className="mentoria-check"><input type="checkbox" checked={item.obrigatorio} onChange={(e) => atualizarItem(indice, "obrigatorio", e.target.checked)} /> Obrigatório</label>
                    <label className="mentoria-detalhe-largo">Orientação ao aluno<input value={item.instrucoes ?? ""} onChange={(e) => atualizarItem(indice, "instrucoes", e.target.value)} placeholder="Ex.: foque classes de palavras antes das questões" /></label>
                    <label className="mentoria-detalhe-largo">Material opcional<input value={item.materialUrl ?? ""} onChange={(e) => atualizarItem(indice, "materialUrl", e.target.value)} placeholder="https://..." /></label>
                  </div>
                </article>
              ))}
            </div>

            <footer className="mentoria-rodape">
              <div><strong>{form.itens.filter((item) => item.materia.trim() && item.assunto.trim()).length} assuntos configurados</strong><small>Alterações futuras podem recalcular os próximos dias sem apagar atividades já concluídas.</small></div>
              <button className="principal" disabled={salvando}>{salvando ? "Salvando..." : trilhaDaTurma ? "Salvar alterações" : "Criar trilha"}</button>
            </footer>
          </form>

          <aside className="mentoria-resumo">
            <span>COMO FUNCIONA</span><h2>Mentor define. Sistema distribui.</h2>
            <div><b>1</b><p><strong>Você define o conteúdo.</strong> Ordem, tempo, questões e prioridade.</p></div>
            <div><b>2</b><p><strong>O aluno define a rotina.</strong> Dias e minutos disponíveis são individuais.</p></div>
            <div><b>3</b><p><strong>O motor monta o dia.</strong> Prioriza revisão vencida, reforço, simulado e depois a trilha.</p></div>
            <div><b>4</b><p><strong>O histórico fica preservado.</strong> Recalcular reagenda o futuro, não apaga o que já foi feito.</p></div>
          </aside>
        </div>
      )}
    </section>
  );
}
