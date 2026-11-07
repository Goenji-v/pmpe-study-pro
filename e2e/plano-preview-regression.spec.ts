import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
let bundle:string, css:string;
test.beforeAll(async()=>{
 const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from 'react'; import {createRoot} from 'react-dom/client';
 import {MemoryRouter,Routes,Route,Link,useNavigate} from 'react-router-dom';
 import {FixtureProvider,useApp} from './src/context/AppContext';
 import Configuracoes from './src/pages/Configuracoes/Configuracoes';
 import Resumo from './src/pages/Dashboard/ResumoSemanaDashboard';
 import ResumoPagina from './src/pages/Dashboard/ResumoSemanal';
 import Desempenho from './src/pages/Dashboard/DesempenhoGeralCards';
 function DesempenhoTeste(){const navigate=useNavigate();return <Desempenho aproveitamento={0} totalQuestoes={0} materias={[]} pontosAtencao={[]} onDetalhes={()=>{}} onResumo={()=>navigate('/resumo-semanal')}/>}
 function ResumoTeste(){const dados=useApp();return <><output data-testid='data-salva'>{dados.configuracoes.dataInicioPlano}</output><Resumo {...dados} irPara={()=>{}}/></>}
 import Plano from './src/pages/PlanoEdital/PlanoEditalGateway';
 import Calendario from './src/pages/Calendario/Calendario';
 import Revisoes from './src/pages/Revisoes/Revisoes';
 import {armazenamentoSessaoDaConta} from './src/services/armazenamentoConta';
 function RevisaoDestino(){return <pre data-testid='revisao-destino'>{armazenamentoSessaoDaConta.getItem('pmpe:central-estudos:prefill')}</pre>}
 import * as backups from './src/services/seguranca/backupAutomaticoDuravel';
 window.backups=backups;
 createRoot(document.getElementById('root')).render(<FixtureProvider><MemoryRouter initialEntries={['/calendario']}><nav><Link to="/calendario">Calendário</Link><Link to="/plano">Plano</Link><Link to="/configuracoes">Configurações</Link><Link to="/resumo">Resumo</Link><Link to="/desempenho-teste">Desempenho</Link></nav><Routes><Route path="/desempenho-teste" element={<DesempenhoTeste/>}/><Route path="/resumo-semanal" element={<ResumoPagina/>}/><Route path="/revisoes" element={<Revisoes/>}/><Route path="/central-estudos" element={<RevisaoDestino/>}/><Route path="/configuracoes" element={<><Configuracoes/><ResumoTeste/></>}/><Route path="/resumo" element={<ResumoTeste/>}/><Route path="/calendario" element={<Calendario/>}/><Route path="/plano" element={<Plano/>}/></Routes></MemoryRouter></FixtureProvider>);
 `},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.css':'empty'},plugins:[{name:'fixtures',setup(b){
 const mock=(filter:RegExp,contents:string)=>b.onLoad({filter},()=>({contents,loader:'tsx',resolveDir:process.cwd()}));
 mock(/\/context\/AppContext\.tsx$/, `
 import React,{useState,createContext,useContext} from 'react';
 import {criarConfiguracoesIniciais} from './src/utils/contaInicial';
 import {gerarPlanoEdital} from './src/utils/planoEdital';
 import {inicializarInicioPlano} from './src/utils/inicioAutomaticoPlano';
 const C=createContext(null); export const useApp=()=>useContext(C);
 const analise={concursoDetectado:'Teste',analisadoEm:'2026-11-06',materias:[{id:'rlm',nome:'RLM',incidenciaEstimada:5,assuntos:Array.from({length:18},(_,i)=>({id:'t'+i,nome:'Tema '+(i+1),prioridade:'alta'}))}]};
 const config={...criarConfiguracoesIniciais('Teste'),concurso:'PMPE',dataInicioPlano:new URLSearchParams(location.search).get('inicio')??'2026-11-02',diasEstudo:['seg','ter','qua','qui','sex','sab'],materiasPorDia:1};config.editalAtivo={analise,plano:gerarPlanoEdital(analise,config,[])};
 export function FixtureProvider({children}){const [configuracoes,setConfiguracoes]=useState(()=>inicializarInicioPlano(config));const [missoesConcluidas,setMissoesConcluidas]=useState([]);return <C.Provider value={{configuracoes,setConfiguracoes,materias:[],questoes:[{id:'q1',materia:'Informática',assunto:'Segurança',certas:15,erradas:2,data:'2026-11-06T06:00:00'}],sessoes:[{id:'s1',materia:'Informática',assunto:'Segurança',tipo:'teoria',minutos:30,data:'2026-11-06T06:00:00'},{id:'s2',materia:'Estatuto PMPE',assunto:'Estatuto',tipo:'teoria',minutos:14,data:'2026-11-06T06:00:00'},{id:'s3',materia:'Estatuto PMPE',assunto:'Estatuto',tipo:'teoria',minutos:31,data:'2026-11-06T06:00:00'},{id:'s4',materia:'Legislação Extravagante',assunto:'Abuso de autoridade',tipo:'teoria',minutos:20,data:'2026-11-06T06:00:00'}],revisoes:[{id:'r1',materia:'Informática',assunto:'Segurança',etapa:1,concluida:false,dataPrevista:'2026-11-06T12:00:00'}],setRevisoes:()=>{},simulados:[],missoesConcluidas,setMissoesConcluidas,setSessoes:()=>{},definirConclusaoAssunto:()=>{},definirConclusaoAula:()=>{}}}>{children}</C.Provider>}
 `);
 mock(/\/context\/CronometroContext\.tsx$/,`export const useCronometro=()=>({cronometroAtivo:false});`);
 mock(/\/context\/AuthContext\.tsx$/,`export const useAuth=()=>({usuario:{id:'teste'}});`);
 mock(/\/context\/ToastContext\.tsx$/,`export const useToast=()=>({showToast:()=>{}});`);
 mock(/\/lib\/supabase\.ts$/,`export const supabase={};`);
 mock(/\/utils\/origemRevisaoSimulado\.ts$/,`export const useNomesSimuladosDeRevisoes=()=>({});export const rotuloOrigemRevisaoSimulado=()=>'';`);
 }}]});bundle=result.outputFiles[0].text;
 css=(await Promise.all(['src/global.css','src/pages/Calendario/Calendario.css','src/pages/Dashboard/ResumoSemanaDashboard.css','src/pages/Configuracoes/Configuracoes.css','src/pages/PlanoEstudos/PlanoEstudos.css','src/pages/PlanoEstudos/SimuladoPdfUpload.css'].map(p=>readFile(p,'utf8')))).join('\n');
});
async function abrir(page:import('@playwright/test').Page,inicio='2026-11-02'){
 await page.clock.install({time:new Date('2026-11-06T07:00:00')});
 await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}));
 await page.goto('https://fixture.test/?inicio='+encodeURIComponent(inicio));await page.addStyleTag({content:css});await page.addScriptTag({content:bundle});
}
for(const width of [1440,390]) test(`calendário abre mesma missão e reflete conclusão em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900}); await abrir(page);
 await expect(page.getByRole('heading',{name:'Programação do plano'})).toBeVisible();
 const assunto=await page.locator('.calendario-programacao li').first().innerText();
 expect(assunto).toContain('Pendente');
 await page.getByRole('button',{name:'Abrir este dia no plano'}).click();
 await expect(page.locator('.plano-missao-card')).toHaveCount(1);
 const titulo=await page.locator('.plano-missao-card').innerText();
 expect(titulo).toContain(assunto.split(' — ')[1].split('\n')[0]);
 await page.locator('.plano-concluir').click();
 await page.getByRole('link',{name:'Calendário',exact:true}).click();
 await expect(page.locator('.calendario-programacao li').first()).toContainText('Concluída');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('quota cheia usa backup persistente e isola contas',async({page})=>{
 await abrir(page);
 const resultado=await page.evaluate(async()=>{
   const api=(window as any).backups;
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError')};
   try {const criado=await api.criarBackupAutomaticoDuravel('conta-a',{schemaVersion:18,sessoes:[{id:'s1'}]},'antes_reconciliacao_estrutural');
   return {id:criado.id,a:await api.listarBackupsAutomaticosDuraveis('conta-a'),b:await api.listarBackupsAutomaticosDuraveis('conta-b')};}
   finally{Storage.prototype.setItem=original;}
 });
 expect(resultado.id).toMatch(/^idb-/);expect(resultado.a).toHaveLength(1);expect(resultado.a[0].dados.sessoes[0].id).toBe('s1');expect(resultado.b).toHaveLength(0);
 await page.reload(); await page.addScriptTag({content:bundle});
 const salvos=await page.evaluate(()=>(window as any).backups.listarBackupsAutomaticosDuraveis('conta-a'));
 expect(salvos).toHaveLength(1);
});

