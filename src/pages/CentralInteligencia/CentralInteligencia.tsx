import { armazenamentoLocalDaConta as localStorage } from "../../services/armazenamentoConta";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, BrainCircuit, CalendarCheck2, CheckCircle2,
  ChevronDown, Compass, FileBarChart2, Info, RotateCcw,
  ShieldCheck, Sparkles, Target, TrendingUp,
} from "lucide-react";

import "./CentralInteligencia.css";
import { useApp } from "../../context/AppContext";
import { BarraProgresso } from "../../components/inteligencia/ComponentesInteligencia";
import { criarPlanoOperacional, obterConclusoesPlanoOperacional } from "../../utils/planoOperacional";
import { getMissaoDoDiaOuProxima, getSemanaOperacional } from "../../utils/planoUtils";
import { obterDiaAtualPlano, NOMES_DIAS_PLANO } from "../../utils/planoCalendario";
import { calcularCentralInteligencia } from "../../services/inteligencia/calcularCentralInteligencia";
import type { DesempenhoAssunto, MissaoDia } from "../../services/inteligencia/types";
import { formatarMinutos, formatarTipoMissao, percentualMeta } from "../../services/inteligencia/utils";

const CHAVE_FILTRO_MATERIAIS = "pmpe_filtro_materiais";

