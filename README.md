# Clonai — primeira versão gratuita

Estúdio privado para criar roteiros de motivação, revisar, renderizar vídeos e baixar para publicação **manual**. Implementação local funcional; configuração de nuvem preparada, mas **implantada na Cloudflare, com validação funcional online pendente**. Foram implantados Worker e Pages, e aplicadas as migrações no D1 fornecido pelo proprietário. Nenhum plano pago ou assinatura R2 foi ativado.

## O que foi entregue

- Painel React/TypeScript/Vite em português, responsivo, com login, páginas editáveis, roteiros, fila, biblioteca e histórico com dados reais.
- API TypeScript compartilhada entre Node.js e Cloudflare Workers; SQLite local e adaptador D1 para nuvem.
- Roteiros por combinações de textos próprios, sem API paga; texto personalizado opcional, aprovação obrigatória e deduplicação normalizada.
- Cinco vídeos únicos por página/dia no fuso da página, aplicados por trigger transacional. O mesmo roteiro não cria duas tarefas. Pausar página impede novos claims.
- Claim atômico, lease de 20 minutos, até três tentativas por tarefa, recuperação de execução interrompida na próxima execução manual.
- FFmpeg real: fundo sintético próprio, legendas por sentença, MP4 1080×1920, H.264, AAC quando houver áudio; validação ffprobe e decodificação completa FFmpeg.
- edge-tts experimental e opcional. Nesta máquina, a biblioteca foi instalada, mas o serviço retornou bloqueio de proxy 403; o fallback sem voz foi comprovado.
- Arquivos privados em disco local; artefatos privados do GitHub Actions no fluxo remoto, sem R2. Uma tarefa por execução; retenção solicitada de um dia.
- Contrato de futuras integrações em `server/publication.ts`; nenhuma publicação social automática.

## Windows: executar

Requisitos: Node.js **24 ou superior**, Git, FFmpeg com libass/subtitles e ffprobe no PATH. Python 3.10+ é opcional para voz. Para Windows de 8 GB, o render usa somente duas threads e uma tarefa por vez.

No PowerShell, dentro do checkout `clonai`:

```powershell
node --version
npm --version
ffmpeg -version
ffprobe -version
npm ci
npm run setup:local
npm run build
npm run dev
```

Abra no navegador o endereço local da porta **8787** no host **127.0.0.1**. Consulte `ADMIN_PASSWORD` no arquivo `.env` criado localmente e faça login. Esse arquivo contém segredos: não publique, não envie por chat e não versione. `setup:local` preserva um `.env` existente; se você criou o arquivo copiando `.env.example`, preencha os valores em branco com segredos próprios (senha 16+ caracteres; worker token 32+). Não coloque essas variáveis no frontend.

Para desenvolvimento com atualização da interface, mantenha `npm run dev` e execute `npm run web` em outro terminal. Nesse caso ajuste `APP_ORIGIN` em `.env` para a origem local exata da porta **5173**, e reinicie a API. O proxy Vite mantém as chamadas `/api` na mesma origem. Não use `npm run preview` como servidor de API.

### Primeiro vídeo

1. Em **Páginas**, cadastre a página, fuso `America/Sao_Paulo`, limite 5 e estilo visual. Comece sem narração ou selecione uma voz experimental.
2. Selecione a página no cabeçalho. Em **Roteiros**, gere um modelo próprio ou escreva 20–1400 caracteres. Revise e aprove.
3. Escolha 15, 20 ou 30 segundos e adicione à fila.
4. Em outro PowerShell, execute:

```powershell
npm run render
```

5. A execução processa **uma** tarefa pendente. O painel atualiza em até 15 segundos; em **Biblioteca**, baixe o MP4 e o roteiro. O trabalho não será marcado como publicado.

Os arquivos auxiliares (legendas ASS, miniatura, texto e metadados) ficam em `.data/renders/ID_DA_TAREFA/`. O vídeo final fica também no armazenamento privado. Em caso de falha, os arquivos de diagnóstico são preservados. Não existe editor de texto para roteiros já aprovados nesta versão: crie outro roteiro revisado. Para reduzir duração de narração, encurte o texto; o sistema rejeita áudio fora de 15–30 segundos em vez de cortar palavras.

### Voz opcional

```powershell
python -m venv .data/voice-env
.data\voice-env\Scripts\python.exe -m pip install -r requirements-voice.txt
$env:PYTHON_BIN = (Resolve-Path .data\voice-env\Scripts\python.exe).Path
npm run render
```

O módulo tenta edge-tts por até 45 s e respeita `HTTPS_PROXY` quando presente. Se não houver áudio, continua sem voz e registra o aviso. Quando há áudio, usa os timestamps de legendas fornecidos pelo serviço. Sem áudio, distribui sentenças ao longo da duração; isso não representa alinhamento de palavras faladas. Vozes: Francisca e Antonio em pt-BR.

