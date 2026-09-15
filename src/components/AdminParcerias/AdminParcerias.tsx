import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  atualizarTurmaParceiroAdmin,
  criarParceriaAdmin,
  criarTurmaParceiroAdmin,
  definirUsuarioParceiroAdmin,
  listarParceriasAdmin,
  type PapelParceiroAdmin,
  type ParceriaAdmin,
  type TurmaParceiroAdmin,
  type UsuarioParceiroAdmin,
} from "../../services/adminParceriasService";
import AdminFinanceiroParceiro from "./AdminFinanceiroParceiro";
import "./AdminParcerias.css";

export default function AdminParcerias() {
  const [parcerias, setParcerias] = useState<ParceriaAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [nomeNova, setNomeNova] = useState("");
  const [slugNova, setSlugNova] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      setParcerias(await listarParceriasAdmin());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as parcerias.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executar(chave: string, tarefa: () => Promise<void>, sucesso: string) {
    try {
      setProcessando(chave);
      setErro("");
      setMensagem("");
      await tarefa();
      setMensagem(sucesso);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setProcessando("");
    }
  }

  async function criarParceria(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const nome = nomeNova.trim();
    const slug = slugNova.trim();
    const valorReais = Number(form.get("valor") || 20);
    if (!nome || !slug) return;

    await executar(
      "nova-parceria",
      async () => {
        await criarParceriaAdmin({
          nome,
          slug,
          valorAlunoCentavos: Math.max(0, Math.round(valorReais * 100)),
        });
        setNomeNova("");
        setSlugNova("");
        setSlugEditado(false);
        evento.currentTarget.reset();
      },
      "Parceria criada. Agora crie a turma e autorize o responsável."
    );
  }

  async function criarTurma(evento: FormEvent<HTMLFormElement>, parceiroId: string) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const nome = String(form.get("nome") || "").trim();
    if (!nome) return;

    await executar(
      `nova-turma-${parceiroId}`,
      async () => {
        await criarTurmaParceiroAdmin({
          parceiroId,
          nome,
          codigo: String(form.get("codigo") || ""),
          iniciaEm: String(form.get("inicio") || ""),
          encerraEm: String(form.get("fim") || ""),
        });
        evento.currentTarget.reset();
      },
      "Turma criada. O parceiro passa a enxergá-la assim que o usuário dele for autorizado."
    );
  }

  async function vincularUsuario(evento: FormEvent<HTMLFormElement>, parceiroId: string) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const email = String(form.get("email") || "").trim();
    const papel = String(form.get("papel") || "professor") as PapelParceiroAdmin;
    if (!email) return;

    await executar(
      `usuario-${parceiroId}`,
      async () => {
        await definirUsuarioParceiroAdmin({ parceiroId, email, papel, ativo: true });
        evento.currentTarget.reset();
      },
      "Responsável autorizado. A opção Área do Parceiro aparecerá para essa conta."
    );
  }

  async function alternarUsuario(parceiroId: string, usuario: UsuarioParceiroAdmin) {
    if (!usuario.email) {
      setErro("Esse usuário não possui e-mail cadastrado.");
      return;
    }
    await executar(
      `toggle-user-${usuario.userId}`,
      () => definirUsuarioParceiroAdmin({
        parceiroId,
        email: usuario.email,
        papel: usuario.papel,
        ativo: !usuario.ativo,
      }),
      usuario.ativo ? "Acesso do parceiro desativado." : "Acesso do parceiro reativado."
    );
  }

  async function alternarTurma(turma: TurmaParceiroAdmin) {
    await executar(
      `turma-${turma.id}`,
      () => atualizarTurmaParceiroAdmin({
        turmaId: turma.id,
        nome: turma.nome,
        ativa: !turma.ativa,
      }),
      turma.ativa ? "Turma pausada." : "Turma reativada."
    );
  }

  async function renomearTurma(turma: TurmaParceiroAdmin) {
    const nome = window.prompt("Novo nome da turma", turma.nome)?.trim();
    if (!nome || nome === turma.nome) return;
    await executar(
      `turma-${turma.id}`,
      () => atualizarTurmaParceiroAdmin({
        turmaId: turma.id,
        nome,
        ativa: turma.ativa,
      }),
      "Turma renomeada."
    );
  }

  function atualizarNomeNova(valor: string) {
    setNomeNova(valor);
    if (!slugEditado) setSlugNova(slug(valor));
  }

  return (
    <section className="admin-parcerias">
      <header className="admin-parcerias-topo">
        <div>
          <span>PARCERIAS E TURMAS</span>
          <h2>Área do Parceiro</h2>
          <p>
            Você cria a parceria e as turmas. Depois autoriza a conta do responsável; a partir daí ele administra somente o que pertence à parceria dele.
          </p>
        </div>
        <strong>{parcerias.length} parceria{parcerias.length === 1 ? "" : "s"}</strong>
      </header>

      {erro && <div className="admin-parcerias-aviso erro" role="alert">{erro}</div>}
      {mensagem && <div className="admin-parcerias-aviso sucesso" role="status">{mensagem}</div>}

      <form className="admin-parcerias-nova" onSubmit={criarParceria}>
        <div>
          <strong>Nova parceria</strong>
          <small>Crie primeiro a organização do parceiro.</small>
        </div>
        <label>
          Nome
          <input
            value={nomeNova}
            onChange={(e) => atualizarNomeNova(e.target.value)}
            required
            minLength={2}
            placeholder="Ex.: Curso PMPE Silva"
          />
        </label>
        <label>
          Identificador
          <input
            value={slugNova}
            onChange={(e) => {
              setSlugEditado(true);
              setSlugNova(slug(e.target.value));
            }}
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="curso-pmpe-silva"
          />
        </label>
        <label>
          Taxa por aluno (R$)
          <input name="valor" type="number" min="0" step="0.01" defaultValue="20.00" />
        </label>
        <button disabled={processando === "nova-parceria"}>
          {processando === "nova-parceria" ? "Criando..." : "Criar parceria"}
        </button>
      </form>

      {carregando ? (
        <div className="admin-parcerias-estado">Carregando parcerias...</div>
      ) : parcerias.length === 0 ? (
        <div className="admin-parcerias-estado">Nenhuma parceria cadastrada ainda.</div>
      ) : (
        <div className="admin-parcerias-lista">
          {parcerias.map((parceria) => (
            <article className="admin-parceria-card" key={parceria.id}>
              <header>
                <div>
                  <span className={`admin-parceria-status ${parceria.status}`}>{parceria.status}</span>
                  <h3>{parceria.nome}</h3>
                  <small>{parceria.slug} · {moeda(parceria.valorAlunoCentavos)} por aluno</small>
                </div>
                <div className="admin-parceria-contadores">
                  <b>{parceria.turmas.filter((turma) => turma.ativa).length} turmas</b>
                  <b>{parceria.usuarios.filter((usuario) => usuario.ativo).length} responsáveis</b>
                </div>
              </header>

              <div className="admin-parceria-colunas">
                <section>
                  <div className="admin-parceria-secao-topo">
                    <div>
                      <span>TURMAS</span>
                      <h4>Turmas desta parceria</h4>
                    </div>
                  </div>

                  {parceria.turmas.length === 0 ? (
                    <div className="admin-parceria-vazio">Nenhuma turma criada.</div>
                  ) : (
                    <div className="admin-parceria-turmas">
                      {parceria.turmas.map((turma) => (
                        <div key={turma.id} className={turma.ativa ? "" : "inativo"}>
                          <div>
                            <strong>{turma.nome}</strong>
                            <small>
                              {turma.codigo ? `Código ${turma.codigo}` : "Sem código"}
                              {turma.iniciaEm ? ` · início ${data(turma.iniciaEm)}` : ""}
                            </small>
                          </div>
                          <div>
                            <button
                              type="button"
                              disabled={processando === `turma-${turma.id}`}
                              onClick={() => void renomearTurma(turma)}
                            >
                              Renomear
                            </button>
                            <button
                              type="button"
                              disabled={processando === `turma-${turma.id}`}
                              onClick={() => void alternarTurma(turma)}
                            >
                              {turma.ativa ? "Pausar" : "Reativar"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    className="admin-parceria-form"
                    onSubmit={(e) => void criarTurma(e, parceria.id)}
                  >
                    <strong>Adicionar turma</strong>
                    <div className="admin-parceria-form-grid">
                      <label>Nome<input name="nome" required placeholder="Ex.: Turma A" /></label>
                      <label>Código<input name="codigo" placeholder="Opcional" /></label>
                      <label>Início<input name="inicio" type="date" /></label>
                      <label>Fim<input name="fim" type="date" /></label>
                    </div>
                    <button disabled={processando === `nova-turma-${parceria.id}`}>
                      {processando === `nova-turma-${parceria.id}` ? "Criando..." : "+ Criar turma"}
                    </button>
                  </form>
                </section>

                <section>
                  <div className="admin-parceria-secao-topo">
                    <div>
                      <span>ACESSO</span>
                      <h4>Responsáveis autorizados</h4>
                    </div>
                  </div>

                  {parceria.usuarios.length === 0 ? (
                    <div className="admin-parceria-vazio">Nenhum responsável autorizado.</div>
                  ) : (
                    <div className="admin-parceria-usuarios">
                      {parceria.usuarios.map((usuario) => (
                        <div key={usuario.userId} className={usuario.ativo ? "" : "inativo"}>
                          <div>
                            <strong>{usuario.nome}</strong>
                            <small>{usuario.email || "E-mail não informado"}</small>
                            <span>{rotuloPapel(usuario.papel)}</span>
                          </div>
                          <button
                            type="button"
                            disabled={processando === `toggle-user-${usuario.userId}`}
                            onClick={() => void alternarUsuario(parceria.id, usuario)}
                          >
                            {usuario.ativo ? "Desativar acesso" : "Reativar acesso"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    className="admin-parceria-form"
                    onSubmit={(e) => void vincularUsuario(e, parceria.id)}
                  >
                    <strong>Autorizar conta</strong>
                    <p>
                      O usuário precisa ter uma conta no Study Pro. Ao autorizar, o menu “Área do Parceiro” passa a aparecer para ele.
                    </p>
                    <div className="admin-parceria-form-grid usuario">
                      <label>
                        E-mail da conta
                        <input name="email" type="email" required placeholder="professor@exemplo.com" />
                      </label>
                      <label>
                        Permissão
                        <select name="papel" defaultValue="professor">
                          <option value="professor">Parceiro</option>
                          <option value="gestor">Gestor</option>
                          <option value="proprietario">Responsável principal</option>
                        </select>
                      </label>
                    </div>
                    <button disabled={processando === `usuario-${parceria.id}`}>
                      {processando === `usuario-${parceria.id}` ? "Autorizando..." : "Autorizar responsável"}
                    </button>
                  </form>
                </section>
              </div>

              <AdminFinanceiroParceiro
                parceiroId={parceria.id}
                valorAlunoCentavos={parceria.valorAlunoCentavos}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function slug(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function moeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function data(valor: string) {
  const [ano, mes, dia] = valor.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return valor;
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

function rotuloPapel(papel: PapelParceiroAdmin) {
  if (papel === "proprietario") return "Responsável principal";
  if (papel === "gestor") return "Gestor";
  return "Parceiro";
}
