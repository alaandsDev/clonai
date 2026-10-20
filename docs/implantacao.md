# Implantação manual — Pages, Workers, D1 e artefatos Actions

Código adaptado para **não usar R2**. Atualização: o D1 informado pelo proprietário recebeu as duas migrações; o Worker e as Pages foram implantados. A API Cloudflare confirmou deploy/success em https://clonai-panel.pages.dev. A validação funcional pela URL pública aguarda a aplicação da permissão de rede no Codex. Actions ainda não foi executado. As instruções abaixo documentam a reprodução e os passos restantes.

## Condições observadas na conta

Telas enviadas pelo proprietário: Workers com 100 mil requisições/dia; D1 disponível; GitHub Free com 2.000 minutos e 0,5 GB incluídos, sem consumo; orçamento Actions US$ 0 com Usage blocked. R2 mostrou ativação de assinatura com excedentes cobrados: permaneceu desativado. Preservar esses bloqueios. Recursos de outras aplicações compartilham as franquias.

## Cloudflare: backend e painel

1. Disponibilizar o código no repositório privado `alaandsDev/clonai`. Não foi feito push nesta tarefa.
2. Criar o banco D1 `clonai` somente na opção gratuita já verificada. Anotar o ID real; aplicar **0001.sql e 0002.sql**, nessa ordem. A segunda migração cria metadados dos artefatos e registro das tentativas, nunca blobs de vídeo. Migrações são idempotentes.
3. Configurar o Worker pelo arquivo `cloudflare/api.wrangler.toml`. Binding `DB` aponta para o banco; **nenhum binding R2/VIDEOS**. Em `[vars]`, definir `APP_ORIGIN` com a origem HTTPS real das Pages, sem barra final, e `GITHUB_REPOSITORY = "alaandsDev/clonai"`. Manter `workers_dev=false`, sem rota pública direta.
4. Configurar secrets no Worker: `ADMIN_PASSWORD` (aleatória, 16+ caracteres) e `WORKER_TOKEN` (aleatório, 32+). Não colocar em Git, frontend, print ou chat. Credenciais Cloudflare só por ferramenta segura/configuração local protegida; não foram disponibilizadas aqui.
5. Pages: Node 24, build `npm ci && npm run build`, saída `dist`; incluir diretório `functions/`. O `wrangler.toml` da raiz é de Pages e configura service binding `API` para `clonai-api`. Não usar o arquivo da raiz para implantar o Worker.
6. Publicar com os bindings configurados e confirmar a origem final em `APP_ORIGIN`. Configuração de produção não deve conceder acesso aos previews automaticamente.

A interface mostra a tela de login publicamente, mas os dados e downloads exigem autenticação. Não há CORS aberto. O Worker privado recebe as chamadas por Pages Functions; ambas consomem as cotas aplicáveis. Um erro no binding deve ser corrigido antes de declarar o painel funcionando.

## Actions: uma tarefa e um pacote privado

- Workflow: `.github/workflows/render.yml`, exclusivamente `workflow_dispatch`, Ubuntu padrão, concorrência 1, timeout total 12 min. Nenhum cron ou publicação social.
- Criar GitHub Environment `render-manual`. Secret `WORKER_TOKEN` igual ao do backend; variável `API_URL` com a origem HTTPS real do painel. Usar revisores se a conta permitir. Nenhum token GitHub pessoal é necessário para o upload do artifact ou o download pelo navegador do proprietário.
- Cada disparo instala FFmpeg/fontes e edge-tts e solicita uma tarefa aprovada. O backend impõe cinco claims/tentativas por dia UTC na nuvem, incluindo retries. O limite por página continua cinco vídeos únicos no fuso da página.
- O renderer prepara somente `video.mp4`, `thumbnail.jpg`, `captions.ass`, `script.txt`, `metadata.json` em `.data/export/`. A soma é limitada a 24 MB. O arquivo de estado com lease fica fora dessa pasta e não é enviado.
- `actions/upload-artifact@v4` faz upload com `retention-days: 1`. Somente após sucesso o workflow envia ID do artifact e da execução ao backend; uma instrução SQL com trigger registra metadados e conclui a tarefa atomicamente. Repositórios e IDs são validados. Falha de upload não conclui a tarefa.
- A biblioteca abre a página oficial do artifact no GitHub, via redirecionamento autenticado pelo Clonai. É necessário estar logado no GitHub com permissão ao repositório privado. O pacote é ZIP, não um MP4 público. O login Clonai não concede acesso ao GitHub.
- O prazo exibido pelo painel é conservador/aproximado: um dia após a confirmação. O arquivo pode ser apagado antes ou expirar conforme as regras do GitHub. O backend não consulta disponibilidade real. Após o prazo, retorna 410 e conserva o histórico. Baixar o pacote prontamente.
- Uma execução interrompida é recuperada no próximo claim após a lease de 20 min, até três tentativas por tarefa. Upload bem-sucedido com confirmação perdida pode deixar artifact órfão até expirar; não se garante execução exatamente uma vez entre sistemas externos.

## Controle de uso

Cinco pacotes/dia × 24 MB dá até 120 MB/dia; retenção curta reduz acúmulo, mas remoção pode não ser imediata e outros repositórios também consomem armazenamento. Cinco execuções/dia × timeout 12 min dá até 1.860 min em mês de 31 dias, **sem incluir disparos extras sem tarefa, execuções manuais fracassadas e outros workflows**. Não é garantia de caber na franquia. Verificar uso antes do primeiro teste e manter orçamento US$ 0 com bloqueio. Não ativar runner maior/pago, cache ou retenção prolongada.

## Aceite remoto pendente

Abrir painel na origem real; confirmar 401 sem sessão; cadastrar página; gerar/aprovar roteiro e criar tarefa; disparar **uma** execução manual; medir minutos e bytes; verificar artifact privado e o ID persistido no D1; baixar ZIP pelo painel; validar MP4 e arquivos auxiliares; provar erro sem autorização e expiração. Só depois ampliar o uso.

A autenticação Cloudflare foi configurada e a implantação Cloudflare foi realizada. O fluxo de renderização remoto ainda depende de código e secrets configurados no GitHub. Não enviar tokens no chat. Nenhuma publicação de vídeos é necessária: esta versão é manual.
