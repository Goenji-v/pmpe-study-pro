import type { Assunto, Materia, Modulo } from "../types";
import { listarModulosDaMateria } from "../services/conteudos/navegarConteudos";

const chave = (nome: string) => nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

const titulosDoCurso = new Map([
  ["análise combinatória (combinação)", "Combinação"],
  ["princípios da contagem - problemas aritméticos", "Princípios da contagem"],
]);

export function nomeDoTopico(nome: string) {
  return titulosDoCurso.get(nome.toLocaleLowerCase("pt-BR")) ?? nome;
}

const grupos = new Map([
  ["estruturas logicas: proposicoes, conectivos, quantificadores e falacias",
    ["Proposições lógicas", "Conectivos lógicos", "Quantificadores lógicos", "Falácias"]],
  ["logica de argumentacao: analogias, inferencias, deducoes, equivalencia, implicacao e argumentos validos",
    ["Analogias", "Inferências", "Deduções", "Equivalências lógicas", "Implicação", "Argumentos válidos"]],
  ["principios e tecnicas de contagem, principio multiplicativo, permutacoes, arranjos, combinacoes e probabilidade",
    ["Princípios da contagem", "Princípio multiplicativo", "Permutação", "Arranjo", "Combinação", "Probabilidade"]],
]);

export function partesDoAssunto(nome: string) {
  return grupos.get(chave(nome));
}

// Os blocos originais continuam disponíveis para localizar sessões antigas.
// Tópicos sem vídeo também precisam de um ID real para registrar a conclusão.
export function garantirTopicosIndividuais(materias: Materia[]): Materia[] {
  return materias.map(materia => {
    const modulos = materia.modulos?.length ? materia.modulos : [
      {id: "modulo-geral-" + materia.id, nome: "Geral", ordem: 0, assuntos: materia.assuntos},
    ];
    const nomes = new Set(modulos.flatMap(m => m.assuntos.flatMap(a => [chave(nomeDoTopico(a.nome)), ...(a.aulas ?? []).map(l => chave(nomeDoTopico(l.nome)))])));
    let mudou = false;
    const resultado = modulos.map(modulo => {
      const novos: Assunto[] = [];
      for (const pai of modulo.assuntos) {
        for (const nome of partesDoAssunto(pai.nome) ?? []) {
          if (nomes.has(chave(nome))) continue;
          nomes.add(chave(nome));
          novos.push({id: pai.id + ":topico:" + chave(nome).replace(/ /g, "-"), nome,
            prioridade: pai.prioridade, concluido: false});
        }
      }
      if (!novos.length) return modulo;
      mudou = true;
      return {...modulo, assuntos: [...modulo.assuntos, ...novos]};
    });
    return mudou ? {...materia, modulos: resultado, assuntos: resultado.flatMap(m => m.assuntos)} : materia;
  });
}

export function topicosDoAssunto(modulo: Modulo, assunto: Assunto) {
  const aulas = assunto.aulas ?? [];
  const videos = aulas.filter(a => !/^(pdf|material de apoio|apostila)$/i.test(a.nome.trim()));
  const individualizar = videos.length > 1 || (videos.length > 0 && partesDoAssunto(assunto.nome));
  if (individualizar) return videos.map(aula => ({
    id: assunto.id + ":aula:" + aula.id, nome: nomeDoTopico(aula.nome), modulo, assunto, aula,
  }));
  if (partesDoAssunto(assunto.nome)) return [];
  return [{id: assunto.id, nome: videos[0] && !/^aula$/i.test(videos[0].nome) ? nomeDoTopico(videos[0].nome) : nomeDoTopico(assunto.nome), modulo, assunto, aula: videos[0]}];
}

export function topicosDaMateria(materia: Materia) {
  const topicos = listarModulosDaMateria(materia).flatMap(modulo =>
    modulo.assuntos.flatMap(assunto => topicosDoAssunto(modulo, assunto))
  );
  const comVideo = new Set(topicos.filter(t => t.aula).map(t => chave(t.nome)));
  return topicos.filter(t => t.aula || t.assunto.concluido || !t.id.includes(":topico:") || !comVideo.has(chave(t.nome)));
}
