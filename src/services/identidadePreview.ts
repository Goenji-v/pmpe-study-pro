import { useSyncExternalStore } from 'react';
export type IdentidadePreview = { nome?:string; foto?:string; cidade?:string; uf?:string; whatsapp?:string; nascimento?:string; concurso?:string; dataProva?:string; tema?:'claro'|'escuro' };
const evento='study:identidade-preview';
function ler(chave:string){try{return localStorage.getItem(chave)??'{}';}catch{return '{}';}}
function assinar(cb:()=>void){window.addEventListener(evento,cb);window.addEventListener('storage',cb);return()=>{window.removeEventListener(evento,cb);window.removeEventListener('storage',cb);};}
export function useIdentidadePreview(userId?:string){
 const chave=`study:identidade-preview:v1:${userId??'visitante'}`;
 const valor=useSyncExternalStore(assinar,()=>ler(chave),()=> '{}');
 let dados:IdentidadePreview={};try{dados=JSON.parse(valor);}catch{/* Ignore damaged local preview. */}
 function salvar(campos:Partial<IdentidadePreview>){let anterior:IdentidadePreview={};try{anterior=JSON.parse(ler(chave));}catch{/* Replace damaged draft. */}localStorage.setItem(chave,JSON.stringify({...anterior,...campos}));window.dispatchEvent(new Event(evento));}
 return {dados,salvar};
}
export async function prepararFoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma foto JPG, PNG ou WebP.');
 if(file.size>8*1024*1024)throw new Error('Escolha uma foto de até 8 MB.');
 const bitmap=await createImageBitmap(file);
 try{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto.');const lado=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-lado)/2,(bitmap.height-lado)/2,lado,lado,0,0,320,320);return canvas.toDataURL('image/jpeg',.85);}finally{bitmap.close();}
}
