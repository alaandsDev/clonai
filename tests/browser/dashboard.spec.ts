import { test, expect } from "@playwright/test";
test("login, painel responsivo, cadastro persistente e biblioteca", async ({
  page,
}) => {
  const pageName = `Página validada ${Date.now()}`;
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Suas ideias. Um passo adiante." }),
  ).toBeVisible();
  await page
    .getByLabel("Senha de administrador")
    .fill(process.env.ADMIN_PASSWORD || "");
  await page.getByRole("button", { name: "Entrar no estúdio" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Páginas", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill(pageName);
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(
    page.getByRole("heading", {
      name: pageName,
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Páginas", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: pageName,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Baixar MP4" }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: ".data/dashboard-mobile.png", fullPage: true });
});

test("biblioteca distingue pacote privado e expirado sem expor credenciais", async ({
  page,
}) => {
  let expires = new Date(Date.now() + 3600000).toISOString();
  await page.route("**/api/state", async (route) =>
    route.fulfill({
      json: {
        pages: [],
        scripts: [],
        jobs: [
          {
            id: "artifact-ui-fixture",
            status: "done",
            attempts: 1,
            created_at: new Date().toISOString(),
            duration: 15,
            artifact_url:
              "https://github.com/alaandsDev/clonai/actions/runs/1/artifacts/2",
            artifact_expires_at: expires,
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Abrir pacote privado no GitHub" }),
  ).toHaveAttribute("href", "/api/files/artifact-ui-fixture");
  await expect(page.getByText(/Exige login no GitHub/)).toBeVisible();
  expires = "2000-01-01T00:00:00.000Z";
  await page.reload();
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(
    page.getByText("Pacote expirado. O histórico permanece salvo."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir pacote privado no GitHub" }),
  ).toHaveCount(0);
});
