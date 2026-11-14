import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
let js:string,css:string;
test.beforeAll(async()=>{
 const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/Estudos/ConteudosBlocosPreview';createRoot(document.getElementById('root')).render(<Page/>);`},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){
 b.onLoad({filter:/\/context\/AppContext\.tsx$/},()=>({loader:'tsx',contents:`const materias=[{id:'p',nome:'Português',assuntos:[],modulos:[{id:'g',nome:'Geral',ordem:0,assuntos:[{id:'a',nome:'Fonologia',prioridade:'alta',concluido:false,aulas:[{id:'a1',nome:'Aula 1 — Dígrafos',url:'https://example.com/1',ordem:0,concluida:false},{id:'a2',nome:'Aula 2 — Encontros vocálicos',url:'https://example.com/2',ordem:1,concluida:false}]}]}]}];export const useApp=()=>({materias,questoes:[],sessoes:[],revisoes:[],configuracoes:{}});`}));
 b.onLoad({filter:/\/services\/materiaisService\.ts$/},()=>({loader:'ts',contents:`export const listarMateriais=async()=>[];export const abrirMaterial=async()=>{};`}));
 b.onLoad({filter:/\/services\/leitorMaterial\.ts$/},()=>({loader:'ts',contents:`export const abrirPdfInterno=()=>{};export const ehLinkPdf=(u)=>u.endsWith('.pdf');`}));
 }}]});js=result.outputFiles[0].text;css=await readFile('src/pages/Estudos/ConteudosBlocosPreview.css','utf8');
});
async function abrir(page:import('@playwright/test').Page){page.on('pageerror',e=>{throw e;});await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><body style="background:#0c1728;color:#e6edf7;font-family:Arial;margin:12px"><div id="root"></div></body></html>'}));await page.goto('https://fixture.test');await page.addStyleTag({content:css});await page.addScriptTag({content:js});}
for(const width of [1440,390])test(`matérias em tabela e perfil sem excesso ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await abrir(page);
 await expect(page.getByRole('table',{name:'Matérias',exact:true})).toBeVisible();
 await page.getByRole('row').filter({hasText:'Português'}).click();await page.getByRole('button',{name:'Perfil →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Fonologia',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Aulas cadastradas'})).toHaveCount(0);
 await page.getByRole('button',{name:/Aulas.*aulas vinculadas/}).click();
 await expect(page.getByRole('heading',{name:'Aulas cadastradas'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('confirmar aula, mínimo de questões e revisão de reforço sem gravação',async({page})=>{
 await abrir(page);await page.getByRole('row').filter({hasText:'Português'}).click();await page.getByRole('button',{name:'Perfil →',exact:true}).click();
 await page.getByRole('button',{name:'Testar conclusão',exact:true}).click();await expect(page.getByRole('button',{name:'Simular conclusão e primeira revisão'})).toBeDisabled();await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:/Aulas.*aulas vinculadas/}).click();
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'Simular fim da sessão'}).nth(i).click();await page.getByRole('button',{name:'Sim, terminei a aula',exact:true}).click();}
 await page.getByRole('button',{name:'Testar conclusão',exact:true}).click();
 await page.getByLabel('Acertos',{exact:true}).fill('3');await page.getByLabel('Erros',{exact:true}).fill('1');await expect(page.getByRole('button',{name:'Simular conclusão e primeira revisão'})).toBeDisabled();
 await page.getByLabel('Erros',{exact:true}).fill('2');await expect(page.getByRole('dialog')).toContainText('reler seu resumo e resolver 10 questões');
 await page.getByRole('button',{name:'Simular conclusão e primeira revisão'}).click();await expect(page.getByRole('status')).toContainText('A agenda real permanece igual');
});
test('cadastro contextual mantém matéria e módulo como rascunho',async({page})=>{
 await abrir(page);await page.getByRole('row').filter({hasText:'Português'}).click();await page.getByRole('button',{name:'＋ Novo assunto',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Português → Geral');await page.getByLabel('Nome',{exact:true}).fill('Crase');await page.getByRole('button',{name:'Adicionar à prévia',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'Crase'})).toBeVisible();
 await page.reload();await page.addScriptTag({content:js});await page.getByRole('row').filter({hasText:'Português'}).click();await expect(page.getByRole('row').filter({hasText:'Crase'})).toHaveCount(0);
});
