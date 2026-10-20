import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type Page = {
  id: string;
  name: string;
  niche: string;
  timezone: string;
  daily_limit: number;
  active: number;
  visual: string;
  voice: string;
};
type Script = {
  id: string;
  page_id: string;
  text: string;
  approved: number;
  origin: string;
  license: string;
};
type Job = {
  artifact_url?: string;
  artifact_expires_at?: string;
  id: string;
  page_id: string;
  script_id: string;
  status: string;
  attempts: number;
  error: string;
  voice_warning: string;
  created_at: string;
  duration: number;
};
function App() {
  const [logged, setLogged] = useState(false),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("Visão geral"),
    [pages, setPages] = useState<Page[]>([]),
    [scripts, setScripts] = useState<Script[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [selected, setSelected] = useState(""),
    [custom, setCustom] = useState(""),
    [duration, setDuration] = useState(15),
    [editing, setEditing] = useState<Page | null>(null),
    [notice, setNotice] = useState("");
  async function api(path: string, body?: unknown) {
    const r = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    if (r.status === 401) setLogged(false);
    if (!r.ok) throw Error(data.error || "Falha na operação");
    return data;
  }
  async function load() {
    try {
      const d = await api("state");
      setPages(d.pages);
      setScripts(d.scripts);
      setJobs(d.jobs);
      setLogged(true);
    } catch (e) {
      if (logged) setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!logged) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [logged]);
  async function act(fn: () => Promise<unknown>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const status: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    done: "Concluído",
    error: "Erro",
  };
  const date = (s: string) =>
    new Date(s).toLocaleString("pt-BR", {
      timeZone:
        pages.find((p) => p.id === selected)?.timezone || "America/Sao_Paulo",
    });
  if (!logged)
    return (
      <main className="login">
        <div className="brand">
          c<span>l</span>onai <small>ESTÚDIO PRIVADO</small>
        </div>
        <h1>
          Suas ideias.
          <br />
          Um passo adiante.
        </h1>
        <p>Crie, revise e organize seus vídeos em um só lugar.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api("login", { password });
              setPassword("");
            });
          }}
        >
          <label>
            Senha de administrador
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={16}
            />
          </label>
          <button disabled={busy}>Entrar no estúdio →</button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <small>Ambiente privado · Publicação exclusivamente manual</small>
      </main>
    );
  return (
    <div className="layout">
      <aside>
        <div className="brand">
          c<span>l</span>onai<small>ESTÚDIO DE CONTEÚDO</small>
        </div>
        <nav>
          {[
            "Visão geral",
            "Páginas",
            "Roteiros",
            "Fila de renderização",
            "Biblioteca",
            "Histórico",
          ].map((v, i) => (
            <button
              className={view === v ? "active" : ""}
              key={v}
              aria-label={v}
              onClick={() => setView(v)}
            >
              <span>{["◈", "▦", "✎", "▷", "▣", "◷"][i]}</span>
              {v}
            </button>
          ))}
        </nav>
        <div className="asidefoot">
          <span className="dot" /> Modo econômico
          <p>
            Publicação manual
            <br />
            Nenhum serviço pago conectado
          </p>
          <button
            onClick={() =>
              act(async () => {
                await api("logout", {});
                setLogged(false);
              })
            }
          >
            Sair da conta
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <small>SEU ESPAÇO DE CRIAÇÃO</small>
            <h1>{view}</h1>
          </div>
          <div className="headerRight">
            <span className="badge">✦ Modo gratuito</span>
            <select
              aria-label="Página selecionada"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Todas as páginas</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {view === "Visão geral" && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">DA IDEIA AO VÍDEO</span>
                <h2>
                  Pequenas ideias.
                  <br />
                  Novas possibilidades.
                </h2>
                <p>
                  Transforme sua mensagem em um vídeo.
                  <br />
                  Você revisa, aprova e escolhe quando publicar.
                </p>
                <button
                  onClick={() => setView(pages.length ? "Roteiros" : "Páginas")}
                >
                  {pages.length
                    ? "Criar meu próximo roteiro"
                    : "Configurar primeira página"}{" "}
                  ↗
                </button>
              </div>
              <div className="heroart">
                <div className="mockvideo">
                  <span>CLONAI / INSPIRE</span>
                  <strong>
                    O próximo
                    <br />
                    passo pode
                    <br />
                    <em>ser pequeno.</em>
                  </strong>
                  <small>Uma ideia de cada vez.</small>
                </div>
                <div className="orb" />
              </div>
            </section>
            <section className="stats">
              {[
                ["Páginas ativas", pages.filter((p) => p.active).length],
                ["Roteiros criados", scripts.length],
                [
                  "Na fila",
                  jobs.filter((j) =>
                    ["pending", "processing"].includes(j.status),
                  ).length,
                ],
                [
                  "Vídeos prontos",
                  jobs.filter((j) => j.status === "done").length,
                ],
              ].map(([s, n]) => (
                <article key={s}>
                  <small>{s}</small>
                  <strong>{n}</strong>
                  <span>Dados do seu estúdio</span>
                </article>
              ))}
            </section>
            <div className="sectionhead">
              <h2>Seu fluxo de criação</h2>
              <span>Você mantém o controle</span>
            </div>
            <section className="steps">
              {[
                [
                  "01",
                  "Prepare uma página",
                  "Escolha o nicho, o estilo e o limite diário.",
                  "Páginas",
                ],
                [
                  "02",
                  "Dê forma à mensagem",
                  "Gere um roteiro, revise e aprove o texto.",
                  "Roteiros",
                ],
                [
                  "03",
                  "Crie e compartilhe",
                  "Renderize, baixe e publique manualmente.",
                  "Biblioteca",
                ],
              ].map(([n, t, d, v]) => (
                <button key={n} onClick={() => setView(v)}>
                  <b>{n}</b>
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <span>Abrir →</span>
                </button>
              ))}
            </section>
          </>
        )}
        {view === "Páginas" && (
          <>
            <section className="panel">
              <h2>{editing ? "Editar página" : "Nova página de conteúdo"}</h2>
              <form
                key={editing?.id || "new"}
                className="gridform"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  act(async () => {
                    await api("pages", {
                      id: editing?.id,
                      name: f.get("name"),
                      niche: f.get("niche"),
                      timezone: f.get("timezone"),
                      daily_limit: Number(f.get("daily_limit")),
                      visual: f.get("visual"),
                      voice: f.get("voice"),
                      active: f.get("active") === "on",
                    });
                    setEditing(null);
                    setNotice("Página salva.");
                  });
                }}
              >
                <label>
                  Nome
                  <input
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={editing?.name}
                  />
                </label>
                <label>
                  Nicho
                  <input
                    name="niche"
                    defaultValue={editing?.niche || "motivação e frases"}
                    required
                  />
                </label>
                <label>
                  Fuso horário
                  <input
                    name="timezone"
                    defaultValue={editing?.timezone || "America/Sao_Paulo"}
                    required
                  />
                </label>
                <label>
                  Vídeos únicos por dia
                  <input
                    type="number"
                    name="daily_limit"
                    min={1}
                    max={5}
                    defaultValue={editing?.daily_limit || 5}
                  />
                </label>
                <label>
                  Estilo visual
                  <select
                    name="visual"
                    defaultValue={editing?.visual || "azul"}
                  >
                    <option value="azul">Azul profundo</option>
                    <option value="violeta">Violeta</option>
                  </select>
                </label>
                <label>
                  Narração
                  <select name="voice" defaultValue={editing?.voice || "none"}>
                    <option value="none">Sem narração</option>
                    <option value="pt-BR-FranciscaNeural">
                      Francisca · experimental
                    </option>
                    <option value="pt-BR-AntonioNeural">
                      Antonio · experimental
                    </option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={editing ? !!editing.active : true}
                  />{" "}
                  Página ativa
                </label>
                <div>
                  <button disabled={busy}>Salvar página</button>
                  {editing && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </section>
            <section className="cards">
              {pages.map((p) => (
                <article className="panel" key={p.id}>
                  <span className="badge">
                    {p.active ? "Ativa" : "Pausada"}
                  </span>
                  <h3>{p.name}</h3>
                  <p>{p.niche} · pt-BR</p>
                  <p>
                    {p.daily_limit} vídeos/dia · {p.timezone}
                  </p>
                  <button className="secondary" onClick={() => setEditing(p)}>
                    Editar página
                  </button>
                </article>
              ))}
            </section>
          </>
        )}
        {view === "Roteiros" && (
          <>
            <section className="panel">
              <h2>Uma nova mensagem</h2>
              <p>
                Modelos próprios, sem API de IA. Revise a originalidade e o
                conteúdo antes de aprovar.
              </p>
              <label>
                Seu texto (opcional)
                <textarea
                  placeholder="Deixe em branco para gerar a partir dos modelos originais."
                  value={custom}
                  maxLength={1400}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !selected}
                onClick={() =>
                  act(async () => {
                    await api("scripts", {
                      page_id: selected,
                      text: custom || undefined,
                    });
                    setCustom("");
                  })
                }
              >
                Criar roteiro
              </button>
              {!selected && <p>Cadastre e selecione uma página primeiro.</p>}
            </section>
            {scripts
              .filter((s) => !selected || s.page_id === selected)
              .map((s) => (
                <article className="panel script" key={s.id}>
                  <span className="badge">
                    {s.approved ? "Aprovado" : "Aguardando revisão"}
                  </span>
                  <p>{s.text}</p>
                  <small>
                    {s.origin} · {s.license}
                  </small>
                  <div className="actions">
                    {!s.approved ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(() => api("scripts/approve", { id: s.id }))
                        }
                      >
                        Aprovar roteiro
                      </button>
                    ) : (
                      <>
                        <label>
                          Duração
                          <select
                            value={duration}
                            onChange={(e) =>
                              setDuration(Number(e.target.value))
                            }
                          >
                            <option value={15}>15 segundos</option>
                            <option value={20}>20 segundos</option>
                            <option value={30}>30 segundos</option>
                          </select>
                        </label>
                        <button
                          disabled={
                            busy || jobs.some((j) => j.script_id === s.id)
                          }
                          onClick={() =>
                            act(async () => {
                              await api("jobs", { script_id: s.id, duration });
                              setNotice(
                                "Tarefa criada. Execute npm run render ou o workflow manual autorizado.",
                              );
                            })
                          }
                        >
                          Adicionar à fila
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
          </>
        )}
        {["Fila de renderização", "Histórico", "Biblioteca"].includes(view) && (
          <>
            <p className="muted">
              {view === "Biblioteca"
                ? "Vídeos concluídos para download e publicação manual."
                : "A fila é persistente. O processamento começa por execução manual do renderizador."}
            </p>
            {jobs.filter(
              (j) =>
                (!selected || j.page_id === selected) &&
                (view !== "Biblioteca" || j.status === "done"),
            ).length === 0 ? (
              <section className="empty">
                <span>▷</span>
                <h2>
                  {view === "Biblioteca"
                    ? "Seu primeiro vídeo começa com uma ideia."
                    : "Nenhuma tarefa por aqui ainda."}
                </h2>
                <p>Crie e aprove um roteiro para começar.</p>
                <button onClick={() => setView("Roteiros")}>
                  Ir para roteiros
                </button>
              </section>
            ) : (
              jobs
                .filter(
                  (j) =>
                    (!selected || j.page_id === selected) &&
                    (view !== "Biblioteca" || j.status === "done"),
                )
                .map((j) => (
                  <article className="panel" key={j.id}>
                    <div className="sectionhead">
                      <h3>{pages.find((p) => p.id === j.page_id)?.name}</h3>
                      <span className={"badge " + j.status}>
                        {status[j.status]}
                      </span>
                    </div>
                    <p>{scripts.find((s) => s.id === j.script_id)?.text}</p>
                    <small>
                      {date(j.created_at)} · {j.duration}s solicitados ·
                      Tentativa {j.attempts}/3
                    </small>
                    {j.error && <p className="error">{j.error}</p>}
                    {j.voice_warning && (
                      <p className="notice">{j.voice_warning}</p>
                    )}
                    {j.artifact_url && (
                      <p className="notice">
                        {new Date(j.artifact_expires_at!).getTime() <=
                        Date.now()
                          ? "Pacote expirado. O histórico permanece salvo."
                          : `Pacote ZIP privado com MP4, legenda e miniatura. Exige login no GitHub com acesso ao repositório. Retenção solicitada: 1 dia; pode ser removido antes. Disponível até aproximadamente ${date(j.artifact_expires_at!)}.`}
                      </p>
                    )}
                    <div className="actions">
                      {j.status === "done" && (
                        <>
                          <a
                            className="button"
                            href={
                              j.artifact_expires_at &&
                              new Date(j.artifact_expires_at).getTime() <=
                                Date.now()
                                ? undefined
                                : "/api/files/" + j.id
                            }
                            aria-disabled={
                              !!j.artifact_expires_at &&
                              new Date(j.artifact_expires_at).getTime() <=
                                Date.now()
                            }
                          >
                            {j.artifact_url
                              ? new Date(j.artifact_expires_at!).getTime() <=
                                Date.now()
                                ? "Pacote expirado"
                                : "Abrir pacote privado no GitHub ↗"
                              : "Baixar MP4 ↓"}
                          </a>
                          <button
                            className="secondary"
                            onClick={() => {
                              const s = scripts.find(
                                (s) => s.id === j.script_id,
                              );
                              const url = URL.createObjectURL(
                                new Blob([s?.text || ""], {
                                  type: "text/plain;charset=utf-8",
                                }),
                              );
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "roteiro.txt";
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            Baixar roteiro
                          </button>
                          <span>Publicação manual · não publicado</span>
                        </>
                      )}
                      {j.status === "error" && j.attempts < 3 && (
                        <button
                          onClick={() =>
                            act(() => api("jobs/retry", { id: j.id }))
                          }
                          disabled={busy}
                        >
                          Tentar novamente
                        </button>
                      )}
                    </div>
                  </article>
                ))
            )}
          </>
        )}
        <footer>
          Clonai · Criação consciente, uma mensagem de cada vez.
          <span>pt-BR · Publicação manual</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
