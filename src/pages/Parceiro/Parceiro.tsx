import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import { carregarResumoParceiro, listarAlunosDoParceiro, type AlunoParceiro, type ResumoParceiro } from "../../services/parceriasService";
import "./Parceiro.css";

export default function Parceiro() {
  const { contexto, carregando: verificando } = useContextoComercial();
  const [resumo, setResumo] = useState<ResumoParceiro | null>(null);
  const [alunos, setAlunos] = useState<AlunoParceiro[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const podeGerenciar = contexto?.papel === "proprietario" || contexto?.papel === "gestor" || contexto?.papel === "professor";

  useEffect(() => {
    let ativo = true;
    if (!podeGerenciar) { setCarregando(false); return; }
    Promise.all([carregarResumoParceiro(), listarAlunosDoParceiro()])
      .then(([novoResumo, novosAlunos]) => { if (ativo) { setResumo(novoResumo); setAlunos(novosAlunos); } })
      .catch((falha) => { if (ativo) setErro(falha instanceof Error ? falha.message : "Erro ao carregar painel."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [podeGerenciar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo ? alunos.filter((aluno) => `${aluno.nome} ${aluno.turma} ${aluno.status}`.toLocaleLowerCase("pt-BR").includes(termo)) : alunos;
  }, [alunos, busca]);

  if (verificando) return <div className="parceiro-estado">Verificando perfil do parceiro...</div>;
  if (!podeGerenciar) return <Navigate to="/" replace />;

  return (
    <section className="parceiro-pagina">
      <header className="parceiro-cabecalho">
        <div><span>ÁREA DO PARCEIRO</span><h1>{resumo?.parceiroNome || contexto?.parceiroNome || "Minha organização"}</h1><p>Acompanhe somente alunos, turmas e licenças vinculados à sua organização.</p></div>
        <div className="parceiro-valor"><small>Faturamento estimado no mês</small><strong>{formatarMoeda(resumo?.valorMensal ?? 0)}</strong><span>R$ 20 por aluno ativo</span></div>
      </header>
      {erro && <div className="parceiro-erro">{erro}</div>}
      <div className="parceiro-cards">
        <Card titulo="Alunos ativos" valor={resumo?.alunosAtivos ?? 0} classe="ativo" />
        <Card titulo="Aguardando início" valor={resumo?.alunosPendentes ?? 0} classe="pendente" />
        <Card titulo="Bloqueados/expirados" valor={resumo?.alunosBloqueados ?? 0} classe="bloqueado" />
      </div>
      <section className="parceiro-lista">
        <div className="parceiro-lista-topo"><div><h2>Alunos vinculados</h2><p>A lista é isolada por parceiro pelas políticas do banco.</p></div><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno ou turma" aria-label="Buscar aluno ou turma" /></div>
        {carregando ? <div className="parceiro-estado">Carregando alunos...</div> : filtrados.length === 0 ? <div className="parceiro-estado">Nenhum aluno encontrado.</div> : (
          <div className="parceiro-tabela-area"><div className="parceiro-tabela cabecalho"><span>Aluno</span><span>Turma</span><span>Início</span><span>Expiração</span><span>Status</span></div>{filtrados.map((aluno) => <article className="parceiro-tabela" key={aluno.licencaId}><strong>{aluno.nome}</strong><span>{aluno.turma}</span><span>{formatarData(aluno.inicioEm)}</span><span>{aluno.expiraEm ? formatarData(aluno.expiraEm) : "Sem expiração"}</span><b className={`status ${aluno.status}`}>{aluno.status}</b></article>)}</div>
        )}
      </section>
    </section>
  );
}

function Card({ titulo, valor, classe }: { titulo: string; valor: number; classe: string }) { return <article className={`parceiro-card ${classe}`}><span>{titulo}</span><strong>{valor}</strong></article>; }
function formatarMoeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatarData(valor: string) { const data = new Date(valor); return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR"); }
