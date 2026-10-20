import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
test("runner prepara pacote real isolado, sem segredo e sem concluir antes do upload", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clonai-artifact-"));
  const token = "worker-test-token-with-at-least-32-characters";
  let claims = 0;
  const id = randomUUID();
  const server = createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer " + token);
    assert.equal(req.url, "/api/worker/claim");
    claims++;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        job: {
          id,
          lease_token: "lease-private-test",
          text: "O próximo passo pode ser pequeno. Escolha uma tarefa possível e avance com atenção. Uma decisão de cada vez.",
          duration: 15,
          voice: "none",
          visual: "azul",
        },
      }),
    );
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as any).port;
  try {
    await new Promise<void>((ok, no) => {
      const child = spawn(process.execPath, ["scripts/runner.ts"], {
        env: {
          ...process.env,
          API_URL: `http://127.0.0.1:${port}`,
          WORKER_TOKEN: token,
          DELIVERY_MODE: "github-artifact",
          GITHUB_ACTIONS: "true",
          GITHUB_OUTPUT: join(dir, "output"),
          RUN_DIRECTORY: dir,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let err = "";
      child.stderr.on("data", (b) => (err += b));
      child.on("error", no);
      child.on("exit", (code) => (code === 0 ? ok() : no(Error(err))));
    });
    assert.equal(claims, 1);
    const outputs = await readFile(join(dir, "output"), "utf8");
    assert.match(outputs, /has_job=true/);
    const files = await readdir(join(dir, "export", id));
    assert.deepEqual(files.sort(), [
      "captions.ass",
      "metadata.json",
      "script.txt",
      "thumbnail.jpg",
      "video.mp4",
    ]);
    for (const file of files) {
      if (file.endsWith(".mp4") || file.endsWith(".jpg")) continue;
      const contents = await readFile(join(dir, "export", id, file), "utf8");
      assert.ok(!contents.includes(token));
      assert.ok(!contents.includes("lease-private-test"));
    }
    assert.equal(
      JSON.parse(await readFile(join(dir, "runner-state.json"), "utf8")).lease,
      "lease-private-test",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((ok) => server.close(() => ok()));
  }
});
