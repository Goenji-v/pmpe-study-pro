export function avaliarBlocoPreview(aulasCompletas: boolean, certas: number, erradas: number, emBranco = 0) {
  const valores = [certas, erradas, emBranco];
  if (valores.some(v => !Number.isSafeInteger(v) || v < 0)) return {liberado:false, mensagem:'Informe quantidades inteiras e não negativas.', reforco:false, percentual:null};
  const respondidas = certas + erradas;
  const total = respondidas + emBranco;
  if (!aulasCompletas) return {liberado:false,mensagem:'Conclua todas as aulas obrigatórias do bloco.',reforco:false,percentual:null};
  if (respondidas < 5) return {liberado:false,mensagem:`Responda pelo menos 5 questões. Faltam ${5-respondidas}.`,reforco:false,percentual:null};
  const percentual = certas / total * 100;
  const reforco = percentual < 80;
  return {liberado:true, percentual, reforco, mensagem:reforco?'Primeira revisão: reler seu resumo e resolver 10 questões.':'Bom resultado. Seguir a revisão normal do bloco.'};
}
