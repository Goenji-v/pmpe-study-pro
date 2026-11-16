import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { criarPlanoOperacional } from '../utils/planoOperacional';
export function usePlanoAtivo() {
  const {configuracoes, materias, missoesConcluidas} = useApp();
  return useMemo(() => criarPlanoOperacional(materias, missoesConcluidas, configuracoes), [configuracoes, materias, missoesConcluidas]);
}
