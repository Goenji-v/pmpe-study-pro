import {
  DISCIPLINAS_CATALOGO,
  FAMILIAS_CATALOGO,
} from "../../utils/catalogoAssuntosCentral";
import "./PainelConciliacaoCatalogo.css";

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
