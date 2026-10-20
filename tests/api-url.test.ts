import { test } from "node:test";
import assert from "node:assert/strict";
import { apiUrl } from "../scripts/api-url.ts";
test("Actions recusa ausência de origem e endereços locais antes de buscar tarefas", () => {
  for (const value of [
    undefined,
    "http://127.0.0.1:8787",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
  ])
    assert.throws(() => apiUrl(value, true));
});
test("origem remota válida é normalizada; local continua disponível no desenvolvimento", () => {
  assert.equal(
    apiUrl("https://clonai-panel.pages.dev/", true),
    "https://clonai-panel.pages.dev",
  );
  assert.equal(apiUrl(undefined, false), "http://127.0.0.1:8787");
  for (const value of [
    "https://user:pass@example.com",
    "https://example.com/api",
    "https://example.com?secret=x",
  ])
    assert.throws(() => apiUrl(value, true));
});
