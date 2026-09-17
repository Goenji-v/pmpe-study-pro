import { Cloud, LockKeyhole, TrendingUp } from "lucide-react";

export default function AuthHero() {
  return (
    <section className="auth-apresentacao" aria-label="Studio Pro: preparação que aprova">
      <div className="auth-hero-grid" aria-hidden="true" />
      <div className="auth-hero-halo" aria-hidden="true" />

      <div className="auth-agente" aria-hidden="true">
        <svg viewBox="0 0 430 760" role="img" focusable="false">
          <defs>
            <linearGradient id="agenteCor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2f7fcb" stopOpacity="0.92" />
              <stop offset="0.55" stopColor="#154a83" stopOpacity="0.88" />
              <stop offset="1" stopColor="#071d35" stopOpacity="0.96" />
            </linearGradient>
            <linearGradient id="coleteCor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#183c63" />
              <stop offset="1" stopColor="#08182a" />
            </linearGradient>
            <radialGradient id="capaceteBrilho" cx="42%" cy="28%" r="70%">
              <stop offset="0" stopColor="#7bbcff" stopOpacity="0.5" />
              <stop offset="1" stopColor="#0a2038" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="220" cy="150" rx="112" ry="110" fill="url(#capaceteBrilho)" />
          <path d="M116 164c7-72 49-119 106-119s102 47 109 119l-26 18H142z" fill="#0c2743" />
          <path d="M137 142c14-48 47-75 86-75 45 0 80 31 91 84l-28-11c-37-14-87-16-149 2z" fill="#173e67" />
          <path d="M151 160c20-18 47-27 73-27 28 0 57 11 78 31l-11 63c-10 42-35 66-66 66-34 0-59-27-68-69z" fill="#18314b" />
          <path d="M167 183c21-14 45-20 70-18 20 1 40 8 56 19l-6 27c-18-8-40-12-64-12-19 0-37 3-55 9z" fill="#07131f" />
          <path d="M151 206h145l-7 23c-42-15-85-16-132-1z" fill="#0c1a29" />

          <path d="M79 730c7-167 21-288 54-355 17-35 50-56 91-58 49-2 88 21 107 60 34 70 47 190 54 353z" fill="url(#agenteCor)" />
          <path d="M133 387c29-26 62-38 96-38 39 0 75 14 104 44l-18 318H145z" fill="url(#coleteCor)" />
          <path d="M153 411h143l-4 77H157z" fill="#0f2945" stroke="#2c5f91" strokeWidth="2" />
          <text x="224.5" y="461" textAnchor="middle" fill="#d9edff" fontSize="31" fontWeight="900" letterSpacing="4">PMPE</text>
          <path d="M151 505h65v75h-61zM234 505h64l4 75h-68z" fill="#0b2138" stroke="#244f77" strokeWidth="2" />
          <path d="M162 596h130v78H158z" fill="#0a1c30" stroke="#244f77" strokeWidth="2" />
          <path d="M132 391l-37 42 24 235 34 43 12-314zM316 395l35 45-15 229-32 42-12-315z" fill="#102d4a" />
          <path d="M120 370l43 30M326 373l-38 29" stroke="#5b98d0" strokeOpacity="0.45" strokeWidth="6" />
          <path d="M114 695h237" stroke="#2a5c88" strokeWidth="2" strokeDasharray="7 10" />
        </svg>
      </div>

      <div className="auth-hero-conteudo">
        <header className="auth-brand">
          <div className="auth-brand-selo" aria-hidden="true">SP</div>
          <div>
            <strong>STUDIO PRO</strong>
            <span>PMPE • Preparação tática</span>
          </div>
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
