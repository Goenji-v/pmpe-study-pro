import type { MissaoDia } from "./types";

export function formatarMinutos(minutosTotais: number) {
  const minutos = Math.max(0, Math.round(minutosTotais));
  const horas = Math.floor(minutos / 60);
  const restantes = minutos % 60;

  if (horas === 0) return `${restantes}min`;
  if (restantes === 0) return `${horas}h`;
  return `${horas}h ${restantes}min`;
}

export function gerarMensagemProntidao(indice: number) {
  if (indice >= 85) {
    return "Seu desempenho está consistente. Mantenha revisões e simulados regulares.";
  }
  if (indice >= 70) {
    return "Você está evoluindo bem, mas ainda existem pontos específicos para corrigir.";
  }
  if (indice >= 55) {
    return "Sua preparação está avançando, porém precisa de maior constância e correção dos assuntos fracos.";
  }
  if (indice >= 35) {
    return "Priorize frequência, revisões e questões antes de aumentar a quantidade de conteúdos.";
  }
  return "Registre suas atividades para que o sistema consiga montar um diagnóstico confiável.";
}

export function formatarTipoMissao(tipo: MissaoDia["tipo"]) {
  const nomes = {
    revisao: "Revisão",
    questoes: "Questões",
    estudo: "Estudo",
    simulado: "Simulado",
  };

  return nomes[tipo];
}

export function percentualMeta(atual: number, meta: number) {
  if (meta <= 0) return 0;
  return limitarNumero(Math.round((atual / meta) * 100), 0, 100);
}

export function limitarNumero(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}
