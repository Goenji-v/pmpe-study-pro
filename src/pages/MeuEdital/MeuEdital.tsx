import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./MeuEdital.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import {
  abrirFonteEditalCatalogo,
  carregarEditaisCatalogo,
  contarAssuntosCatalogo,
  prepararAnaliseCatalogo,
} from "../../services/catalogoEditaisService";
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
import type { EditalCatalogo } from "../../types/catalogoEditais";
import type { ConfiguracoesComCursos } from "../../types/cursos";
import {
  obterReferenciasDaMissao,
  planoPMPE,
} from "../../data/planoPMPE";
import { aplicarCursosAtivosNasMaterias } from "../../utils/importacaoCurso";
import {
  gerarPlanoEdital,
  mesclarMateriasDoEdital,
  normalizarAnaliseEdital,
  preservarIdsPlanoAnterior,
} from "../../utils/planoEdital";
import {
  criarEditalAnteriorSintetico,
  prepararMigracaoEditalSegura,
  remapearMissoesConcluidasPorConteudo,
  type ResultadoPreparacaoMigracaoEdital,
} from "../../utils/migracaoEditalSegura";

const CARGOS_PMPE = [
  "Soldado PMPE",
  "Oficial PMPE",
  "Oficial Médico PMPE",
  "Oficial Dentista PMPE",
] as const;

function cargoInicialDoEdital(
  concurso: string,
  cargoSalvo?: string
) {
  if (cargoSalvo) {
    const normalizado = cargoSalvo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (normalizado.includes("soldado")) return "Soldado PMPE";
    if (normalizado.includes("medico")) return "Oficial Médico PMPE";
    if (normalizado.includes("dentista")) return "Oficial Dentista PMPE";
    if (normalizado.includes("oficial")) return "Oficial PMPE";
    return cargoSalvo;
  }

  return /PMPE|Polícia Militar de Pernambuco/i.test(concurso)
    ? "Soldado PMPE"
    : "";
}

