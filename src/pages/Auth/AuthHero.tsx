import "./AuthHero.css";

export default function AuthHero() {
  return (
    <section className="auth-apresentacao" aria-label="Study Pro: disciplina e foco">
      <img
        className="auth-hero-fundo"
        src="/assets/auth-pmpe-background.webp"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="auth-hero-overlay" aria-hidden="true" />

      <div className="auth-hero-conteudo">
        <div className="auth-hero-mensagem">
          <span className="auth-hero-linha" aria-hidden="true" />
          <h1>
            DISCIPLINA
            <br />
            HOJE,
            <br />
            <strong>RESULTADOS</strong>
            <br />
            SEMPRE.
          </h1>
          <p>Seu futuro começa com foco.</p>
        </div>

        <footer>PMPE&nbsp;&nbsp;|&nbsp;&nbsp;HONRA&nbsp;&nbsp;|&nbsp;&nbsp;FOCO&nbsp;&nbsp;|&nbsp;&nbsp;APROVAÇÃO</footer>
      </div>
    </section>
  );
}
