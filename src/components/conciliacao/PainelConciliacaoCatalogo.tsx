import type { RelatorioConciliacao, SituacaoConciliacao } from "../../utils/conciliacaoImportacaoCatalogo";
import { FAMILIAS_CATALOGO } from "../../utils/catalogoAssuntosCentral";
import "./PainelConciliacaoCatalogo.css";
import type { ImpactoImportacaoEstrutural } from "../../utils/simulacaoImpactoEstrutural";

const rotulos: Record<SituacaoConciliacao, string> = {
  exato: "Nome já existente",
  alias: "Mesmo subassunto, outro nome",
  "mesma-familia": "Conteúdo relacionado",
  "titulo-composto": "Abrange vários subassuntos",
  "disciplina-divergente": "Possível disciplina incorreta",
  "nome-semelhante": "Similaridade inconclusiva",
  "repetido-no-arquivo": "Repetição dentro do arquivo",
  novo: "Conteúdo novo / não identificado",
};

type Props = {
  titulo: string;
  relatorio: RelatorioConciliacao;
  confirmado: boolean;
  onConfirmar: (confirmado: boolean) => void;
  sincronizacaoInsegura?: boolean;
  impactoEstrutural?: ImpactoImportacaoEstrutural | null;
  erroImpacto?: string | null;
};

