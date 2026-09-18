import { Cloud, LockKeyhole, TrendingUp } from "lucide-react";

import "./AuthHero.css";

export default function AuthHero() {
  return (
    <section className="auth-apresentacao" aria-label="Studio Pro: preparação que aprova">
      <img
        className="auth-hero-fundo"
        src="/assets/auth-pmpe-background.webp"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="auth-hero-overlay" aria-hidden="true" />
      <div className="auth-hero-grid" aria-hidden="true" />

      <div className="auth-hero-conteudo">
        <header className="auth-brand">
          <img
            className="auth-brand-logo auth-brand-logo-completa"
            src="/assets/studio-pro-logo.svg"
            alt="Studio Pro"
          />
        </header>

        <div className="auth-hero-kicker">
          <span aria-hidden="true" />
          ESTUDO SINCRONIZADO
        </div>

        <h1>
          Seus dados <em>disponíveis</em> no computador e no celular.
        </h1>

        <p>
          Entre na sua conta para acessar estudos, sessões, questões, revisões,
          simulados e materiais em qualquer lugar.
        </p>

        <div className="auth-hero-recursos">
          <article>
            <div className="auth-hero-recurso-icone"><Cloud size={22} /></div>
            <div>
              <strong>Sincronização</strong>
              <span>Seus dados atualizados em todos os dispositivos.</span>
            </div>
          </article>
          <article>
            <div className="auth-hero-recurso-icone"><LockKeyhole size={22} /></div>
            <div>
              <strong>Segurança</strong>
              <span>Cada conta acessa somente os próprios registros.</span>
            </div>
          </article>
          <article>
            <div className="auth-hero-recurso-icone"><TrendingUp size={22} /></div>
            <div>
              <strong>Seu progresso</strong>
              <span>Acompanhe sua evolução e mantenha o foco.</span>
            </div>
          </article>
        </div>

        <footer>DISCIPLINA HOJE. EVOLUÇÃO TODOS OS DIAS.</footer>
      </div>
    </section>
  );
}
