import fs from "node:fs";

function ler(caminho) {
  return fs.readFileSync(caminho, "utf8");
}

function salvar(caminho, conteudo) {
  fs.writeFileSync(caminho, conteudo);
}

function substituirUma(conteudo, antigo, novo, rotulo) {
  if (conteudo.includes(novo)) return conteudo;
  const indice = conteudo.indexOf(antigo);
  if (indice < 0) {
    throw new Error(`Trecho não encontrado: ${rotulo}`);
  }
  return conteudo.slice(0, indice) + novo + conteudo.slice(indice + antigo.length);
}

function substituirTodas(conteudo, antigo, novo, rotulo) {
  if (!conteudo.includes(antigo)) {
    if (conteudo.includes(novo)) return conteudo;
    throw new Error(`Trecho não encontrado: ${rotulo}`);
  }
  return conteudo.split(antigo).join(novo);
}

function atualizar(caminho, transformacao) {
  const anterior = ler(caminho);
  const proximo = transformacao(anterior);
  if (proximo !== anterior) {
    salvar(caminho, proximo);
    console.log(`Atualizado: ${caminho}`);
  }
}

function desabilitarFastRefreshNoContexto(conteudo) {
  const cabecalho = "/* Contexto exporta Provider e hook intencionalmente no mesmo módulo. */\n/* oxlint-disable react/only-export-components */\n";
  return conteudo.startsWith(cabecalho) ? conteudo : cabecalho + conteudo;
}

// Mantém o mínimo direto do React Router acima da versão vulnerável.
atualizar("package.json", (texto) =>
  substituirUma(texto, '"react-router-dom": "^7.18.1"', '"react-router-dom": "^7.18.3"', "package react-router-dom")
);
atualizar("package-lock.json", (texto) =>
  substituirUma(texto, '"react-router-dom": "^7.18.1"', '"react-router-dom": "^7.18.3"', "lock root react-router-dom")
);

atualizar("src/hooks/useAdminStatus.ts", (texto) => {
  texto = substituirUma(
    texto,
    '  const { usuario } = useAuth();\n',
    '  const { usuario } = useAuth();\n  const usuarioId = usuario?.id;\n',
    "useAdminStatus usuarioId"
  );
  texto = substituirUma(texto, "      if (!usuario) {", "      if (!usuarioId) {", "useAdminStatus guard");
  texto = substituirUma(texto, "  }, [usuario?.id]);", "  }, [usuarioId]);", "useAdminStatus deps");
  return texto;
});

atualizar("src/components/MissaoDoDia/MissaoDoDia.tsx", (texto) => {
  const blocoAntigo = `  const proxima = useMemo(\n    () => getProximaMissao(missoesConcluidas, planoCalendario, semanaAtual),\n    [atualizacao, missoesConcluidas, planoCalendario, semanaAtual]\n  );`;
  const blocoNovo = `  // atualizacao é um token explícito para invalidar o cálculo após eventos externos.\n  /* oxlint-disable react-hooks/exhaustive-deps */\n  const proxima = useMemo(\n    () => getProximaMissao(missoesConcluidas, planoCalendario, semanaAtual),\n    [atualizacao, missoesConcluidas, planoCalendario, semanaAtual]\n  );\n  /* oxlint-enable react-hooks/exhaustive-deps */`;
  return substituirUma(texto, blocoAntigo, blocoNovo, "MissaoDoDia refresh token");
});

atualizar("src/components/MateriaisDoAssunto/MateriaisDoAssunto.tsx", (texto) => {
  const blocoAntigo = `  useEffect(() => {\n    carregar();\n  }, [materia, modulo, assunto]);`;
  const blocoNovo = `  // carregar usa somente os três campos abaixo; a função local é recriada por render.\n  /* oxlint-disable react-hooks/exhaustive-deps */\n  useEffect(() => {\n    carregar();\n  }, [materia, modulo, assunto]);\n  /* oxlint-enable react-hooks/exhaustive-deps */`;
  return substituirUma(texto, blocoAntigo, blocoNovo, "MateriaisDoAssunto effect");
});