O projeto edge-tts é um cliente não oficial de um serviço externo, não uma garantia de API gratuita, disponibilidade ou licença comercial. Alternativas: continuar com legendas sem voz; gravar voz própria para edição externa; avaliar eSpeak NG, leve e de código aberto, como futuro adaptador offline. Upload de áudio próprio e eSpeak ainda não estão implementados. Não há modelo pesado nem clonagem de voz.

## Testes

```powershell
npm run build
npm test
```

Com o servidor local ligado, o teste de aceite cria dados reais de demonstração e um vídeo:

```powershell
npm run smoke
```

No Windows o smoke usa a mesma variável `PYTHON_BIN` configurada acima; sem Python, o fallback continua funcionando. O smoke é exclusivo da máquina local e nunca publica nas redes.

Teste opcional de navegador (cria uma página de demonstração; execute o smoke antes para haver um vídeo na biblioteca):

```powershell
npx playwright install chromium
npm run test:ui
```

Nesta máquina Linux, foi usado o Chromium já instalado via `CHROMIUM_PATH=/usr/bin/chromium`. Screenshots e evidências ficam em `.data/`, ignoradas pelo Git. Testes executados: ver `docs/validacao.md`.

## Organização

- `src/`: painel e estilos.
- `server/api.ts`: autenticação, validação, páginas, roteiros, fila e downloads.
- `server/local.ts`: HTTP, SQLite e armazenamento local.
- `migrations/`: schema, integridade, idempotência, limites e índices.
- `scripts/render.ts`: voz, legendas, FFmpeg e validação.
- `scripts/runner.ts`: uma tarefa autorizada, upload e conclusão/falha.
- `cloudflare/worker.ts`, `cloudflare/api.wrangler.toml`: adaptador Workers/D1 e registro de artefatos privados.
- `functions/api/[[path]].ts`, `wrangler.toml`: proxy Pages para Worker privado.
- `.github/workflows/render.yml`: execução manual, sem cron/polling infinito.
- `tests/`: testes de backend, render e navegador.

## Segurança, limites e operação

- API falha de forma fechada sem senha/token válidos; cookie HttpOnly, SameSite Strict, Secure na nuvem, sessão de oito horas e hash do identificador no banco.
- Origem de escrita restrita; sem CORS permissivo; até dez tentativas de login/minuto globalmente e 60 escritas administrativas/minuto. Proteção contra abuso distribuído avançado não está implementada.
- Worker token separado, somente no backend/Actions; URLs remotas exigem HTTPS e não seguem redirecionamentos. Renderer não executa comandos via shell nem baixa URLs fornecidas pelo usuário.
- Limites fixos econômicos: dez páginas, 500 roteiros, 100 tarefas totais, cinco vídeos/página/dia, duração de 15–30 s, 24 MB por arquivo, concorrência remota 1. Esses limites não são uma medição de quota do fornecedor.
- Na nuvem, no máximo cinco tentativas de render por dia UTC, contando retries; uma execução bloqueada ou sem tarefa também pode consumir minutos de instalação do Actions. Esse teto não substitui o orçamento de US$ 0 da conta.
- Tentativas não criam novo vídeo/registro diário. O dia é o da **criação da tarefa**, não o dia de eventual publicação manual. Não existe calendário de publicação futura nesta versão.
- Arquivos auxiliares são preservados; retenção automática e remoção pelo painel ainda não existem. Revise espaço e quota antes de mais execuções; o limite total bloqueia a criação adicional, sem apagar trabalho. Não altere limites para contornar franquias.
- `.data` e `.env` são privados e locais. Backup: com a API parada e sem render em andamento, copie `.data/clonai.sqlite` e `.data/files` para destino privado; restaure com os processos parados. Nunca comite backups ou credenciais.

## Nuvem e custos

Veja [implantação](docs/implantacao.md), [cotas e dependências](docs/cotas.md) e [validação](docs/validacao.md). A hospedagem desacoplada permitirá painel com o PC desligado **depois de uma implantação real**; o servidor local atual não oferece essa disponibilidade.

As páginas oficiais consultadas retornaram 403 no proxy. Posteriormente, as telas da conta fornecidas pelo proprietário mostraram GitHub Free com 2.000 minutos e 0,5 GB de Actions, sem consumo, e orçamento de Actions US$ 0 com Usage blocked. Workers mostrou 100 mil requisições/dia; D1 mostrou limites da conta; R2 exigiu assinatura e foi descartado. Não há promessa de custo zero absoluto ou solução pronta para produção. O fluxo remoto agora dispensa R2: o painel abre o pacote ZIP privado no GitHub, exigindo login e acesso ao repositório. Esse pacote não é um link MP4 público nem um arquivo permanente; baixe antes de expirar. Nenhum token GitHub é enviado ao frontend ou armazenado no Worker. Se uma ativação exigir cartão ou plano pago, interrompa essa etapa.