/** Painel de leitura: não salva IDs, não reclassifica aulas, não mescla revisões. */
export default function PainelConciliacaoCatalogo({
  titulo, relatorio, confirmado, onConfirmar, sincronizacaoInsegura = false,
  impactoEstrutural, erroImpacto,
}: Props) {
  const conferir = relatorio.risco + relatorio.alias + relatorio.relacionados;
  const destaques = relatorio.itens.filter((item) =>
    item.situacao !== "exato" && item.situacao !== "novo"
  );
  return (
    <section className="conciliacao-catalogo" aria-label="Comparação segura do catálogo central">
      <div className="conciliacao-catalogo-topo">
        <span>CATÁLOGO CENTRAL · PRÉVIA</span>
        <h3>{titulo}</h3>
        <p>O Study Pro identifica nomes alternativos, conteúdos apenas relacionados e riscos de duplicação ANTES de importar. Esta etapa não altera os dados.</p>
      </div>
      <div className="conciliacao-catalogo-numeros" aria-label="Resultado da comparação">
        <div><strong>{relatorio.total}</strong><small>conteúdos analisados</small></div>
        <div><strong>{relatorio.identicos}</strong><small>nomes existentes</small></div>
        <div><strong>{relatorio.alias}</strong><small>possíveis aliases</small></div>
        <div><strong>{relatorio.relacionados}</strong><small>relacionados</small></div>
        <div><strong>{relatorio.risco}</strong><small>riscos para conferir</small></div>
        <div><strong>{relatorio.novos}</strong><small>novos/não identificados</small></div>
      </div>

      {(impactoEstrutural || erroImpacto) && (
        <div className="conciliacao-catalogo-impacto" aria-label="Simulação do importador real">
          <strong>Simulação da estrutura real — sem salvar</strong>
          {impactoEstrutural ? (
            <>
              <p>Caminho testado: {impactoEstrutural.modalidade === "primeiro-edital"
                ? "primeiro edital" : "troca de edital"}. O resultado vem das mesmas funções de importação usadas pelo Study Pro.</p>
              <div className="conciliacao-catalogo-impacto-numeros">
                <span>Matérias: {impactoEstrutural.materiasAntes} → {impactoEstrutural.materiasDepois}</span>
                <span>Assuntos: {impactoEstrutural.assuntosAntes} → {impactoEstrutural.assuntosDepois}</span>
                <span>Aulas: {impactoEstrutural.aulasAntes} → {impactoEstrutural.aulasDepois}</span>
                <span>Concluídos: {impactoEstrutural.concluidosAntes} → {impactoEstrutural.concluidosDepois}</span>
                <span>Revisões: {impactoEstrutural.revisoesAntes} → {impactoEstrutural.revisoesDepois}</span>
                <span>Sessões: {impactoEstrutural.sessoesAntes} → {impactoEstrutural.sessoesDepois}</span>
                <span>Questões registradas: {impactoEstrutural.questoesAntes} → {impactoEstrutural.questoesDepois}</span>
              </div>
              <p>
                <b>{impactoEstrutural.riscosBloqueantes
                  ? "Bloqueado: " + impactoEstrutural.riscosBloqueantes + " risco(s) aos dados."
                  : "Nenhuma perda estrutural identificada pelo simulador."}</b>
                {" "}Reimportação do mesmo edital: {impactoEstrutural.idempotente ? "estável" : "instável"}.
                {" "}{impactoEstrutural.duplicacoesParaRevisar} possível(is) duplicação(ões) pedagógica(s) para conferência.
              </p>
              {impactoEstrutural.avisos.length > 0 && (
                <details>
                  <summary>Ver {impactoEstrutural.avisos.length} achado(s) da simulação</summary>
                  <ul>{impactoEstrutural.avisos.slice(0,35).map((aviso,indice) => (
                    <li key={indice}>
                      <strong>{aviso.bloqueante ? "BLOQUEANTE" : "CONFERIR"} · {aviso.assunto}</strong>
                      <span>{aviso.detalhe}</span>
                    </li>
                  ))}</ul>
                  {impactoEstrutural.avisos.length > 35 && <p>Exibindo os primeiros 35 alertas.</p>}
                </details>
              )}
            </>
          ) : (
            <p role="alert">Não foi possível calcular o impacto estrutural: {erroImpacto}.
              A aplicação fica bloqueada até resolver esse erro.</p>
          )}
        </div>
      )}

      <div className="conciliacao-catalogo-alerta">
        <strong>O que a comparação faz — e o que não faz</strong>
        <p>Conectivos, tabelas-verdade, equivalências e negação podem compartilhar uma família de revisão, mas cada um tem identidade própria. O catálogo ainda NÃO faz fusões automáticas no importador existente. A análise serve para revisar possíveis erros antes de aplicar.</p>
      </div>

      {destaques.length > 0 ? (
        <details className="conciliacao-catalogo-detalhes" open={destaques.length <= 8}>
          <summary>Ver {destaques.length} correspondência(s) que merecem conferência</summary>
          <div className="conciliacao-catalogo-lista">
            {destaques.slice(0, 40).map((item,indice) => (
              <div className="conciliacao-catalogo-item" key={item.idOrigem + ":" + indice}>
                <span className={"conciliacao-catalogo-status status-" + item.situacao}>{rotulos[item.situacao]}</span>
                <strong>{item.materia} · {item.assunto}</strong>
                <small>{item.familia ? "Família sugerida: " + item.familia + " · " : ""}
                  {item.referencia ? (item.referencia.doArquivo ? "No próprio arquivo: " : "Na conta: ") + item.referencia.assunto : "Sem conteúdo correspondente identificado"}</small>
                {item.subassuntosIds.length > 1 && (
                  <div className="conciliacao-catalogo-cobertura">
                    <strong>Subassuntos identificados (não serão fundidos automaticamente)</strong>
                    <ul>
                      {item.subassuntosIds.map((id) => {
                        const familia = FAMILIAS_CATALOGO.find((grupo) =>
                          grupo.subassuntos.some((subassunto) => subassunto.id === id)
                        );
                        const subassunto = familia?.subassuntos.find((sub) => sub.id === id);
                        return (
                          <li key={id}>
                            <span>{subassunto?.nome ?? id}</span>
                            <small>{familia?.nome ?? "Família a conferir"}</small>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <p>{item.explicacao}</p>
              </div>
            ))}
          </div>
          {destaques.length > 40 && <p>Exibindo os primeiros 40 casos. Nenhum dos demais foi aprovado automaticamente.</p>}
        </details>
      ) : (
        <p className="conciliacao-catalogo-sem-risco">Não apareceram associações duvidosas na amostra atual.</p>
      )}

      {sincronizacaoInsegura && (
        <p className="conciliacao-catalogo-bloqueio" role="alert">
          Sua conta ainda não está sincronizada (carregando, salvando, offline ou em conflito). Aguarde a sincronização ou resolva o aviso antes de importar.
        </p>
      )}
      {conferir > 0 && (
        <label className="conciliacao-catalogo-confirmacao">
          <input type="checkbox" checked={confirmado} onChange={(evento) => onConfirmar(evento.target.checked)} />
          <span>Conferi os {conferir} caso(s) de nomes diferentes ou conteúdos relacionados. Entendo que a importação atual pode manter itens separados; esta confirmação NÃO os funde automaticamente.</span>
        </label>
      )}
      <p className="conciliacao-catalogo-rodape">IDs, revisões concluídas, notas, aulas, PDFs e o Plano Tático são preservados durante esta simulação. As mudanças reais continuam protegidas pelo fluxo de aplicação existente.</p>
    </section>
  );
}
