import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  render,
  synthesize,
  validateVideo,
  captions,
} from "../scripts/render.ts";
test("voz indisponível mantém fallback explícito", async () => {
  const r = await synthesize(
    "texto de teste",
    "pt-BR-FranciscaNeural",
    "unused",
    async () => {
      throw Error("offline");
    },
  );
  assert.equal(r.audio, null);
  assert.match(r.warning!, /indisponível/);
});
test("render real 1080x1920 H264 de 15 segundos, validado e com arquivos auxiliares", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clonai-render-"));
  const result = await render(
    {
      id: randomUUID(),
      text: "O próximo passo pode ser pequeno. Escolha uma tarefa possível e cuide dela com atenção. Hoje é um bom momento para recomeçar.",
      duration: 15,
      voice: "none",
    },
    dir,
  );
  const meta = await validateVideo(result.file);
  assert.equal(meta.streams[0].width, 1080);
  assert.match(await readFile(join(dir, "captions.ass"), "utf8"), /Dialogue/);
  assert.ok((await readFile(join(dir, "thumbnail.jpg"))).length > 100);
  assert.equal(
    JSON.parse(await readFile(join(dir, "metadata.json"), "utf8")).publication,
    "manual",
  );
});
test("arquivo inválido e parâmetros maliciosos recusados", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clonai-invalid-"));
  const p = join(dir, "fake.mp4");
  await writeFile(p, "invalid");
  await assert.rejects(validateVideo(p));
  await assert.rejects(
    render(
      { id: "../../unsafe", text: "a".repeat(30), duration: 15, voice: "none" },
      dir,
    ),
  );
  assert.ok(!captions("Olá {texto} \\ perigoso.", 15).includes("{texto}"));
});
