import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QuestaoComunidade from "../../components/QuestaoComunidade/QuestaoComunidade";
import { listarCadernosSimuladosIA, type CadernoSimuladoIA } from "../../services/cadernosSimuladosIAService";
import { carregarRevisoesCadernoIA } from "../../services/revisaoCadernoIAService";
import { numerarQuestoesRevisao, possuiCorrecaoCompleta, type TentativaRevisaoIA } from "../../utils/revisaoCadernoIA";
import { calcularDiagnosticoQuestoesIA } from "../../utils/resultadoQuestoesIA";
import "./RevisaoCadernoIA.css";

type Filtro = "todos" | "erro" | "acerto" | "branco";
const ROTULOS = { erro: "Erro", acerto: "Acerto", branco: "Em branco" };
const LETRAS = ["A", "B", "C", "D", "E"] as const;

export default function RevisaoCadernoIA() {
  const { cadernoId } = useParams();
  const [caderno, setCaderno] = useState<CadernoSimuladoIA | null>(null);
  const [tentativas, setTentativas] = useState<TentativaRevisaoIA[]>([]);
  const [tentativaId, setTentativaId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [atualizacao, setAtualizacao] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro("");
      setAviso("");
      try {
        const encontrado = (await listarCadernosSimuladosIA()).find((c) => c.id === cadernoId);
        if (!encontrado) throw new Error("Este caderno não foi encontrado na sua conta.");
        const resultado = await carregarRevisoesCadernoIA(encontrado);
        if (!ativo) return;
        setCaderno(encontrado);
        setTentativas(resultado.tentativas);
        setTentativaId(resultado.tentativas[0]?.id ?? "");
        setAviso(resultado.aviso);
        setFiltro("todos");
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível abrir a correção agora.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [cadernoId, atualizacao]);

  const tentativa = tentativas.find((t) => t.id === tentativaId);
  const completa = tentativa ? possuiCorrecaoCompleta(tentativa) : false;
  const itens = useMemo(() => tentativa && completa ? numerarQuestoesRevisao(tentativa) : [], [tentativa, completa]);
  const diagnostico = useMemo(() => tentativa && completa
    ? calcularDiagnosticoQuestoesIA(tentativa.questoes!, tentativa.respostas!) : [], [tentativa, completa]);
  const pontos = diagnostico.filter((d) => d.erradas > 0 || d.emBranco > 0);
  const visiveis = itens.filter((item) => filtro === "todos" || item.status === filtro);

  return (
    <section className="revisao-caderno">
      <Link className="revisao-caderno-voltar" to="/resolver-simulado-ia">← Meus cadernos</Link>
      <header className="revisao-caderno-cabecalho">
        <span>CORREÇÃO DO CADERNO</span>
        <h1>{caderno?.assunto ?? "Revisar respostas"}</h1>
        <p>Confira suas respostas e os comentários do gabarito. Consultar esta tela não inicia um treino nem altera sua nota.</p>
      </header>
      {carregando ? <p role="status">Carregando sua correção...</p> : erro ? (
        <div className="revisao-caderno-aviso" role="alert">
          <p>{erro}</p><button onClick={() => setAtualizacao((n) => n + 1)}>Tentar novamente</button>
        </div>
      ) : !tentativa ? (
        <div className="revisao-caderno-aviso">Nenhuma tentativa concluída foi encontrada para este caderno.</div>
      ) : <>
        {aviso && <div className="revisao-caderno-aviso" role="status">{aviso} <button onClick={() => setAtualizacao((n) => n + 1)}>Atualizar</button></div>}
        <div className="revisao-caderno-tentativa">
          {tentativas.length > 1 ? <label>
            Tentativas disponíveis
            <select value={tentativaId} onChange={(e) => { setTentativaId(e.target.value); setFiltro("todos"); }}>
              {tentativas.map((t, i) => <option key={t.id} value={t.id}>{formatarData(t.data)} · {formatarNota(t.percentual)}%{i === 0 ? " · mais recente" : ""}</option>)}
            </select>
          </label> : <p>Tentativa de <strong>{formatarData(tentativa.data)}</strong></p>}
          {tentativa.auditoria && <span className="revisao-caderno-selo">Nota revisada</span>}
        </div>
        <div className="revisao-caderno-resumo" aria-label="Resultado da tentativa">
          <div><span>Aproveitamento</span><strong>{formatarNota(tentativa.percentual)}%</strong><small>{tentativa.certas} de {tentativa.total} válidas</small></div>
          <div><span>Acertos</span><strong>{tentativa.certas}</strong></div>
          <div><span>Erros</span><strong>{tentativa.erradas}</strong></div>
          <div><span>Em branco</span><strong>{tentativa.emBranco}</strong></div>
        </div>
        {tentativa.auditoria && tentativa.auditoria.excluidas.length > 0 && (
          <details className="revisao-caderno-excluidas">
            <summary>{tentativa.auditoria.excluidas.length} questões desconsideradas na nota</summary>
            <p>Itens inválidos ou ambíguos não entram no diagnóstico de erros. A numeração abaixo mantém a ordem da tentativa original.</p>
            <ul>{tentativa.auditoria.excluidas.map((q) => <li key={q.id}><strong>Questão {q.numero}:</strong> {q.motivo}</li>)}</ul>
          </details>
        )}
        {!completa ? (
          <div className="revisao-caderno-aviso">
            <h2>Nota disponível, respostas incompletas</h2>
            <p>Esta tentativa antiga não tem detalhes suficientes para identificar com segurança cada acerto e erro. Suas próximas tentativas guardarão as alternativas marcadas e os comentários para consulta.</p>
          </div>
        ) : <>
          {tentativa.recuperada && <p className="revisao-caderno-origem">Respostas recuperadas do histórico e conferidas com a nota salva. Os comentários usam o gabarito guardado neste caderno.</p>}
          <section className="revisao-caderno-diagnostico" aria-label="Resumo dos pontos a revisar">
            <h2>O que revisar</h2>
            {pontos.length === 0 ? <p>Você acertou todas as questões válidas desta tentativa.</p> : <>
              <p>{tentativa.erradas} erro(s) e {tentativa.emBranco} questão(ões) em branco em {pontos.length} assunto(s). Consulte os comentários das questões abaixo para revisar as regras envolvidas.</p>
              <ul>{pontos.map((p) => <li key={p.chave}>
                <strong>{p.assunto}</strong>
                <span>{p.erradas} erro(s) · {p.emBranco} em branco · {p.certas}/{p.total} acertos</span>
              </li>)}</ul>
              {tentativa.erradas > 0 && <details className="revisao-caderno-erros-resumo" open>
                <summary>Resumo dos erros desta tentativa</summary>
                <ul>{itens.filter((item) => item.status === "erro").map(({ questao, numero, resposta }) => <li key={questao.id}>
                  <strong>Questão {numero} · marcou {resposta}, gabarito {questao.respostaCorreta}</strong>
                  <span>{resumirComentario(questao.explicacao)}</span>
                </li>)}</ul>
              </details>}
            </>}
          </section>
          <nav className="revisao-caderno-filtros" aria-label="Filtrar correção">
            {([
              ["todos", "Todas", tentativa.total], ["erro", "Erros", tentativa.erradas],
              ["acerto", "Acertos", tentativa.certas], ["branco", "Em branco", tentativa.emBranco],
            ] as const).map(([valor, rotulo, total]) => (
              <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{rotulo} ({total})</button>
            ))}
          </nav>
          <p className="revisao-caderno-contagem" role="status">{visiveis.length} questão(ões) neste filtro</p>
          {visiveis.length === 0 && <p>Nenhuma questão neste filtro.</p>}
          <div className="revisao-caderno-questoes">
            {visiveis.map(({ questao: q, numero, resposta, status }) => (
              <details className={`revisao-caderno-questao revisao-caderno-${status}`} key={`${tentativa.id}:${filtro}:${q.id}`} open={filtro !== "todos" || status === "erro"}>
                <summary><strong>Questão {numero}</strong><span>{q.assunto}</span><b>{ROTULOS[status]}</b></summary>
                <div className="revisao-caderno-conteudo">
                  <h3>{q.enunciado}</h3>
                  <p><strong>Sua resposta:</strong> {resposta ?? "Em branco"} · <strong>Gabarito:</strong> {q.respostaCorreta}</p>
                  <ul className="revisao-caderno-alternativas">
                    {LETRAS.filter((letra) => q.alternativas[letra]).map((letra) => <li key={letra} className={letra === q.respostaCorreta ? "correta" : letra === resposta ? "marcada" : ""}>
                      <strong>{letra}</strong><span>{q.alternativas[letra]}</span>
                      {(letra === resposta || letra === q.respostaCorreta) && <small>{letra === resposta ? "Sua resposta" : ""}{letra === resposta && letra === q.respostaCorreta ? " · " : ""}{letra === q.respostaCorreta ? "Correta" : ""}</small>}
                    </li>)}
                  </ul>
                  <div className="revisao-caderno-explicacao">
                    <h4>Comentário do gabarito</h4>
                    <p>{q.explicacao || "Este caderno não tem comentário salvo para esta questão."}</p>
                  </div>
                  <QuestaoComunidade questaoId={q.id} compacto />
                </div>
              </details>
            ))}
          </div>
        </>}
      </>}
    </section>
  );
}

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function formatarNota(nota: number) {
  return nota.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function resumirComentario(texto: string) {
  const comentario = (texto || "Consulte a alternativa correta abaixo.").replace(/\s+/g, " ").trim();
  return comentario.length <= 260 ? comentario : `${comentario.slice(0, 257).replace(/\s+\S*$/, "")}…`;
}
