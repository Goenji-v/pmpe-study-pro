import assert from "node:assert/strict";
import test from "node:test";
import type { Materia } from "../src/types/index.ts";
import type { CursoImportado } from "../src/types/cursos.ts";
import type { AnaliseEdital } from "../src/types/editalInteligente.ts";
import {
  DISCIPLINAS_CATALOGO,
  FAMILIAS_CATALOGO,
  identificarConteudoCatalogo,
  identificarDisciplinaCatalogo,
} from "../src/utils/catalogoAssuntosCentral.ts";
import {
  candidatosDoCurso,
  candidatosDoEdital,
  compararImportacaoConteudos,
} from "../src/utils/conciliacaoImportacaoCatalogo.ts";

function materia(id:string,nome:string,assuntos: string[]):Materia {
  return {
    id,nome,
    assuntos: assuntos.map((titulo,i)=>({
      id:id+"-"+i,nome:titulo,concluido:i===0,
      prioridade:"media" as const,
      pdf:i===0?"material-nao-remover.pdf":undefined,
    })),
  };
}
const conjunto = [
  materia("rlm", "RLM", ["Conectivos lógicos", "Tabelas-verdade", "Lógica argumentativa"]),
  materia("pt", "Português", ["Dígrafo e encontro consonantal", "Sílaba"]),
  materia("ti", "Informática", ["Conceitos de proteção e segurança - aulas 1 a 4", "Windows - Parte I: Conceito e componentes do sistema"]),
  materia("dh", "Direitos Humanos", ["Estatuto dos Militares do Estado de Pernambuco"]),
  materia("hist", "História de Pernambuco", ["Economia Açucareira","Guerra dos Mascates"]),
];

test("catalogo usa identificadores estáveis, sem duplicar disciplinas, famílias ou subassuntos",()=>{
  assert.equal(DISCIPLINAS_CATALOGO.length,9);
  assert.equal(new Set(DISCIPLINAS_CATALOGO.map(x=>x.id)).size,DISCIPLINAS_CATALOGO.length);
  assert.equal(new Set(FAMILIAS_CATALOGO.map(x=>x.id)).size,FAMILIAS_CATALOGO.length);
  const ids=FAMILIAS_CATALOGO.flatMap(x=>x.subassuntos.map(t=>t.id));
  assert.equal(new Set(ids).size,ids.length);
  for(const familia of FAMILIAS_CATALOGO) {
    assert.ok(DISCIPLINAS_CATALOGO.some(d=>d.id===familia.disciplinaId));
    assert.ok(familia.subassuntos.length>0);
  }
  assert.equal(identificarDisciplinaCatalogo("Raciocínio Lógico e Matemática")?.id,"rlm");
  assert.equal(identificarDisciplinaCatalogo("Língua Portuguesa")?.id,"portugues");
});

test("conectivos e tabela-verdade compartilham família, mas NÃO subassunto",()=>{
  const x=identificarConteudoCatalogo("RLM","Conectivos lógicos");
  const y=identificarConteudoCatalogo("Raciocínio Lógico e Matemática","Tabela verdade");
  const z=identificarConteudoCatalogo("RLM","Equivalências lógicas");
  const composto=identificarConteudoCatalogo("RLM","Conectivos, tabelas-verdade e negação");
  const argumento=identificarConteudoCatalogo("RLM","Lógica argumentativa");
  assert.equal(x.familiaId,y.familiaId);
  assert.equal(y.familiaId,z.familiaId);
  assert.notEqual(x.idsSubassuntos[0],y.idsSubassuntos[0]);
  assert.notEqual(y.idsSubassuntos[0],z.idsSubassuntos[0]);
  assert.equal(composto.tipo,"composto");
  assert.deepEqual(composto.idsSubassuntos,["rlm.conectivos","rlm.tabela","rlm.negacao"]);
  assert.notEqual(argumento.familiaId,x.familiaId);
});

