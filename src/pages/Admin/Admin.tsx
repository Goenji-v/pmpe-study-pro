import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import BetaMonitor from "../../components/BetaMonitor/BetaMonitor";
import { useAdminStatus } from "../../hooks/useAdminStatus";
import {
  carregarResumoAdmin,
  carregarUsuariosAdmin,
  type ResumoAdmin,
  type UsuarioAdmin,
} from "../../services/adminService";
import "./Admin.css";

const resumoVazio: ResumoAdmin = {
  totalUsuarios: 0,
  novosNoMes: 0,
  ativosNoMes: 0,
  minutosNoMes: 0,
  questoesNoMes: 0,
  acertosNoMes: 0,
};

export default function Admin() {
  const { administrador, carregandoAdmin } = useAdminStatus();
  const [resumo, setResumo] = useState<ResumoAdmin>(resumoVazio);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!administrador) return;

    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const [novoResumo, novosUsuarios] = await Promise.all([
          carregarResumoAdmin(),
          carregarUsuariosAdmin(),
        ]);

        if (ativo) {
          setResumo(novoResumo);
          setUsuarios(novosUsuarios);
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Erro desconhecido.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [administrador]);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;

    return usuarios.filter((usuario) =>
      `${usuario.nome} ${usuario.email}`.toLowerCase().includes(termo)
    );
  }, [usuarios, busca]);

  if (carregandoAdmin) {
    return <div className="admin-estado">Verificando permissão administrativa...</div>;
  }

  if (!administrador) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="admin-container">
      <header className="admin-cabecalho">
        <div>
          <span className="admin-etiqueta">ACESSO RESTRITO</span>
          <h1>🛡️ Administração</h1>
          <p>Acompanhe usuários cadastrados, atividade mensal e indicadores gerais.</p>
        </div>
        <div className="admin-seguranca">
          <strong>RLS + RPC protegida</strong>
          <span>Somente administradores cadastrados no Supabase.</span>
        </div>
      </header>

      {erro && (
        <div className="admin-erro">
          <strong>Não foi possível carregar o painel.</strong>
          <span>{erro}</span>
          <small>Execute o arquivo supabase/ADMINISTRACAO.sql antes de usar esta página.</small>
        </div>
      )}

      <div className="admin-cards">
        <Card titulo="Usuários" valor={resumo.totalUsuarios} detalhe="Contas cadastradas" />
        <Card titulo="Novos no mês" valor={resumo.novosNoMes} detalhe="Cadastros recentes" />
        <Card titulo="Ativos no mês" valor={resumo.ativosNoMes} detalhe="Com atividade no ranking" />
        <Card titulo="Horas no mês" valor={formatarHoras(resumo.minutosNoMes)} detalhe="Somatório dos usuários" />
        <Card titulo="Questões" valor={resumo.questoesNoMes} detalhe="Resolvidas no mês" />
        <Card titulo="Acertos" valor={resumo.acertosNoMes} detalhe="Acertos registrados" />
      </div>

      <section className="admin-painel">
        <div className="admin-painel-topo">
          <div>
            <h2>Usuários cadastrados</h2>
            <p>Dados privados disponíveis apenas para a administração.</p>
          </div>
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Pesquisar por nome ou e-mail"
            aria-label="Pesquisar usuários"
          />
        </div>

        {carregando ? (
          <div className="admin-estado">Carregando usuários...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="admin-estado">Nenhum usuário encontrado.</div>
        ) : (
          <div className="admin-tabela-area">
            <div className="admin-tabela admin-tabela-cabecalho">
              <span>Usuário</span>
              <span>Cadastro</span>
              <span>Último login</span>
              <span>Horas</span>
              <span>Questões</span>
              <span>Acertos</span>
              <span>XP</span>
              <span>Status</span>
            </div>

            {usuariosFiltrados.map((usuario) => (
              <article className="admin-tabela admin-linha" key={usuario.userId}>
                <div className="admin-identidade">
                  <strong>{usuario.nome}</strong>
                  <span>{usuario.email}</span>
                </div>
                <span>{formatarData(usuario.criadoEm)}</span>
                <span>{usuario.ultimoLoginEm ? formatarData(usuario.ultimoLoginEm) : "Nunca"}</span>
                <strong>{formatarHoras(usuario.minutosMes)}</strong>
                <span>{usuario.questoesMes}</span>
                <span>{usuario.acertosMes}</span>
                <b>{usuario.xpMes}</b>
                <Status usuario={usuario} />
              </article>
            ))}
          </div>
        )}
      </section>

      <BetaMonitor usuarios={usuarios} />
    </section>
  );
}

function Card({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe: string }) {
  return (
    <article className="admin-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function Status({ usuario }: { usuario: UsuarioAdmin }) {
  if (usuario.banidoAte && new Date(usuario.banidoAte) > new Date()) {
    return <span className="admin-status admin-status-bloqueado">Bloqueado</span>;
  }

  if (!usuario.emailConfirmadoEm) {
    return <span className="admin-status admin-status-pendente">E-mail pendente</span>;
  }

  return <span className="admin-status admin-status-ativo">Ativo</span>;
}

function formatarHoras(minutos: number) {
  const horas = Math.floor(minutos / 60);
  const restantes = minutos % 60;
  return restantes === 0 ? `${horas}h` : `${horas}h ${restantes}min`;
}

function formatarData(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