export default function CentralInteligencia() {
  const navigate = useNavigate();
  const { questoes, sessoes, revisoes, simulados, materias, missoesConcluidas, configuracoes } = useApp();
  const [versaoPlano, setVersaoPlano] = useState(0);

  useEffect(() => {
    const atualizar = () => setVersaoPlano((valor) => valor + 1);
    const eventos = ["pmpe-plano-atualizado", "pmpe-dashboard-atualizado", "focus"];
    eventos.forEach((nome) => window.addEventListener(nome, atualizar));
    return () => eventos.forEach((nome) => window.removeEventListener(nome, atualizar));
  }, []);

  const planoCalendario = useMemo(
    () => criarPlanoOperacional(materias, missoesConcluidas, configuracoes),
    [materias, missoesConcluidas, configuracoes]
  );
  const conclusoesPlano = useMemo(
    () => obterConclusoesPlanoOperacional(materias, missoesConcluidas, planoCalendario),
    [materias, missoesConcluidas, planoCalendario]
  );
  const missaoPrincipal = useMemo(() => {
    const semana = getSemanaOperacional(
      conclusoesPlano, planoCalendario, configuracoes.semanaAtualPlano, configuracoes.dataInicioPlano
    );
    const dia = obterDiaAtualPlano();
    const proxima = getMissaoDoDiaOuProxima(missoesConcluidas, planoCalendario, semana, dia);
    return { proxima, semana, dia };
    /* Recalcular quando o Plano Tático avisar que a missão mudou. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoCalendario, conclusoesPlano, missoesConcluidas, configuracoes.semanaAtualPlano, configuracoes.dataInicioPlano, versaoPlano]);
  const [mostrarCalculo, setMostrarCalculo] = useState(false);

  const dados = useMemo(
    () => calcularCentralInteligencia({
      questoes,
      sessoes,
      revisoes,
      simulados,
      metaMinutos: configuracoes.metaMinutosDiaria,
      metaQuestoes: configuracoes.metaQuestoesDiaria,
      metaRevisoes: configuracoes.metaRevisoesDiaria,
    }),
    [
      questoes, sessoes, revisoes, simulados,
      configuracoes.metaMinutosDiaria, configuracoes.metaQuestoesDiaria,
      configuracoes.metaRevisoesDiaria,
    ]
  );

  const critico = dados.assuntosCriticos[0] ?? null;
  const aocp = dados.bancas.find((banca) => banca.banca === "Instituto AOCP") ?? null;
  const semNota = dados.materias.filter((materia) => materia.total === 0 && materia.minutos > 0);
  const materiasAvaliadas = dados.materias.filter((materia) => materia.total > 0);

  function abrirMissao(missao: MissaoDia) {
    localStorage.setItem(
      "pmpe_missao_inteligente_atual",
      JSON.stringify({ ...missao, criadaEm: new Date().toISOString() })
    );
    navigate(missao.rota);
  }

  function abrirMateriais(materia: string, assunto = "") {
    localStorage.setItem(CHAVE_FILTRO_MATERIAIS, JSON.stringify({ materia, assunto }));
    navigate("/materiais");
  }

  return (
    <section className="inteligencia-container inteligencia-v2">
      <header className="inteligencia-v2-hero">
        <div className="inteligencia-v2-hero-copia">
          <span className="inteligencia-v2-sobretitulo"><BrainCircuit size={15} /> INTELIGÊNCIA DE ESTUDOS</span>
          <h1>Seu centro estratégico</h1>
          <p>Menos números soltos. Veja o que estudar, o motivo da prioridade e como está sua evolução.</p>
          <div className="inteligencia-v2-hero-acoes">
            <button type="button" className="inteligencia-v2-botao-primario" onClick={() => navigate("/plano")}>
              <CalendarCheck2 size={17} /> Ir para o Plano Tático <ArrowRight size={16} />
            </button>
            <button type="button" className="inteligencia-v2-botao-discreto" onClick={() => navigate("/inteligencia?aba=coach")}>
              <Sparkles size={16} /> IA Coach
            </button>
          </div>
        </div>
        <div className="inteligencia-v2-prontidao">
          <span>Índice de prontidão</span>
          <strong>{dados.indiceProntidao}<small>/100</small></strong>
          <p>{dados.classificacao}</p>
          <BarraProgresso percentual={dados.indiceProntidao} />
          <button type="button" className="inteligencia-v2-explicar" onClick={() => setMostrarCalculo((atual) => !atual)} aria-expanded={mostrarCalculo}>
            <Info size={14} /> Como é calculado? <ChevronDown size={14} className={mostrarCalculo ? "girado" : ""} />
          </button>
        </div>
      </header>

      {mostrarCalculo && (
        <section className="inteligencia-v2-explicacao">
          <strong>O índice é um termômetro de estudo, não sua nota nem uma chance de aprovação.</strong>
          <p>Combina aproveitamento das questões (35%), simulados (20%), cumprimento do tempo de estudo (20%), frequência (15%) e tamanho da amostra (10%). Revisões atrasadas reduzem o resultado. A fórmula é uma heurística do Study Pro e não utiliza nota de corte ou concorrência.</p>
        </section>
      )}

      <div className="inteligencia-v2-cabecalho-secao">
        <div>
          <span className="inteligencia-v2-sobretitulo">ONDE CONCENTRAR A ENERGIA</span>
          <h2><Target size={22} /> Seu foco de hoje</h2>
          <p>A missão oficial é definida pelo Plano Tático. A Inteligência sugere reforços, mas não cria ou conclui tarefas do plano.</p>
        </div>
      </div>

      <div className="inteligencia-v2-foco-grid">
        <article className="inteligencia-v2-foco-card foco-plano">
          <div className="inteligencia-v2-foco-icone"><CalendarCheck2 size={21} /></div>
          <span className="inteligencia-v2-foco-label">01 · MISSÃO PRINCIPAL</span>
          {missaoPrincipal.proxima ? (
            <>
              <h3>{missaoPrincipal.proxima.missao.materia}</h3>
              <p>
                <strong className="inteligencia-v2-assunto-missao">{missaoPrincipal.proxima.missao.assunto}</strong>
                <span className="inteligencia-v2-origem-missao">
                  Semana {missaoPrincipal.proxima.semana} · {NOMES_DIAS_PLANO[missaoPrincipal.proxima.dia] ?? "Dia " + missaoPrincipal.proxima.dia}
                  {missaoPrincipal.proxima.dia !== missaoPrincipal.dia ? " · Pendência útil do plano" : ""}
                </span>
                {missaoPrincipal.dia === 7 ? "O domingo mantém as atividades de redação e simulado dentro do Plano Tático." : "Esta é a próxima missão calculada pela mesma regra do Plano Tático."}
              </p>
              <button type="button" onClick={() => navigate("/plano", { state: { semana: missaoPrincipal.proxima?.semana, dia: missaoPrincipal.proxima?.dia } })}>Ver missão no plano <ArrowRight size={16}/></button>
            </>
          ) : (
            <>
              <h3>{planoCalendario.length ? "Nenhuma missão pendente" : "Configure seu Plano Tático"}</h3>
              <p>{planoCalendario.length ? "Não há uma missão de conteúdo a iniciar neste momento. Confira o plano e as pendências." : "Defina sua grade de estudos para receber a missão oficial nesta área."}</p>
              <button type="button" onClick={() => navigate("/plano")}>Abrir Plano Tático <ArrowRight size={16}/></button>
            </>
          )}
        </article>
        <article className="inteligencia-v2-foco-card foco-revisao">
          <div className="inteligencia-v2-foco-icone"><RotateCcw size={21} /></div>
          <span className="inteligencia-v2-foco-label">02 · REVISÕES</span>
          <h3>{dados.revisoesAtrasadas.length > 0 ? String(dados.revisoesAtrasadas.length) + " revisões atrasadas" : dados.revisoesHoje.length > 0 ? String(dados.revisoesHoje.length) + " revisões para hoje" : "Revisões em dia"}</h3>
          <p>{dados.revisoesAtrasadas.length > 0
            ? "Priorize as vencidas, preservando a fila e as datas que você já possui."
            : dados.revisoesHoje.length > 0 ? "Você tem revisões programadas para hoje." : "Nenhuma revisão vencida ou prevista para hoje."}</p>
          <button type="button" onClick={() => navigate("/revisoes")}>Abrir revisões <ArrowRight size={16}/></button>
        </article>
        <article className="inteligencia-v2-foco-card foco-reforco">
          <div className="inteligencia-v2-foco-icone"><BookOpen size={21} /></div>
          <span className="inteligencia-v2-foco-label">03 · REFORÇO COMPLEMENTAR</span>
          {critico ? (
            <>
              <h3>{critico.assunto}</h3>
              <p>{critico.materia} · {critico.percentual}% em {critico.total} questões registradas. {critico.total < 10 ? "Amostra pequena: confirme com novas questões." : "Assunto que merece nova prática."}</p>
              <button type="button" onClick={() => abrirMateriais(critico.materia, critico.assunto)}>Abrir material do assunto <ArrowRight size={16}/></button>
            </>
          ) : (
            <>
              <h3>Nenhum reforço identificado</h3>
              <p>Registre questões por assunto para receber uma recomendação baseada nos erros.</p>
              <button type="button" onClick={() => navigate("/materiais")}>Abrir materiais <ArrowRight size={16}/></button>
            </>
          )}
        </article>
      </div>

      <section className="inteligencia-v2-ritmo" aria-label="Indicadores de estudo">
        <div className="inteligencia-v2-ritmo-titulo"><TrendingUp size={18} /><strong>Seu ritmo</strong><span>Hoje e últimos 7 dias</span></div>
        <div className="inteligencia-v2-indicadores">
          <Indicador titulo="Tempo hoje" valor={formatarMinutos(dados.hoje.minutos)} detalhe={String(percentualMeta(dados.hoje.minutos, configuracoes.metaMinutosDiaria)) + "% da meta diária"} />
          <Indicador titulo="Questões na semana" valor={String(dados.semana.questoes)} detalhe="Últimos 7 dias" />
          <Indicador titulo="Acertos na semana" valor={dados.semana.questoes > 0 ? String(dados.semana.percentual) + "%" : "—"} detalhe={dados.semana.questoes > 0 ? String(dados.semana.questoes) + " questões registradas" : "Sem questões no período"} />
          <Indicador titulo="Dias ativos" valor={String(dados.semana.diasAtivos) + "/7"} detalhe="Dias com atividade registrada" />
        </div>
      </section>

      <div className="inteligencia-v2-divisao">
        <section className="inteligencia-v2-painel">
          <div className="inteligencia-v2-painel-topo">
            <div>
              <span className="inteligencia-v2-sobretitulo">OPCIONAL · NÃO ALTERA O PLANO</span>
              <h2><Compass size={20} /> Próximas ações recomendadas</h2>
              <p>Atalhos calculados a partir dos seus registros. Abra individualmente o que fizer sentido.</p>
            </div>
            {dados.missoes.length > 0 && <small>{formatarMinutos(dados.tempoMissao)} sugeridos</small>}
          </div>
          {dados.missoes.length ? (
            <div className="inteligencia-v2-acoes-lista">
              {dados.missoes.slice(0, 3).map((missao, indice) => (
                <article className="inteligencia-v2-acao" key={missao.id}>
                  <span className="inteligencia-v2-acao-numero">{indice + 1}</span>
                  <div>
                    <strong>{missao.titulo}</strong>
                    <p>{missao.descricao}</p>
                    <small>{formatarTipoMissao(missao.tipo)} · {missao.minutos} min{missao.quantidadeQuestoes ? " · " + missao.quantidadeQuestoes + " questões" : ""}</small>
                  </div>
                  <button type="button" onClick={() => abrirMissao(missao)} aria-label={"Abrir " + missao.titulo}>Abrir <ArrowRight size={15}/></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="inteligencia-v2-vazio">Sem sugestões extras por enquanto. Siga sua missão no Plano Tático.</div>
          )}
        </section>

        <section className="inteligencia-v2-painel inteligencia-v2-cenario">
          <div className="inteligencia-v2-painel-topo">
            <div>
              <span className="inteligencia-v2-sobretitulo">LEITURA DO MOMENTO</span>
              <h2><ShieldCheck size={20} /> Diagnóstico rápido</h2>
              <p>Baseado nos dados disponíveis, sem prever aprovação.</p>
            </div>
          </div>
          <div className="inteligencia-v2-cenario-linhas">
            <div><span>Revisões vencidas</span><strong>{dados.revisoesAtrasadas.length}</strong></div>
            <div><span>Assuntos com baixo aproveitamento</span><strong>{dados.assuntosCriticos.length}{dados.assuntosCriticos.length === 5 ? "+" : ""}</strong></div>
            <div><span>Aproveitamento AOCP</span><strong>{aocp && aocp.total > 0 ? String(aocp.percentual) + "%" : "Sem dados"}</strong></div>
          </div>
          <p className="inteligencia-v2-amostra">{aocp ? String(aocp.total) + " questões identificadas como Instituto AOCP no histórico." : "O filtro AOCP depende da identificação correta da banca nas questões."}</p>
          <button type="button" className="inteligencia-v2-link-rodape" onClick={() => navigate("/inteligencia?aba=relatorio")}>
            Ver desempenho completo <ArrowRight size={16}/>
          </button>
        </section>
      </div>

      <div className="inteligencia-v2-cabecalho-secao inteligencia-v2-cabecalho-menor">
        <div>
          <span className="inteligencia-v2-sobretitulo">MAPA DE APRENDIZAGEM</span>
          <h2><FileBarChart2 size={21} /> Assuntos para acompanhar</h2>
          <p>Resultado observado e tamanho da amostra. Bons acertos não significam domínio definitivo.</p>
        </div>
      </div>

      <div className="inteligencia-v2-divisao">
        <PainelAssuntos
          titulo="Precisam de reforço"
          vazio="Nenhum assunto crítico identificado com as questões registradas."
          itens={dados.assuntosCriticos}
          tipo="critico"
          aoAbrir={abrirMateriais}
        />
        <PainelAssuntos
          titulo="Bons resultados observados"
          vazio="Resolva mais questões para identificar assuntos em evolução."
          itens={dados.assuntosDominados}
          tipo="positivo"
          aoAbrir={abrirMateriais}
        />
      </div>

      <details className="inteligencia-v2-detalhes">
        <summary>Explorar todos os indicadores por disciplina e banca <ChevronDown size={17} /></summary>
        <div className="inteligencia-v2-detalhes-grid">
          <section>
            <h3>Desempenho por matéria</h3>
            {materiasAvaliadas.length === 0 && <p>Sem questões registradas por matéria.</p>}
            {materiasAvaliadas.map((materia) => (
              <div className="inteligencia-v2-detalhe-linha" key={materia.materia}>
                <div><strong>{materia.materia}</strong><small>{materia.total} questões · {formatarMinutos(materia.minutos)}</small></div>
                <b>{materia.percentual}%</b>
              </div>
            ))}
            {semNota.map((materia) => (
              <div className="inteligencia-v2-detalhe-linha" key={materia.materia}>
                <div><strong>{materia.materia}</strong><small>{formatarMinutos(materia.minutos)} estudados · Sem questões avaliadas</small></div>
                <b>—</b>
              </div>
            ))}
          </section>
          <section>
            <h3>Questões por banca</h3>
            {dados.bancas.length === 0 && <p>Sem banca registrada nas questões.</p>}
            {dados.bancas.map((banca) => (
              <div className="inteligencia-v2-detalhe-linha" key={banca.banca}>
                <div><strong>{banca.banca}</strong><small>{banca.total} questões</small></div>
                <b>{banca.percentual}%</b>
              </div>
            ))}
            <p className="inteligencia-v2-amostra">Registros mistos, de IA ou sem banca confirmada aparecem separados dos exames identificados.</p>
          </section>
        </div>
      </details>

      <div className="inteligencia-v2-fecho">
        <div><span className="inteligencia-v2-sobretitulo">PRÓXIMA ETAPA</span><strong>Quer transformar os dados em uma sequência personalizada?</strong><p>O IA Coach usa o histórico para propor ações e explicar suas prioridades.</p></div>
        <button type="button" className="inteligencia-v2-botao-primario" onClick={() => navigate("/inteligencia?aba=coach")}>
          <Sparkles size={17} /> Abrir IA Coach <ArrowRight size={16}/>
        </button>
      </div>
    </section>
  );
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <article className="inteligencia-v2-indicador">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function PainelAssuntos({
  titulo, vazio, itens, tipo, aoAbrir,
}: {
  titulo: string;
  vazio: string;
  itens: DesempenhoAssunto[];
  tipo: "critico" | "positivo";
  aoAbrir: (materia: string, assunto: string) => void;
}) {
  return (
    <section className="inteligencia-v2-painel">
      <div className="inteligencia-v2-painel-topo">
        <div><h3>{tipo === "critico" ? <RotateCcw size={18}/> : <CheckCircle2 size={18}/>} {titulo}</h3></div>
      </div>
      {itens.length === 0 ? <p className="inteligencia-v2-vazio">{vazio}</p> : (
        <div className="inteligencia-v2-assuntos">
          {itens.map((assunto) => (
            <article key={assunto.chave} className={"inteligencia-v2-assunto " + tipo}>
              <div>
                <small>{assunto.materia} · {assunto.total} questões</small>
                <strong>{assunto.assunto}</strong>
                <span>{assunto.total < (tipo === "positivo" ? 20 : 10) ? "Amostra ainda limitada" : tipo === "critico" ? "Recomendado revisar e praticar" : "Mantenha revisões periódicas"}</span>
              </div>
              <div className="inteligencia-v2-assunto-acao">
                <b>{assunto.percentual}%</b>
                <button type="button" onClick={() => aoAbrir(assunto.materia, assunto.assunto)} aria-label={"Abrir materiais de " + assunto.assunto}><BookOpen size={17}/></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
