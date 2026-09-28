import { Link } from "react-router-dom";
import { ArrowLeft, Database, ShieldCheck } from "lucide-react";
import "./Legal.css";

export default function PoliticaPrivacidade() {
  return (
    <main className="legal-page">
      <section className="legal-shell">
        <header className="legal-header">
          <Link to="/login" className="legal-back">
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar
          </Link>
          <div className="legal-brand">
            <img src="/assets/study-pro-logo-original-v2.jpg" alt="Study Pro" />
            <div>
              <span>PRIVACIDADE E DADOS</span>
              <h1>Política de Privacidade</h1>
              <p>Última atualização: 27 de setembro de 2026</p>
            </div>
          </div>
        </header>

        <div className="legal-highlight">
          <ShieldCheck size={22} aria-hidden="true" />
          <p>
            O Study Pro trata apenas os dados necessários para operar, proteger e melhorar a
            experiência de estudos. Dados pessoais não são vendidos a anunciantes.
          </p>
        </div>

        <article className="legal-content">
          <section>
            <h2>1. Quem trata os dados</h2>
            <p>
              O responsável pela operação do serviço Study Pro atua como controlador dos dados
              pessoais tratados para funcionamento da plataforma. Enquanto um canal comercial
              exclusivo não estiver publicado, solicitações de privacidade podem ser feitas pelos
              canais oficiais utilizados para disponibilizar e prestar suporte ao Study Pro.
            </p>
          </section>

          <section>
            <h2>2. Dados que podem ser tratados</h2>
            <ul>
              <li>
                <strong>Conta:</strong> nome, e-mail, identificador da conta, confirmação de e-mail,
                método de login e informações básicas de autenticação.
              </li>
              <li>
                <strong>Estudos:</strong> matérias, materiais, cronogramas, sessões, revisões,
                questões, respostas, resultados, simulados, metas, preferências e progresso.
              </li>
              <li>
                <strong>Segurança e operação:</strong> registros de erro, eventos técnicos,
                informações de navegador/dispositivo e dados necessários para prevenção de abuso.
              </li>
              <li>
                <strong>Interações:</strong> feedbacks, denúncias de questões e informações
                fornecidas voluntariamente pelo usuário dentro da plataforma.
              </li>
            </ul>
            <p>
              Senhas não são armazenadas em texto simples pelo Study Pro. A autenticação é realizada
              por infraestrutura especializada do Supabase Auth.
            </p>
          </section>

          <section>
            <h2>3. Para que os dados são usados</h2>
            <ul>
              <li>criar, autenticar e proteger a conta;</li>
              <li>sincronizar dados e manter o histórico de estudos;</li>
              <li>gerar estatísticas, revisões e recomendações relacionadas ao estudo;</li>
              <li>processar recursos de inteligência artificial solicitados pelo usuário;</li>
              <li>detectar falhas, abuso, tentativas indevidas e problemas de segurança;</li>
              <li>atender solicitações de suporte e melhorar o serviço;</li>
              <li>cumprir obrigações legais quando aplicável.</li>
            </ul>
          </section>

          <section>
            <h2>4. Bases legais</h2>
            <p>
              Conforme o caso, o tratamento pode ocorrer para execução do serviço solicitado pelo
              usuário, cumprimento de obrigação legal, exercício regular de direitos, legítimo
              interesse compatível com a proteção da plataforma ou consentimento quando ele for
              necessário.
            </p>
          </section>

          <section>
            <h2>5. Armazenamento no navegador</h2>
            <p>
              O Study Pro utiliza recursos como localStorage, sessionStorage e mecanismos de sessão
              para manter autenticação, preferências, estado de navegação, proteção contra falhas e
              continuidade da experiência. Esses dados permanecem no dispositivo conforme a função
              de cada recurso e podem ser removidos pelo navegador.
            </p>
          </section>

          <section>
            <h2>6. Fornecedores utilizados</h2>
            <p>
              Para operar a plataforma, dados estritamente necessários podem ser processados por
              fornecedores de tecnologia, incluindo:
            </p>
            <ul>
              <li><strong>Supabase:</strong> autenticação, banco de dados e sincronização;</li>
              <li><strong>Vercel:</strong> hospedagem e entrega do frontend;</li>
              <li><strong>Render:</strong> hospedagem de serviços de backend;</li>
              <li><strong>Sentry:</strong> monitoramento de erros e diagnóstico técnico;</li>
              <li>
                <strong>Google:</strong> autenticação quando o usuário escolhe entrar com Google e
                processamento de recursos de inteligência artificial quando esses recursos são acionados.
              </li>
            </ul>
            <p>
              Esses fornecedores possuem suas próprias práticas de segurança e privacidade e podem
              processar dados em infraestrutura localizada fora do Brasil, observadas as garantias
              contratuais e legais aplicáveis.
            </p>
          </section>

          <section>
            <h2>7. Recursos de inteligência artificial</h2>
            <p>
              Quando o usuário solicita geração ou análise por inteligência artificial, o conteúdo
              necessário ao pedido — por exemplo matéria, assunto, banca, dificuldade, material ou
              contexto escolhido para a tarefa — pode ser enviado ao provedor de IA para produzir a
              resposta. O Study Pro procura limitar esse envio ao que é necessário para executar a
              funcionalidade solicitada.
            </p>
          </section>

          <section>
            <h2>8. Compartilhamento</h2>
            <p>
              O Study Pro não vende dados pessoais. Informações podem ser compartilhadas com
              fornecedores necessários à operação, com autoridades quando houver obrigação legal ou
              em situações necessárias para proteger direitos, segurança e integridade do serviço.
            </p>
          </section>

          <section>
            <h2>9. Retenção e exclusão</h2>
            <p>
              Os dados são mantidos pelo período necessário à prestação do serviço, segurança,
              prevenção de fraude, continuidade do histórico e cumprimento de obrigações aplicáveis.
              Quando cabível, o usuário pode solicitar correção ou exclusão de dados, ressalvadas
              hipóteses de retenção permitidas ou exigidas por lei.
            </p>
          </section>

          <section>
            <h2>10. Direitos do titular</h2>
            <p>Nos termos da LGPD, o titular pode solicitar, conforme aplicável:</p>
            <ul>
              <li>confirmação da existência de tratamento e acesso aos dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação nas hipóteses legais;</li>
              <li>informações sobre compartilhamento;</li>
              <li>portabilidade quando regulamentada e tecnicamente aplicável;</li>
              <li>revogação de consentimento quando essa for a base do tratamento.</li>
            </ul>
          </section>

          <section>
            <h2>11. Segurança</h2>
            <p>
              O Study Pro utiliza autenticação, criptografia em trânsito, controles de acesso,
              políticas de segurança em nível de banco de dados, monitoramento de erros, limitação
              de tentativas de login e revisões automatizadas de segurança. Nenhum sistema é
              invulnerável, por isso medidas podem ser atualizadas continuamente.
            </p>
          </section>

          <section>
            <h2>12. Crianças e adolescentes</h2>
            <p>
              O serviço é voltado a estudos e preparação para provas. Caso o usuário seja menor de
              idade, o uso deve observar a legislação aplicável e, quando necessário, ocorrer com
              ciência ou assistência do responsável legal.
            </p>
          </section>

          <section>
            <h2>13. Alterações e contato</h2>
            <p>
              Esta Política pode ser atualizada quando houver mudança relevante no serviço ou no
              tratamento de dados. A versão vigente ficará disponível nesta página. Dúvidas e
              solicitações podem ser encaminhadas pelos canais oficiais de atendimento do Study Pro.
            </p>
            <p className="legal-note">
              Um canal exclusivo de privacidade e os dados comerciais formais do responsável serão
              publicados antes da abertura de cobranças ao público.
            </p>
          </section>
        </article>

        <footer className="legal-footer">
          <Database size={17} aria-hidden="true" />
          <span>Study Pro · Política de Privacidade</span>
          <Link to="/termos">Termos de Uso</Link>
        </footer>
      </section>
    </main>
  );
}
