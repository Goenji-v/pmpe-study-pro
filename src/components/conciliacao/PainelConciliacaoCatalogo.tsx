import type { RelatorioConciliacao, SituacaoConciliacao } from "../../utils/conciliacaoImportacaoCatalogo";
import "./PainelConciliacaoCatalogo.css";

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
};

/** Painel de leitura: não salva IDs, não reclassifica aulas, não mescla revisões. */
export default function PainelConciliacaoCatalogo({
  titulo, relatorio, confirmado, onConfirmar, sincronizacaoInsegura = false,
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
