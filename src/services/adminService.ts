import { supabase } from "../lib/supabase";

export type ResumoAdmin = {
  totalUsuarios: number;
  novosNoMes: number;
  ativosNoMes: number;
  minutosNoMes: number;
  questoesNoMes: number;
  acertosNoMes: number;
};

export type UsuarioAdmin = {
  userId: string;
  nome: string;
  email: string;
  criadoEm: string;
  ultimoLoginEm: string | null;
  emailConfirmadoEm: string | null;
  banidoAte: string | null;
  minutosMes: number;
  questoesMes: number;
  acertosMes: number;
  xpMes: number;
  nivel: number;
};

export async function verificarAdministrador(): Promise<boolean> {
  const { data, error } = await supabase.rpc("sou_admin");

  if (error) {
    console.warn("Não foi possível verificar o perfil administrativo:", error.message);
    return false;
  }

  return data === true;
}

export async function carregarResumoAdmin(): Promise<ResumoAdmin> {
  const { data, error } = await supabase.rpc("admin_resumo");

  if (error) {
    throw new Error(`Erro ao carregar resumo administrativo: ${error.message}`);
  }

  const valor = (data ?? {}) as Record<string, unknown>;

  return {
    totalUsuarios: numero(valor.total_usuarios),
    novosNoMes: numero(valor.novos_no_mes),
    ativosNoMes: numero(valor.ativos_no_mes),
    minutosNoMes: numero(valor.minutos_no_mes),
    questoesNoMes: numero(valor.questoes_no_mes),
    acertosNoMes: numero(valor.acertos_no_mes),
  };
}

export async function carregarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const { data, error } = await supabase.rpc("admin_listar_usuarios");

  if (error) {
    throw new Error(`Erro ao carregar usuários: ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((item) => ({
    userId: texto(item.user_id),
    nome: texto(item.nome_publico) || "Usuário",
    email: texto(item.email),
    criadoEm: texto(item.criado_em),
    ultimoLoginEm: textoOuNulo(item.ultimo_login_em),
    emailConfirmadoEm: textoOuNulo(item.email_confirmado_em),
    banidoAte: textoOuNulo(item.banido_ate),
    minutosMes: numero(item.minutos_mes),
    questoesMes: numero(item.questoes_mes),
    acertosMes: numero(item.acertos_mes),
    xpMes: numero(item.xp_mes),
    nivel: Math.max(1, numero(item.nivel)),
  }));
}

function numero(valor: unknown) {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function textoOuNulo(valor: unknown) {
  const convertido = texto(valor);
  return convertido || null;
}