export default function MeuEdital() {
  const {
    configuracoes,
    setConfiguracoes,
    setMaterias,
    materias,
    questoes,
    sessoes,
    revisoes,
    simulados,
    bancoQuestoes,
    simuladosGerados,
    missoesConcluidas,
    aplicarMigracaoEditalSegura,
  } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  const configCursos = configuracoes as ConfiguracoesComCursos;
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
  const [migracaoPrevia, setMigracaoPrevia] = useState<
    (ResultadoPreparacaoMigracaoEdital & {
      editalNovoId: string;
      editalNovoNome: string;
      missoesConcluidasMigradas: string[];
    }) | null
  >(null);
  const [processando, setProcessando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erroProcessamento, setErroProcessamento] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<EditalCatalogo[]>([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [mostrarEditalPessoal, setMostrarEditalPessoal] = useState(
    Boolean(config.editalAtivo && !config.editalAtivo.catalogoId)
  );
  const [editalVisualizado, setEditalVisualizado] =
    useState<EditalCatalogo | null>(null);
  const [catalogoSelecionadoId, setCatalogoSelecionadoId] = useState(
    config.editalAtivo?.catalogoId ?? ""
  );
  const [idiomasCatalogo, setIdiomasCatalogo] = useState<Record<string, string>>(
    {}
  );
  const [cargoAlvo, setCargoAlvo] = useState(() =>
    cargoInicialDoEdital(
      config.concurso,
      config.editalAtivo?.analise.cargoDetectado
    )
  );

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const editais = await carregarEditaisCatalogo();
        if (!ativo) return;

        setCatalogo(editais);
        setIdiomasCatalogo((atuais) => {
          const proximos = { ...atuais };
          for (const edital of editais) {
            if (
              edital.opcoes.idiomaPadrao &&
              !proximos[edital.id]
            ) {
              proximos[edital.id] = edital.opcoes.idiomaPadrao;
            }
          }
          return proximos;
        });
      } catch (erro) {
        if (!ativo) return;
        const mensagem =
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar os editais pré-definidos.";
        showToast(mensagem, "error");
      } finally {
        if (ativo) setCarregandoCatalogo(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [showToast]);

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

  const editalCatalogoSelecionado = useMemo(
    () =>
      catalogo.find((edital) => edital.id === catalogoSelecionadoId) ?? null,
    [catalogo, catalogoSelecionadoId]
  );
  const editaisPorGrupo = useMemo(
    () => ({
      soldado: catalogo.filter(
        (edital) =>
          edital.status === "publicado" && edital.grupoCargo === "soldado"
      ),
      oficial: catalogo.filter(
        (edital) =>
          edital.status === "publicado" && edital.grupoCargo === "oficial"
      ),
      outro: catalogo.filter(
        (edital) =>
          edital.status === "publicado" && edital.grupoCargo === "outro"
      ),
    }),
    [catalogo]
  );

  const cargoDaAnalise = analise?.cargoDetectado ?? "";
  const cargoAlteradoAposAnalise = Boolean(
    !editalCatalogoSelecionado &&
      analise &&
      cargoAlvo !== cargoDaAnalise
  );

  function selecionarEditalCatalogo(
    edital: EditalCatalogo,
    analisePersonalizada?: AnaliseEdital
  ) {
    const idioma =
      idiomasCatalogo[edital.id] ??
      edital.opcoes.idiomaPadrao ??
      edital.opcoes.idiomas?.[0];
    const resultado =
      analisePersonalizada ?? prepararAnaliseCatalogo(edital, { idioma });

    setCatalogoSelecionadoId(edital.id);
    setMostrarEditalPessoal(false);
    setAnalise(resultado);
    setCargoAlvo(edital.cargo);
    setPlanoPrevio(null);
    setMigracaoPrevia(null);
    setArquivo(null);
    setPdfNovo(null);
    setErroProcessamento(null);

    showToast(
      `${edital.organizacao} ${edital.ano} · ${edital.cargo} selecionado. Confira e gere a prévia.`,
      "success"
    );
  }

  async function abrirFonteCatalogo(edital: EditalCatalogo) {
    try {
      await abrirFonteEditalCatalogo(edital);
    } catch (erro) {
      showToast(
        erro instanceof Error
          ? erro.message
          : "Não foi possível abrir a fonte do edital.",
        "error"
      );
    }
  }

  async function processarPdf() {
    if (!arquivo) {
      showToast("Selecione o PDF do edital.", "warning");
      return;
    }

    setProcessando(true);
    setErroProcessamento(null);
    setPdfNovo(null);
    setCatalogoSelecionadoId("");

    try {
      const resultado = await analisarPdfEdital(arquivo, {
        concurso: mostrarEditalPessoal ? "" : config.concurso,
        banca: mostrarEditalPessoal ? "" : config.bancaPadrao,
        cargo: cargoAlvo,
      });

      // A conferência deve aparecer assim que a leitura termina. O salvamento
      // do PDF é uma etapa independente e não pode apagar uma análise válida.
      setAnalise(resultado);
      setCargoAlvo(resultado.cargoDetectado ?? cargoAlvo);
      setPlanoPrevio(null);
    setMigracaoPrevia(null);

      try {
        const pdf = await enviarPdfEdital(arquivo, crypto.randomUUID());
        setPdfNovo(pdf);
        showToast(
          "Edital analisado. Confira matérias e assuntos antes de aplicar.",
          "success"
        );
      } catch (erroUpload) {
        const detalhe =
          erroUpload instanceof Error
            ? erroUpload.message
            : "não foi possível salvar o PDF";
        const mensagem =
          `A leitura foi concluída e já pode ser conferida, mas o PDF ainda não foi salvo. ${detalhe}`;
        setErroProcessamento(mensagem);
        showToast(mensagem, "warning");
      }
    } catch (erro) {
      const mensagem =
        erro instanceof Error
          ? erro.message
          : "Não foi possível analisar o edital.";
      setErroProcessamento(mensagem);
      showToast(mensagem, "error");
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
    setMigracaoPrevia(null);
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
    setMigracaoPrevia(null);
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
    setMigracaoPrevia(null);
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
    setMigracaoPrevia(null);
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
    setMigracaoPrevia(null);
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
    setMigracaoPrevia(null);
  }

  function gerarPrevia() {
    if (!analise) return;

    if (cargoAlteradoAposAnalise) {
      showToast(
        "Reanalise o edital para o cargo selecionado antes de gerar o cronograma.",
        "warning"
      );
      return;
    }

    const normalizada = normalizarAnaliseEdital(analise);

    if (normalizada.materias.length === 0) {
      showToast(
        "Mantenha pelo menos uma matéria com um assunto.",
        "warning"
      );
      return;
    }

    const possuiDadosExistentes =
      materias.length > 0 ||
      questoes.length > 0 ||
      sessoes.length > 0 ||
      revisoes.length > 0 ||
      simulados.length > 0 ||
      bancoQuestoes.length > 0 ||
      simuladosGerados.length > 0 ||
      missoesConcluidas.length > 0;

    const editalAnteriorParaMigracao =
      config.editalAtivo ??
      (possuiDadosExistentes
        ? criarEditalAnteriorSintetico({
            materias,
            concurso: config.concurso,
            banca: config.bancaPadrao,
          })
        : undefined);

    if (editalAnteriorParaMigracao) {
      const editalNovoId =
        editalCatalogoSelecionado?.id ??
        crypto.randomUUID();
      const editalNovoNome =
        editalCatalogoSelecionado
          ? `${editalCatalogoSelecionado.organizacao} ${editalCatalogoSelecionado.ano} — ${editalCatalogoSelecionado.cargo}`
          : pdfNovo?.nomeArquivo ?? arquivo?.name ?? normalizada.concursoDetectado;

      const migracao = prepararMigracaoEditalSegura({
        materiasAtuais: materias,
        editalAnterior: editalAnteriorParaMigracao,
        editalNovoId,
        editalNovoNome,
        analiseNova: normalizada,
        cursos: configCursos.cursos ?? [],
        cursosAtivosIds: configCursos.cursosAtivosIds ?? [],
        contagens: {
          questoes: questoes.length,
          sessoes: sessoes.length,
          revisoes: revisoes.length,
          simulados: simulados.length,
          bancoQuestoes: bancoQuestoes.length,
          simuladosGerados: simuladosGerados.length,
          missoesConcluidas: missoesConcluidas.length,
        },
      });

      const plano = preservarIdsPlanoAnterior(
        gerarPlanoEdital(
          migracao.analiseCanonica,
          config,
          migracao.materiasMigradas
        ),
        editalAnteriorParaMigracao.plano
      );

      setAnalise(normalizada);
      setMigracaoPrevia({
        ...migracao,
        editalNovoId,
        editalNovoNome,
        missoesConcluidasMigradas:
          remapearMissoesConcluidasDoPlanoLegado(
            plano,
            missoesConcluidas
          ),
      });
      setPlanoPrevio(plano);
      showToast(
        "Prévia de migração criada. Nenhum dado da sua conta foi alterado.",
        "success"
      );
      return;
    }

    const gradePrevia = aplicarCursosAtivosNasMaterias(
      mesclarMateriasDoEdital(materias, normalizada),
      configCursos.cursos ?? [],
      configCursos.cursosAtivosIds ?? [],
      normalizada
    );
    const plano = gerarPlanoEdital(normalizada, config, gradePrevia);
    setAnalise(normalizada);
    setMigracaoPrevia(null);
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

    setAplicando(true);
    setErroProcessamento(null);

    try {
      const editalAnterior = config.editalAtivo;
      const agora = new Date().toISOString();

      if (migracaoPrevia) {
        if (migracaoPrevia.relatorio.bloqueios.length > 0) {
          throw new Error(
            `Migração bloqueada por segurança: ${migracaoPrevia.relatorio.bloqueios.join(" ")}`
          );
        }

        let novasConfiguracoes: ConfiguracoesComEdital;

        if (editalCatalogoSelecionado) {
          novasConfiguracoes = {
            ...config,
            planoPadraoAtivo: false,
            concurso: editalCatalogoSelecionado.organizacao,
            bancaPadrao:
              editalCatalogoSelecionado.banca ?? config.bancaPadrao,
            editalOnboardingVisto: true,
            editalAtivo: {
              id: migracaoPrevia.editalNovoId,
              catalogoId: editalCatalogoSelecionado.id,
              nomeArquivo: migracaoPrevia.editalNovoNome,
              storagePath: editalCatalogoSelecionado.pdfPath ?? "",
              fonteUrl: editalCatalogoSelecionado.fonteUrl,
              analise: migracaoPrevia.analiseCanonica,
              plano: planoPrevio,
              confirmadoEm: agora,
            },
          };
        } else {
          let pdf = pdfNovo;

          if (!pdf && arquivo) {
            pdf = await enviarPdfEdital(
              arquivo,
              crypto.randomUUID()
            );
            setPdfNovo(pdf);
          }

          if (!pdf) {
            throw new Error(
              "O novo PDF ainda não foi salvo. Selecione novamente o arquivo antes de aplicar a migração."
            );
          }

          novasConfiguracoes = {
            ...config,
            planoPadraoAtivo: false,
            concurso:
              migracaoPrevia.analiseCanonica.concursoDetectado ||
              config.concurso,
            bancaPadrao:
              migracaoPrevia.analiseCanonica.bancaDetectada ||
              config.bancaPadrao,
            editalOnboardingVisto: true,
            editalAtivo: {
              id: migracaoPrevia.editalNovoId,
              nomeArquivo: pdf.nomeArquivo,
              storagePath: pdf.storagePath,
              analise: migracaoPrevia.analiseCanonica,
              plano: planoPrevio,
              confirmadoEm: agora,
            },
          };
        }

        const { backupNuvemId } =
          await aplicarMigracaoEditalSegura({
            materias: migracaoPrevia.materiasMigradas,
            configuracoes: novasConfiguracoes,
            relatorio: migracaoPrevia.relatorio,
            missoesConcluidas:
              migracaoPrevia.missoesConcluidasMigradas,
          });

        showToast(
          `Novo edital aplicado com segurança. Backup pré-migração preservado: ${backupNuvemId.slice(0, 8)}…`,
          "success"
        );
        navigate("/plano");
        return;
      }

      if (editalCatalogoSelecionado) {
        setMaterias((atuais) =>
          aplicarCursosAtivosNasMaterias(
            mesclarMateriasDoEdital(atuais, analise),
            configCursos.cursos ?? [],
            configCursos.cursosAtivosIds ?? [],
            analise
          )
        );

        const novasConfiguracoes: ConfiguracoesComEdital = {
          ...config,
          concurso: editalCatalogoSelecionado.organizacao,
          bancaPadrao:
            editalCatalogoSelecionado.banca ?? config.bancaPadrao,
          editalOnboardingVisto: true,
          editalAtivo: {
            id: editalCatalogoSelecionado.id,
            catalogoId: editalCatalogoSelecionado.id,
            nomeArquivo:
              `${editalCatalogoSelecionado.organizacao} ${editalCatalogoSelecionado.ano} — ${editalCatalogoSelecionado.cargo}`,
            storagePath: editalCatalogoSelecionado.pdfPath ?? "",
            fonteUrl: editalCatalogoSelecionado.fonteUrl,
            analise,
            plano: planoPrevio,
            confirmadoEm: agora,
          },
        };
        setConfiguracoes(novasConfiguracoes);

        if (
          editalAnterior?.storagePath &&
          !editalAnterior.catalogoId
        ) {
          void removerPdfEdital(editalAnterior.storagePath);
        }

        showToast(
          `${editalCatalogoSelecionado.organizacao} ${editalCatalogoSelecionado.ano} · ${editalCatalogoSelecionado.cargo} aplicado ao Plano Tático.`,
          "success"
        );
        navigate("/plano");
        return;
      }

      let pdf =
        pdfNovo ??
        (editalAnterior && !editalAnterior.catalogoId
          ? {
              storagePath: editalAnterior.storagePath,
              nomeArquivo: editalAnterior.nomeArquivo,
            }
          : null);
      let pdfEnviadoAgora = false;

      if (!pdf && arquivo) {
        pdf = await enviarPdfEdital(arquivo, crypto.randomUUID());
        setPdfNovo(pdf);
        pdfEnviadoAgora = true;
      }

      if (!pdf) {
        throw new Error(
          "O PDF ainda não foi salvo. Selecione novamente o arquivo e tente aplicar o plano."
        );
      }

      const usaNovoPdf = Boolean(pdfNovo || pdfEnviadoAgora);
      const id =
        editalAnterior?.id &&
        !editalAnterior.catalogoId &&
        !usaNovoPdf
          ? editalAnterior.id
          : crypto.randomUUID();

      setMaterias((atuais) =>
          aplicarCursosAtivosNasMaterias(
            mesclarMateriasDoEdital(atuais, analise),
            configCursos.cursos ?? [],
            configCursos.cursosAtivosIds ?? [],
            analise
          )
        );

      const novasConfiguracoes: ConfiguracoesComEdital = {
        ...config,
        concurso: analise.concursoDetectado || config.concurso,
        bancaPadrao: analise.bancaDetectada || config.bancaPadrao,
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
        usaNovoPdf &&
        editalAnterior?.storagePath &&
        !editalAnterior.catalogoId &&
        editalAnterior.storagePath !== pdf.storagePath
      ) {
        void removerPdfEdital(editalAnterior.storagePath);
      }

      showToast(
        "Edital confirmado e plano de estudos aplicado.",
        "success"
      );
      navigate("/plano");
    } catch (erro) {
      const mensagem =
        erro instanceof Error
          ? erro.message
          : "Não foi possível aplicar o edital.";
      setErroProcessamento(mensagem);
      showToast(mensagem, "error");
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

        {(config.editalAtivo?.storagePath ||
          config.editalAtivo?.fonteUrl) && (
          <button
            type="button"
            className="edital-botao-secundario"
            onClick={() => {
              const atual = config.editalAtivo;
              if (!atual) return;

              if (atual.fonteUrl) {
                window.open(
                  atual.fonteUrl,
                  "_blank",
                  "noopener,noreferrer"
                );
                return;
              }

              if (atual.storagePath) {
                void abrirPdfEdital(atual.storagePath);
              }
            }}
          >
            Abrir edital atual
          </button>
        )}
      </header>

      <div className="edital-fluxo">
        <span className="ativo">1. Edital</span>
        <span className={analise ? "ativo" : ""}>2. Conferir</span>
        <span className={planoPrevio ? "ativo" : ""}>3. Prévia</span>
        <span className={config.editalAtivo?.confirmadoEm ? "ativo" : ""}>
          4. Aplicar
        </span>
      </div>

      <article className="edital-card edital-catalogo">
        <div className="edital-card-cabecalho">
          <div>
            <span>EDITAIS PRÉ-DEFINIDOS</span>
            <h2>Escolha seu concurso e cargo</h2>
            <p>
              O conteúdo já foi separado por cargo. Escolha um edital pronto e
              o Study Pro usa essa grade para montar o Plano Tático.
            </p>
          </div>
          {carregandoCatalogo && (
            <small className="edital-catalogo-carregando">Carregando...</small>
          )}
        </div>

        <GrupoEditaisCatalogo
          titulo="Polícia Militar — Soldado"
          descricao="Editais destinados à carreira de Praça/Soldado."
          editais={editaisPorGrupo.soldado}
          selecionadoId={catalogoSelecionadoId}
          idiomas={idiomasCatalogo}
          onIdioma={(id, idioma) =>
            setIdiomasCatalogo((atuais) => ({ ...atuais, [id]: idioma }))
          }
          onSelecionar={selecionarEditalCatalogo}
          onVerConteudos={setEditalVisualizado}
          onAbrirFonte={(edital) => void abrirFonteCatalogo(edital)}
        />

        <GrupoEditaisCatalogo
          titulo="Polícia Militar — Oficial"
          descricao="Editais destinados ao quadro de Oficiais."
          editais={editaisPorGrupo.oficial}
          selecionadoId={catalogoSelecionadoId}
          idiomas={idiomasCatalogo}
          onIdioma={(id, idioma) =>
            setIdiomasCatalogo((atuais) => ({ ...atuais, [id]: idioma }))
          }
          onSelecionar={selecionarEditalCatalogo}
          onVerConteudos={setEditalVisualizado}
          onAbrirFonte={(edital) => void abrirFonteCatalogo(edital)}
        />

        {editaisPorGrupo.outro.length > 0 && (
          <GrupoEditaisCatalogo
            titulo="Outros editais"
            descricao="Outros cargos publicados pela administração."
            editais={editaisPorGrupo.outro}
            selecionadoId={catalogoSelecionadoId}
            idiomas={idiomasCatalogo}
            onIdioma={(id, idioma) =>
              setIdiomasCatalogo((atuais) => ({ ...atuais, [id]: idioma }))
            }
            onSelecionar={selecionarEditalCatalogo}
            onVerConteudos={setEditalVisualizado}
            onAbrirFonte={(edital) => void abrirFonteCatalogo(edital)}
          />
        )}
      </article>

      <article className="edital-card edital-outro-edital">
        <div>
          <span>OUTRO CONCURSO</span>
          <h2>Não encontrou seu edital?</h2>
          <p>
            Adicione um PDF próprio. Ele fica somente na sua conta e não entra
            no catálogo público de editais pré-definidos.
          </p>
        </div>
        <button
          type="button"
          className="edital-botao-secundario"
          onClick={() => {
            setMostrarEditalPessoal((atual) => {
              const proximo = !atual;
              if (proximo) {
                setCargoAlvo("");
                setCatalogoSelecionadoId("");
              }
              return proximo;
            });
          }}
        >
          {mostrarEditalPessoal ? "Fechar" : "+ Adicionar outro edital"}
        </button>
      </article>

      {editalVisualizado && (
        <ConteudosEditalModal
          edital={editalVisualizado}
          idioma={
            idiomasCatalogo[editalVisualizado.id] ??
            editalVisualizado.opcoes.idiomaPadrao ??
            editalVisualizado.opcoes.idiomas?.[0] ??
            ""
          }
          onFechar={() => setEditalVisualizado(null)}
          onUsar={(edital, analisePersonalizada) => {
            selecionarEditalCatalogo(edital, analisePersonalizada);
            setEditalVisualizado(null);
          }}
        />
      )}

      {mostrarEditalPessoal && (
        <article className="edital-card edital-upload-card edital-upload-pessoal">
          <div>
            <span className="edital-pessoal-etiqueta">EDITAL PESSOAL</span>
            <h2>Adicionar outro edital</h2>
            <p>
              Envie qualquer edital em PDF. O Study Pro lê as matérias e
              assuntos, você confere e edita, e depois aplica só na sua conta.
            </p>
          </div>

          <label className="edital-upload">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(evento) => {
                const novoArquivo = evento.target.files?.[0] ?? null;
                setArquivo(novoArquivo);
                setErroProcessamento(null);
                setCatalogoSelecionadoId("");
                if (novoArquivo) {
                  setAnalise(null);
                  setPlanoPrevio(null);
    setMigracaoPrevia(null);
                  setPdfNovo(null);
                }
              }}
            />
            <strong>{arquivo?.name ?? "Selecionar PDF"}</strong>
            <span>
              {arquivo
                ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
                : "PDF completo ou verticalizado, até 25 MB"}
            </span>
          </label>

          <label className="edital-cargo-seletor">
            <span>Cargo do seu edital</span>
            <input
              value={cargoAlvo}
              disabled={processando}
              onChange={(evento) => {
                setCargoAlvo(evento.target.value);
                setPlanoPrevio(null);
    setMigracaoPrevia(null);
              }}
              placeholder="Ex.: Agente PCPE, Guarda Municipal..."
            />
            <small>
              Opcional. Deixe em branco para o Study Pro detectar o cargo pelo
              próprio PDF.
            </small>
          </label>

          <button
            type="button"
            className="edital-botao-principal"
            disabled={!arquivo || processando}
            onClick={() => void processarPdf()}
          >
            {processando
              ? "Lendo edital e organizando conteúdos..."
              : erroProcessamento && !analise
                ? "Tentar analisar novamente"
                : "Analisar meu edital"}
          </button>

          {erroProcessamento && (
            <div className="edital-observacao">{erroProcessamento}</div>
          )}
        </article>
      )}

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

          <div className="edital-cargo-confirmacao">
            <div>
              <span>CARGO DO PLANO</span>
              <strong>{cargoDaAnalise || "Detectado automaticamente"}</strong>
              <small>
                A lista abaixo foi filtrada para este cargo antes do cronograma.
              </small>
            </div>
            {editalCatalogoSelecionado ? (
              <div className="edital-cargo-fixo">
                <strong>
                  {editalCatalogoSelecionado.organizacao}{" "}
                  {editalCatalogoSelecionado.ano}
                </strong>
                <small>Edital pré-definido do catálogo</small>
              </div>
            ) : (
              <select
                aria-label="Cargo do plano"
                value={cargoAlvo}
                disabled={processando}
                onChange={(evento) => {
                  setCargoAlvo(evento.target.value);
                  setPlanoPrevio(null);
    setMigracaoPrevia(null);
                }}
              >
                <option value="">Detectar automaticamente</option>
                {CARGOS_PMPE.map((cargo) => (
                  <option key={cargo} value={cargo}>
                    {cargo}
                  </option>
                ))}
              </select>
            )}
          </div>

          {cargoAlteradoAposAnalise && (
            <div className="edital-observacao">
              Você mudou o cargo para <strong>{cargoAlvo}</strong>. Reanalise
              este mesmo PDF antes de gerar o cronograma para não misturar
              conteúdos de cargos diferentes.
              <button
                type="button"
                className="edital-botao-secundario edital-reanalisar-cargo"
                disabled={!arquivo || processando}
                onClick={() => void processarPdf()}
              >
                {arquivo
                  ? "Reanalisar para este cargo"
                  : "Selecione o PDF novamente para reanalisar"}
              </button>
            </div>
          )}

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
            disabled={cargoAlteradoAposAnalise || processando}
            onClick={gerarPrevia}
          >
            {cargoAlteradoAposAnalise
              ? "Reanalise para o cargo selecionado"
              : "Gerar prévia do cronograma"}
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

          {migracaoPrevia && (
            <div className="edital-migracao-previa">
              <div className="edital-migracao-previa-topo">
                <div>
                  <span>MIGRAÇÃO SEGURA</span>
                  <strong>
                    {migracaoPrevia.relatorio.editalAnteriorNome ?? "Edital atual"} →{" "}
                    {migracaoPrevia.relatorio.editalNovoNome}
                  </strong>
                </div>
                <small>
                  Nenhum dado foi alterado. Esta é somente a prévia.
                </small>
              </div>

              <div className="edital-migracao-resumo">
                <span>
                  <strong>{migracaoPrevia.relatorio.resumo.mantidos}</strong>
                  mantidos
                </span>
                <span>
                  <strong>{migracaoPrevia.relatorio.resumo.renomeados}</strong>
                  renomeados
                </span>
                <span>
                  <strong>{migracaoPrevia.relatorio.resumo.novos}</strong>
                  novos
                </span>
                <span>
                  <strong>{migracaoPrevia.relatorio.resumo.removidosPreservados}</strong>
                  fora do novo edital, mas preservados
                </span>
                <span>
                  <strong>{migracaoPrevia.relatorio.resumo.ambiguos}</strong>
                  associações para revisar
                </span>
              </div>

              <p>
                O histórico será preservado:{" "}
                <strong>{migracaoPrevia.relatorio.preservacao.questoes}</strong>{" "}
                registros de questões,{" "}
                <strong>{migracaoPrevia.relatorio.preservacao.sessoes}</strong>{" "}
                sessões,{" "}
                <strong>{migracaoPrevia.relatorio.preservacao.revisoes}</strong>{" "}
                revisões e{" "}
                <strong>{migracaoPrevia.relatorio.preservacao.linksQuestoes}</strong>{" "}
                links de questões existentes.
              </p>

              {migracaoPrevia.relatorio.resumo.ambiguos > 0 && (
                <details className="edital-migracao-ambiguos">
                  <summary>
                    Revisar associações ambíguas antes de aplicar
                  </summary>
                  {migracaoPrevia.relatorio.correspondencias
                    .filter((item) => item.status === "ambiguo")
                    .map((item) => (
                      <div
                        className="edital-migracao-ambiguo"
                        key={`${item.materiaNovaId}:${item.assuntoNovoId}`}
                      >
                        <strong>
                          {item.materiaNova} → {item.assuntoNovo}
                        </strong>
                        <span>
                          Não será unido automaticamente. O conteúdo antigo
                          permanece preservado e o novo entra separado.
                        </span>
                        {(item.candidatos ?? []).map((candidato) => (
                          <small key={candidato.assuntoId}>
                            Possível correspondência: {candidato.nome} ·{" "}
                            {Math.round(candidato.score * 100)}%
                          </small>
                        ))}
                      </div>
                    ))}
                </details>
              )}

              <div className="edital-migracao-garantias">
                <span>✓ backup local antes da troca</span>
                <span>✓ backup completo no Supabase</span>
                <span>✓ rollback automático se a gravação falhar</span>
                <span>✓ IDs equivalentes preservados</span>
                <span>✓ aulas novas sem apagar links de questões</span>
              </div>
            </div>
          )}

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
            {aplicando
              ? "Aplicando..."
              : migracaoPrevia
                ? "Aplicar migração com backup"
                : "Aplicar edital e cronograma"}
          </button>
        </article>
      )}

      {!materias.length && !config.editalAtivo && (
        <article className="edital-previa-card">
          <h2>Comece do seu jeito</h2>
          <p>
            Sua conta está vazia. Escolha um edital pré-definido acima ou
            comece importando seu curso.
          </p>
          <button type="button" className="edital-pular" onClick={() => {
            const novasConfiguracoes: ConfiguracoesComEdital = { ...config, editalOnboardingVisto: true };
            setConfiguracoes(novasConfiguracoes);
            navigate("/cursos");
          }}>Importar meu curso</button>
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

function remapearMissoesConcluidasDoPlanoLegado(
  planoNovo: PlanoEdital,
  concluidasAtuais: string[]
) {
  const referenciasLegadas = planoPMPE.flatMap((semana) =>
    semana.dias.flatMap((dia) =>
      dia.missoes.flatMap((missao) =>
        obterReferenciasDaMissao(missao).map((referencia) => ({
          missaoId: missao.id,
          materiaId: referencia.materiaId,
          assuntoId: referencia.assuntoId,
        }))
      )
    )
  );

  return remapearMissoesConcluidasPorConteudo({
    planoNovo,
    concluidasAtuais,
    referenciasLegadas,
  });
}

function GrupoEditaisCatalogo({
  titulo,
  descricao,
  editais,
  selecionadoId,
  idiomas,
  onIdioma,
  onSelecionar,
  onVerConteudos,
  onAbrirFonte,
}: {
  titulo: string;
  descricao: string;
  editais: EditalCatalogo[];
  selecionadoId: string;
  idiomas: Record<string, string>;
  onIdioma: (id: string, idioma: string) => void;
  onSelecionar: (edital: EditalCatalogo) => void;
  onVerConteudos: (edital: EditalCatalogo) => void;
  onAbrirFonte: (edital: EditalCatalogo) => void;
}) {
  if (editais.length === 0) return null;

  return (
    <section className="edital-catalogo-grupo">
      <div className="edital-catalogo-grupo-topo">
        <div>
          <h3>{titulo}</h3>
          <p>{descricao}</p>
        </div>
        <span>{editais.length} edital(is)</span>
      </div>

      <div className="edital-catalogo-grid">
        {editais.map((edital) => {
          const selecionado = edital.id === selecionadoId;
          const idiomasDisponiveis = edital.opcoes.idiomas ?? [];
          const idioma =
            idiomas[edital.id] ??
            edital.opcoes.idiomaPadrao ??
            idiomasDisponiveis[0] ??
            "";

          return (
            <article
              key={edital.id}
              className={
                selecionado
                  ? "edital-catalogo-card selecionado"
                  : "edital-catalogo-card"
              }
            >
              <div className="edital-catalogo-card-topo">
                <div>
                  <span className="edital-catalogo-sigla">
                    {edital.organizacao}
                  </span>
                  <strong>{edital.ano}</strong>
                </div>
                <span className="edital-catalogo-uf">{edital.uf}</span>
              </div>

              <h4>{edital.cargo}</h4>
              {edital.codigoCargo && <small>{edital.codigoCargo}</small>}
              <p>
                {edital.banca ?? "Banca não informada"} ·{" "}
                {edital.analise.materias.length} matérias ·{" "}
                {contarAssuntosCatalogo(edital)} assuntos
              </p>

              {idiomasDisponiveis.length > 0 && (
                <label className="edital-catalogo-opcao">
                  <span>Língua estrangeira</span>
                  <select
                    value={idioma}
                    onChange={(evento) =>
                      onIdioma(edital.id, evento.target.value)
                    }
                  >
                    {idiomasDisponiveis.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="edital-catalogo-acoes">
                <button
                  type="button"
                  className="edital-botao-principal"
                  onClick={() => onVerConteudos(edital)}
                >
                  Ver conteúdos
                </button>
                <button
                  type="button"
                  className="edital-botao-secundario"
                  onClick={() => onSelecionar(edital)}
                >
                  {selecionado ? "Selecionado ✓" : "Usar direto"}
                </button>
                {(edital.fonteUrl || edital.pdfPath) && (
                  <button
                    type="button"
                    className="edital-botao-secundario"
                    onClick={() => onAbrirFonte(edital)}
                  >
                    Edital oficial
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}


function ConteudosEditalModal({
  edital,
  idioma,
  onFechar,
  onUsar,
}: {
  edital: EditalCatalogo;
  idioma: string;
  onFechar: () => void;
  onUsar: (edital: EditalCatalogo, analise: AnaliseEdital) => void;
}) {
  const [rascunho, setRascunho] = useState<AnaliseEdital>(() =>
    prepararAnaliseCatalogo(edital, { idioma })
  );

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }

    window.addEventListener("keydown", fecharComEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [onFechar]);

  const totalAssuntos = useMemo(
    () =>
      rascunho.materias.reduce(
        (total, materia) => total + materia.assuntos.length,
        0
      ),
    [rascunho]
  );

  function atualizarMateria(indice: number, nome: string) {
    setRascunho((atual) => {
      const materias = [...atual.materias];
      materias[indice] = { ...materias[indice], nome };
      return { ...atual, materias };
    });
  }

  function removerMateria(indice: number) {
    setRascunho((atual) => ({
      ...atual,
      materias: atual.materias.filter((_, i) => i !== indice),
    }));
  }

  function adicionarMateria() {
    setRascunho((atual) => ({
      ...atual,
      materias: [
        ...atual.materias,
        {
          id: "",
          nome: "Nova matéria",
          incidenciaEstimada: 3,
          assuntos: [
            { id: "", nome: "Novo assunto", prioridade: "media" },
          ],
        },
      ],
    }));
  }

  function atualizarAssunto(
    indiceMateria: number,
    indiceAssunto: number,
    campo: "nome" | "prioridade",
    valor: string
  ) {
    setRascunho((atual) => {
      const materias = [...atual.materias];
      const materia = { ...materias[indiceMateria] };
      const assuntos = [...materia.assuntos];
      assuntos[indiceAssunto] = {
        ...assuntos[indiceAssunto],
        [campo]:
          campo === "prioridade"
            ? (valor as PrioridadeEdital)
            : valor,
      };
      materia.assuntos = assuntos;
      materias[indiceMateria] = materia;
      return { ...atual, materias };
    });
  }

  function removerAssunto(indiceMateria: number, indiceAssunto: number) {
    setRascunho((atual) => {
      const materias = [...atual.materias];
      const materia = { ...materias[indiceMateria] };
      materia.assuntos = materia.assuntos.filter(
        (_, i) => i !== indiceAssunto
      );
      materias[indiceMateria] = materia;
      return { ...atual, materias };
    });
  }

  function adicionarAssunto(indiceMateria: number) {
    setRascunho((atual) => {
      const materias = [...atual.materias];
      const materia = { ...materias[indiceMateria] };
      materia.assuntos = [
        ...materia.assuntos,
        { id: "", nome: "Novo assunto", prioridade: "media" },
      ];
      materias[indiceMateria] = materia;
      return { ...atual, materias };
    });
  }

  function restaurarOriginal() {
    setRascunho(prepararAnaliseCatalogo(edital, { idioma }));
  }

  function confirmarUso() {
    const normalizada = normalizarAnaliseEdital(rascunho);
    if (
      normalizada.materias.length === 0 ||
      normalizada.materias.every((materia) => materia.assuntos.length === 0)
    ) {
      return;
    }
    onUsar(edital, normalizada);
  }

  return (
    <div
      className="edital-conteudos-backdrop"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.currentTarget === evento.target) onFechar();
      }}
    >
      <section
        className="edital-conteudos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edital-conteudos-titulo"
      >
        <header className="edital-conteudos-cabecalho">
          <div>
            <span>CONTEÚDO DO EDITAL</span>
            <h2 id="edital-conteudos-titulo">
              {edital.organizacao} {edital.ano} · {edital.cargo}
            </h2>
            <p>
              {rascunho.materias.length} matérias · {totalAssuntos} assuntos.
              Você pode personalizar esta cópia antes de usar no seu plano.
            </p>
          </div>
          <button
            type="button"
            className="edital-conteudos-fechar"
            onClick={onFechar}
            aria-label="Fechar conteúdos do edital"
          >
            ×
          </button>
        </header>

        <div className="edital-conteudos-aviso">
          As alterações feitas aqui valem apenas para o seu plano. O edital
          pré-definido original continua igual para os outros alunos.
        </div>

        <div className="edital-conteudos-toolbar">
          <button
            type="button"
            className="edital-botao-secundario"
            onClick={adicionarMateria}
          >
            + Adicionar matéria
          </button>
          <button
            type="button"
            className="edital-botao-secundario"
            onClick={restaurarOriginal}
          >
            Restaurar original
          </button>
        </div>

        <div className="edital-conteudos-lista">
          {rascunho.materias.map((materia, indiceMateria) => (
            <section
              className="edital-conteudos-materia"
              key={`materia-${indiceMateria}`}
            >
              <div className="edital-conteudos-materia-topo">
                <input
                  value={materia.nome}
                  aria-label="Nome da matéria no edital"
                  onChange={(evento) =>
                    atualizarMateria(indiceMateria, evento.target.value)
                  }
                />
                <span>
                  {materia.assuntos.length} assunto(s)
                </span>
                <button
                  type="button"
                  onClick={() => removerMateria(indiceMateria)}
                >
                  Remover matéria
                </button>
              </div>

              <div className="edital-conteudos-assuntos">
                {materia.assuntos.map((assunto, indiceAssunto) => (
                  <div
                    className="edital-conteudos-assunto"
                    key={`assunto-${indiceMateria}-${indiceAssunto}`}
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

        <footer className="edital-conteudos-rodape">
          <button
            type="button"
            className="edital-botao-secundario"
            onClick={onFechar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="edital-botao-principal"
            disabled={
              rascunho.materias.length === 0 ||
              rascunho.materias.every(
                (materia) => materia.assuntos.length === 0
              )
            }
            onClick={confirmarUso}
          >
            Usar este edital com estas alterações
          </button>
        </footer>
      </section>
    </div>
  );
}
