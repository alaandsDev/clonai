import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir(".data", { recursive: true });
try {
  await writeFile(
    ".env",
    `ADMIN_PASSWORD=${randomBytes(24).toString("base64url")}\nWORKER_TOKEN=${randomBytes(40).toString("base64url")}\nAPP_ORIGIN=http://127.0.0.1:8787\nAPI_URL=http://127.0.0.1:8787\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Configuração local criada em .env, ignorada pelo Git. Consulte a senha somente nesse arquivo.",
  );
} catch (e: any) {
  if (e.code === "EEXIST") console.log(".env existente preservado.");
  else throw e;
}
