import { useMemo, useState } from "react";
import "./PreviewIdeias.css";

type Aba = "dashboard" | "flashcards" | "simulado";

const dias = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const assuntos = [
  { nome: "Crase", nivel: "Difícil", quando: "Hoje", cor: "danger" },
  { nome: "Conectivos", nivel: "Médio", quando: "Amanhã", cor: "warning" },
  { nome: "Direitos Humanos", nivel: "Fácil", quando: "Em 6 dias", cor: "success" },
];

export default function PreviewIdeias() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const [virado, setVirado] = useState(false);
  const [avaliacao, setAvaliacao] = useState("Médio");
  const intervalo = useMemo(() => {
    if (avaliacao === "Difícil") return "amanhã";
    if (avaliacao === "Fácil") return "em 7 dias";
    return "em 3 dias";
  }, [avaliacao]);

  return (
    <main className="preview-ideias-page">
      <header className="preview-topbar">
        <div className="preview-brand">
          <span className="preview-logo">SP</span>
          <div>
            <strong>STUDY PRO</strong>
            <small>PRÉVIA VISUAL DAS NOVAS IDEIAS</small>
          </div>
        </div>
        <span className="preview-badge">NÃO PUBLICADO</span>
      </header>

      <section className="preview-shell">
        <aside className="preview-sidebar">
          <button className={aba === "dashboard" ? "active" : ""} onClick={() => setAba("dashboard")}>▣ Dashboard</button>
          <button className={aba === "flashcards" ? "active" : ""} onClick={() => setAba("flashcards")}>◫ Flashcards SRS</button>
          <button className={aba === "simulado" ? "active" : ""} onClick={() => setAba("simulado")}>◎ Simulado</button>
          <div className="preview-side-note">
            <b>Objetivo</b>
            <span>Mostrar como as ideias ficariam visualmente antes de mexer no site oficial.</span>
          </div>
        </aside>

        <section className="preview-content">
          <div className="preview-heading">
            <div>
              <span className="eyebrow">LABORATÓRIO STUDY PRO</span>
              <h1>Prévia das ideias novas</h1>
              <p>Uma versão visual para decidir o que realmente merece entrar no site.</p>
            </div>
            <div className="preview-status">
              <span className="dot" />
              Prévia online
            </div>
          </div>

          {aba === "dashboard" && (
            <>
              <section className="preview-grid hero-grid">
                <article className="preview-card hero-card">
                  <span className="eyebrow gold">MISSÃO DE HOJE</span>
                  <h2>Informática — Internet, Intranet, Extranet e VPN</h2>
                  <div className="progress"><i style={{ width: "42%" }} /></div>
                  <div className="hero-meta">
                    <span>42% da missão</span><span>12 questões</span><span>2 revisões</span>
                  </div>
                  <div className="actions"><button className="primary">▶ Continuar estudo</button><button>Ver conteúdo</button></div>
                </article>

                <article className="preview-card ai-card">
                  <div className="card-title-row"><span className="icon">✦</span><div><small>IA RESILIENTE</small><h3>Geração protegida</h3></div></div>
                  <div className="pipeline">
                    <span className="done">Gerando</span><b>→</b><span className="done">Revisando</span><b>→</b><span className="active">Salvando</span>
                  </div>
                  <p>Se a internet cair, o processo continua no servidor e retoma sem duplicar a execução.</p>
                  <div className="mini-status success">✓ Job protegido contra execução duplicada</div>
                </article>
              </section>

              <section className="preview-grid feature-grid">
                <article className="preview-card srs-card">
                  <div className="card-title-row"><span className="icon">🧠</span><div><small>REVISÃO INTELIGENTE</small><h3>Flashcards SRS</h3></div><b className="metric">5</b></div>
                  <p>Cartões vencidos aparecem primeiro. O intervalo muda conforme sua dificuldade.</p>
                  <div className="srs-list">
                    {assuntos.map((item) => <div key={item.nome}><span className={"level-dot "+item.cor} /><b>{item.nome}</b><small>{item.nivel}</small><strong>{item.quando}</strong></div>)}
                  </div>
                </article>

                <article className="preview-card offline-card">
                  <div className="card-title-row"><span className="icon">📶</span><div><small>MODO OFFLINE</small><h3>Estude sem perder respostas</h3></div></div>
                  <div className="offline-state"><span>Sem internet</span><b>3 ações salvas</b></div>
                  <div className="offline-arrow">↓</div>
                  <div className="offline-state online"><span>Internet voltou</span><b>Sincronização automática</b></div>
                  <div className="mini-status">IndexedDB → Supabase</div>
                </article>

                <article className="preview-card streak-card">
                  <div className="card-title-row"><span className="icon">🔥</span><div><small>CONSTÂNCIA</small><h3>7 dias seguidos</h3></div><b className="record">Recorde 13</b></div>
                  <div className="week">
                    {dias.map((dia, i) => <div key={dia}><small>{dia}</small><span className={i < 5 ? "checked" : i === 5 ? "today" : ""}>{i < 5 ? "✓" : i === 5 ? "•" : ""}</span></div>)}
                  </div>
                  <p>Conta estudo, questões, revisão ou simulado feito no dia.</p>
                </article>
              </section>

              <section className="preview-card decision-card">
                <div><span className="eyebrow">COMO EU COLOCARIA NO SITE</span><h3>Sem criar módulos duplicados</h3></div>
                <div className="decision-pills"><span>✓ SRS nos flashcards atuais</span><span>✓ Offline nas respostas</span><span>✓ Streak visível</span><span>✓ IA mais confiável</span><span className="muted">✕ outro banco de questões</span><span className="muted">✕ outro sistema de login</span></div>
              </section>
            </>
          )}

          {aba === "flashcards" && (
            <section className="flash-preview">
              <div className="flash-top">
                <div><span className="eyebrow gold">FLASHCARDS SRS</span><h2>Conectivos — Questão 04/20</h2></div>
                <div className="review-pill">5 revisões para hoje</div>
              </div>
              <div className={"flash-card "+(virado ? "flipped" : "")} onClick={() => setVirado(v => !v)}>
                {!virado ? (
                  <div><small>PERGUNTA</small><h3>Qual conectivo representa uma conjunção lógica?</h3><p>Clique no cartão para virar</p></div>
                ) : (
                  <div><small>RESPOSTA</small><h3>“E” representa a conjunção.</h3><p>Ela só é verdadeira quando as duas proposições forem verdadeiras.</p></div>
                )}
              </div>
              <div className="rating-grid">
                {["Difícil","Médio","Fácil"].map((nome) => <button key={nome} className={avaliacao===nome ? "selected" : ""} onClick={() => setAvaliacao(nome)}>{nome}<small>{nome==="Difícil"?"1 dia":nome==="Médio"?"3 dias":"7 dias"}</small></button>)}
              </div>
              <div className="next-review">Próxima revisão: <strong>{intervalo}</strong></div>
            </section>
          )}

          {aba === "simulado" && (
            <section className="simulado-preview">
              <div className="simulado-top">
                <div><span className="eyebrow gold">SIMULADO</span><h2>PMPE — Treino rápido AOCP</h2></div>
                <div className="timer">18:42</div>
              </div>
              <div className="simulado-body">
                <aside className="question-map">
                  {Array.from({length:20},(_,i)=>i+1).map(n=><span key={n} className={n<7?"answered":n===7?"current":""}>{n}</span>)}
                </aside>
                <article className="question-card">
                  <small>QUESTÃO 07 DE 20 · DIREITOS HUMANOS</small>
                  <h3>Assinale a alternativa correta de acordo com a Declaração Universal dos Direitos Humanos.</h3>
                  {["Alternativa A","Alternativa B","Alternativa C","Alternativa D","Alternativa E"].map((a,i)=><button key={a} className={i===2?"marked":""}><b>{String.fromCharCode(65+i)}</b>{a}</button>)}
                </article>
              </div>
              <div className="simulado-footer"><span>6 respondidas · 14 pendentes</span><button className="primary">Próxima questão →</button></div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
