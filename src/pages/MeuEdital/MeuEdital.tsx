import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./MeuEdital.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import {
  abrirPdfEdital,
  analisarPdfEdital,
  enviarPdfEdital,
  removerPdfEdital,
  type PdfEditalArmazenado,
} from "../../services/editalInteligenteService";
import {
  DIAS_SEMANA,
  type AnaliseEdital,
  type ConfiguracoesComEdital,
  type DiaSemanaId,
  type PlanoEdital,
  type PrioridadeEdital,
} from "../../types/editalInteligente";
import {
  gerarPlanoEdital,
  mesclarMateriasDoEdital,
  normalizarAnaliseEdital,
} from "../../utils/planoEdital";

export default function MeuEdital() {
  const { configuracoes, setConfiguracoes, setMaterias } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseEdital | null>(
    config.editalAtivo?.analise ?? null
  );
  const [pdfNovo, setPdfNovo] = useState<PdfEditalArmazenado | null>(null);
  const [planoPrevio, setPlanoPrevio] = useState<PlanoEdital | null>(
    config.editalAtivo?.plano ?? null
  );
  const [processando, setProcessando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const totalAssuntos = useMemo(
    () =>
      analise?.materias.reduce(
        (total, materia) => total + materia.assuntos.length,
        0
      ) ?? 0,
    [analise]
  );

  const diasAtivos: DiaSemanaId[] = config.diasEstudo?.length
    ? config.diasEstudo
    : ["seg", "ter", "qua", "qui", "sex", "sab"];

  async function processarPdf() {
    if (!arquivo) {
      showToast("Selecione o PDF do edital.", "warning");
      return;
    }

    setProcessando(true);
    try {
      const editalId = crypto.randomUUID();
      const resultado = await analisarPdfEdital(arquivo, {
        concurso: config.concurso,
        banca: config.bancaPadrao,
      });
      const pdf = await enviarPdfEdital(arquivo, editalId);

      setAnalise(resultado);
      setPdfNovo(pdf);
      setPlanoPrevio(null);
      showToast(
        "Edital analisado. Confira matérias e assuntos antes de aplicar.",
        "success"
      );
    } catch (erro) {
      showToast(
        erro instanceof Error
          ? erro.message
          : "Não foi possível analisar o edital.",
        "error"
      );
    } finally {
      setProcessando(false);
    }
  }

  function atualizarMateria(indice: number, nome: string) {
    setAnalise((atual) => {
      if (!atual) return atual;
      const materias = [...atual.materias];
      materias[indice] = { ...materias[indice], nome };
      return { ...atual, materias };
    });
    setPlanoPrevio(null);
  }

  function removerMateria(indice: number) {
    setAnalise((atual) =>
      atual
        ? {
            ...atual,
            materias: atual.materias.filter((_, i) => i !== indice),
          }
        : atual
    );
    setPlanoPrevio(null);
  }

  function adicionarMateria() {
    setAnalise((atual) => {
      const base: AnaliseEdital = atual ?? {
        concursoDetectado: config.concurso,
        materias: [],
        analisadoEm: new Date().toISOString(),
      };

      return {
        ...base,
        materias: [
          ...base.materias,
          {
            id: "",
            nome: "Nova matéria",
            incidenciaEstimada: 3,
            assuntos: [
              { id: "", nome: "Novo assunto", prioridade: "media" },
            ],
          },
        ],
      };
    });
    setPlanoPrevio(null);
  }

  function atualizarAssunto(
    indiceMateria: number,
    indiceAssunto: number,
    campo: "nome" | "prioridade",
    valor: string
  ) {
    setAnalise((atual) => {
      if (!atual) return atual;
      const materias = [...atual.materias];
      const materia = { ...materias[indiceMateria] };
      const assuntos = [...materia.assuntos];
      assuntos[indiceAssunto] = {
        ...assuntos[indiceAssunto],
        [campo]:
          campo === "prioridade" ? (valor as PrioridadeEdital) : valor,
      };
      materia.assuntos = assuntos;
      materias[indiceMateria] = materia;
      return { ...atual, materias };
    });
    setPlanoPrevio(null);
  }

  function removerAssunto(indiceMateria: number, indiceAssunto: number) {
    setAnalise((atual) => {
      if (!atual) return atual;
      const materias = [...atual.materias];
      const materia = { ...materias[indiceMateria] };
      materia.assuntos = materia.assuntos.filter(
        (_, i) => i !== indiceAssunto
      );
      materias[indiceMateria] = materia;
      return { ...atual, materias };
    });
    setPlanoPrevio(null);
  }

  function adicionarAssunto(indiceMateria: number) {
    setAnalise((atual) => {
      if (!atual) return atual;
      const materias = [...atual.materias];
      const materia = { ...materias[indiceMateria] };
      materia.assuntos = [
        ...materia.assuntos,
        { id: "", nome: "Novo assunto", prioridade: "media" },
      ];
      materias[indiceMateria] = materia;
      return { ...atual, materias };
    });
    setPlanoPrevio(null);
  }

  function gerarPrevia() {
    if (!analise) return;
    const normalizada = normalizarAnaliseEdital(analise);

    if (normalizada.materias.length === 0) {
      showToast(
        "Mantenha pelo menos uma matéria com um assunto.",
        "warning"
      );
      return;
    }

    const plano = gerarPlanoEdital(normalizada, config);
    setAnalise(normalizada);
    setPlanoPrevio(plano);
    showToast("Prévia criada com as regras do seu perfil.", "success");
  }

  async function aplicarPlano() {
    if (!analise || !planoPrevio) {
      showToast(
        "Gere a prévia antes de aplicar o cronograma.",
        "warning"
      );
      return;
    }

    const pdf =
      pdfNovo ??
      (config.editalAtivo
        ? {
            storagePath: config.editalAtivo.storagePath,
            nomeArquivo: config.editalAtivo.nomeArquivo,
          }
        : null);

    if (!pdf) {
      showToast("Envie o PDF do edital antes de aplicar.", "warning");
      return;
    }

    setAplicando(true);
    try {
      const editalAnterior = config.editalAtivo;
      const agora = new Date().toISOString();
      const id =
        editalAnterior?.id && !pdfNovo
          ? editalAnterior.id
          : crypto.randomUUID();

      setMaterias((atuais) => mesclarMateriasDoEdital(atuais, analise));

      const novasConfiguracoes: ConfiguracoesComEdital = {
        ...config,
        editalOnboardingVisto: true,
        editalAtivo: {
          id,
          nomeArquivo: pdf.nomeArquivo,
          storagePath: pdf.storagePath,
          analise,
          plano: planoPrevio,
          confirmadoEm: agora,
        },
      };
      setConfiguracoes(novasConfiguracoes);

      if (
        pdfNovo &&
        editalAnterior?.storagePath &&
        editalAnterior.storagePath !== pdfNovo.storagePath
      ) {
        void removerPdfEdital(editalAnterior.storagePath);
      }

      showToast(
        "Edital confirmado e plano de estudos aplicado.",
        "success"
      );
      navigate("/plano");
    } catch (erro) {
      showToast(
        erro instanceof Error
          ? erro.message
          : "Não foi possível aplicar o edital.",
        "error"
      );
    } finally {
      setAplicando(false);
    }
  }

  function continuarSemEdital() {
    const novasConfiguracoes: ConfiguracoesComEdital = {
      ...config,
      editalOnboardingVisto: true,
    };
    setConfiguracoes(novasConfiguracoes);
    navigate("/");
  }

  return (
    <section className="meu-edital-page">
      <header className="meu-edital-hero">
        <div>
          <span>EDITAL INTELIGENTE</span>
          <h1>Meu Edital</h1>
          <p>
            Envie o PDF. O Study Pro separa matérias e assuntos, estima
            prioridades e monta o plano conforme sua disponibilidade.
          </p>
        </div>

        {config.editalAtivo?.storagePath && (
          <button
            type="button"
            className="edital-botao-secundario"
            onClick={() =>
              void abrirPdfEdital(config.editalAtivo!.storagePath)
            }
          >
            Abrir edital atual
          </button>
        )}
      </header>

      <div className="edital-fluxo">
        <span className="ativo">1. PDF</span>
        <span className={analise ? "ativo" : ""}>2. Conferir</span>
        <span className={planoPrevio ? "ativo" : ""}>3. Prévia</span>
        <span className={config.editalAtivo?.confirmadoEm ? "ativo" : ""}>
          4. Aplicar
        </span>
      </div>

      <article className="edital-card edital-upload-card">
        <div>
          <h2>Adicionar ou trocar edital</h2>
          <p>
            PDF completo ou verticalizado. Para análise automática, até 25 MB.
          </p>
        </div>

        <label className="edital-upload">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(evento) =>
              setArquivo(evento.target.files?.[0] ?? null)
            }
          />
          <strong>{arquivo?.name ?? "Selecionar PDF"}</strong>
          <span>
            {arquivo
              ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
              : "Clique para escolher o edital"}
          </span>
        </label>

        <button
          type="button"
          className="edital-botao-principal"
          disabled={!arquivo || processando}
          onClick={() => void processarPdf()}
        >
          {processando
            ? "Lendo edital e organizando conteúdos..."
            : "Analisar edital"}
        </button>
      </article>

      {analise && (
        <article className="edital-card">
          <div className="edital-card-cabecalho">
            <div>
              <span>CONFIRA ANTES DE IMPLEMENTAR</span>
              <h2>{analise.concursoDetectado}</h2>
              <p>
                {analise.materias.length} matérias · {totalAssuntos} assuntos
                {analise.bancaDetectada
                  ? ` · Banca ${analise.bancaDetectada}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="edital-botao-secundario"
              onClick={adicionarMateria}
            >
              + Matéria
            </button>
          </div>

          {analise.observacao && (
            <div className="edital-observacao">{analise.observacao}</div>
          )}

          <div className="edital-materias">
            {analise.materias.map((materia, indiceMateria) => (
              <section
                className="edital-materia"
                key={`${materia.id}-${indiceMateria}`}
              >
                <div className="edital-materia-topo">
                  <input
                    value={materia.nome}
                    aria-label="Nome da matéria"
                    onChange={(evento) =>
                      atualizarMateria(indiceMateria, evento.target.value)
                    }
                  />
                  <span className="edital-incidencia">
                    Prioridade da matéria {materia.incidenciaEstimada}/5
                  </span>
                  <button
                    type="button"
                    onClick={() => removerMateria(indiceMateria)}
                  >
                    Remover
                  </button>
                </div>

                <div className="edital-assuntos">
                  {materia.assuntos.map((assunto, indiceAssunto) => (
                    <div
                      className="edital-assunto"
                      key={`${assunto.id}-${indiceAssunto}`}
                    >
                      <input
                        value={assunto.nome}
                        aria-label={`Assunto de ${materia.nome}`}
                        onChange={(evento) =>
                          atualizarAssunto(
                            indiceMateria,
                            indiceAssunto,
                            "nome",
                            evento.target.value
                          )
                        }
                      />
                      <select
                        value={assunto.prioridade}
                        aria-label={`Prioridade de ${assunto.nome}`}
                        onChange={(evento) =>
                          atualizarAssunto(
                            indiceMateria,
                            indiceAssunto,
                            "prioridade",
                            evento.target.value
                          )
                        }
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                      <button
                        type="button"
                        aria-label={`Remover ${assunto.nome}`}
                        onClick={() =>
                          removerAssunto(indiceMateria, indiceAssunto)
                        }
                      >
                        ×
                      </button>
                      {assunto.justificativaPrioridade && (
                        <small>{assunto.justificativaPrioridade}</small>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="edital-adicionar-assunto"
                  onClick={() => adicionarAssunto(indiceMateria)}
                >
                  + Adicionar assunto
                </button>
              </section>
            ))}
          </div>

          <div className="edital-perfil-resumo">
            <strong>Regras que serão usadas no plano</strong>
            <div className="edital-dias-resumo">
              {DIAS_SEMANA.map((dia) => (
                <span
                  key={dia.id}
                  className={diasAtivos.includes(dia.id) ? "ativo" : ""}
                >
                  {dia.curto}
                </span>
              ))}
            </div>
            <p>
              {config.metaMinutosDiaria} min/dia ·{" "}
              {config.materiasPorDia ?? config.missoesPorDia ?? 1} matéria(s)/dia
              · {config.metaRevisoesDiaria} revisão(ões)/dia · meta de{" "}
              {config.metaQuestoesDiaria} questões/dia.
            </p>
            <button
              type="button"
              className="edital-link-config"
              onClick={() => navigate("/configuracoes")}
            >
              Alterar disponibilidade no perfil
            </button>
          </div>

          <button
            type="button"
            className="edital-botao-principal"
            onClick={gerarPrevia}
          >
            Gerar prévia do cronograma
          </button>
        </article>
      )}

      {planoPrevio && (
        <article className="edital-card edital-previa">
          <div className="edital-card-cabecalho">
            <div>
              <span>PRÉVIA</span>
              <h2>{planoPrevio.titulo}</h2>
              <p>
                {planoPrevio.totalSemanas} semana(s) para passar por{" "}
                {planoPrevio.totalAssuntos} assuntos, respeitando os dias
                escolhidos.
              </p>
            </div>
          </div>

          <div className="edital-previa-semanas">
            {planoPrevio.semanas.slice(0, 2).map((semana) => (
              <section key={semana.numero}>
                <h3>Semana {semana.numero}</h3>
                {semana.dias.map((dia) => (
                  <div className="edital-previa-dia" key={dia.id}>
                    <strong>{dia.nomeDia}</strong>
                    <div>
                      {dia.missoes.map((missao) => (
                        <span key={missao.id}>
                          {missao.materia}: {missao.assunto} ·{" "}
                          {missao.duracaoMinutos} min
                        </span>
                      ))}
                      {dia.revisoesPlanejadas > 0 && (
                        <small>
                          + até {dia.revisoesPlanejadas} revisões da fila
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>

          {planoPrevio.totalSemanas > 2 && (
            <p className="edital-previa-restante">
              A prévia mostra as 2 primeiras semanas. O plano completo terá{" "}
              {planoPrevio.totalSemanas} semanas.
            </p>
          )}

          <button
            type="button"
            className="edital-botao-principal"
            disabled={aplicando}
            onClick={() => void aplicarPlano()}
          >
            {aplicando ? "Aplicando..." : "Aplicar edital e cronograma"}
          </button>
        </article>
      )}

      {!config.editalOnboardingVisto && (
        <button
          type="button"
          className="edital-pular"
          onClick={continuarSemEdital}
        >
          Configurar depois e continuar no Study Pro
        </button>
      )}
    </section>
  );
}
