export type TrechoAlternativaExplicacao = {
  letra: string;
  status: "correta" | "errada";
  texto: string;
};

export type ExplicacaoQuestaoEstruturada = {
  resumo: string;
  alternativas: TrechoAlternativaExplicacao[];
};

const INICIO_ALTERNATIVA =
  /(?:^|[.!?;]\s+)(?=(?:alternativa\s+)?[A-E][).:-]?\s+(?:está|esta|é|e)\s+(?:(?:a\s+)?(?:alternativa\s+)?)?(?:errada|incorreta|correta|certa)\b)/giu;

const PADRAO_ALTERNATIVA =
  /^(?:alternativa\s+)?([A-E])[).:-]?\s+(?:está|esta|é|e)\s+(?:(?:a\s+)?(?:alternativa\s+)?)?(errada|incorreta|correta|certa)\b\s*(.*)$/iu;

export function estruturarExplicacaoQuestao(
  valor: string | null | undefined
): ExplicacaoQuestaoEstruturada {
  const texto = String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!texto) {
    return {
      resumo: "",
      alternativas: [],
    };
  }

  const separado = texto.replace(
    INICIO_ALTERNATIVA,
    (trecho) => {
      const pontuacao = trecho.trim();
      return pontuacao ? pontuacao + "\n" : "\n";
    }
  );

  const partes = separado
    .split("\n")
    .map((parte) => parte.trim())
    .filter(Boolean);

  const resumos: string[] = [];
  const alternativas: TrechoAlternativaExplicacao[] = [];

  partes.forEach((parte) => {
    const correspondencia = parte.match(
      PADRAO_ALTERNATIVA
    );

    if (!correspondencia) {
      resumos.push(parte);
      return;
    }

    const [, letra, classificacao, restante] =
      correspondencia;

    alternativas.push({
      letra: letra.toUpperCase(),
      status:
        ["correta", "certa"].includes(
          classificacao.toLowerCase()
        )
          ? "correta"
          : "errada",
      texto: restante.trim(),
    });
  });

  return {
    resumo: resumos.join(" "),
    alternativas,
  };
}
