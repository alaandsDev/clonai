export function apiUrl(value: string | undefined, remote: boolean): string {
  if (remote && !value)
    throw Error(
      "API_URL ausente: configure a origem HTTPS do painel Cloudflare.",
    );
  const url = new URL(value || "http://127.0.0.1:8787");
  const loopback =
    ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname) ||
    url.hostname.endsWith(".localhost");
  if (remote && (url.protocol !== "https:" || loopback))
    throw Error(
      "Actions exige API_URL HTTPS pública. Endereço local não funciona no runner.",
    );
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw Error("API remota exige HTTPS");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error(
      "API_URL deve conter somente a origem, sem credenciais, caminho ou parâmetros.",
    );
  return url.origin;
}
