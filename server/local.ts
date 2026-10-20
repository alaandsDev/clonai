import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { handle } from "./api.ts";
import type { DB, Storage } from "./api.ts";
const root = resolve(".data");
await mkdir(root + "/files", { recursive: true });
export function sqliteDB(path: string): DB {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  return {
    all: async (sql, args = []) => db.prepare(sql).all(...(args as any[])),
    run: async (sql, args = []) =>
      Number(db.prepare(sql).run(...(args as any[])).changes),
  };
}
const db = sqliteDB(root + "/clonai.sqlite");
const schema = await readFile("migrations/0001.sql", "utf8");
// exec via separate connection supports idempotent initialization.
const init = new DatabaseSync(root + "/clonai.sqlite");
init.exec(schema);
for (const file of (await readdir("migrations"))
  .filter((f) => f.endsWith(".sql") && f !== "0001.sql")
  .sort())
  init.exec(await readFile("migrations/" + file, "utf8"));
init.close();
const storage: Storage = {
  get: async (key) => {
    if (!/^[a-f0-9-]+\.mp4$/.test(key)) return null;
    try {
      return new Response(await readFile(root + "/files/" + key));
    } catch {
      return null;
    }
  },
  put: async (key, data) => {
    if (!/^[a-f0-9-]+\.mp4$/.test(key)) throw Error("Invalid key");
    await writeFile(root + "/files/" + key, new Uint8Array(data));
  },
};
const port = Number(process.env.PORT || 8787);
const origin = process.env.APP_ORIGIN || `http://127.0.0.1:${port}`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", origin);
    if (url.pathname.startsWith("/api/")) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > 24 * 1024 * 1024) {
          res.writeHead(413);
          res.end("Arquivo muito grande");
          return;
        }
        chunks.push(part);
      }
      const headers = new Headers();
      for (const [key, v] of Object.entries(req.headers))
        if (v) headers.set(key, Array.isArray(v) ? v.join(",") : v);
      const response = await handle(
        new Request(url, {
          method: req.method,
          headers,
          body: ["GET", "HEAD"].includes(req.method || "GET")
            ? undefined
            : Buffer.concat(chunks),
        }),
        {
          db,
          storage,
          githubRepository: process.env.GITHUB_REPOSITORY,
          adminPassword: process.env.ADMIN_PASSWORD || "",
          workerToken: process.env.WORKER_TOKEN || "",
          origin,
          secure: origin.startsWith("https:"),
        },
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const target = resolve("dist", "." + pathname);
    if (
      !target.startsWith(resolve("dist") + "/") &&
      target !== resolve("dist")
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    let file: Buffer;
    let name = target;
    try {
      file = await readFile(target);
    } catch {
      name = "index.html";
      file = await readFile("dist/index.html");
    }
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
    };
    res.writeHead(200, {
      "Content-Type": types[extname(name)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'",
      "Referrer-Policy": "no-referrer",
    });
    res.end(file);
  } catch {
    res.writeHead(500);
    res.end("Falha local. Execute npm run build e verifique a configuração.");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Clonai local: porta ${port}; publicação manual. Configuração ${process.env.ADMIN_PASSWORD && process.env.WORKER_TOKEN ? "presente" : "pendente"}.`,
  ),
);
