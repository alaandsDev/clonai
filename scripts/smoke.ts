import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { validateVideo } from "./render.ts";
const base = "http://127.0.0.1:8787";
let cookie = "";
async function api(path: string, body?: unknown) {
  const r = await fetch(base + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
assert.equal((await fetch(base + "/api/state")).status, 401);
assert.match(await (await fetch(base)).text(), /id="root"/);
const login = await api("login", { password: process.env.ADMIN_PASSWORD });
cookie = login.headers.get("set-cookie")!.split(";")[0];
const page = (await (
  await api("pages", {
    name: "Motivação · validação funcional",
    voice: "pt-BR-FranciscaNeural",
    daily_limit: 5,
  })
).json()) as any;
const script = (await (
  await api("scripts", { page_id: page.id })
).json()) as any;
await api("scripts/approve", { id: script.id });
const job = (await (
  await api("jobs", { script_id: script.id, duration: 15 })
).json()) as any;
await new Promise<void>((ok, no) => {
  const proc = spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "scripts/runner.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PYTHON_BIN: process.env.PYTHON_BIN || ".data/voice-env/bin/python",
      },
    },
  );
  proc.on("error", no);
  proc.on("exit", (code) =>
    code === 0 ? ok() : no(Error("Runner falhou: " + code)),
  );
});
const state = (await (await api("state")).json()) as any;
const finished = state.jobs.find((j: any) => j.id === job.id);
assert.equal(finished.status, "done");
const file = await api("files/" + job.id);
assert.equal(file.headers.get("content-type"), "video/mp4");
assert.equal((await fetch(base + "/api/files/" + job.id)).status, 401);
await mkdir(".data/acceptance", { recursive: true });
const path = ".data/acceptance/primeiro-video.mp4";
await writeFile(path, new Uint8Array(await file.arrayBuffer()));
const info = await validateVideo(path);
await writeFile(
  ".data/acceptance/evidence.json",
  JSON.stringify(
    {
      page: page.id,
      script: script.id,
      job: job.id,
      status: finished.status,
      voiceWarning: finished.voice_warning,
      videoCodec: info.streams[0].codec_name,
      width: info.streams[0].width,
      height: info.streams[0].height,
      duration: info.format.duration,
      publication: "manual",
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  "ACEITE LOCAL: painel servido, login protegido, página/roteiro persistidos, aprovação, tarefa, render, ffprobe e download autenticado passaram.",
);
