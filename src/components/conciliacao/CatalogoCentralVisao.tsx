import {
  DISCIPLINAS_CATALOGO,
  FAMILIAS_CATALOGO,
} from "../../utils/catalogoAssuntosCentral";
import "./PainelConciliacaoCatalogo.css";
import type { Materia } from "../../types";
import {
  compararImportacaoConteudos,
  type CandidatoImportacao,
} from "../../utils/conciliacaoImportacaoCatalogo";

// Cenário fictício, somente para ensaiar curso antigo -> edital novo.
// NUNCA é preenchido com o estado real da conta e não escreve na nuvem.
const CURSO_DEMONSTRACAO: Materia[] = [{
  id: "exemplo-curso-rlm",
  nome: "RLM",
  assuntos: [
    { id: "ex-1", nome: "Conectivos lógicos", concluido: true, prioridade: "media" },
    { id: "ex-2", nome: "Equivalências lógicas", concluido: true, prioridade: "media" },
    { id: "ex-3", nome: "Lógica argumentativa", concluido: true, prioridade: "media" },
    { id: "ex-4", nome: "Combinação simples", concluido: false, prioridade: "media" },
  ],
}];
const EDITAL_DEMONSTRACAO: CandidatoImportacao[] = [
  {origem: "edital", materia: "Raciocínio Lógico", idOrigem: "ex-edital-1",
   assunto: "Estruturas lógicas: proposições, conectivos, quantificadores e falácias"},
  {origem: "edital", materia: "Raciocínio Lógico", idOrigem: "ex-edital-2",
   assunto: "Lógica de argumentação: analogias, inferências, deduções, equivalência, implicação e argumentos válidos"},
  {origem: "edital", materia: "Raciocínio Lógico", idOrigem: "ex-edital-3",
   assunto: "Diagramas lógicos"},
  {origem: "edital", materia: "Raciocínio Lógico", idOrigem: "ex-edital-4",
   assunto: "Princípios e técnicas de contagem, princípio multiplicativo, permutações, arranjos, combinações e probabilidade"},
];
const SIMULACAO = compararImportacaoConteudos(CURSO_DEMONSTRACAO, EDITAL_DEMONSTRACAO);

/** Consulta do dicionário na prévia. Não modifica nem reclassifica a conta. */
export default function CatalogoCentralVisao() {
  return (
    <details className="catalogo-central-visao">
      <summary>
        <span>CATÁLOGO CENTRAL · PARA SUA ANÁLISE</span>
        <strong>Ver disciplinas, assuntos, subassuntos e nomes alternativos</strong>
        <small>Somente consulta. Nada será unificado por abrir esta área.</small>
      </summary>
      <div className="catalogo-central-introducao">
        <strong>Como interpretar o mapa</strong>
        <p><b>Disciplina</b> organiza a matéria. <b>Assunto principal</b> agrupa conteúdos relacionados.
          <b> Subassunto</b> identifica o que realmente foi ensinado.
          <b> Nome alternativo</b> ajuda a reconhecer títulos diferentes de cursos e editais.</p>
        <p>Uma família compartilhada não autoriza concluir que duas aulas são iguais.
          Conectivos, tabelas-verdade e equivalências continuam subassuntos independentes.
          Confira as correspondências antes de permitir uma migração de IDs.</p>
      </div>
      <details className="catalogo-central-simulacao">
        <summary>Simular curso antigo + edital novo (sem alterar a conta)</summary>
        <p>Cenário fictício: curso com Conectivos, Equivalências, Lógica Argumentativa e Combinação Simples;
          edital com os quatro títulos completos de RLM. Nenhum ID, aula, material ou revisão é alterado.</p>
        <div className="catalogo-central-simulacao-metricas">
          <span><strong>{SIMULACAO.total}</strong> títulos analisados</span>
          <span><strong>{SIMULACAO.risco}</strong> títulos para conferência</span>
          <span><strong>{SIMULACAO.novos}</strong> sem correspondência no curso</span>
        </div>
        <div className="catalogo-central-simulacao-lista">
          {SIMULACAO.itens.map((item) => (
            <article key={item.idOrigem}>
              <strong>{item.assunto}</strong>
              <small>{item.situacao === "titulo-composto" ? "Título com vários subassuntos" :
                item.situacao === "novo" ? "Sem correspondência no curso antigo" : "Conferir classificação"}</small>
              <p>{item.subassuntosIds.length ? item.subassuntosIds.map((id) => {
                const grupo = FAMILIAS_CATALOGO.find((familia) => familia.subassuntos.some((sub) => sub.id === id));
                return grupo?.subassuntos.find((sub) => sub.id === id)?.nome ?? id;
              }).join(" · ") : item.explicacao}</p>
            </article>
          ))}
        </div>
        <p><strong>Resultado:</strong> o catálogo sugere o vínculo pedagógico, sem mesclar IDs.
          O importador real continua exigindo aprovação e backup antes de qualquer atualização.</p>
      </details>
      <div className="catalogo-central-disciplinas">
        {DISCIPLINAS_CATALOGO.map((disciplina) => {
          const familias = FAMILIAS_CATALOGO.filter((familia) => familia.disciplinaId === disciplina.id);
          return (
            <section key={disciplina.id}>
              <h3>{disciplina.nome}</h3>
              <p>Outros nomes da disciplina: {disciplina.nomesAlternativos.join(", ") || "—"}</p>
              {familias.map((familia) => (
                <div key={familia.id} className="catalogo-central-familia">
                  <strong>{familia.nome}</strong>
                  <code>{familia.id}</code>
                  {familia.nomesAlternativos.length > 0 && (
                    <small>Também aparece como: {familia.nomesAlternativos.join(" · ")}</small>
                  )}
                  <ul>
                    {familia.subassuntos.map((topico) => (
                      <li key={topico.id}>
                        <b>{topico.nome}</b>
                        {topico.tipo === "material" && <em> (material complementar)</em>}
                        <span> · {topico.id}</span>
                        {topico.nomesAlternativos.length > 0 &&
                          <small>Variações: {topico.nomesAlternativos.join(" · ")}</small>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <p className="catalogo-central-rodape">
        Catálogo inicial para homologação. Assuntos não reconhecidos permanecem na lista original;
        o sistema não altera automaticamente registros concluídos, revisões ou o Plano Tático.
      </p>
    </details>
  );
}
