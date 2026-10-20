import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
let state: { id: string; lease: string; voice_warning?: string };
try {
  state = JSON.parse(
    await readFile(
      resolve(process.env.RUN_DIRECTORY || ".data", "runner-state.json"),
      "utf8",
    ),
  );
} catch {
  if (process.argv[2] === "fail") process.exit(0);
  throw Error("Estado de execução não encontrado");
}
const base = new URL(process.env.API_URL || "");
if (base.protocol !== "https:") throw Error("API remota exige HTTPS");
const failed = process.argv[2] === "fail";
const body = failed
  ? {
      id: state.id,
      lease: state.lease,
      error:
        "Execução remota ou upload do artefato falhou. Verifique o histórico do Actions.",
    }
  : {
      ...state,
      repository: process.env.GITHUB_REPOSITORY,
      run_id: process.env.GITHUB_RUN_ID,
      artifact_id: process.env.ARTIFACT_ID,
    };
const r = await fetch(
  new URL(failed ? "/api/worker/fail" : "/api/worker/artifact", base),
  {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: "Bearer " + process.env.WORKER_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  },
);
if (!r.ok && !(failed && r.status === 409))
  throw Error(
    `Backend recusou conclusão (${r.status}); consulte a tarefa no painel.`,
  );
console.log(
  failed
    ? "Falha registrada ou tarefa já encerrada."
    : "Artefato privado registrado no backend.",
);
