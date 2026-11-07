/** Datas de calendário não têm hora: hoje é válido também antes do meio-dia. */
export function validarDataInicioPlano(valor: string, agora = new Date()): 'valida' | 'invalida' | 'futura' {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'invalida';
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return 'invalida';
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return data > hoje ? 'futura' : 'valida';
}
