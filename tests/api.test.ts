import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handle, localDay, originalScript } from "../server/api.ts";
import type { Config } from "../server/api.ts";
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync("migrations/0001.sql", "utf8"));
  sql.exec(readFileSync("migrations/0002.sql", "utf8"));
  const files = new Map<string, ArrayBuffer>();
  const c: Config = {
    db: {
      all: async (s, a = []) => sql.prepare(s).all(...(a as any[])),
      run: async (s, a = []) =>
        Number(sql.prepare(s).run(...(a as any[])).changes),
    },
    storage: {
      put: async (k, d) => {
        files.set(k, d);
      },
      get: async (k) => (files.has(k) ? new Response(files.get(k)) : null),
    },
    adminPassword: "test-password-16-characters",
    workerToken: "test-worker-token-32-characters-long",
    origin: "http://localhost",
    secure: false,
  };
  let cookie = "";
  async function request(
    path: string,
    body?: unknown,
    worker = false,
    extra: Record<string, string> = {},
  ) {
    return handle(
      new Request("http://localhost/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(worker
            ? { Authorization: "Bearer " + c.workerToken }
            : { cookie }),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      c,
    );
  }
  async function login() {
    const r = await request("login", { password: c.adminPassword });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie")!.split(";")[0];
  }
  async function page(limit = 5) {
    const r = await request("pages", { name: "Motivação", daily_limit: limit });
    assert.equal(r.status, 200);
    return ((await r.json()) as any).id;
  }
  async function script(page_id: string, i = 0) {
    const r = await request("scripts", {
      page_id,
      text: `Cada passo tem seu valor. Reserve um momento para avançar com atenção. Hoje é a escolha número ${i}.`,
    });
    assert.equal(r.status, 200);
    const { id } = (await r.json()) as any;
    await request("scripts/approve", { id });
    return id;
  }
  return { sql, c, request, login, page, script };
}
test("rotas privadas, worker e configuração manual protegidos", async () => {
  const f = fixture();
  assert.equal((await f.request("state")).status, 401);
  assert.equal((await f.request("worker/claim", {})).status, 401);
  const r = await f.request("health");
  assert.equal(((await r.json()) as any).publication, "manual");
  assert.equal((await f.request("login", { password: "wrong" })).status, 401);
  await f.login();
  assert.equal((await f.request("state")).status, 200);
  assert.equal((await f.request("publish", {})).status, 404);
  await f.request("logout", {});
  assert.equal((await f.request("state")).status, 401);
});
test("criação/edição de página e validação de fuso, limite e voz", async () => {
  const f = fixture();
  await f.login();
  assert.equal(
    (await f.request("pages", { name: "X", timezone: "invalido" })).status,
    400,
  );
  assert.equal(
    (await f.request("pages", { name: "X", daily_limit: 6 })).status,
    400,
  );
  assert.equal(
    (await f.request("pages", { name: "X", voice: "arbitrary" })).status,
    400,
  );
  const id = await f.page();
  assert.equal(
    (
      await f.request("pages", {
        id,
        name: "Editada",
        active: false,
        daily_limit: 3,
      })
    ).status,
    200,
  );
  assert.equal(f.sql.prepare("SELECT active FROM pages").get()!.active, 0);
});
test("roteiros validados, com origem e duplicação normalizada bloqueada", async () => {
  const f = fixture();
  await f.login();
  const p = await f.page();
  assert.equal(
    (await f.request("scripts", { page_id: p, text: "curto" })).status,
    400,
  );
  const id = await f.script(p);
  const s = f.sql.prepare("SELECT * FROM scripts WHERE id=?").get(id)!;
  assert.ok(s.origin);
  assert.ok(s.license);
  assert.equal(
    (
      await f.request("scripts", {
        page_id: p,
        text: String(s.text).replaceAll(" ", "  "),
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.request("scripts", { page_id: "missing" })).status,
    404,
  );
});
test("gerador por modelos mantém texto original próprio sem API paga", () => {
  const a = originalScript("00000001-0000-0000-0000-000000000000");
  const b = originalScript("00000002-0000-0000-0000-000000000000");
  assert.notEqual(a, b);
  assert.ok(a.length > 70);
});
test("limite de cinco conteúdos únicos e prevenção de tarefas duplicadas", async () => {
  const f = fixture();
  await f.login();
  const p = await f.page();
  const first = await f.script(p);
  assert.equal((await f.request("jobs", { script_id: first })).status, 200);
  assert.equal((await f.request("jobs", { script_id: first })).status, 409);
  for (let i = 1; i < 5; i++)
    assert.equal(
      (await f.request("jobs", { script_id: await f.script(p, i) })).status,
      200,
    );
  assert.equal(
    (await f.request("jobs", { script_id: await f.script(p, 5) })).status,
    409,
  );
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM jobs").get()!.n, 5);
});
test("limite transacional sob solicitações concorrentes", async () => {
  const f = fixture();
  await f.login();
  const p = await f.page(1);
  const a = await f.script(p, 1),
    b = await f.script(p, 2);
  const results = await Promise.all([
    f.request("jobs", { script_id: a }),
    f.request("jobs", { script_id: b }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test("dia local respeita meia-noite de São Paulo", () =>
  assert.equal(
    localDay(new Date("2026-10-21T01:00:00Z"), "America/Sao_Paulo"),
    "2026-10-20",
  ));
test("aprovação é obrigatória e dados de páginas permanecem separados", async () => {
  const f = fixture();
  await f.login();
  const a = await f.page(),
    b = await f.page();
  const r = await f.request("scripts", { page_id: a });
  const s = (await r.json()) as any;
  assert.equal((await f.request("jobs", { script_id: s.id })).status, 400);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM scripts WHERE page_id=?").get(b)!
      .n,
    0,
  );
});
test("claim exclusivo, retomada após interrupção e limite de tentativas", async () => {
  const f = fixture();
  await f.login();
  const p = await f.page();
  await f.request("jobs", { script_id: await f.script(p) });
  const one = (await (await f.request("worker/claim", {}, true)).json()) as any;
  assert.ok(one.job.lease_token);
  assert.equal(
    ((await (await f.request("worker/claim", {}, true)).json()) as any).job,
    null,
  );
  f.sql.prepare("UPDATE jobs SET lease_until='2000-01-01'").run();
  const two = (await (await f.request("worker/claim", {}, true)).json()) as any;
  assert.equal(two.job.id, one.job.id);
  assert.equal(two.job.attempts, 2);
  assert.notEqual(two.job.lease_token, one.job.lease_token);
  assert.equal(
    (
      await f.request(
        "worker/fail",
        { id: one.job.id, lease: one.job.lease_token, error: "stale" },
        true,
      )
    ).status,
    409,
  );
  f.sql.prepare("UPDATE jobs SET attempts=3,lease_until='2000-01-01'").run();
  assert.equal(
    ((await (await f.request("worker/claim", {}, true)).json()) as any).job,
    null,
  );
  assert.equal(f.sql.prepare("SELECT status FROM jobs").get()!.status, "error");
});
test("falha de armazenamento não conclui tarefa e falha explícita permite retry", async () => {
  const f = fixture();
  await f.login();
  await f.request("jobs", { script_id: await f.script(await f.page()) });
  const { job } = (await (
    await f.request("worker/claim", {}, true)
  ).json()) as any;
  f.c.storage.put = async () => {
    throw Error("offline");
  };
  const mp4 = new Uint8Array(128);
  mp4.set(new TextEncoder().encode("ftyp"), 4);
  const req = new Request("http://localhost/api/worker/complete?id=" + job.id, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + f.c.workerToken,
      "X-Lease-Token": job.lease_token,
    },
    body: mp4,
  });
  assert.equal((await handle(req, f.c)).status, 503);
  assert.equal(
    f.sql.prepare("SELECT status FROM jobs").get()!.status,
    "processing",
  );
  await f.request(
    "worker/fail",
    { id: job.id, lease: job.lease_token, error: "storage unavailable" },
    true,
  );
  assert.equal((await f.request("jobs/retry", { id: job.id })).status, 200);
});
test("origem estranha bloqueada e tentativas de login limitadas", async () => {
  const f = fixture();
  await f.login();
  assert.equal(
    (
      await f.request("pages", { name: "X" }, false, {
        origin: "https://example.org",
      })
    ).status,
    403,
  );
  for (let i = 0; i < 10; i++) await f.request("login", { password: "bad" });
  assert.equal((await f.request("login", { password: "bad" })).status, 429);
});

test("artefato privado: repositório permitido, lease, conclusão atômica e expiração", async () => {
  const f = fixture();
  f.c.githubRepository = "alaandsDev/clonai";
  f.c.artifactOnly = true;
  await f.login();
  await f.request("jobs", { script_id: await f.script(await f.page()) });
  const { job } = (await (
    await f.request("worker/claim", {}, true)
  ).json()) as any;
  const payload = {
    id: job.id,
    lease: job.lease_token,
    run_id: "12345",
    artifact_id: "67890",
    repository: "alaandsDev/clonai",
    voice_warning: "Sem voz no teste",
  };
  assert.equal((await f.request("worker/artifact", payload)).status, 401);
  assert.equal(
    (
      await f.request(
        "worker/artifact",
        { ...payload, repository: "outro/repo" },
        true,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        "worker/artifact",
        { ...payload, artifact_id: "https://evil.example" },
        true,
      )
    ).status,
    400,
  );
  assert.equal(
    (await f.request("worker/artifact", { ...payload, lease: "stale" }, true))
      .status,
    409,
  );
  assert.equal((await f.request("worker/artifact", payload, true)).status, 200);
  assert.equal(f.sql.prepare("SELECT status FROM jobs").get()!.status, "done");
  assert.equal(
    f.sql.prepare("SELECT voice_warning FROM jobs").get()!.voice_warning,
    "Sem voz no teste",
  );
  const response = await f.request("files/" + job.id);
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://github.com/alaandsDev/clonai/actions/runs/12345/artifacts/67890",
  );
  assert.equal((await f.request("worker/artifact", payload, true)).status, 409);
  f.sql.prepare("UPDATE artifacts SET expires_at='2000-01-01'").run();
  assert.equal((await f.request("files/" + job.id)).status, 410);
  assert.equal(f.sql.prepare("SELECT status FROM jobs").get()!.status, "done");
  const rows = ((await (await f.request("state")).json()) as any).jobs;
  assert.ok(rows[0].artifact_expires_at);
});
test("artefato recusado após expiração da lease; nuvem não recebe upload R2", async () => {
  const f = fixture();
  f.c.githubRepository = "alaandsDev/clonai";
  f.c.artifactOnly = true;
  await f.login();
  await f.request("jobs", { script_id: await f.script(await f.page()) });
  const { job } = (await (
    await f.request("worker/claim", {}, true)
  ).json()) as any;
  f.sql.prepare("UPDATE jobs SET lease_until='2000-01-01'").run();
  assert.equal(
    (
      await f.request(
        "worker/artifact",
        {
          id: job.id,
          lease: job.lease_token,
          repository: "alaandsDev/clonai",
          run_id: "1",
          artifact_id: "2",
        },
        true,
      )
    ).status,
    409,
  );
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM artifacts").get()!.n,
    0,
  );
  assert.equal((await f.request("worker/complete", {}, true)).status, 409);
});
test("teto remoto conta tentativas, incluindo retries, no claim atômico", async () => {
  const f = fixture();
  f.c.artifactOnly = true;
  await f.login();
  await f.request("jobs", { script_id: await f.script(await f.page()) });
  for (let i = 0; i < 5; i++)
    f.sql
      .prepare(
        "INSERT INTO render_attempts VALUES(?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      )
      .run("attempt-" + i);
  const r = (await (await f.request("worker/claim", {}, true)).json()) as any;
  assert.equal(r.job, null);
  assert.match(r.note, /cinco tentativas/);
  assert.equal(f.sql.prepare("SELECT attempts FROM jobs").get()!.attempts, 0);
});
