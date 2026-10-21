import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./MateriaisDoAssunto.css";

import {
  abrirMaterial,
  listarMateriais,
  type MaterialEstudo,
} from "../../services/materiaisService";
import type { MaterialAssunto } from "../../types";
import { abrirPdfInterno, ehLinkPdf } from "../../services/leitorMaterial";
import { listarMateriaisDaEstrutura } from "../../utils/materiaisDoConteudo";
import { separarMateriaisPorUso } from "../../utils/materiaisLinks";
import { agruparMateriaisDaDisciplina, materialPertenceAMateria } from "../../utils/correspondenciaMateriais";

type AtalhosMateriais = {
  aula?: string;
  questoes?: string;
};

type Props = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  assuntoIdsLegados?: readonly string[];
  materiaisDoConteudo?: readonly MaterialAssunto[];
  pdfDoConteudo?: string;
  onAtalhosCarregados?: (atalhos: AtalhosMateriais) => void;
};

export default function MateriaisDoAssunto({
  materia,
  materiaId,
  modulo,
  moduloId,
  assunto,
  assuntoId,
  assuntoIdsLegados,
  materiaisDoConteudo,
  pdfDoConteudo,
  onAtalhosCarregados,
}: Props) {
  const [
    materiais,
    setMateriais,
  ] = useState<MaterialEstudo[]>([]);

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [erro, setErro] =
    useState("");
  const geracaoRequisicao = useRef(0);

  // carregar usa somente os três campos abaixo; o callback apenas devolve
  // os atalhos encontrados para a Central de Estudos.
  /* oxlint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void carregar();
    return () => { geracaoRequisicao.current += 1; };
  }, [materia, materiaId, modulo, moduloId, assunto, assuntoId, assuntoIdsLegados]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  async function carregar() {
    const geracao = ++geracaoRequisicao.current;
    if (!materia.trim()) {
      setMateriais([]);
      setErro("");
      onAtalhosCarregados?.({});
      return;
    }

    try {
      setCarregando(true);
      setMateriais([]);
      setErro("");

      const todos = await listarMateriais();
      if (geracao !== geracaoRequisicao.current) return;
      if (!assunto.trim()) {
        // Somente a matéria foi selecionada: mostrar todo conteúdo dela,
        // sem atribuir links ou arquivos a um assunto não escolhido.
        setMateriais(todos.filter((material) =>
          materialPertenceAMateria(material, { materia, materiaId })
        ));
        onAtalhosCarregados?.({});
        return;
      }

      // Com assunto selecionado, exibir somente vínculos confirmados.
      // Materiais dos demais assuntos permanecem intactos no cadastro.
      const { vinculados: lista } =
        agruparMateriaisDaDisciplina(todos, {
          materia, materiaId, modulo, moduloId,
          assunto, assuntoId, assuntoIdsLegados,
        });

      setMateriais(lista);

      const separados =
        separarMateriaisPorUso(lista);

      onAtalhosCarregados?.({
        aula:
          separados.aula?.url,
        questoes:
          separados.questoes?.url,
      });
    } catch (erroCarregamento) {
      if (geracao !== geracaoRequisicao.current) return;
      onAtalhosCarregados?.({});
      setErro(
        erroCarregamento instanceof Error
          ? erroCarregamento.message
          : "Não foi possível carregar os materiais."
      );
    } finally {
      if (geracao === geracaoRequisicao.current) setCarregando(false);
    }
  }

  async function abrir(
    material: MaterialEstudo
  ) {
    try {
      setErro("");

      await abrirMaterial(
        material
      );
    } catch (erroAbertura) {
      setErro(
        erroAbertura instanceof Error
          ? erroAbertura.message
          : "Não foi possível abrir o material."
      );
    }
  }

  if (!materia.trim()) {
    return null;
  }

  const assuntoSelecionado = Boolean(assunto.trim());
  const materiaisComuns = assuntoSelecionado
    ? separarMateriaisPorUso(materiais).vinculados
    : materiais;
  const materiaisCurso = assuntoSelecionado
    ? listarMateriaisDaEstrutura({
        materiais: materiaisDoConteudo,
        pdf: pdfDoConteudo,
      }).filter((item) => !materiais.some((material) => material.url === item.url))
    : [];

  // Se não houver arquivo correspondente, indicar isso no próprio assunto,
  // em vez de exibir arquivos de Ortografia ou de outros temas.
  return (
    <section className="materiais-assunto-box">
      <div className="materiais-assunto-topo">
        <div>
          <span>
            {assuntoSelecionado ? "MATERIAIS VINCULADOS" : "MATERIAIS DA MATÉRIA"}
          </span>

          <h3>
            {materia}
            {assuntoSelecionado && (
              <>
                {modulo ? ` → ${modulo}` : ""}
                {" → "}
                {assunto}
              </>
            )}
          </h3>
        </div>

        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
        >
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="materiais-assunto-erro">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="materiais-assunto-vazio">
          Carregando materiais...
        </div>
      ) : materiaisComuns.length === 0 ? (
        materiaisCurso.length === 0 && (
          <div className="materiais-assunto-vazio">
            {assuntoSelecionado
              ? "Nenhum PDF, imagem, documento ou link extra foi vinculado diretamente a este assunto."
              : "Nenhum material cadastrado nesta matéria."}
          </div>
        )
      ) : (
        <div className="materiais-assunto-lista">
          {materiaisComuns.map(
            (material) => (
              <article
                key={material.id}
                className="materiais-assunto-card"
              >
                <div className="materiais-assunto-icone">
                  {iconeMaterial(
                    material
                  )}
                </div>

                <div className="materiais-assunto-info">
                  <strong>
                    {material.nome}
                  </strong>

                  <span>
                    {material.tipo ===
                    "arquivo"
                      ? material.nomeArquivo ||
                        "Arquivo"
                      : material.url}
                  </span>

                  {material.observacao && (
                    <p>
                      {
                        material.observacao
                      }
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    abrir(material)
                  }
                >
                  Abrir
                </button>
              </article>
            )
          )}
        </div>
      )}

      {materiaisCurso.length > 0 && (
        <div className="materiais-assunto-curso">
          <h4>PDFs e links do conteúdo</h4>
          <div className="materiais-assunto-lista">
            {materiaisCurso.map((material) => (
              <article className="materiais-assunto-card" key={material.id}>
                <div className="materiais-assunto-icone">{material.tipo === "pdf" ? "📕" : "🔗"}</div>
                <div className="materiais-assunto-info">
                  <strong>{material.nome}</strong>
                  <span>Material já associado ao conteúdo do curso</span>
                </div>
                <button type="button" onClick={() => {
                  if (material.tipo === "pdf" || ehLinkPdf(material.url)) {
                    try {
                      abrirPdfInterno({
                        id: `conteudo:${assuntoId ?? assunto}:${material.id}`,
                        nome: material.nome,
                        url: material.url,
                      });
                    } catch {
                      setErro("Não foi possível abrir este PDF.");
                    }
                  } else {
                    window.open(material.url, "_blank", "noopener,noreferrer");
                  }
                }} aria-label={`Abrir ${material.nome} do curso`}>
                  Abrir
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}

function iconeMaterial(
  material: MaterialEstudo
) {
  if (
    material.tipo === "link"
  ) {
    return "🔗";
  }

  const tipo =
    material.mimeType ?? "";

  if (
    tipo.includes("pdf")
  ) {
    return "📕";
  }

  if (
    tipo.includes("image")
  ) {
    return "🖼️";
  }

  if (
    tipo.includes("word") ||
    tipo.includes("document")
  ) {
    return "📘";
  }

  return "📄";
}
