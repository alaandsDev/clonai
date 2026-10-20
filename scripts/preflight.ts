import { apiUrl } from "./api-url.ts";
apiUrl(process.env.API_URL, true);
if (!process.env.WORKER_TOKEN || process.env.WORKER_TOKEN.length < 32)
  throw Error(
    "Configure o repository secret WORKER_TOKEN com o valor do backend (32+ caracteres).",
  );
console.log("Configuração remota validada; nenhum segredo foi exibido.");
