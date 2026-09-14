import type { CursoParceiro } from "../../services/cursoParceiroService";
import CursoImportadorLegado from "./CursoImportadorLegado";
import ImportadorArquivoCurso from "./ImportadorArquivoCurso";

type Props = {
  parceiroId: string;
  cursoAtual: CursoParceiro | null;
  onImportado: (cursoId: string) => Promise<void> | void;
};

export default function CursoImportador(props: Props) {
  return (
    <>
      <ImportadorArquivoCurso {...props} />
      <CursoImportadorLegado {...props} />
    </>
  );
}
