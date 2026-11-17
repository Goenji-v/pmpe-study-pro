import { useState } from "react";
import type { Revisao } from "../../types";
import {
  GRUPOS_INTEGRADOS,
  idsTopicosReconhecidos,
  revisoesDaFamilia,
  type GrupoIntegradoId,
  type SubassuntoIntegrado,
} from "../../utils/catalogoRevisoesIntegradas";
import "./PainelRevisoesIntegradas.css";

export type EstadoChecklistsIntegrados = Record<string, string[]>;

type Props = {
  revisoes: Revisao[];
  marcados: EstadoChecklistsIntegrados;
  onAlternar: (chave: string, topico: string, marcado: boolean) => void;
  onTreinar: (materia: string, topicos: string[], quantidade: number) => void;
};

export default function PainelRevisoesIntegradas({
  revisoes, marcados, onAlternar, onTreinar,
}: Props) {
  const [ativo, setAtivo] = useState<GrupoIntegradoId>("logica-proposicional");
  const grupo = GRUPOS_INTEGRADOS.find((item) => item.id === ativo) ?? GRUPOS_INTEGRADOS[0];
  const familiares = revisoesDaFamilia(revisoes, ativo);
  const pendentes = familiares.filter((revisao) => !revisao.concluida);
  const cadastrados = new Set(familiares.flatMap(idsTopicosReconhecidos));
  const chave = "biblioteca:" + ativo;
  const selecionados = marcados[chave] ?? [];
  const concluidos = grupo.topicos.filter((topico) => selecionados.includes(topico.id));
  const faltam = grupo.topicos.filter((topico) => !selecionados.includes(topico.id));
  const percentual = Math.round((concluidos.length / grupo.topicos.length) * 100);

  const treinar = (topicos: readonly SubassuntoIntegrado[], quantidade: number) => {
    onTreinar(grupo.materia, topicos.map((topico) => topico.titulo), quantidade);
  };

  return (
    <section className="revisoes-integradas-biblioteca" aria-label="Biblioteca de revisões integradas">
      <header className="revisoes-integradas-topo">
        <div>
          <span className="revisoes-integradas-selo">NOVIDADE NA PRÉVIA · PILOTO</span>
          <h2>🧠 Revisão integrada por subassuntos</h2>
          <p>Revise conteúdos relacionados numa única sessão, mantendo as revisões e as etapas originais separadas.</p>
        </div>
        <span className="revisoes-integradas-sem-auto">Checklist manual · sem conclusão automática</span>
      </header>

      <div className="revisoes-integradas-abas" role="group" aria-label="Escolher assunto principal">
        {GRUPOS_INTEGRADOS.map((item) => (
          <button type="button" key={item.id} className={ativo === item.id ? "ativo" : ""}
            aria-pressed={ativo === item.id} onClick={() => setAtivo(item.id)}>
            {item.titulo}
          </button>
        ))}
      </div>

      <div className="revisoes-integradas-conteudo">
        <div className="revisoes-integradas-cabecalho">
          <div>
            <span>{grupo.materia}</span>
            <h3>{grupo.titulo}</h3>
            <p>{grupo.descricao}</p>
          </div>
          <div className="revisoes-integradas-origem">
            <strong>{familiares.length}</strong><small>registros históricos<br /> relacionados</small>
            <strong>{pendentes.length}</strong><small>pendentes neste<br /> assunto principal</small>
          </div>
        </div>
        <div className="revisoes-integradas-progresso">
          <div>
            <strong>Checklist desta sessão</strong>
            <span>{concluidos.length}/{grupo.topicos.length} conferidos</span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}
            aria-label={"Progresso manual em " + grupo.titulo} className="revisoes-integradas-barra">
            <span style={{ width: String(percentual) + "%" }} />
          </div>
        </div>

        <div className="revisoes-integradas-lista">
          {grupo.topicos.map((topico) => {
            const marcado = selecionados.includes(topico.id);
            const jaConsta = cadastrados.has(topico.id);
            return (
              <div className="revisoes-integradas-topico" key={topico.id}>
                <label>
                  <input type="checkbox" checked={marcado}
                    onChange={(evento) => onAlternar(chave, topico.id, evento.target.checked)} />
                  <span className="revisoes-integradas-texto">
                    <strong>{topico.titulo}</strong>
                    <small>{jaConsta
                      ? "Assunto identificado em revisões cadastradas"
                      : "Sem revisão individual identificada com este nome"}</small>
                  </span>
                </label>
                <button type="button" onClick={() => treinar([topico], 10)}
                  aria-label={"Treino IA sobre " + topico.titulo}>
                  Treinar tópico
                </button>
              </div>
            );
          })}
        </div>

        <div className="revisoes-integradas-rodape">
          <p>Marcar um item registra apenas a conferência nesta sessão e neste navegador. Não conclui nem reagenda a revisão no Study Pro.</p>
          <div>
            <button type="button" className="revisoes-integradas-treino-secundario"
              onClick={() => treinar(grupo.topicos, 15)}>
              Treinar todos
            </button>
            <button type="button" className="revisoes-integradas-treino-principal"
              onClick={() => treinar(faltam.length ? faltam : grupo.topicos, 15)}>
              {"✨ Treinar " + (faltam.length ? String(faltam.length) + " não conferido(s)" : "o assunto completo")}
            </button>
          </div>
        </div>
        <small className="revisoes-integradas-nota">
          A geração utiliza o estilo AOCP e os tópicos selecionados como orientação; confira a distribuição e o conteúdo antes de gerar as questões.
          As revisões futuras permanecem nas datas originais.
        </small>
      </div>
    </section>
  );
}
