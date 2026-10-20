# Cotas e condições verificadas

Data: 20/10/2026. Fonte das observações: capturas dos painéis da própria conta enviadas pelo proprietário. As consultas automatizadas à documentação oficial retornaram 403 do proxy; os números abaixo são os exibidos nessa conta, não promessa universal.

| Serviço                       | Evidência da conta                                                                                  | Estado do projeto                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Workers                       | 100.000 requisições/dia                                                                             | Código preparado; não implantado                                                  |
| D1                            | 10 bancos, 5 milhões de linhas lidas/dia, 100 mil gravadas/dia, 5 GB                                | Migrações preparadas; banco não criado                                            |
| Pages                         | Área Workers & Pages disponível; limites específicos de builds não examinados                       | Não implantado                                                                    |
| R2                            | Franquia de 10 GB/mês, 1 milhão de operações A e 10 milhões B, com assinatura e excedentes cobrados | **Descartado; não ativar**                                                        |
| Actions privado               | GitHub Free, 2.000 minutos e 0,5 GB incluídos; uso zero nas telas                                   | Workflow preparado; não executado remotamente                                     |
| Orçamento Actions             | US$ 0; Usage blocked                                                                                | Manter bloqueio; confirmar execução dentro da franquia no primeiro teste          |
| edge-tts                      | Biblioteca gratuita instalada; serviço retornou proxy 403                                           | Experimental, sem garantia de disponibilidade/licença comercial; fallback sem voz |
| Node/React/Vite/SQLite/FFmpeg | Instalados e usados localmente                                                                      | Funcionamento local comprovado; recursos da máquina finitos                       |

Limites do aplicativo: dez páginas, 500 roteiros, 100 tarefas totais, cinco vídeos/página/dia, três tentativas/tarefa, cinco tentativas remotas/dia UTC, um pacote de até 24 MB por execução, retenção solicitada de um dia. O teto remoto não impede o proprietário de disparar workflows adicionais sem tarefa e consumir minutos na preparação. Não substitui controles de faturamento da conta.

Arquivos e minutos de outros repositórios compartilham as franquias. Não habilitar cobrança, runner pago, cache adicional ou retenção longa. A expiração dos artifacts não é instantânea nem armazenamento permanente. Localmente os diagnósticos continuam no disco e exigem revisão manual de espaço.

Referências oficiais para consulta adicional:

- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
- https://github.com/rany2/edge-tts
