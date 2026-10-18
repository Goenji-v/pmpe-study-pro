export const FUNDOS_PERFIL = [
 {id:'fundo-aurora',nome:'Aurora Boreal',descricao:'Luzes verdes e azuis para destacar seu perfil.',preco:180,raridade:'raro' as const,icone:'🌌',valorVisual:'aurora'},
 {id:'fundo-cosmos',nome:'Cosmos',descricao:'Um céu violeta para sua jornada de estudos.',preco:240,raridade:'epico' as const,icone:'✨',valorVisual:'cosmos'},
 {id:'fundo-disciplina',nome:'Disciplina de Ouro',descricao:'Exclusivo da conquista Disciplina de Ferro: 30 dias consecutivos de estudo.',preco:0,raridade:'lendario' as const,icone:'🏅',valorVisual:'disciplina',conquistaId:'sequencia-30'},
];
export function classeFundoPerfil(id?: string | null) {
 return `fundo-perfil-${FUNDOS_PERFIL.find(f=>f.id===id)?.valorVisual ?? 'padrao'}`;
}
