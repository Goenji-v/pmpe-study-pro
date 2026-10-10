
const T=[["Direito Constitucional","Princípios Fundamentais","45 min"],["Direito Penal","Crimes contra a Pessoa","45 min"],["Legislação PMPE","Estatuto dos Policiais Militares","30 min"]];
const tk=document.getElementById('tasks');
T.forEach((t,i)=>{const d=document.createElement('div');d.className='task';d.innerHTML=`<span class="n">0${i+1}</span><div><strong>${t[0]}</strong><span>${t[1]}</span></div><span class="t">◷ ${t[2]}</span><button aria-label="Concluir">✓</button>`;d.querySelector('button').onclick=()=>d.classList.toggle('done');tk.appendChild(d)});
const cal=document.getElementById('cal');
['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].forEach(x=>cal.insertAdjacentHTML('beforeend',`<div class="d">${x}</div>`));
const S=[1,3,7,8,10,15,16];
[30,31].forEach(n=>cal.insertAdjacentHTML('beforeend',`<span class="o">${n}</span>`));
for(let n=1;n<=30;n++)cal.insertAdjacentHTML('beforeend',`<span class="${n==17?'h':S.includes(n)?'s':''}">${n}</span>`);
[1,2,3].forEach(n=>cal.insertAdjacentHTML('beforeend',`<span class="o">${n}</span>`));
// cronômetro
let tot=1500,left=tot,iv=null;const clk=document.getElementById('clk'),arc=document.getElementById('arc');
const draw=()=>{clk.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');arc.style.strokeDashoffset=452.4*(1-left/tot)};
const start=()=>{if(iv)return;iv=setInterval(()=>{left--;draw();if(left<=0)stop()},1000)};
const stop=()=>{clearInterval(iv);iv=null};
b1.onclick=start;b2.onclick=stop;b3.onclick=()=>{stop();left=tot;draw()};go.onclick=start;
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on')});
const D=[["Direito Constitucional","⚖️",67,"bom","bom"],["Legislação Extravagante","📄",60,"atencao","atenção"],["Raciocínio Lógico","📊",60,"atencao","atenção"],["Português","📖",64,"atencao","atenção"],["História","🏛️",75,"evol","evoluindo"],["Direitos Humanos","📊",59,"atencao","atenção"]];
dc.innerHTML=D.map(d=>`<div class="dk"><div class="t"><i>${d[1]}</i><span>${d[0]}</span><em class="bd ${d[3]}" style="font-style:normal">${d[4]}</em></div><b>${d[2]}%</b><div class="pb"><i class="${d[3]}" style="width:${d[2]}%"></i></div></div>`).join('');
fd.innerHTML='<option value="">Todas as disciplinas</option>'+D.map(d=>`<option>${d[0]}</option>`).join('');
const Q=[["Equivalências lógicas","Raciocínio Lógico","at","Atrasada"],["Guerra dos Mascates e Revolução Pernambucana","História","at","Atrasada"],["Confederação do Equador","História","ho","Hoje"],["Direitos fundamentais","Direitos Humanos","ho","Hoje"],["Crimes de tortura","Legislação Extravagante","am","Amanhã"]];
const render=()=>{const l=Q.filter(q=>(!fd.value||q[1]==fd.value)&&(!fs.value||q[2]==fs.value));
['at','ho','am'].forEach(k=>document.getElementById('c-'+k).textContent=Q.filter(q=>q[2]==k&&(!fd.value||q[1]==fd.value)).length);
qs.innerHTML=l.length?l.map(q=>`<div class="q"><span>${q[0]}</span><em class="${q[2]}">${q[3]}</em></div>`).join(''):'<div class="none">Nenhuma revisão com esses filtros.</div>'};
fd.onchange=fs.onchange=render;render();
