import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { criarPlanoAtivo } from '../utils/planoAtivo';
export function usePlanoAtivo() {
  const {configuracoes, materias} = useApp();
  return useMemo(() => criarPlanoAtivo(configuracoes, materias), [configuracoes, materias]);
}
