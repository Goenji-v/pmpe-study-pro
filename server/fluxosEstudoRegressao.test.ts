import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularConquistasPermanentes } from '../src/services/conquistasPermanentes';
import { gerarRelatorioInteligente } from '../src/services/inteligencia/relatorioInteligenteService';
import { calcularCentralInteligencia } from '../src/services/inteligencia/calcularCentralInteligencia';
import { correspondeFiltroCatalogo } from '../src/services/filtrosCatalogoIA';

const base: any = { questoes: [], sessoes: [], revisoes: [], simulados: [], materias: [], missoesConcluidas: [], configuracoes: {} };
test('Disciplina de Ferro zera após dia completo sem estudo e recomeça em um', () => {
  const sessoes = Array.from({length:10}, (_,i) => ({id:String(i),tipo:'estudo',materia:'Português',assunto:'Geral',minutos:30,data:`2026-10-${String(i+1).padStart(2,'0')}T12:00:00`}));
  const calcular = (dia:number, ss=sessoes) => calcularConquistasPermanentes({...base,sessoes:ss,agora:new Date(2026,9,dia,12)}).find(x=>x.id==='sequencia-30')!;
  assert.equal(calcular(10).atual,'10/30 dias consecutivos');
  assert.equal(calcular(11).atual,'10/30 dias consecutivos');
  assert.equal(calcular(12).progresso,0);
  assert.equal(calcular(12,[...sessoes,{...sessoes[0],id:'nova',data:'2026-10-12T10:00:00'}]).atual,'1/30 dias consecutivos');
});
test('Constitucional federal e aliases usam a revisão recente no relatório e inteligência', () => {
  const entrada = {...base,metaMinutos:60,metaQuestoes:10,metaRevisoes:1,metaMinutosDiaria:60,
    questoes:[{id:'q',materia:'Constitucional',assunto:'Direitos',banca:'AOCP',certas:8,erradas:2,minutos:0,data:'2026-08-01T12:00:00Z'}],
    sessoes:[{id:'s',tipo:'estudo',materia:'Direito Constitucional',assunto:'Direitos',minutos:30,data:'2026-08-02T12:00:00Z'}],
    revisoes:[{id:'r',materia:'Constitucional Federal',assunto:'Direitos',concluida:true,dataConclusao:new Date().toISOString(),dataPrevista:new Date().toISOString()}]};
  for (const resultado of [gerarRelatorioInteligente(entrada),calcularCentralInteligencia(entrada)]) {
    assert.equal(resultado.materias.length,1);
    assert.equal(resultado.materias[0].diasSemEstudar,0);
  }
});
test('catálogo aceita aliases de matéria e banca, mantendo assunto e banca selecionados', () => {
  const filtros={materia:'Direito Constitucional Federal',assunto:'Direitos fundamentais',banca:'Instituto AOCP'};
  const linha={materia:'Constitucional',assunto:'Direitos fundamentais',banca:'AOCP'};
  assert.equal(correspondeFiltroCatalogo(linha,filtros),true);
  assert.equal(correspondeFiltroCatalogo({...linha,banca:'FGV'},filtros),false);
  assert.equal(correspondeFiltroCatalogo({...linha,assunto:'Outro'},filtros),false);
  assert.equal(correspondeFiltroCatalogo({...linha,banca:'FGV'},{...filtros,banca:'Aleatórias'}),true);
  assert.equal(correspondeFiltroCatalogo({...linha,materia:'Direito Penal Militar'},filtros),false);
});
