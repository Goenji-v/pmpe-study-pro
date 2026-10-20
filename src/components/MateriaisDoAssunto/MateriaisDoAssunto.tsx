import {
  useEffect,
  useState,
} from "react";

import "./MateriaisDoAssunto.css";

import {
  abrirMaterial,
  listarMateriais,
  type MaterialEstudo,
} from "../../services/materiaisService";
import { separarMateriaisPorUso } from "../../utils/materiaisLinks";
import { agruparMateriaisDaDisciplina } from "../../utils/correspondenciaMateriais";

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
  onAtalhosCarregados,
}: Props) {
  const [
    materiais,
    setMateriais,
  ] = useState<MaterialEstudo[]>([]);

  const [
    outrosDaDisciplina,
    setOutrosDaDisciplina,
  ] = useState<MaterialEstudo[]>([]);

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [erro, setErro] =
    useState("");

  // carregar usa somente os três campos abaixo; o callback apenas devolve
  // os atalhos encontrados para a Central de Estudos.
  /* oxlint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    carregar();
  }, [materia, materiaId, modulo, moduloId, assunto, assuntoId, assuntoIdsLegados]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  async function carregar() {
    if (
      !materia.trim() ||
      !assunto.trim()
    ) {
      setMateriais([]);
      setOutrosDaDisciplina([]);
      setErro("");
      onAtalhosCarregados?.({});
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const todos = await listarMateriais();
      const { vinculados: lista, outrosDaDisciplina: outros } =
        agruparMateriaisDaDisciplina(todos, {
          materia, materiaId, modulo, moduloId,
          assunto, assuntoId, assuntoIdsLegados,
        });

      setMateriais(lista);
      setOutrosDaDisciplina(outros);

      const separados =
        separarMateriaisPorUso(lista);

      onAtalhosCarregados?.({
        aula:
          separados.aula?.url,
        questoes:
          separados.questoes?.url,
      });
    } catch (erroCarregamento) {
      onAtalhosCarregados?.({});
      setErro(
        erroCarregamento instanceof Error
          ? erroCarregamento.message
          : "Não foi possível carregar os materiais."
      );
    } finally {
      setCarregando(false);
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

  if (
    !materia.trim() ||
    !assunto.trim()
  ) {
    return null;
  }

  const {
    vinculados: materiaisComuns,
  } = separarMateriaisPorUso(
    materiais
  );

  /*
   * Aula e Questões são atalhos operacionais da sessão e aparecem na barra
   * principal da Central de Estudos. Esta caixa fica reservada a PDF, imagem,
   * documento e links personalizados.
   */
  if (
    !carregando &&
    !erro &&
    materiaisComuns.length === 0 &&
    outrosDaDisciplina.length === 0
  ) {
    return null;
  }

  return (
    <section className="materiais-assunto-box">
      <div className="materiais-assunto-topo">
        <div>
          <span>
            MATERIAIS VINCULADOS
          </span>

          <h3>
            {materia}
            {modulo ? ` → ${modulo}` : ""}
            {" → "}
            {assunto}
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
        <div className="materiais-assunto-vazio">
          Nenhum PDF, imagem, documento ou link extra
          foi vinculado a este assunto.
        </div>
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

      {outrosDaDisciplina.length > 0 && (
        <details className="materiais-assunto-outros">
          <summary>
            Outros materiais de {materia} ({outrosDaDisciplina.length})
          </summary>
          <p>
            Estes materiais estão salvos na mesma disciplina, mas não têm vínculo
            confirmado com este assunto. Confira a origem antes de reutilizá-los.
          </p>
          <div className="materiais-assunto-lista">
            {outrosDaDisciplina.map((material) => (
              <article key={material.id} className="materiais-assunto-card">
                <div className="materiais-assunto-icone">{iconeMaterial(material)}</div>
                <div className="materiais-assunto-info">
                  <strong>{material.nome}</strong>
                  <span>Cadastro: {material.assunto}{material.modulo ? ` · ${material.modulo}` : ""}</span>
                </div>
                <button type="button" onClick={() => abrir(material)}
                  aria-label={`Abrir ${material.nome}, cadastrado em ${material.assunto}`}>
                  Abrir
                </button>
              </article>
            ))}
          </div>
        </details>
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
