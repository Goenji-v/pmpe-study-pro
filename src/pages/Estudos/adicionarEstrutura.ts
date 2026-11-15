import type { Materia, Modulo, Assunto } from '../../types';
import { criarIdModuloGeral } from '../../services/conteudos/navegarConteudos';
const normalizar = (nome: string) => nome.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Adiciona sem reconstruir módulos projetados de cursos nem substituir IDs existentes. */
export function adicionarEstrutura(materias: Materia[], tipo: 'materia'|'modulo'|'assunto', nomeInformado: string, materiaId: string, moduloId: string): Materia[] {
  const nome = nomeInformado.trim();
  if (!nome) throw new Error('Informe o nome.');
  const igual = (item: {nome:string}) => normalizar(item.nome) === normalizar(nome);
  if (tipo === 'materia') {
    if (materias.some(igual)) throw new Error('Essa matéria já existe.');
    const id = crypto.randomUUID();
    return [...materias, {id, nome, assuntos: [], modulos: [{id:criarIdModuloGeral(id),nome:'Geral',ordem:0,assuntos:[]}]}];
  }
  const materia = materias.find(m=>m.id===materiaId);
  if (!materia) throw new Error('Selecione a matéria.');
  const modulos: Modulo[] = materia.modulos?.length ? materia.modulos : [{id:criarIdModuloGeral(materia.id),nome:'Geral',ordem:0,assuntos:materia.assuntos??[]}];
  let novosModulos: Modulo[];
  if (tipo === 'modulo') {
    if (modulos.some(igual)) throw new Error('Esse módulo já existe nessa matéria.');
    novosModulos = [...modulos,{id:crypto.randomUUID(),nome,ordem:Math.max(-1,...modulos.map(m=>m.ordem))+1,assuntos:[]}];
  } else {
    const modulo = modulos.find(m=>m.id===moduloId);
    if (!modulo) throw new Error('Selecione um módulo próprio. Para uma visão agrupada de curso, crie um novo módulo nesta matéria.');
    if (modulo.assuntos.some(igual)) throw new Error('Esse assunto já existe nesse módulo.');
    const assunto: Assunto = {id:crypto.randomUUID(),nome,concluido:false,prioridade:'media',origemConteudo:'manual',atualizadoEm:new Date().toISOString()};
    novosModulos = modulos.map(m=>m.id===moduloId?{...m,assuntos:[...m.assuntos,assunto]}:m);
  }
  return materias.map(m=>m.id===materiaId?{...m,modulos:novosModulos,assuntos:novosModulos.flatMap(mod=>mod.assuntos)}:m);
}