atualizar("src/components/QuestaoIACronometroBridge/QuestaoIACronometroBridge.tsx", (texto) => {
  const blocoAntigo = `  const questoes = useMemo(\n    () => (emTelaDeProva ? carregarQuestoes() : []),\n    [emTelaDeProva, location.key]\n  );`;
  const blocoNovo = `  // location.key força releitura do storage a cada nova navegação para a prova.\n  /* oxlint-disable react-hooks/exhaustive-deps */\n  const questoes = useMemo(\n    () => (emTelaDeProva ? carregarQuestoes() : []),\n    [emTelaDeProva, location.key]\n  );\n  /* oxlint-enable react-hooks/exhaustive-deps */`;
  return substituirUma(texto, blocoAntigo, blocoNovo, "QuestaoIACronometroBridge navigation token");
});

atualizar("src/components/NotificationCenter/NotificationCenter.tsx", (texto) => {
  texto = substituirUma(
    texto,
    'import { useEffect, useMemo, useState } from "react";',
    'import { useCallback, useEffect, useMemo, useState } from "react";',
    "NotificationCenter useCallback import"
  );

  if (!texto.includes("const carregar = useCallback")) {
    const inicioMarcador = "  async function carregar() {";
    const fimMarcador = "\n  }\n\n  useEffect(() => {\n    void carregar();";
    const inicio = texto.indexOf(inicioMarcador);
    const fim = texto.indexOf(fimMarcador, inicio);
    if (inicio < 0 || fim < 0) throw new Error("Trecho não encontrado: NotificationCenter carregar");
    const corpo = texto.slice(inicio + inicioMarcador.length, fim);
    texto =
      texto.slice(0, inicio) +
      `  const carregar = useCallback(async () => {${corpo}\n  }, [administrador, usuario?.id]);\n\n  useEffect(() => {\n    void carregar();` +
      texto.slice(fim + fimMarcador.length);
  }

  texto = substituirTodas(texto, "  }, [usuario?.id, administrador]);", "  }, [carregar]);", "NotificationCenter carregar deps");
  texto = substituirUma(
    texto,
    "  }, [usuario?.id, missaoHoje?.missao.id]);",
    "  }, [missaoHoje, usuario?.id]);",
    "NotificationCenter missaoHoje deps"
  );
  return texto;
});

atualizar("src/context/AppContext.tsx", (texto) => {
  texto = desabilitarFastRefreshNoContexto(texto);
  texto = substituirUma(
    texto,
    '  const { usuario } = useAuth();\n\n  const userId =\n    usuario?.id ?? "sem-usuario";',
    '  const { usuario } = useAuth();\n  const usuarioId = usuario?.id;\n\n  const userId =\n    usuarioId ?? "sem-usuario";',
    "AppContext usuarioId"
  );

  texto = substituirUma(
    texto,
    `  useEffect(() => {\n    if (!usuario) {\n      nuvemInicializadaRef.current = false;`,
    `  useEffect(() => {\n    if (!usuarioId) {\n      nuvemInicializadaRef.current = false;`,
    "AppContext init guard"
  );
  texto = substituirUma(texto, "    const idDaConta = usuario.id;\n    let ativo = true;", "    const idDaConta = usuarioId;\n    let ativo = true;", "AppContext init id");
  texto = substituirUma(
    texto,
    `  }, [\n    usuario?.id,\n    aplicarEstadoDaNuvem,\n  ]);`,
    `  }, [\n    usuarioId,\n    aplicarEstadoDaNuvem,\n  ]);`,
    "AppContext init deps"
  );

  texto = substituirUma(
    texto,
    `  useEffect(() => {\n    if (\n      !usuario ||\n      !nuvemInicializadaRef.current ||`,
    `  useEffect(() => {\n    if (\n      !usuarioId ||\n      !nuvemInicializadaRef.current ||`,
    "AppContext autosave guard"
  );
  texto = substituirUma(
    texto,
    "        usuario.id,\n        estadoAtual,\n        revisaoBaseRef.current",
    "        usuarioId,\n        estadoAtual,\n        revisaoBaseRef.current",
    "AppContext autosave pending id"
  );
  texto = substituirUma(texto, "    const idDaConta = usuario.id;\n\n    timerSalvarRef.current", "    const idDaConta = usuarioId;\n\n    timerSalvarRef.current", "AppContext autosave id");
  texto = substituirUma(
    texto,
    `  }, [\n    estadoAtual,\n    usuario?.id,\n  ]);`,
    `  }, [\n    estadoAtual,\n    usuarioId,\n  ]);`,
    "AppContext autosave deps"
  );

  const onlineAntigo = `  useEffect(() => {\n    if (!usuario) return;\n\n    function ficouOffline()`;
  const onlineNovo = `  useEffect(() => {\n    if (!usuarioId) return;\n\n    function ficouOffline()`;
  texto = substituirUma(texto, onlineAntigo, onlineNovo, "AppContext online guard");
  texto = substituirUma(
    texto,
    `      window.removeEventListener("online", voltouOnline);\n    };\n  }, [usuario?.id]);`,
    `      window.removeEventListener("online", voltouOnline);\n    };\n    // sincronizarAgora lê os dados atuais por refs; o listener deve mudar apenas com a conta.\n    // oxlint-disable-next-line react-hooks/exhaustive-deps\n  }, [usuarioId]);`,
    "AppContext online deps"
  );
  return texto;
});

