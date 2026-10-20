// Pages service binding API -> private clonai-api Worker. Same-origin cookies;
// no CORS wildcard and no public worker URL are required.
export const onRequest = ({
  request,
  env,
}: {
  request: Request;
  env: { API: { fetch(request: Request): Promise<Response> } };
}) => env.API.fetch(request);
