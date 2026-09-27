import { Link } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import "./Legal.css";

export default function TermosUso() {
  return (
    <main className="legal-page">
      <section className="legal-shell">
        <header className="legal-header">
          <Link to="/login" className="legal-back">
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar
          </Link>
          <div className="legal-brand">
            <img src="/assets/study-pro-logo-official.jpg?v=1" alt="Study Pro" />
            <div>
              <span>DOCUMENTO LEGAL</span>
              <h1>Termos de Uso</h1>
              <p>Última atualização: 27 de setembro de 2026</p>
            </div>
          </div>
        </header>

        <div className="legal-highlight">
          <ShieldCheck size={22} aria-hidden="true" />
          <p>
            Estes termos regulam o uso do Study Pro. O serviço é uma ferramenta de apoio à
            organização dos estudos e não garante aprovação em concurso, prova ou processo seletivo.
          </p>
        </div>

        <article className="legal-content">
          <section>
            <h2>1. Sobre o Study Pro</h2>
            <p>
              O Study Pro oferece recursos de planejamento, cronograma, registro de estudos,
              questões, simulados, revisões, materiais, estatísticas e recursos de inteligência
              artificial para apoiar a preparação do usuário.
            </p>
          </section>

          <section>
            <h2>2. Conta e acesso</h2>
            <p>
              Para utilizar áreas protegidas, o usuário deve criar uma conta ou usar um método de
              autenticação disponível. O usuário deve fornecer informações corretas, manter suas
              credenciais sob sigilo e comunicar qualquer suspeita de acesso indevido.
            </p>
            <p>
              O Study Pro pode bloquear temporariamente tentativas repetidas de login e adotar
              outras medidas de segurança para proteger contas e dados.
            </p>
          </section>

          <section>
            <h2>3. Uso permitido</h2>
            <p>Ao utilizar o Study Pro, o usuário se compromete a não:</p>
            <ul>
              <li>tentar acessar dados ou contas de terceiros;</li>
              <li>contornar controles de acesso, limites técnicos ou mecanismos de segurança;</li>
              <li>usar automações abusivas, extração em massa ou ações que prejudiquem o serviço;</li>
              <li>inserir conteúdo ilícito ou que viole direitos de terceiros;</li>
              <li>usar a plataforma para distribuir malware, fraude ou atividades não autorizadas.</li>
            </ul>
          </section>

          <section>
            <h2>4. Conteúdo educacional e inteligência artificial</h2>
            <p>
              Questões, resumos, explicações e outros conteúdos, inclusive os gerados ou auxiliados
              por inteligência artificial, podem conter imprecisões. O usuário deve conferir
              informações importantes no edital, legislação, material oficial ou fonte confiável
              correspondente.
            </p>
            <p>
              O Study Pro pode corrigir, atualizar, suspender ou anular conteúdos quando identificar
              erro, inconsistência ou necessidade de revisão.
            </p>
          </section>

          <section>
            <h2>5. Dados e sincronização</h2>
            <p>
              O funcionamento do serviço pode envolver armazenamento local no dispositivo e
              sincronização com serviços de nuvem. A forma de tratamento dos dados pessoais está
              detalhada na <Link to="/privacidade">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2>6. Disponibilidade, manutenção e cópias de segurança</h2>
            <p>
              O Study Pro busca manter o serviço disponível e seguro, mas podem ocorrer
              indisponibilidades temporárias por manutenção, falhas de terceiros, atualização,
              segurança ou eventos fora do controle razoável da aplicação.
            </p>
            <p>
              Recursos de sincronização e backup reduzem o risco de perda, mas o usuário deve manter
              cópia própria de materiais pessoais importantes quando isso for aplicável.
            </p>
          </section>

          <section>
            <h2>7. Planos, pagamentos e recursos pagos</h2>
            <p>
              Neste momento, estes Termos não autorizam qualquer cobrança automática. Quando o
              Study Pro disponibilizar plano pago, assinatura, compra ou renovação, preço,
              periodicidade, condições de cancelamento e meio de pagamento deverão ser apresentados
              antes da confirmação da contratação.
            </p>
          </section>

          <section>
            <h2>8. Suspensão ou encerramento de acesso</h2>
            <p>
              O acesso poderá ser limitado ou suspenso em caso de risco de segurança, abuso,
              violação destes Termos, tentativa de acesso indevido ou obrigação legal. Quando
              possível, a medida será proporcional ao problema identificado.
            </p>
          </section>

          <section>
            <h2>9. Serviços de terceiros</h2>
            <p>
              O Study Pro utiliza fornecedores de infraestrutura, autenticação, hospedagem,
              monitoramento e serviços relacionados. O uso de recursos externos, como login com
              Google, também pode estar sujeito aos termos do respectivo fornecedor.
            </p>
          </section>

          <section>
            <h2>10. Alterações destes Termos</h2>
            <p>
              Estes Termos podem ser atualizados para refletir mudanças no serviço, na segurança ou
              em requisitos legais. Alterações relevantes deverão ser comunicadas de forma adequada
              dentro da aplicação ou pelos canais oficiais do Study Pro.
            </p>
          </section>

          <section>
            <h2>11. Lei aplicável e contato</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Solicitações,
              dúvidas ou questões relacionadas ao serviço podem ser encaminhadas pelos canais
              oficiais usados pelo Study Pro para atendimento e comunicação com seus usuários.
            </p>
            <p className="legal-note">
              Dados comerciais formais do responsável e um canal exclusivo de suporte serão
              adicionados antes da abertura de cobranças ao público.
            </p>
          </section>
        </article>

        <footer className="legal-footer">
          <FileText size={17} aria-hidden="true" />
          <span>Study Pro · Termos de Uso</span>
          <Link to="/privacidade">Política de Privacidade</Link>
        </footer>
      </section>
    </main>
  );
}