atualizar("src/components/CloudStatus/CloudStatus.tsx", (texto) => {
  texto = substituirUma(
    texto,
    '  const { usuario } = useAuth();\n',
    '  const { usuario } = useAuth();\n  const usuarioId = usuario?.id;\n',
    "CloudStatus usuarioId"
  );
  texto = substituirUma(
    texto,
    `    const automatico = usuario\n      ? listarBackupsAutomaticosLocais(usuario.id)[0]?.criadoEm ?? null\n      : null;`,
    `    const automatico = usuarioId\n      ? listarBackupsAutomaticosLocais(usuarioId)[0]?.criadoEm ?? null\n      : null;`,
    "CloudStatus backup id"
  );
  texto = substituirUma(
    texto,
    `  }, [usuario?.id, versaoBackup, statusNuvem]);`,
    `    // versaoBackup e statusNuvem são gatilhos explícitos para reler o localStorage.\n    // oxlint-disable-next-line react-hooks/exhaustive-deps\n  }, [usuarioId, versaoBackup, statusNuvem]);`,
    "CloudStatus memo deps"
  );
  return texto;
});

atualizar("src/context/AuthContext.tsx", desabilitarFastRefreshNoContexto);
atualizar("src/context/ToastContext.tsx", desabilitarFastRefreshNoContexto);

atualizar("src/context/CronometroContext.tsx", (texto) => {
  texto = desabilitarFastRefreshNoContexto(texto);
  texto = substituirUma(
    texto,
    "  }, [materias, sessaoAtiva.missaoId]);",
    `  }, [\n    materias,\n    sessaoAtiva.missaoId,\n    sessaoAtiva.semana,\n    sessaoAtiva.dia,\n    sessaoAtiva.materiaId,\n    sessaoAtiva.moduloId,\n    sessaoAtiva.assuntoId,\n    sessaoAtiva.aulaId,\n    sessaoAtiva.materia,\n    sessaoAtiva.modulo,\n    sessaoAtiva.assunto,\n  ]);`,
    "CronometroContext canonical deps"
  );
  return texto;
});

atualizar("src/pages/CronogramaIA/CronogramaIA.tsx", (texto) =>
  substituirUma(texto, "    !Boolean(localStorage.getItem(chavePerfil))", "    !localStorage.getItem(chavePerfil)", "CronogramaIA boolean")
);

atualizar("src/pages/Cursos/Cursos.tsx", (texto) => {
  texto = substituirUma(
    texto,
    'import { useMemo, useState, type ChangeEvent } from "react";',
    'import { useState, type ChangeEvent } from "react";',
    "Cursos import"
  );
  const antigo = `  const resumo = useMemo(() => ({\n    cursos: cursos.length,\n    ativos: ativosIds.length,\n    materias: cursos.reduce((total, curso) => total + curso.materias.length, 0),\n    aulas: cursos.reduce((total, curso) => total + contarAulas(curso), 0),\n  }), [ativosIds.length, cursos]);`;
  const novo = `  const resumo = {\n    cursos: cursos.length,\n    ativos: ativosIds.length,\n    materias: cursos.reduce((total, curso) => total + curso.materias.length, 0),\n    aulas: cursos.reduce((total, curso) => total + contarAulas(curso), 0),\n  };`;
  return substituirUma(texto, antigo, novo, "Cursos resumo");
});

