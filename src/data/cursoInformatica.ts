import type { AulaAssunto } from "../types/index";

export const CURSO_INFORMATICA_NOME = "Informática";
export const SEGURANCA_INFORMACAO_ASSUNTO = "Segurança da informação (PDF)";

/**
 * Grade real do bloco "Conceitos de proteção e segurança" do curso de
 * Informática. O link legado disponível no plano é preservado na primeira
 * aula; as demais continuam navegáveis no Study Pro mesmo quando a plataforma
 * externa não fornece um link individual conhecido.
 */
export function criarAulasSegurancaInformacao(
  urlPdf?: string
): AulaAssunto[] {
  const nomes = [
    SEGURANCA_INFORMACAO_ASSUNTO,
    "Parte I: Conceito e princípios da Segurança da Informação",
    "Parte II: Disponibilidade, integridade, confidencialidade, autenticidade, ativos e outros conceitos",
    "Parte III: Hacker, cracker, script kidie e política de senhas.",
    "Parte IV: Conceito e visão geral dos principais malwares",
    "Parte V: Assinatura de vírus, vírus, trojan, ransomware e rootkit",
    "Parte VI: Backdoor, worm, bot, spyware, hijacker e questões.",
    "Parte VII: Conceito de ataque, engenharia social, spam, phishing e pharming",
    "Parte VIII: botnet, negação de serviço, IP spoofing, defacement e força bruta.",
    "Parte IX: Conceito de aplicativos de segurança, IDS, IPS, antimalwares, antivirus e firewall",
    "Bateria de questões | Segurança da informação",
  ];

  return nomes.map((nome, ordem) => ({
    id: `informatica-seguranca-informacao-aula-${ordem + 1}`,
    nome,
    ordem,
    concluida: false,
    ...(ordem === 0 && urlPdf ? { url: urlPdf } : {}),
  }));
}