test("Português: dígrafo+encontro composto, crase separada e História não unifica Mascates/Economia",()=>{
  const fonologia=identificarConteudoCatalogo("Português","Dígrafo e encontro consonantal");
  assert.equal(fonologia.tipo,"composto");
  assert.deepEqual(fonologia.idsSubassuntos,["pt.digrafos","pt.encontro-consonantal"]);
  const crase=identificarConteudoCatalogo("Português","Uso do sinal grave indicativo de Crase");
  assert.equal(crase.familiaId,"portugues.crase");
  const historia=identificarConteudoCatalogo("História de Pernambuco","A presença Holandesa, O governo Nassau e a Insurreição Pernambucana");
  assert.equal(historia.tipo,"composto");
  assert.deepEqual(historia.idsSubassuntos,["hist.presenca","hist.insurreicao"]);
  assert.notEqual(identificarConteudoCatalogo("História","Guerra dos Mascates").familiaId,
    identificarConteudoCatalogo("História","Economia Açucareira").familiaId);
});

test("comparação preserva estado original e NÃO equipara materiais, História ou legislação sem confirmar",()=>{
  const antes=JSON.stringify(conjunto);
  const candidatos=[
    {origem:"edital" as const,materia:"Raciocínio Lógico e Matemática",assunto:"Conectivos",idOrigem:"c1"},
    {origem:"edital" as const,materia:"RLM",assunto:"Tabelas-verdade",idOrigem:"c2"},
    {origem:"edital" as const,materia:"RLM",assunto:"Equivalências lógicas",idOrigem:"c3"},
    {origem:"edital" as const,materia:"RLM",assunto:"Conectivos, tabelas-verdade e negação",idOrigem:"c4"},
    {origem:"edital" as const,materia:"História",assunto:"Guerra dos Mascates",idOrigem:"c5"},
    {origem:"edital" as const,materia:"Informática",assunto:"Conceitos de proteção e segurança - aulas 5 a 9",idOrigem:"c6"},
  ];
  const a=compararImportacaoConteudos(conjunto,candidatos);
  assert.equal(a.itens[0].situacao,"alias");
  assert.equal(a.itens[1].situacao,"exato");
  assert.equal(a.itens[2].situacao,"mesma-familia");
  assert.equal(a.itens[3].situacao,"titulo-composto");
  assert.equal(a.itens[4].situacao,"exato");
  assert.equal(a.itens[5].situacao,"mesma-familia");
  assert.equal(a.risco,1);
  assert.equal(JSON.stringify(conjunto),antes);
  assert.deepEqual(compararImportacaoConteudos(conjunto,candidatos),a);
});

test("importação inicial detecta repetições no próprio arquivo mesmo sem curso anterior",()=>{
  const incoming=[
    {origem:"curso" as const,materia:"RLM",assunto:"Conectivos lógicos",idOrigem:"l1"},
    {origem:"curso" as const,materia:"RLM",assunto:"Conectivos",idOrigem:"l2"},
    {origem:"curso" as const,materia:"RLM",assunto:"Tabelas-verdade",idOrigem:"l3"},
    {origem:"curso" as const,materia:"Língua Portuguesa",assunto:"Fonemas",idOrigem:"l4"},
  ];
  const resultado=compararImportacaoConteudos([],incoming);
  assert.equal(resultado.itens[1].situacao,"repetido-no-arquivo");
  assert.equal(resultado.itens[2].situacao,"novo");
  assert.equal(resultado.risco,1);
});

test("Estatuto em Direitos Humanos exige conferência de classificação, jamais muda disciplina automaticamente",()=>{
  const resultado=compararImportacaoConteudos(conjunto,[
    {origem:"edital",materia:"Direitos Humanos",assunto:"Estatuto dos Policiais Militares de Pernambuco (Lei 6.783/74)",idOrigem:"estatuto-1"}
  ]);
  assert.equal(resultado.itens[0].situacao,"disciplina-divergente");
  assert.equal(resultado.risco,1);
});

test("fontes curso/edital são transformadas em prévia, sem modificar a origem",()=>{
  const curso:CursoImportado={
    id:"curso-x",nome:"RDC",origem:"texto",criadoEm:"2026-11-01",atualizadoEm:"2026-11-01",
    materias:[{id:"rlm",nome:"RLM",ordem:0,modulos:[{
      id:"m",nome:"Lógica",ordem:0,aulas:[{id:"a",nome:"Conectivos lógicos",ordem:0}]
    }]}]
  };
  const edital:AnaliseEdital={
    concursoDetectado:"PMPE",analisadoEm:"2026-11-01",materias:[{
      id:"rlm",nome:"RLM",incidenciaEstimada:3,assuntos:[{
        id:"x",nome:"Tabelas-verdade",prioridade:"alta"
      }]
    }]
  };
  const anteriorCurso=JSON.stringify(curso);
  const anteriorEdital=JSON.stringify(edital);
  assert.deepEqual(candidatosDoCurso(curso).map(x=>x.assunto),["Conectivos lógicos"]);
  assert.deepEqual(candidatosDoEdital(edital).map(x=>x.assunto),["Tabelas-verdade"]);
  assert.equal(JSON.stringify(curso),anteriorCurso);
  assert.equal(JSON.stringify(edital),anteriorEdital);
});