test('início automático às 7h aparece sem campo manual e calendário usa a data',async({page})=>{
 await abrir(page,'');
 await page.getByRole('link',{name:'Configurações',exact:true}).click();
 await expect(page.locator('input#dataInicioPlano')).toHaveCount(0);
 await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
 await expect(page.getByTestId('data-salva')).toHaveText('2026-11-06');
 await page.getByRole('link',{name:'Calendário',exact:true}).click();
 await expect(page.locator('.calendario-programacao li')).not.toHaveCount(0);
});
for(const width of [1440,390]) test(`resumo semanal organizado em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await abrir(page);
 await page.getByRole('link',{name:'Resumo',exact:true}).click();
 await expect(page.locator('.resumo-semana')).toBeVisible();
 await expect(page.locator('.resumo-semana-metricas>div')).toHaveCount(4);
 await expect(page.locator('.resumo-semana-prioridades button').first()).toHaveCSS('border-radius','10px');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

 test('prova tem contagem e início antigo explica fim sem criar semana 50',async({page})=>{
 await abrir(page,'2025-11-24');
 await page.getByRole('link',{name:'Configurações',exact:true}).click();
 await page.getByLabel('Data da prova',{exact:true}).fill('2026-11-16');
 await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
 await page.getByRole('link',{name:'Calendário',exact:true}).click();
 await expect(page.getByText('Faltam 10 dias',{exact:true})).toBeVisible();
 await expect(page.getByText('Esta data está depois do fim do plano.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Ver plano e pendências'}).click();
 await expect(page.locator('.plano-semana-botao')).toHaveCount(3);
 await expect(page.getByText('O período previsto para este plano terminou.',{exact:false})).toBeVisible();
 });

 test('calendário agrupa matérias e abre a revisão exata sem concluir',async({page})=>{
 await abrir(page);
 await expect(page.locator('.calendario-grupo')).toHaveCount(3);
 const informatica=page.locator('.calendario-grupo').filter({has:page.locator('summary strong',{hasText:'Informática'})});
 await expect(informatica.locator('summary')).toContainText('30min de estudo · 17 questões');
 await expect(informatica.getByRole('button',{name:'Fazer revisão'})).not.toBeVisible();
 await informatica.locator('summary').click();
 await informatica.getByRole('button',{name:'Fazer revisão'}).click();
 await expect(page.getByTestId('revisao-destino')).toContainText('"revisaoId":"r1"');
 await expect(page.getByTestId('revisao-destino')).toContainText('"assunto":"Segurança"');
 });

 test('desempenho abre resumo em página própria',async({page})=>{
 await abrir(page);
 await page.getByRole('link',{name:'Desempenho',exact:true}).click();
 await expect(page.locator('.resumo-semana')).toHaveCount(0);
 await page.getByRole('button',{name:'Ver resumo da semana ↗'}).click();
 await expect(page.getByRole('heading',{name:'Resumo da semana',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'← Voltar ao dashboard'})).toBeVisible();
 });
