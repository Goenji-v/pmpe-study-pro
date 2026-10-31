import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

// Renderiza os componentes reais em uma conta sintética. PDF.js e serviços remotos
// são substituídos para testar layout e preferência sem acessar contas de alunos.
let bundle: string;
let css: string;
test.beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {MemoryRouter} from 'react-router-dom';
    import {FixtureProvider} from './src/context/AppContext';
    import Configuracoes from './src/pages/Configuracoes/Configuracoes';
    import Leitor from './src/components/LeitorMaterial/LeitorMaterial';
    import Perfil from './src/components/PerfilAssunto/PerfilAssunto';
    import {abrirPdfInterno} from './src/services/leitorMaterial';
    function App(){const [perfil,setPerfil]=useState(false);return <FixtureProvider><MemoryRouter>
      <button id="abrir-pdf" onClick={()=>abrirPdfInterno({id:'pdf-teste',nome:'PDF de teste',url:'http://fixture.test/material.pdf'})}>Abrir PDF</button>
      <div className="conteudos-assunto-item"><button className="conteudos-nome-perfil" onClick={()=>setPerfil(true)}>Internet, Intranet, Extranet e VPN <small>Ver perfil ↗</small></button></div>
      <Configuracoes/><Leitor/>{perfil&&<Perfil materia={{id:'m',nome:'Português'}} modulo={{id:'g',nome:'Geral'}} assunto={{id:'a',nome:'Verbos',anotacoes:'Notas de estudo. '.repeat(500)}} fechar={()=>setPerfil(false)}/>}</MemoryRouter></FixtureProvider>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, loader: { '.css': 'empty' }, plugins: [{ name: 'fixture', setup(b) {
    const mock = (filter: RegExp, contents: string) => b.onLoad({filter}, () => ({contents,loader:'tsx'}));
    mock(/\/context\/AppContext\.tsx$/, `import React,{createContext,useContext,useState} from 'react'; const C=createContext(null); export const useApp=()=>useContext(C); export function FixtureProvider({children}){const [configuracoes,setConfiguracoes]=useState({nomeUsuario:'Teste',concurso:'PMPE',bancaPadrao:'AOCP',metaQuestoesDiaria:10,metaMinutosDiaria:60,metaRevisoesDiaria:2,economia:{moedas:300,recompensasRecebidas:[]}});return <C.Provider value={{configuracoes,setConfiguracoes,materias:[],questoes:[],sessoes:[],revisoes:[]}}>{children}</C.Provider>}`);
    mock(/\/context\/AuthContext\.tsx$/, `export const useAuth=()=>({usuario:{id:'teste'}});`);
    // O teste valida PDFs; não inicializa Supabase Auth nem executa fluxos de senha.
    mock(/\/pages\/Configuracoes\/AlterarSenha\.tsx$/, `import React from 'react'; export default function AlterarSenha(){return <section data-testid="alterar-senha-fixture"/>}`);
    mock(/\/context\/ToastContext\.tsx$/, `export const useToast=()=>({showToast:()=>{}});`);
    mock(/\/services\/armazenamentoConta\.ts$/, `export const armazenamentoLocalDaConta=window.localStorage;`);
    mock(/\/MateriaisDoAssunto\/MateriaisDoAssunto\.tsx$/, `export default function Materiais(){return null}`);
    mock(/\/SimuladoPdf\/PdfAnotavel\.tsx$/, `import React from 'react'; export default function Pdf({anotacoesIniciais,onAnotacoesChange}){return <div className="pdf-anotavel"><div className="pdf-toolbar"><button onClick={()=>onAnotacoesChange({1:[{id:'marca'}]})}>Anotar</button><span data-testid="marcas">{Object.keys(anotacoesIniciais).length}</span></div><div className="pdf-area"><div style={{height:3000}}>Página do PDF</div></div></div>}`);
  }}] });
  bundle=result.outputFiles[0].text;
  css=(await Promise.all(['src/global.css','src/pages/Estudos/Estudos.css','src/pages/Configuracoes/Configuracoes.css','src/pages/SimuladoPdf/SimuladoPdf.css','src/components/LeitorMaterial/LeitorMaterial.css','src/components/PerfilAssunto/PerfilAssunto.css'].map(p=>readFile(p,'utf8')))).join('\n');
});
for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  test(`painéis e marcações em ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.route('http://fixture.test/**',async route=>{
      if(route.request().url().endsWith('.pdf')) await route.fulfill({contentType:'application/pdf',body:'%PDF-1.4 fixture'});
      else await route.fulfill({contentType:'text/html',body:'<html><body><main id="root"></main></body></html>'});
    });
    await page.goto('http://fixture.test/');
    await page.addStyleTag({content:css}); await page.addScriptTag({content:bundle});
    const checkbox=page.getByRole('checkbox',{name:'Salvar minhas marcações nos PDFs dos materiais'});
    await checkbox.check();
    const label=await page.locator('.configuracoes-checkbox').boundingBox();
    const help=await page.locator('.configuracoes-checkbox + .configuracoes-ajuda').boundingBox();
    expect(help!.y).toBeGreaterThanOrEqual(label!.y+label!.height+8);
    await expect(page.locator('.conteudos-nome-perfil')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await page.locator('#abrir-pdf').click();
    const pdf=page.locator('dialog.leitor-material');
    await expect(pdf.getByText('Marcações salvas neste aparelho para sua conta.')).toBeVisible();
    await expect(pdf.getByRole('button',{name:'Anotar'})).toBeVisible();
    const box=await pdf.boundingBox();
    expect(Math.abs(box!.x+box!.width/2-viewport.width/2)).toBeLessThan(2);
    expect(Math.abs(box!.y+box!.height/2-viewport.height/2)).toBeLessThan(2);
    expect(await pdf.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    await pdf.getByRole('button',{name:'Anotar'}).click();
    await pdf.getByRole('button',{name:'Fechar PDF'}).click();
    await page.locator('#abrir-pdf').click();
    await expect(page.getByTestId('marcas')).toHaveText('1');
    await pdf.getByRole('button',{name:'Fechar PDF'}).click();
    await checkbox.uncheck(); await page.locator('#abrir-pdf').click();
    await expect(pdf.getByText('Marcações temporárias: serão descartadas ao fechar.')).toBeVisible();
    await expect(page.getByTestId('marcas')).toHaveText('0');
    await pdf.getByRole('button',{name:'Fechar PDF'}).click();
    await page.locator('.conteudos-nome-perfil').click();
    const perfil=page.locator('dialog.perfil-assunto'); const p=await perfil.boundingBox();
    expect(Math.abs(p!.x+p!.width/2-viewport.width/2)).toBeLessThan(2);
    expect(p!.y).toBeGreaterThanOrEqual(0);
    await perfil.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await expect(perfil.getByRole('button',{name:'Fechar perfil do assunto'})).toBeVisible();
    await perfil.getByRole('button',{name:'Fechar perfil do assunto'}).click();
    await expect(perfil).toHaveCount(0);
  });
}
