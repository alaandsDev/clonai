import { render } from "./render.ts";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  appendFile,
  stat,
} from "node:fs/promises";
import { resolve } from "node:path";
const runDirectory = resolve(process.env.RUN_DIRECTORY || ".data");
const base = process.env.API_URL || "http://127.0.0.1:8787";
const token = process.env.WORKER_TOKEN;
if (!token || token.length < 32)
  throw Error("Configure WORKER_TOKEN (32+ caracteres)");
const parsed = new URL(base);
if (
  parsed.protocol !== "https:" &&
  !(
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(parsed.hostname)
  )
)
  throw Error("API remota exige HTTPS");
async function call(path: string, body?: unknown) {
  const r = await fetch(base + path, {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error(`Backend retornou ${r.status}`);
  return r.json();
}
const { job, note } = (await call("/api/worker/claim")) as any;
if (!job) {
  console.log(note || "Nenhuma tarefa autorizada pendente.");
  process.exit(0);
}
if (process.env.DELIVERY_MODE === "github-artifact") {
  if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_OUTPUT)
    throw Error("Modo artefato exige execução GitHub Actions");
  await mkdir(runDirectory, { recursive: true });
  await writeFile(
    resolve(runDirectory, "runner-state.json"),
    JSON.stringify({ id: job.id, lease: job.lease_token }),
    { mode: 0o600 },
  );
}
try {
  const result = await render(job, resolve(runDirectory, "renders", job.id));
  if (process.env.DELIVERY_MODE === "github-artifact") {
    const output = resolve(runDirectory, "export", job.id);
    await mkdir(output, { recursive: true });
    const source = resolve(runDirectory, "renders", job.id);
    let bytes = 0;
    for (const file of [
      "video.mp4",
      "thumbnail.jpg",
      "captions.ass",
      "script.txt",
      "metadata.json",
    ]) {
      bytes += (await stat(resolve(source, file))).size;
      if (bytes > 24 * 1024 * 1024)
        throw Error("Pacote excede limite econômico de 24 MB");
      await copyFile(resolve(source, file), resolve(output, file));
    }
    await writeFile(
      resolve(runDirectory, "runner-state.json"),
      JSON.stringify({
        id: job.id,
        lease: job.lease_token,
        voice_warning: result.warning,
      }),
      { mode: 0o600 },
    );
    await appendFile(
      process.env.GITHUB_OUTPUT!,
      `has_job=true\nartifact_name=clonai-${job.id}\n`,
    );
    console.log(
      "Pacote validado e pronto para upload privado. A tarefa só será concluída após o upload.",
    );
    process.exit(0);
  }
  const data = await readFile(result.file);
  const r = await fetch(
    `${base}/api/worker/complete?id=${encodeURIComponent(job.id)}`,
    {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "video/mp4",
        "X-Lease-Token": job.lease_token,
        "X-Voice-Warning": encodeURIComponent(result.warning || "none"),
      },
      body: data,
      signal: AbortSignal.timeout(90000),
    },
  );
  if (!r.ok) throw Error(`Upload recusado (${r.status})`);
  console.log("Vídeo validado, armazenado e concluído:", job.id);
  if (result.warning) console.log(result.warning);
} catch (e) {
  await call("/api/worker/fail", {
    id: job.id,
    lease: job.lease_token,
    error:
      "Falha de renderização, validação ou armazenamento. Consulte a execução local; arquivos de diagnóstico preservados.",
  }).catch(() => {});
  throw e;
}