test("UI da prévia bloqueia aplicação sem conferência e com conflito de sincronização",async()=>{
  const {readFile}=await import("node:fs/promises");
  const edital=await readFile("src/pages/MeuEdital/MeuEdital.tsx","utf8");
  const cursos=await readFile("src/pages/Cursos/Cursos.tsx","utf8");
  assert.match(edital,/conferenciaValida/);
  assert.match(edital,/sincronizacaoInsegura/);
  assert.match(edital,/aplicarEstadoEstruturalSeguro/);
  assert.match(cursos,/conferenciaValida/);
  assert.match(cursos,/sincronizacaoInsegura/);
  assert.match(cursos,/aplicarEstadoEstruturalSeguro/);
  assert.match(cursos,/criarBackupAutomaticoLocal/);
});


test("nomes reais da conta são reconhecidos sem remover prefixos da identidade salva",()=>{
  assert.equal(identificarDisciplinaCatalogo("Estatuto PMPE (Pós Edital)")?.id,"estatuto-pmpe");
  assert.equal(identificarConteudoCatalogo("Estatuto PMPE (Pós Edital)","Em Produção - Hierarquia e disciplina").idsSubassuntos[0],"est.hierarquia");
  assert.equal(identificarConteudoCatalogo("Direitos Humanos",
    "1. Teoria geral dos Direitos Humanos: conceito; terminologia; estrutura normativa; fundamento; classificação; especificidades").idsSubassuntos[0],"dh.teoria");
  assert.equal(identificarConteudoCatalogo("Direitos Humanos",
    "3. Incorporação dos tratados internacionais de Direitos Humanos ao ordenamento jurídico brasileiro: Constituição Federal, art. 5º, §§ 2º e 3º; hierarquia normativa dos tratados de Direitos Humanos.").idsSubassuntos[0],"dh.incorporacao");
  assert.equal(identificarConteudoCatalogo("Informática",
    "Windows - Parte III: Nomes, símbolos proibidos, painel de controle, novidades do Windows 10").idsSubassuntos[0],"inf.windows-3");
  const wrong=identificarConteudoCatalogo("Direitos Humanos","Estatuto dos Militares do Estado de Pernambuco");
  assert.equal(wrong.tipo,"nao_identificado");
  assert.equal(identificarConteudoCatalogo("História de Pernambuco","Guerra dos Mascates").familiaId,"historia-pe.mascates");
});


test("título de Estatuto idêntico em Direitos Humanos ainda é classificado como conflito, não como vínculo exato",()=>{
  const titulo="Estatuto dos Militares do Estado de Pernambuco";
  const antigo=[materia("dh","Direitos Humanos",[titulo])];
  const resultado=compararImportacaoConteudos(antigo,[
    {origem:"edital",materia:"Direitos Humanos",assunto:titulo,idOrigem:"dh-estatuto"}
  ]);
  assert.equal(resultado.itens[0].situacao,"disciplina-divergente");
  assert.equal(resultado.risco,1);
  assert.equal(antigo[0].assuntos[0].nome,titulo);
});


