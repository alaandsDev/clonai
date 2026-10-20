export interface DB {
  all(sql: string, args?: unknown[]): Promise<any[]>;
  run(sql: string, args?: unknown[]): Promise<number>;
}
export interface Storage {
  get(key: string): Promise<Response | null>;
  put(key: string, data: ArrayBuffer): Promise<void>;
}
export interface Config {
  db: DB;
  storage: Storage;
  adminPassword: string;
  workerToken: string;
  origin: string;
  secure: boolean;
  githubRepository?: string;
  artifactOnly?: boolean;
}
export const digest = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(s: string, status = 400): never {
  throw Object.assign(new Error(s), { status });
}
export function text(v: unknown, min = 1, max = 160) {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    fail("Texto inválido");
  return (v as string).trim();
}
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export function localDay(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function originalScript(seed: string) {
  const openings = [
    "Você não precisa vencer tudo hoje.",
    "O próximo passo pode ser pequeno.",
    "A constância começa numa escolha.",
    "Nem todo progresso faz barulho.",
    "Seu ritmo merece respeito.",
  ];
  const middles = [
    "Escolha uma tarefa que cabe no seu dia e termine com atenção.",
    "Reserve alguns minutos para o que você vive adiando.",
    "Troque a pressa por uma ação que você consegue repetir amanhã.",
    "Reconheça o que já aprendeu e pratique mais uma vez.",
    "Quando faltar energia, reduza a tarefa e preserve o compromisso.",
  ];
  const endings = [
    "Comece com o possível e volte amanhã.",
    "Uma escolha consciente já muda a direção.",
    "Dê valor ao passo que você pode dar agora.",
    "Construa hoje um motivo para continuar.",
    "Faça espaço para recomeçar.",
  ];
  const n = parseInt(seed.replaceAll("-", "").slice(0, 8), 16);
  return `${openings[n % 5]} ${middles[Math.floor(n / 5) % 5]} ${endings[Math.floor(n / 25) % 5]}`;
}
export async function handle(req: Request, c: Config): Promise<Response> {
  try {
    const u = new URL(req.url),
      p = u.pathname,
      db = c.db;
    if (p === "/api/health") return json({ ok: true, publication: "manual" });
    if (
      !c.adminPassword ||
      c.adminPassword.length < 16 ||
      !c.workerToken ||
      c.workerToken.length < 32
    )
      return json(
        { error: "Configure ADMIN_PASSWORD (16+) e WORKER_TOKEN (32+)." },
        503,
      );
    if (
      req.method !== "GET" &&
      req.headers.get("origin") &&
      req.headers.get("origin") !== c.origin
    )
      fail("Origem não autorizada", 403);
    if (Number(req.headers.get("content-length") || 0) > 24 * 1024 * 1024)
      fail("Arquivo excede 24 MB", 413);
    async function body() {
      const raw = await req.text();
      if (raw.length > 16384) fail("Requisição muito grande", 413);
      try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== "object" || Array.isArray(value))
          fail("JSON inválido");
        return value;
      } catch {
        fail("JSON inválido");
      }
    }
    if (p === "/api/login" && req.method === "POST") {
      const key = "login-global";
      const bucket = Math.floor(Date.now() / 60000);
      await db.run(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at=? THEN count+1 ELSE 1 END,expires_at=?",
        [key, bucket, bucket, bucket],
      );
      const [rate] = await db.all("SELECT count FROM rate_limits WHERE key=?", [
        key,
      ]);
      if (rate.count > 10)
        fail("Aguarde um minuto antes de tentar novamente", 429);
      const b = await body();
      if (
        (await digest(String(b.password))) !== (await digest(c.adminPassword))
      )
        fail("Credencial inválida", 401);
      const token = id() + id();
      await db.run("DELETE FROM sessions WHERE expires_at < ?", [now()]);
      await db.run("INSERT INTO sessions VALUES(?,?)", [
        await digest(token),
        new Date(Date.now() + 8 * 3600000).toISOString(),
      ]);
      return new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Set-Cookie": `clonai=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${c.secure ? "; Secure" : ""}`,
        },
      });
    }
    const worker = p.startsWith("/api/worker/");
    if (worker) {
      if (
        (await digest(req.headers.get("authorization") || "")) !==
        (await digest("Bearer " + c.workerToken))
      )
        fail("Não autorizado", 401);
    } else {
      const token =
        req.headers.get("cookie")?.match(/(?:^|;\s*)clonai=([^;]+)/)?.[1] || "";
      if (
        !(
          await db.all(
            "SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?",
            [await digest(token), now()],
          )
        ).length
      )
        fail("Faça login", 401);
    }
    if (!worker && req.method !== "GET") {
      const bucket = Math.floor(Date.now() / 60000);
      await db.run(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at=? THEN count+1 ELSE 1 END,expires_at=?",
        ["admin", bucket, bucket, bucket],
      );
      const [rate] = await db.all("SELECT count FROM rate_limits WHERE key=?", [
        "admin",
      ]);
      if (rate.count > 60)
        fail("Limite de requisições por minuto atingido", 429);
    }
    if (p === "/api/logout" && req.method === "POST") {
      const token =
        req.headers.get("cookie")?.match(/(?:^|;\s*)clonai=([^;]+)/)?.[1] || "";
      await db.run("DELETE FROM sessions WHERE token_hash=?", [
        await digest(token),
      ]);
      return new Response("{}", {
        headers: {
          "Set-Cookie": "clonai=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          "Content-Type": "application/json",
        },
      });
    }
    if (p === "/api/state" && req.method === "GET")
      return json({
        pages: await db.all("SELECT * FROM pages ORDER BY created_at DESC"),
        scripts: await db.all(
          "SELECT * FROM scripts ORDER BY created_at DESC LIMIT 300",
        ),
        jobs: await db.all(
          "SELECT j.*,a.url AS artifact_url,a.expires_at AS artifact_expires_at FROM jobs j LEFT JOIN artifacts a ON a.job_id=j.id ORDER BY j.created_at DESC LIMIT 300",
        ),
        publication: "manual",
      });
    if (p === "/api/pages" && req.method === "POST") {
      const b = await body(),
        name = text(b.name),
        niche = text(b.niche || "motivação e frases"),
        timezone = text(b.timezone || "America/Sao_Paulo");
      try {
        localDay(new Date(), timezone);
      } catch {
        fail("Fuso inválido");
      }
      const limit = Number(b.daily_limit ?? 5);
      if (!Number.isInteger(limit) || limit < 1 || limit > 5)
        fail("Limite deve ser de 1 a 5");
      const voice = text(b.voice || "none");
      if (
        !["none", "pt-BR-FranciscaNeural", "pt-BR-AntonioNeural"].includes(
          voice,
        )
      )
        fail("Voz inválida");
      const pageId = b.id ? text(b.id) : id();
      if (b.id) {
        if (
          !(await db.run(
            "UPDATE pages SET name=?,niche=?,timezone=?,daily_limit=?,active=?,visual=?,voice=? WHERE id=?",
            [
              name,
              niche,
              timezone,
              limit,
              b.active === false ? 0 : 1,
              text(b.visual || "azul"),
              voice,
              pageId,
            ],
          ))
        )
          fail("Página não encontrada", 404);
      } else
        await db.run(
          "INSERT INTO pages(id,name,niche,timezone,daily_limit,visual,voice,created_at) VALUES(?,?,?,?,?,?,?,?)",
          [
            pageId,
            name,
            niche,
            timezone,
            limit,
            text(b.visual || "azul"),
            voice,
            now(),
          ],
        );
      return json({ id: pageId });
    }
    if (p === "/api/scripts" && req.method === "POST") {
      const b = await body(),
        [page] = await db.all("SELECT * FROM pages WHERE id=?", [
          text(b.page_id),
        ]);
      if (!page) fail("Página inexistente", 404);
      let content = b.text
        ? text(b.text, 20, 1400).replace(/\s+/g, " ").normalize("NFC")
        : "";
      if (!content) {
        for (let i = 0; i < 30; i++) {
          content = originalScript(id());
          if (
            !(await db.all("SELECT id FROM scripts WHERE text=?", [content]))
              .length
          )
            break;
        }
      }
      const scriptId = id();
      await db.run("INSERT INTO scripts VALUES(?,?,?,?,?,?,?)", [
        scriptId,
        page.id,
        content,
        0,
        "Modelo original Clonai; sem API de IA",
        "Texto interno; revisar antes de publicar",
        now(),
      ]);
      return json({ id: scriptId });
    }
    if (p === "/api/scripts/approve" && req.method === "POST") {
      const b = await body();
      if (
        !(await db.run("UPDATE scripts SET approved=1 WHERE id=?", [
          text(b.id),
        ]))
      )
        fail("Roteiro inexistente", 404);
      return json({ ok: true });
    }
    if (p === "/api/jobs" && req.method === "POST") {
      const b = await body(),
        [s] = await db.all(
          "SELECT s.*,p.timezone,p.active FROM scripts s JOIN pages p ON p.id=s.page_id WHERE s.id=?",
          [text(b.script_id)],
        );
      if (!s || !s.approved || !s.active)
        fail("Aprove o roteiro e ative a página");
      const duration = Number(b.duration ?? 15);
      if (!Number.isInteger(duration) || duration < 15 || duration > 30)
        fail("Duração de 15 a 30 segundos");
      const jobId = id();
      await db.run(
        "INSERT INTO jobs(id,page_id,script_id,local_day,duration,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        [
          jobId,
          s.page_id,
          s.id,
          localDay(new Date(), s.timezone),
          duration,
          now(),
          now(),
        ],
      );
      return json({ id: jobId });
    }
    if (p === "/api/jobs/retry" && req.method === "POST") {
      const b = await body();
      if (
        !(await db.run(
          "UPDATE jobs SET status='pending',error=NULL,updated_at=? WHERE id=? AND status='error' AND attempts<3",
          [now(), text(b.id)],
        ))
      )
        fail("Tarefa não pode ser repetida (máximo 3 tentativas)");
      return json({ ok: true });
    }
    if (p === "/api/worker/claim" && req.method === "POST") {
      await db.run(
        "UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'error' ELSE 'pending' END,error='Execução interrompida; lease expirou',lease_token=NULL,updated_at=? WHERE status='processing' AND lease_until<?",
        [now(), now()],
      );
      const token = id();
      const rows = await db.all(
        "UPDATE jobs SET status='processing',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=? WHERE id=(SELECT j.id FROM jobs j JOIN pages p ON p.id=j.page_id WHERE j.status='pending' AND j.attempts<3 AND p.active=1 AND (?=0 OR (SELECT COUNT(*) FROM render_attempts WHERE created_at>=strftime('%Y-%m-%dT00:00:00.000Z','now'))<5) ORDER BY j.created_at LIMIT 1) AND status='pending' RETURNING *",
        [
          token,
          new Date(Date.now() + 20 * 60000).toISOString(),
          now(),
          c.artifactOnly ? 1 : 0,
        ],
      );
      if (!rows.length)
        return json({
          job: null,
          note: c.artifactOnly
            ? "Sem tarefa elegível ou teto de cinco tentativas remotas/dia UTC atingido."
            : "Nenhuma tarefa autorizada pendente.",
        });
      const job = rows[0],
        [s] = await db.all("SELECT text FROM scripts WHERE id=?", [
          job.script_id,
        ]),
        [page] = await db.all("SELECT voice,visual FROM pages WHERE id=?", [
          job.page_id,
        ]);
      return json({
        job: { ...job, text: s.text, voice: page.voice, visual: page.visual },
      });
    }
    if (p === "/api/worker/artifact" && req.method === "POST") {
      const b = await body();
      const repository = c.githubRepository;
      if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
        fail("Configure GITHUB_REPOSITORY no backend", 503);
      if (b.repository !== repository) fail("Repositório não autorizado", 403);
      const jobId = text(b.id),
        lease = text(b.lease);
      const runId = text(b.run_id),
        artifactId = text(b.artifact_id);
      if (
        !/^[1-9][0-9]{0,19}$/.test(runId) ||
        !/^[1-9][0-9]{0,19}$/.test(artifactId)
      )
        fail("Identificador GitHub inválido");
      const url = `https://github.com/${repository}/actions/runs/${runId}/artifacts/${artifactId}`;
      const expires = new Date(Date.now() + 24 * 3600000).toISOString();
      // One SQL statement updates completion and artifact metadata atomically via trigger.
      const changed = await db.run(
        "INSERT INTO artifacts(job_id,url,expires_at,run_id,artifact_id,voice_warning) SELECT id,?,?,?,?,? FROM jobs WHERE id=? AND lease_token=? AND status='processing' AND lease_until>?",
        [
          url,
          expires,
          runId,
          artifactId,
          b.voice_warning ? text(b.voice_warning, 1, 400) : null,
          jobId,
          lease,
          now(),
        ],
      );
      if (!changed) fail("Lease inválido ou expirado", 409);
      return json({ ok: true, url, expires_at: expires });
    }
    if (p === "/api/worker/complete" && req.method === "POST") {
      if (c.artifactOnly)
        fail("Nesta implantação use artefatos privados do Actions", 409);
      const jobId = text(u.searchParams.get("id")),
        lease = text(req.headers.get("x-lease-token"));
      const [job] = await db.all(
        "SELECT * FROM jobs WHERE id=? AND lease_token=? AND status='processing' AND lease_until>?",
        [jobId, lease, now()],
      );
      if (!job) fail("Lease inválido ou expirado", 409);
      const data = await req.arrayBuffer();
      if (
        data.byteLength < 100 ||
        data.byteLength > 24 * 1024 * 1024 ||
        new TextDecoder().decode(data.slice(4, 8)) !== "ftyp"
      )
        fail("MP4 inválido ou excede 24 MB");
      const key = job.id + ".mp4";
      try {
        await c.storage.put(key, data);
      } catch {
        fail("Falha ao armazenar; tarefa pode ser retomada", 503);
      }
      const warning = text(
        decodeURIComponent(req.headers.get("x-voice-warning") || "none"),
        1,
        400,
      );
      if (
        !(await db.run(
          "UPDATE jobs SET status='done',file_key=?,voice_warning=?,lease_token=NULL,updated_at=? WHERE id=? AND lease_token=? AND status='processing'",
          [key, warning === "none" ? null : warning, now(), job.id, lease],
        ))
      )
        fail("Lease substituído", 409);
      return json({ ok: true });
    }
    if (p === "/api/worker/fail" && req.method === "POST") {
      const b = await body();
      if (
        !(await db.run(
          "UPDATE jobs SET status='error',error=?,lease_token=NULL,updated_at=? WHERE id=? AND lease_token=? AND status='processing'",
          [text(b.error, 1, 500), now(), text(b.id), text(b.lease)],
        ))
      )
        fail("Lease inválido", 409);
      return json({ ok: true });
    }
    if (p.startsWith("/api/files/") && req.method === "GET") {
      const jobId = p.slice("/api/files/".length);
      const [j] = await db.all(
        "SELECT file_key FROM jobs WHERE id=? AND status='done'",
        [jobId],
      );
      if (!j) fail("Vídeo indisponível", 404);
      const [artifact] = await db.all(
        "SELECT url,expires_at FROM artifacts WHERE job_id=?",
        [jobId],
      );
      if (artifact) {
        if (artifact.expires_at <= now())
          fail(
            "Pacote expirado; os metadados permanecem salvos. Gere um novo roteiro para outro vídeo.",
            410,
          );
        return new Response(null, {
          status: 303,
          headers: {
            Location: artifact.url,
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      }
      if (c.artifactOnly) fail("Artefato não disponível", 404);
      const file = await c.storage.get(j.file_key);
      if (!file) fail("Arquivo não encontrado", 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="clonai-${jobId}.mp4"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return json({ error: "Rota não encontrada" }, 404);
  } catch (e: any) {
    const m = String(e.message || "");
    if (m.includes("capacity_limit"))
      return json(
        {
          error:
            "Capacidade econômica atingida; exporte e revise a retenção antes de continuar",
        },
        409,
      );
    if (m.includes("daily_limit"))
      return json({ error: "Limite diário atingido" }, 409);
    if (m.includes("UNIQUE"))
      return json({ error: "Roteiro ou tarefa duplicado" }, 409);
    return json(
      { error: e.status ? m : "Falha interna; operação não concluída" },
      e.status || 500,
    );
  }
}
