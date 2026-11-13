
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen, Plus, Layers3, Folder,
  LayoutGrid, List, ChevronRight, ChevronDown, ArrowLeft, Video, FileText,
  MessageSquareMore, Calculator, Scale, Gavel, Shield,
  CalendarDays, CheckCircle2, Circle, X, Upload, Link2, PlayCircle,
  BookmarkCheck, SlidersHorizontal,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";
import { atualizarAssuntoNaArvore } from "../../services/conteudos/migrarEstruturaConteudos";
import { salvarArquivoMaterial, salvarLinkMaterial, listarMateriais, abrirMaterial, type MaterialEstudo } from "../../services/materiaisService";
import { abrirPdfInterno, ehLinkPdf } from "../../services/leitorMaterial";
import { materialCorrespondeAoAssunto, materialPertenceAMateria } from "../../utils/correspondenciaMateriais";
import { agruparAssuntosParaExibicao } from "../../utils/auditoriaAgrupamentoAssuntos";
import { armazenamentoSessaoDaConta as sessionStorage } from "../../services/armazenamentoConta";
import type { ConfiguracoesComCursos } from "../../types/cursos";
import type { Assunto, AulaAssunto, Materia, Modulo } from "../../types";
import { adicionarEstrutura } from "./adicionarEstrutura";
import "./EstudosPainel.css";

