type Props = {
  userId: string;
  turmaId: string | null;
};

/**
 * Compatibilidade com telas antigas.
 * O parceiro não recebe mais progresso individual de alunos.
 */
export default function ProgressoCursosAluno(_props: Props) {
  return (
    <section className="mentoria-aluno-card curso-aluno-bloco">
      <div className="mentoria-aluno-card-topo compacto">
        <div>
          <span>PROGRESSO DO CURSO</span>
          <h2>Visão consolidada</h2>
          <p>
            O acompanhamento individual foi desativado nesta área. O parceiro
            acompanha apenas o progresso geral das turmas no painel do curso.
          </p>
        </div>
      </div>
    </section>
  );
}