atualizar("src/pages/Backup/Backup.tsx", (texto) => {
  texto = substituirUma(
    texto,
    '  const { usuario } = useAuth();\n',
    '  const { usuario } = useAuth();\n  const usuarioId = usuario?.id;\n',
    "Backup usuarioId"
  );
  texto = substituirUma(
    texto,
    `      usuario\n        ? listarBackupsAutomaticosLocais(usuario.id)\n        : [],`,
    `      usuarioId\n        ? listarBackupsAutomaticosLocais(usuarioId)\n        : [],`,
    "Backup automaticos id"
  );
  texto = substituirUma(
    texto,
    "    [usuario?.id, ultimoBackup, statusNuvem]\n  );",
    `    // ultimoBackup e statusNuvem são gatilhos explícitos para reler backups locais.\n    /* oxlint-disable react-hooks/exhaustive-deps */\n    [usuarioId, ultimoBackup, statusNuvem]\n    /* oxlint-enable react-hooks/exhaustive-deps */\n  );`,
    "Backup memo deps"
  );
  return texto;
});

atualizar("src/pages/Dashboard/Dashboard.tsx", (texto) => {
  texto = substituirUma(
    texto,
    "  }, [atualizacaoPlano, missoesConcluidas, planoCalendario]);",
    `    // atualizacaoPlano é um token explícito disparado por eventos externos do Dashboard.\n    /* oxlint-disable react-hooks/exhaustive-deps */\n  }, [atualizacaoPlano, missoesConcluidas, planoCalendario, configuracoes.semanaAtualPlano]);\n  /* oxlint-enable react-hooks/exhaustive-deps */`,
    "Dashboard dadosPlano deps"
  );
  return texto;
});

atualizar("src/pages/BancoQuestoes/BancoQuestoes.tsx", (texto) => {
  texto = substituirUma(
    texto,
    "  }, [configuracoes.concurso]);",
    "  }, [configuracoes.concurso, showToast]);",
    "BancoQuestoes showToast dep"
  );
  const antigo = `  const estatisticasPorQuestao = useMemo(\n    () => carregarEstatisticasQuestoes(),\n    [bancoQuestoes]\n  );`;
  const novo = `  // bancoQuestoes invalida a leitura das estatísticas persistidas no storage.\n  /* oxlint-disable react-hooks/exhaustive-deps */\n  const estatisticasPorQuestao = useMemo(\n    () => carregarEstatisticasQuestoes(),\n    [bancoQuestoes]\n  );\n  /* oxlint-enable react-hooks/exhaustive-deps */`;
  return substituirUma(texto, antigo, novo, "BancoQuestoes stats refresh");
});

atualizar("src/pages/Revisoes/Revisoes.tsx", (texto) => {
  const antigo = `  useEffect(() => {\n    if (!usuario) return;\n\n    importarRevisoesIA();\n\n    function atualizarRevisoesIA() {\n      importarRevisoesIA();\n    }\n\n    window.addEventListener("pmpe-revisoes-ia-atualizadas", atualizarRevisoesIA);\n    window.addEventListener("storage", atualizarRevisoesIA);\n\n    return () => {\n      window.removeEventListener("pmpe-revisoes-ia-atualizadas", atualizarRevisoesIA);\n      window.removeEventListener("storage", atualizarRevisoesIA);\n    };\n  }, [usuario?.id]);`;
  const novo = `  // A função é local, mas todas as capturas relevantes são enumeradas para\n  // renovar os listeners quando o estado usado na importação mudar.\n  /* oxlint-disable react-hooks/exhaustive-deps */\n  useEffect(() => {\n    if (!usuario) return;\n\n    importarRevisoesIA();\n\n    function atualizarRevisoesIA() {\n      importarRevisoesIA();\n    }\n\n    window.addEventListener("pmpe-revisoes-ia-atualizadas", atualizarRevisoesIA);\n    window.addEventListener("storage", atualizarRevisoesIA);\n\n    return () => {\n      window.removeEventListener("pmpe-revisoes-ia-atualizadas", atualizarRevisoesIA);\n      window.removeEventListener("storage", atualizarRevisoesIA);\n    };\n  }, [usuario, revisoes, materias, configuracoes.metaRevisoesDiaria, setRevisoes, showToast]);\n  /* oxlint-enable react-hooks/exhaustive-deps */`;
  return substituirUma(texto, antigo, novo, "Revisoes listeners deps");
});

console.log("Correções de lint aplicadas.");