type Tipo = "pdf" | "aula" | "questoes" | "link";
type Local = { materia: Materia; modulo: Modulo; assunto: Assunto };
const norm = (s?: string) => (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const soma = (ns: number[]) => ns.reduce((x,y) => x+y,0);
const dataLocal = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const ICONES = [BookOpen, Calculator, Scale, Gavel, Gavel, Shield, BookOpen, BookOpen];

export default function EstudosPainel() {
  const {
    materias, setMaterias, questoes, revisoes, configuracoes,
    definirConclusaoAula, definirConclusaoAssunto, statusNuvem,
  } = useApp();
  const configCursos = configuracoes as ConfiguracoesComCursos;
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [busca, setBusca] = useState("");
  const [exibicao, setExibicao] = useState<"grade"|"lista">("grade");
  const [materiaId, setMateriaId] = useState<string|null>(null);
  const [moduloId, setModuloId] = useState<string|null>(null);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const [assuntoId, setAssuntoId] = useState<string|null>(null);
  const [cadastro, setCadastro] = useState(false);
  const [estrutura, setEstrutura] = useState<"conteudo"|"materia"|"modulo"|"assunto">("conteudo");
  const [tipo, setTipo] = useState<Tipo>("pdf");
  const [destMateria, setDestMateria] = useState("");
  const [destModulo, setDestModulo] = useState("");
  const [destAssunto, setDestAssunto] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const [arquivo, setArquivo] = useState<File|null>(null);
  const [salvando, setSalvando] = useState(false);
  const [materiais, setMateriais] = useState<MaterialEstudo[]>([]);
  const [erroMateriais, setErroMateriais] = useState("");
  const [carregandoMateriais, setCarregandoMateriais] = useState(true);
  const [somenteLeitura, setSomenteLeitura] = useState(true);

  const disciplinas = useMemo(() => materias.map(m => ({...m, modulos: listarModulosDaMateria(m)})), [materias]);
  const localizacoes = useMemo<Local[]>(() => disciplinas.flatMap(materia =>
    (materia.modulos ?? []).flatMap(modulo => modulo.assuntos.map(assunto => ({materia, modulo, assunto})))
  ), [disciplinas]);
  const local = localizacoes.find(item => item.assunto.id === assuntoId && item.materia.id === materiaId);
  const materiaAtual = disciplinas.find(m => m.id === materiaId);
  const materiaCadastro = disciplinas.find(m => m.id === destMateria);
  const moduloCadastro = materiaCadastro?.modulos?.find(m => m.id === destModulo);
  const assuntoCadastro = moduloCadastro?.assuntos.find(a => a.id === destAssunto);

  const materiaisDo = (item: Local) => materiais.filter(mat => materialCorrespondeAoAssunto(mat, {
    materia: item.materia.nome, materiaId: item.materia.id, modulo: item.modulo.nome,
    moduloId: item.modulo.id, assunto: item.assunto.nome, assuntoId: item.assunto.id,
    assuntoIdsLegados: item.assunto.idsLegados,
  }));
  const cursoPreferido = (id: string) => configCursos.fontePrincipalPorMateria?.[id];
  const ordenarAulas = (m: Materia, a: Assunto) => (a.aulas ?? []).slice().sort((x,y) => {
    const preferida = cursoPreferido(m.id);
    const fonteA = (preferida && x.origemCurso?.cursoId === preferida) ? 0 : 1;
    const fonteB = (preferida && y.origemCurso?.cursoId === preferida) ? 0 : 1;
    return fonteA - fonteB || x.ordem-y.ordem;
  });
  const consultar = norm(busca);
  const disciplinasFiltradas = disciplinas.filter(m =>
    !consultar || norm(m.nome).includes(consultar) ||
    (m.modulos ?? []).some(mod => norm(mod.nome).includes(consultar) ||
      mod.assuntos.some(a => norm(a.nome).includes(consultar) || (a.aulas ?? []).some(x => norm(x.nome).includes(consultar))))
  );

  async function carregarMateriais() {
    setCarregandoMateriais(true);
    try { setMateriais(await listarMateriais()); setErroMateriais(""); }
    catch (e) { setErroMateriais(e instanceof Error ? e.message : "Não foi possível consultar o Centro de Materiais."); }
    finally { setCarregandoMateriais(false); }
  }
  useEffect(() => { void carregarMateriais(); }, []);
  useEffect(() => {
    const estado = location.state as { termoBusca?: string; focoBusca?: boolean } | null;
    if (estado?.termoBusca) setBusca(estado.termoBusca);
  }, [location.pathname, location.state]);

  function selecionarMateria(id: string) {setMateriaId(id);setModuloId(null);setAssuntoId(null);}
  function selecionarAssunto(item: Local) {
    setMateriaId(item.materia.id);setModuloId(item.modulo.id);setAssuntoId(item.assunto.id);
  }
  function abrirCentral(item: Local, aula?: AulaAssunto) {
    const escolhida = aula ?? ordenarAulas(item.materia, item.assunto).find(a => !a.concluida) ?? ordenarAulas(item.materia, item.assunto)[0];
    sessionStorage.setItem("pmpe:central-estudos:prefill", JSON.stringify({
      materia: item.materia.nome, materiaId: item.materia.id,
      modulo: item.modulo.nome, moduloId: item.modulo.id,
      assunto: item.assunto.nome, assuntoId: item.assunto.id,
      tipo: "aula", objetivo: escolhida ? "Estudar "+item.assunto.nome+" · "+escolhida.nome : "Estudar "+item.assunto.nome,
      urlAula: escolhida?.url ?? item.assunto.aula, urlQuestoes: item.assunto.questoes,
    }));
    navigate("/central-estudos");
  }
  function abrirQuestoes(item: Local) {
    sessionStorage.setItem("pmpe:gerar-ia:modo","questoes");
    sessionStorage.setItem("pmpe:gerar-ia:prefill", JSON.stringify({
      materia: item.materia.nome, modulo: item.modulo.nome, assunto: item.assunto.nome
    }));
    navigate("/gerar-simulado-ia");
  }
  function abrirCadastro(item?: Local, tipoInicial: Tipo = "pdf") {
    setTipo(tipoInicial);setDestMateria(item?.materia.id ?? materiaId ?? "");setDestModulo(item?.modulo.id ?? moduloId ?? "");
    setDestAssunto(item?.assunto.id ?? assuntoId ?? "");setEstrutura("conteudo");setNovoNome("");setNovoUrl("");setArquivo(null);setCadastro(true);
  }
  async function salvarCadastro() {
    if (estrutura !== "conteudo") {
      if (somenteLeitura) {showToast("Teste sem salvar ativo: nenhum cadastro será gravado.", "info");return;}
      try {
        const atualizadas = adicionarEstrutura(materias, estrutura, novoNome, destMateria, destModulo);
        setMaterias(atualizadas);
        setCadastro(false);
        showToast("Cadastro adicionado sem alterar os conteúdos existentes.", "success");
      } catch(e) {showToast(e instanceof Error ? e.message : "Não foi possível cadastrar.", "warning");}
      return;
    }
    if (!materiaCadastro || !moduloCadastro || !assuntoCadastro) {
      showToast("Escolha matéria, módulo e assunto.", "warning"); return;
    }
    if (!novoNome.trim()) {showToast("Informe o nome do conteúdo.", "warning");return;}
    if (somenteLeitura) {showToast("Modo de visualização: desative 'Teste sem salvar' para cadastrar.", "info");return;}
    if (tipo === "pdf" && !arquivo && !novoUrl.trim()) {showToast("Selecione um PDF ou informe o link.", "warning");return;}
    if (tipo !== "pdf" && !(novoUrl.trim().startsWith("https://") || novoUrl.trim().startsWith("http://"))) {
      showToast("Informe um link completo começando com https:// ou http://.", "warning");return;
    }
    try {
      setSalvando(true);
      if (tipo === "aula") {
        setMaterias(anteriores => anteriores.map(m => m.id !== materiaCadastro.id ? m :
          atualizarAssuntoNaArvore(m, assuntoCadastro.id, a => ({
            ...a,
            aulas: [...(a.aulas ?? []), {
              id: crypto.randomUUID(), nome: novoNome.trim(), url: novoUrl.trim(),
              ordem: a.aulas?.length ?? 0, concluida: false,
            }],
          }), moduloCadastro.id)));
      } else if (tipo === "pdf" && arquivo) {
        if (arquivo.type !== "application/pdf" && !arquivo.name.toLowerCase().endsWith(".pdf")) {
          showToast("Selecione um arquivo PDF válido.", "warning");return;
        }
        await salvarArquivoMaterial({
          nome: novoNome.trim(), materia: materiaCadastro.nome, materiaId: materiaCadastro.id,
          modulo: moduloCadastro.nome, moduloId: moduloCadastro.id,
          assunto: assuntoCadastro.nome, assuntoId: assuntoCadastro.id, observacao: "", arquivo,
        });
      } else {
        await salvarLinkMaterial({
          nome: novoNome.trim(), materia: materiaCadastro.nome, materiaId: materiaCadastro.id,
          modulo: moduloCadastro.nome, moduloId: moduloCadastro.id,
          assunto: assuntoCadastro.nome, assuntoId: assuntoCadastro.id, observacao: "",
          url: novoUrl.trim(), categoriaLink: tipo === "questoes" ? "questoes" : "personalizado",
        });
      }
      setCadastro(false);await carregarMateriais();
      showToast("Conteúdo salvo no assunto selecionado.", "success");
    } catch(e) {showToast(e instanceof Error ? e.message : "Erro ao salvar conteúdo.", "error");}
    finally {setSalvando(false);}
  }
  function alternarAula(item: Local, aula: AulaAssunto) {
    if (somenteLeitura) {showToast("Teste sem salvar ativo: nenhuma conclusão será registrada.", "info");return;}
    definirConclusaoAula(item.materia.id, item.assunto.id, aula.id, !aula.concluida, item.modulo.id);
  }
  function alternarAssunto(item: Local) {
    if (somenteLeitura) {showToast("Teste sem salvar ativo: nenhuma conclusão será registrada.", "info");return;}
    definirConclusaoAssunto(item.materia.id,item.assunto.id,!item.assunto.concluido,item.modulo.id);
  }
  async function abrirArquivo(material: MaterialEstudo) {
    try {await abrirMaterial(material);}
    catch(e) {showToast(e instanceof Error ? e.message : "Falha ao abrir material.","error");}
  }
  function abrirMaterialInterno(nome: string, url: string, id: string) {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      if (ehLinkPdf(url)) abrirPdfInterno({id,nome,url});
      else window.open(url,"_blank","noopener,noreferrer");
    } else showToast("O material não possui link disponível.", "info");
  }
  function metricaMateria(m: Materia) {
    const itens = (m.modulos ?? []).flatMap(mod => mod.assuntos);
    const completos = itens.filter(a => a.concluido).length;
    const percentual = itens.length ? Math.round(completos / itens.length * 100) : 0;
    const aulas = soma(itens.map(a => a.aulas?.length ?? (a.aula ? 1 : 0)));
    const materiaisEmbed = soma(itens.map(a => (a.materiais?.length ?? 0) + (a.pdf ? 1 : 0)));
    const documentos = materiais.filter(x => materialPertenceAMateria(x, {materia:m.nome,materiaId:m.id})).length + materiaisEmbed;
    const questoesMateria = soma(questoes.filter(x => x.materiaId === m.id || (!x.materiaId && norm(x.materia)===norm(m.nome))).map(x => x.certas+x.erradas));
    return {total:itens.length,completos,percentual,aulas,documentos,questoes:questoesMateria};
  }
  function aulasConcluidas(a: Assunto) {return a.aulas?.filter(x => x.concluida).length ?? (a.concluido ? 1 : 0);}
  const selecionada = materiaAtual;
  return <section className="sp-estudos">
    <header className="sp-heading sp-heading-simple">
      <div className="sp-identity"><div><h1>Estudos</h1><p>Organize suas matérias, módulos e conteúdos.</p></div></div>
      <button type="button" className="sp-primary" onClick={()=>abrirCadastro(local)}><Plus size={19}/> Adicionar conteúdo</button>
    </header>
    <div className="sp-layout sp-layout-simple"><div className="sp-main">
        <div className="sp-panel sp-content">
          {erroMateriais&&<p className="sp-warning">{erroMateriais}</p>}
          {carregandoMateriais&&<p className="sp-hint">Consultando materiais…</p>}
          {busca&&<p className="sp-hint">Resultados para “{busca}” <button type="button" className="sp-back" onClick={()=>setBusca("")}>Limpar filtro</button></p>}
          {!selecionada && <>
            <div className="sp-panel-head"><div><h2>Suas matérias</h2><p>Abra uma matéria para acessar os módulos e assuntos.</p></div>
              <div className="sp-switch"><button type="button" className={exibicao==="grade"?"ativo":""} onClick={()=>setExibicao("grade")}><LayoutGrid size={17}/> Grade</button>
                <button type="button" className={exibicao==="lista"?"ativo":""} onClick={()=>setExibicao("lista")}><List size={17}/> Lista</button></div>
            </div>
            <div className={"sp-cards "+(exibicao==="lista"?"lista":"")}>
              {disciplinasFiltradas.map((m,indice)=>{
                const Icon=ICONES[indice%ICONES.length];
                const t=metricaMateria(m);
                return <button type="button" className={"sp-subject "+(indice===0?"destaque":"")} key={m.id} onClick={()=>selecionarMateria(m.id)}>
                  <div className="sp-subject-top">
                    <span className={"sp-subject-icon "+(indice%3===1?"roxo":"")}><Icon size={27}/></span>
                    <div className="sp-subject-text"><strong>{m.nome}</strong><small>{t.completos} de {t.total} conteúdos</small>
                      <div className="sp-meter-row"><div className="sp-meter"><span style={{width:t.percentual+"%"}}/></div><b>{t.percentual}%</b></div>
                    </div><ChevronRight size={19}/>
                  </div>
                  <div className="sp-subject-stats"><span><Video size={15}/>{t.aulas} aulas</span><span><FileText size={15}/>{t.documentos} materiais</span><span><MessageSquareMore size={15}/>{t.questoes} questões</span></div>
                </button>;
              })}
            </div>
            {disciplinasFiltradas.length===0&&<p className="sp-empty">Nenhuma matéria localizada. Confira a busca ou o edital ativo.</p>}
          </>}
          {selecionada && <>
            <div className="sp-panel-head"><div>
              {selecionada&&<button type="button" className="sp-back" onClick={()=>{setMateriaId(null);setModuloId(null);setAssuntoId(null);}}><ArrowLeft size={16}/> Todas as disciplinas</button>}
              <h2>{local ? local.assunto.nome : selecionada ? selecionada.nome : "Biblioteca de conteúdos"}</h2>
              <p>{local ? local.materia.nome+" → "+local.modulo.nome : "Matéria → Módulo → Assunto → Aula, com todos os vínculos preservados."}</p>
            </div></div>
            {local ? <div className="sp-detail">
              <div className="sp-mini-stats"><span><BookOpen size={17}/>{aulasConcluidas(local.assunto)}/{local.assunto.aulas?.length ?? 0} aulas concluídas</span>
                <button type="button" className="sp-outline" onClick={()=>alternarAssunto(local)}>{local.assunto.concluido?"Reabrir assunto":"Concluir assunto"}</button></div>
              <h3>Videoaulas e fontes</h3>
              {ordenarAulas(local.materia,local.assunto).map(aula=><div className="sp-lesson" key={aula.id}>
                <button type="button" className="sp-check" aria-label={aula.concluida?"Desmarcar aula":"Marcar aula concluída"} onClick={()=>alternarAula(local,aula)}>
                  {aula.concluida?<CheckCircle2 color="#16a56c" size={20}/>:<Circle color="#98a7c0" size={20}/>}</button>
                <div><strong className={aula.concluida?"feito":""}>{aula.nome}</strong><small>{aula.origemCurso?.cursoNome ?? "Aula própria"}</small></div>
                <button type="button" className="sp-outline" onClick={()=>abrirCentral(local,aula)}><PlayCircle size={16}/> Estudar</button>
              </div>)}
              {!local.assunto.aulas?.length && <p className="sp-hint">Nenhuma videoaula interna. {local.assunto.aula?"Há um link de aula disponível.":"Você pode adicionar uma nova."}</p>}
              {local.assunto.aula&&<button type="button" className="sp-outline" onClick={()=>abrirCentral(local)}>Abrir aula vinculada</button>}
              <div className="sp-detail-actions"><button type="button" className="sp-outline" onClick={()=>abrirCadastro(local,"pdf")}><Plus size={15}/> PDF</button>
                <button type="button" className="sp-outline" onClick={()=>abrirCadastro(local,"aula")}><Plus size={15}/> Aula</button>
                <button type="button" className="sp-outline" onClick={()=>abrirQuestoes(local)}><MessageSquareMore size={15}/> Questões IA</button></div>
              <h3>Materiais e links do assunto</h3>
              {materiaisDo(local).map(mat=><div className="sp-resource" key={mat.id}>
                <FileText size={19}/><div><strong>{mat.nome}</strong><small>{mat.tipo==="arquivo"?"Arquivo cadastrado":mat.categoriaLink==="questoes"?"Link de questões":"Link externo"}</small></div>
                <button type="button" className="sp-outline" onClick={()=>{void abrirArquivo(mat);}}>Abrir</button>
              </div>)}
              {(local.assunto.materiais ?? []).map(mat=><div className="sp-resource" key={mat.id}><FileText size={19}/>
                <div><strong>{mat.nome}</strong><small>Material associado ao conteúdo</small></div>
                <button type="button" className="sp-outline" onClick={()=>abrirMaterialInterno(mat.nome,mat.url,mat.id)}>Abrir</button></div>)}
              {local.assunto.pdf&&<div className="sp-resource"><FileText size={19}/><div><strong>PDF da aula</strong></div><button type="button" className="sp-outline" onClick={()=>abrirMaterialInterno("PDF da aula",local.assunto.pdf!,local.assunto.id)}>Abrir</button></div>}
              {local.assunto.questoes&&<div className="sp-resource"><MessageSquareMore size={19}/><div><strong>Link de questões cadastrado</strong></div><button type="button" className="sp-outline" onClick={()=>abrirMaterialInterno("Questões de "+local.assunto.nome,local.assunto.questoes!,local.assunto.id+"-questoes")}>Abrir</button></div>}
              {materiaisDo(local).length===0&&!local.assunto.materiais?.length&&!local.assunto.pdf&&!local.assunto.questoes&&<p className="sp-hint">Ainda não há materiais registrados neste assunto.</p>}
              <h3>Revisões e histórico</h3>
              {revisoes.filter(r => r.assuntoId===local.assunto.id||r.grupoAssuntosIds?.includes(local.assunto.id)).map(r=>
                <button type="button" className="sp-review-full" key={r.id} onClick={()=>navigate("/revisoes",{state:{revisaoId:r.id}})}>
                  <CalendarDays size={18}/><span>{r.assunto} · Etapa {r.etapa} · {dataLocal(r.dataPrevista)}</span><ChevronRight size={18}/></button>)}
              <button type="button" className="sp-back" onClick={()=>setAssuntoId(null)}>Voltar aos módulos</button>
            </div> :
            selecionada ? <div className="sp-modules">{(selecionada.modulos ?? []).map(mod=>{
              const aberto=moduloId===mod.id||!!consultar;
              const gruposTodos=agruparAssuntosParaExibicao(selecionada.nome,mod.id,mod.assuntos);
              const assuntosFiltrados=mod.assuntos.filter(a=>!consultar||norm(mod.nome).includes(consultar)||norm(a.nome).includes(consultar)||
                (a.aulas??[]).some(x=>norm(x.nome).includes(consultar))||
                gruposTodos.some(g=>norm(g.titulo).includes(consultar)&&g.assuntos.some(x=>x.id===a.id)));
              const grupos=agruparAssuntosParaExibicao(selecionada.nome,mod.id,assuntosFiltrados);
              return <section key={mod.id} className="sp-module">
                <button type="button" className="sp-module-head" onClick={()=>setModuloId(aberto?null:mod.id)}>
                  <div><strong><Folder size={18}/> {mod.nome}</strong><small>{mod.assuntos.filter(a=>a.concluido).length} de {mod.assuntos.length} assuntos concluídos</small></div>
                  <ChevronDown className={aberto?"aberto":""} size={19}/></button>
                {aberto&&<div className="sp-module-body">{grupos.map(g=>{
                  const grupoVisivel = g.tipo==="unico" || Boolean(consultar) || Boolean(gruposAbertos[g.chave]);
                  return <div className={g.tipo==="unico"?"sp-topic-one":"sp-topic-group"} key={g.chave}>
                    {g.tipo!=="unico"&&<button type="button" className="sp-topic-group-head" aria-expanded={grupoVisivel}
                      onClick={()=>setGruposAbertos(v=>({...v,[g.chave]:!v[g.chave]}))}>
                      <Layers3 size={18}/><strong>{g.titulo}</strong>
                      <small>{g.assuntos.filter(a=>a.concluido).length}/{g.assuntos.length} partes · revisão do bloco</small>
                      <ChevronDown size={17}/></button>}
                    {grupoVisivel&&g.assuntos.map(a=><div className="sp-topic" key={a.id}>
                      <div><strong>{a.nome}</strong><small>{aulasConcluidas(a)} de {a.aulas?.length??0} aulas · {(a.materiais?.length??0)+materiaisDo({materia:selecionada,modulo:mod,assunto:a}).length} materiais</small></div>
                      <span className={"sp-chip "+(a.concluido?"ok":"")}>{a.concluido?"Concluído":"Pendente"}</span>
                      <button type="button" className="sp-outline" onClick={()=>selecionarAssunto({materia:selecionada,modulo:mod,assunto:a})}>Abrir <ChevronRight size={15}/></button>
                    </div>)}
                  </div>;
                })}{assuntosFiltrados.length===0&&<p className="sp-empty">Sem assuntos nesta busca.</p>}</div>}
              </section>;
            })}</div> :
            <div className="sp-index">{disciplinasFiltradas.map(m=><button type="button" className="sp-index-row" key={m.id} onClick={()=>selecionarMateria(m.id)}>
              <BookOpen size={19}/><strong>{m.nome}</strong><span>{m.modulos?.length??0} módulos</span><ChevronRight size={18}/></button>)}</div>}
          </>}
        </div>
        <p className="sp-foot">Prévia do novo visual · Conteúdo vindo da sua conta · <button type="button" onClick={()=>navigate("/estudos/legado")}>Abrir visual anterior</button></p>
      </div>
        <div className="sp-preview-safe"><SlidersHorizontal size={16}/>
          <label><input type="checkbox" checked={somenteLeitura} onChange={e=>setSomenteLeitura(e.target.checked)}/> Teste sem salvar</label>
          <small>{somenteLeitura?"Modo seguro: somente navegação; cadastros e conclusões bloqueados.":"Atenção: alterações realizadas serão gravadas na sua conta."}</small>
          <small>Sincronização: {statusNuvem}</small>
        </div>

    </div>
    {cadastro&&<div className="sp-modal-overlay" role="presentation">
      <section className="sp-modal" role="dialog" aria-modal="true" aria-label="Adicionar conteúdo">
        <div className="sp-modal-head"><div><h2><Plus size={24}/> Adicionar conteúdo</h2><p>Associe cada item à matéria, módulo e assunto corretos.</p></div><button type="button" onClick={()=>setCadastro(false)} aria-label="Fechar"><X size={20}/></button></div>
        <label>O que deseja adicionar?<select value={estrutura} onChange={e=>{setEstrutura(e.target.value as typeof estrutura);setNovoNome("");}}>
          <option value="conteudo">Aula, PDF, questões ou link</option><option value="materia">Nova matéria</option><option value="modulo">Novo módulo</option><option value="assunto">Novo assunto</option>
        </select></label>
        {estrutura==="conteudo"&&<div className="sp-modal-types">
          {([["pdf",FileText,"PDF"],["aula",Video,"Aula"],["questoes",MessageSquareMore,"Questões"],["link",Link2,"Link"]] as const).map(([id,Icon,label])=>
            <button type="button" className={tipo===id?"ativo":""} key={id} onClick={()=>{setTipo(id);setArquivo(null);}}><Icon size={24}/>{label}</button>)}
        </div>}
        <div className="sp-modal-cols">
          {estrutura!=="materia"&&<label>Matéria<select value={destMateria} onChange={e=>{setDestMateria(e.target.value);setDestModulo("");setDestAssunto("");}}>
            <option value="">Selecione a matéria</option>{disciplinas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>}
          {(estrutura==="conteudo"||estrutura==="assunto")&&<label>Módulo<select value={destModulo} onChange={e=>{setDestModulo(e.target.value);setDestAssunto("");}}>
            <option value="">Selecione o módulo</option>{(materiaCadastro?.modulos??[]).map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>}
        </div>
        {estrutura==="conteudo"&&<label>Assunto<select value={destAssunto} onChange={e=>setDestAssunto(e.target.value)}>
          <option value="">Selecione o assunto</option>{(moduloCadastro?.assuntos??[]).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>}
        <label>Nome<input value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder={estrutura==="conteudo"?"Nome do PDF, aula ou link":"Nome do novo cadastro"}/></label>
        {estrutura==="conteudo"&&tipo==="pdf"&&<label> Arquivo PDF (opcional se houver URL)<input type="file" accept=".pdf,application/pdf" onChange={e=>setArquivo(e.target.files?.[0]??null)}/></label>}
        {estrutura==="conteudo"&&<label>{tipo==="pdf"?"Link para o PDF (alternativa ao arquivo)":"5. Link do conteúdo"}<input value={novoUrl} onChange={e=>setNovoUrl(e.target.value)} placeholder="https://..." type="url"/></label>}
        {estrutura==="conteudo"&&tipo==="questoes"&&<p className="sp-hint">Um link de questões ficará vinculado ao assunto. Questões completas com alternativas e gabarito podem ser administradas no banco de questões.</p>}
        {estrutura==="conteudo"&&<div className="sp-destination"><BookmarkCheck size={18}/> <span>Destino: <strong>{materiaCadastro?.nome??"Matéria"} → {moduloCadastro?.nome??"Módulo"} → {assuntoCadastro?.nome??"Assunto"}</strong>
          O item aparecerá em Conteúdos e, quando aplicável, no Centro de Materiais.</span></div>}
        <div className="sp-modal-foot"><button type="button" className="sp-secondary" onClick={()=>setCadastro(false)}>Cancelar</button>
          <button type="button" className="sp-primary" disabled={salvando} onClick={()=>{void salvarCadastro();}}>{salvando?"Salvando…":<><Upload size={17}/> Salvar conteúdo</>}</button></div>
      </section>
    </div>}
  </section>;
}
