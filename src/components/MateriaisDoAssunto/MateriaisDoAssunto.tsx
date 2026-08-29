import {
  useEffect,
  useState,
} from "react";

import "./MateriaisDoAssunto.css";

import {
  abrirMaterial,
  listarMateriaisPorAssunto,
  type MaterialEstudo,
} from "../../services/materiaisService";

type Props = {
  materia: string;
  modulo?: string;
  assunto: string;
};

export default function MateriaisDoAssunto({
  materia,
  modulo,
  assunto,
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

  // carregar usa somente os três campos abaixo; a função local é recriada por render.
  /* oxlint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    carregar();
  }, [materia, modulo, assunto]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  async function carregar() {
    if (
      !materia.trim() ||
      !assunto.trim()
    ) {
      setMateriais([]);
      setErro("");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const lista =
        await listarMateriaisPorAssunto(
          materia,
          assunto,
          modulo
        );

      setMateriais(lista);
    } catch (erroCarregamento) {
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
      ) : materiais.length === 0 ? (
        <div className="materiais-assunto-vazio">
          Nenhum material foi cadastrado
          para este assunto.
        </div>
      ) : (
        <div className="materiais-assunto-lista">
          {materiais.map(
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