test("RLM: títulos reais e extensos do edital são decompostos em subassuntos e famílias corretas",()=>{
  const titulos = [
    "Estruturas lógicas: proposições, conectivos, quantificadores e falácias",
    "Lógica de argumentação: analogias, inferências, deduções, equivalência, implicação e argumentos válidos",
    "Diagramas lógicos",
    "Princípios e técnicas de contagem, princípio multiplicativo, permutações, arranjos, combinações e probabilidade",
  ];
  const [estruturas, argumentos, diagramas, contagem] = titulos.map(titulo =>
    identificarConteudoCatalogo("Raciocínio Lógico", titulo)
  );
  assert.equal(estruturas.tipo,"composto");
  assert.deepEqual(estruturas.idsSubassuntos,[
    "rlm.prop","rlm.conectivos","rlm.quantificadores","rlm.falacias"
  ]);
  assert.deepEqual(estruturas.familiasIds,[
    "rlm.logica-proposicional","rlm.predicados","rlm.argumentativa"
  ]);
  assert.equal(estruturas.familiaId,null);
  assert.equal(argumentos.tipo,"composto");
  assert.deepEqual(argumentos.idsSubassuntos,[
    "rlm.equivalencia","rlm.implicacao","rlm.analogias","rlm.deducoes","rlm.argumentos"
  ]);
  assert.equal(argumentos.familiasIds?.length,2);
  assert.equal(diagramas.tipo,"subassunto");
  assert.deepEqual(diagramas.idsSubassuntos,["rlm.diagrama"]);
  assert.equal(contagem.tipo,"composto");
  assert.deepEqual(contagem.idsSubassuntos,[
    "rlm.contagem","rlm.permutacao","rlm.arranjo","rlm.combinacao","rlm.probabilidade"
  ]);
  assert.deepEqual(contagem.familiasIds,["rlm.combinatoria","rlm.probabilidade"]);
  assert.equal(identificarDisciplinaCatalogo("Matemática"),null);
  assert.notEqual(identificarConteudoCatalogo("RLM","Equivalência lógica").idsSubassuntos[0],
    identificarConteudoCatalogo("RLM","Implicação lógica").idsSubassuntos[0]);
});

test("simulação curso antigo + edital composto preserva IDs, progresso e PDFs sem promover relação a equivalência",()=>{
  const cursoAntigo=[
    materia("curso-rlm","RLM",["Conectivos lógicos","Equivalências lógicas","Lógica argumentativa","Combinação simples"]),
    materia("curso-hist","História de Pernambuco",["Guerra dos Mascates"]),
  ];
  const editalNovo = [
    {origem:"edital" as const,materia:"Raciocínio Lógico",assunto:
      "Estruturas lógicas: proposições, conectivos, quantificadores e falácias",idOrigem:"ed-1"},
    {origem:"edital" as const,materia:"Raciocínio Lógico",assunto:
      "Lógica de argumentação: analogias, inferências, deduções, equivalência, implicação e argumentos válidos",idOrigem:"ed-2"},
    {origem:"edital" as const,materia:"Raciocínio Lógico",assunto:
      "Diagramas lógicos",idOrigem:"ed-3"},
    {origem:"edital" as const,materia:"Raciocínio Lógico",assunto:
      "Princípios e técnicas de contagem, princípio multiplicativo, permutações, arranjos, combinações e probabilidade",idOrigem:"ed-4"},
  ];
  const snapshotCurso=JSON.stringify(cursoAntigo);
  const snapshotEdital=JSON.stringify(editalNovo);
  const parecer=compararImportacaoConteudos(cursoAntigo,editalNovo);
  assert.equal(parecer.total,4);
  assert.deepEqual(parecer.itens.map(item=>item.situacao),[
    "titulo-composto","titulo-composto","novo","titulo-composto"
  ]);
  assert.equal(parecer.risco,3);
  assert.equal(parecer.novos,1);
  assert.ok(parecer.itens[0].referencia?.assunto.includes("Conectivos"));
  assert.ok(parecer.itens[1].referencia);
  assert.ok(parecer.itens[3].referencia?.assunto.includes("Combinação"));
  assert.ok(parecer.itens.slice(0,4).every(item=>item.confianca!=="alta"));
  assert.equal(JSON.stringify(cursoAntigo),snapshotCurso);
  assert.equal(JSON.stringify(editalNovo),snapshotEdital);
  assert.equal(cursoAntigo[0].assuntos[0].concluido,true);
  assert.equal(cursoAntigo[0].assuntos[0].pdf,"material-nao-remover.pdf");
  assert.deepEqual(compararImportacaoConteudos(cursoAntigo,editalNovo),parecer);
});

test("título com conteúdos de disciplinas diferentes não atravessa fronteiras",()=>{
  assert.equal(identificarConteudoCatalogo("Português",
    "Estruturas lógicas: proposições, conectivos, quantificadores e falácias").tipo,"nao_identificado");
  assert.equal(identificarConteudoCatalogo("História","Diagramas lógicos").tipo,"nao_identificado");
});
