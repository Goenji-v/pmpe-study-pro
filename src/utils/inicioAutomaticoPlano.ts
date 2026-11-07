import type { ConfiguracoesApp } from '../types';
import { validarDataInicioPlano } from './dataInicioPlano';
/** Executar apenas depois da hidratação da conta. Preserva um início já salvo. */
export function inicializarInicioPlano(config: ConfiguracoesApp, agora = new Date()): ConfiguracoesApp {
 if (config.dataInicioPlano && validarDataInicioPlano(config.dataInicioPlano, agora) === 'valida') return config;
 const dataInicioPlano = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
 return {...config, dataInicioPlano};
}
