import { handle } from "../server/api.ts";
interface Env {
  DB: any;
  GITHUB_REPOSITORY: string;
  ADMIN_PASSWORD: string;
  WORKER_TOKEN: string;
  APP_ORIGIN: string;
}
export default {
  async fetch(request: Request, env: Env) {
    return handle(request, {
      db: {
        all: async (sql, args = []) => {
          const r = await env.DB.prepare(sql)
            .bind(...args)
            .all();
          return r.results;
        },
        run: async (sql, args = []) => {
          const r = await env.DB.prepare(sql)
            .bind(...args)
            .run();
          return r.meta.changes;
        },
      },
      storage: {
        get: async () => null,
        put: async () => {
          throw new Error("R2 desativado; use Actions artifacts");
        },
      },
      githubRepository: env.GITHUB_REPOSITORY,
      artifactOnly: true,
      adminPassword: env.ADMIN_PASSWORD,
      workerToken: env.WORKER_TOKEN,
      origin: env.APP_ORIGIN,
      secure: true,
    });
  },
};
