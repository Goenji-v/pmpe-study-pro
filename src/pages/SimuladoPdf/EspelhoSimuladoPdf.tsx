import { useMemo, useState } from "react";
import type { QuestaoAnaliseSimulado } from "../../utils/analiseSimuladoStudyPro";

type Props = { questoes: QuestaoAnaliseSimulado[]; respostas: Record<string, string | undefined>; nome: string };

export function gerarPromptDiagnostico(nome: string, oficial: string, aluno: string, tabela: string) {
  return `Atue como orientador de estudos. Analise exclusivamente os PDFs anexados (caderno de questões e gabarito oficial ou simulado comentado), usando o gabarito do aluno abaixo. Confira cada questão e cada explicação, sem inventar respostas, assuntos nem fontes. Identifique lacunas e proponha revisões e exercícios por matéria e assunto. Onde houver inconsistência ou questão anulada, explique a incerteza. Se precisar de informação atualizada, pesquise e cite fontes confiáveis. Diferencie fatos dos PDFs de sugestões suas.

SIMULADO: ${nome}

GABARITO OFICIAL (REFERÊNCIA):
${oficial}

RESPOSTAS DO ALUNO:
${aluno}

BALANÇO POR MATÉRIA:
${tabela}

Entregue uma análise detalhada de erros, temas prioritários e plano de revisão, distinguindo questões não respondidas e anuladas.`;
}

export default function EspelhoSimuladoPdf({questoes, respostas, nome}: Props) {
  const [copiado, setCopiado] = useState("");
  const dados = useMemo(() => {
    const ordenadas = [...questoes].sort((a,b) => a.numero-b.numero);
    const materias = new Map<string, { total: number; acertos: number; erros: number; brancos: number; anuladas: number }>();
    let acertos = 0, erros = 0, brancos = 0, anuladas = 0;
    const linhas = ordenadas.map(q => {
      const oficial = (q.gabarito ?? "").trim().toUpperCase();
      const marcada = (respostas[q.id] ?? "").trim().toUpperCase();
      const anulada = Boolean(q.anulada) || !/^[A-E]$/.test(oficial);
      const materia = q.materia?.trim() || "Matéria não identificada";
      const grupo = materias.get(materia) ?? {total:0,acertos:0,erros:0,brancos:0,anuladas:0};
      grupo.total++;
      let situacao: string;
      if(anulada) { anuladas++; grupo.anuladas++; situacao="Anulada / gabarito não confiável"; }
      else if (!marcada) { brancos++; grupo.brancos++; situacao="Em branco"; }
      else if (marcada===oficial) { acertos++; grupo.acertos++; situacao="Correta"; }
      else { erros++; grupo.erros++; situacao="Errada"; }
      materias.set(materia,grupo);
      return { numero:q.numero, oficial:anulada?"—":oficial, marcada:marcada||"—", materia, situacao };
    });
    const oficial = linhas.map(l=>`${l.numero}-${l.oficial}`).join(" ");
    const aluno = linhas.map(l=>`${l.numero}-${l.marcada}`).join(" ");
    const tabela = Array.from(materias, ([materia,g])=>`${materia}: ${g.acertos} acertos, ${g.erros} erros, ${g.brancos} em branco, ${g.anuladas} anuladas (total ${g.total})`).join("\n");
    return {linhas,oficial,aluno,tabela,materias:Array.from(materias),acertos,erros,brancos,anuladas};
  },[questoes,respostas]);
  async function copiar(valor:string, rotulo:string) {
    try { await navigator.clipboard.writeText(valor); setCopiado(rotulo); }
    catch { setCopiado("Cópia automática indisponível. Selecione o texto e copie."); }
  }
  const prompt = gerarPromptDiagnostico(nome,dados.oficial,dados.aluno,dados.tabela);
  return <section style={{maxWidth:1050,margin:"20px auto",padding:20,display:"grid",gap:20}}>
    <h2>Espelho de correção — {nome}</h2>
    <p>Correção baseada no gabarito fornecido. Nenhum diagnóstico completo é gerado pelo Study Pro.</p>
    <p role="status"><strong>{dados.acertos} acertos</strong> · {dados.erros} erros · {dados.brancos} em branco · {dados.anuladas} anuladas / não confiáveis</p>
    <h3>Desempenho por matéria</h3>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}>
      <thead><tr><th>Matéria</th><th>Total</th><th>Acertos</th><th>Erros</th><th>Em branco</th><th>Anuladas</th></tr></thead>
      <tbody>{dados.materias.map(([materia,g])=><tr key={materia}><th>{materia}</th><td>{g.total}</td><td>{g.acertos}</td><td>{g.erros}</td><td>{g.brancos}</td><td>{g.anuladas}</td></tr>)}</tbody>
    </table></div>
    <h3>Correção questão a questão</h3>
    <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}><table style={{width:"100%",textAlign:"left"}}>
      <thead><tr><th>Questão</th><th>Matéria</th><th>Oficial</th><th>Aluno</th><th>Situação</th></tr></thead>
      <tbody>{dados.linhas.map(l=><tr key={l.numero}><td>{l.numero}</td><td>{l.materia}</td><td>{l.oficial}</td><td>{l.marcada}</td><td>{l.situacao}</td></tr>)}</tbody>
    </table></div>
    <div><h3>Gabarito oficial</h3><textarea readOnly aria-label="Gabarito oficial para copiar" rows={4} value={dados.oficial} style={{width:"100%"}}/><button type="button" onClick={()=>void copiar(dados.oficial,"Gabarito oficial copiado")}>Copiar gabarito oficial</button></div>
    <div><h3>Respostas do aluno</h3><textarea readOnly aria-label="Respostas do aluno para copiar" rows={4} value={dados.aluno} style={{width:"100%"}}/><button type="button" onClick={()=>void copiar(dados.aluno,"Gabarito do aluno copiado")}>Copiar respostas do aluno</button></div>
    <div><h3>Quer um diagnóstico completo?</h3><p>Anexe o PDF da prova e o PDF do gabarito ou simulado comentado no ChatGPT ou em outra IA. Cole o prompt e suas respostas. Confira as conclusões com o material oficial.</p><textarea readOnly aria-label="Prompt para diagnóstico em outra IA" rows={9} value={prompt} style={{width:"100%"}}/><button type="button" onClick={()=>void copiar(prompt,"Prompt copiado")}>Copiar prompt completo</button></div>
    {copiado && <p role="status">{copiado}</p>}
    <small>Questões sem resposta oficial confiável não são contabilizadas como erro do aluno. A classificação por matéria depende da identificação no PDF.</small>
  </section>;
}
