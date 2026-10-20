import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./MateriaisDoAssunto.css";

import {
  abrirMaterial,
  listarMateriaisPorAssunto,
  type MaterialEstudo,
} from "../../services/materiaisService";
import { separarMateriaisPorUso } from "../../utils/materiaisLinks";
import type { Materia } from "../../types";

type AtalhosMateriais = {
  aula?: string;
  questoes?: string;
};

type Props = {
  materia: string;
  materiaId?: string;
  idsLegadosMateria?: string[];
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  idsLegadosAssunto?: string[];
  materiaCatalogo?: Materia;
  onAtalhosCarregados?: (atalhos: AtalhosMateriais) => void;
};

export default function MateriaisDoAssunto({
  materia,
  materiaId,
  idsLegadosMateria,
  modulo,
  moduloId,
  assunto,
  assuntoId,
  idsLegadosAssunto,
  materiaCatalogo,
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
  const identidadeLegada = JSON.stringify([idsLegadosMateria, idsLegadosAssunto]);
  const consultaAtual = useRef(0);

  // O callback apenas devolve
  // os atalhos encontrados para a Central de Estudos.
  /* oxlint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let cancelado = false;
    void carregar(() => cancelado);
    return () => { cancelado = true; consultaAtual.current += 1; };
  }, [materia, materiaId, modulo, moduloId, assunto, assuntoId, identidadeLegada, materiaCatalogo]);
  /* oxlint-enable react-hooks/exhaustive-deps */

  async function carregar(cancelado = () => false) {
    const consulta = ++consultaAtual.current;
    const ignorar = () => cancelado() || consulta !== consultaAtual.current;
    if (
      !materia.trim() ||
      !assunto.trim()
    ) {
      setMateriais([]);
      setErro("");
      onAtalhosCarregados?.({});
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const lista =
        await listarMateriaisPorAssunto(
          materia,
          assunto,
          modulo,
          { materiaId, idsLegadosMateria, moduloId, assuntoId, idsLegadosAssunto, materiaCatalogo }
        );

      if (ignorar()) return;
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
      if (ignorar()) return;
      onAtalhosCarregados?.({});
      setErro(
        erroCarregamento instanceof Error
          ? erroCarregamento.message
          : "Não foi possível carregar os materiais."
      );
    } finally {
      if (!ignorar()) setCarregando(false);
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
    materiaisComuns.length === 0
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
          onClick={() => carregar()}
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
