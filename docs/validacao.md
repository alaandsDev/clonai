# Evidências locais — 20/10/2026

## Auditoria

Checkout inicialmente vazio e sem commits, sem dependências/manifests ou funcionalidades. Node 24.19.0, npm 11.9.0, FFmpeg/ffprobe 7.1.5. Nenhum AGENTS.md encontrado. Docker sem acesso ao daemon, desnecessário para esta implementação. Credenciais Cloudflare não estavam presentes nos nomes verificados. Nenhum segredo foi impresso.

## Executado

- `npm run build`: TypeScript e bundle Vite passaram.
- `npm test`: 14 testes passaram, zero falhas/skips, incluindo render real de 15 segundos com H.264 1080×1920 e decodificação completa; falha de voz simulada; rejeição de arquivo inválido; limite concorrente; autenticação; duplicação; recuperação e falha de armazenamento.
- `npm run smoke`: painel servido, página criada, roteiro gerado e aprovado, tarefa persistida, execução real do renderizador, upload para disco pela API, status concluído e download autenticado passaram; acesso ao vídeo sem sessão retornou 401.
- Voz real: edge-tts instalado, erro DNS no acesso direto; tentativa pelo proxy retornou ClientHttpProxyError, HTTP 403. Áudio não foi gerado. O vídeo de aceite foi produzido sem áudio, com aviso persistido. Não foi validada narração com sucesso nem legendagem com voz no serviço externo.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`: teste real de navegador passou, cobrindo login, dashboard, cadastro e persistência de página após recarregar, biblioteca e layout sem overflow em tela de 390 px.
- `npm audit --omit=dev`: zero vulnerabilidades encontradas naquele momento nas dependências de produção.

Evidências geradas em caminhos ignorados: `.data/acceptance/primeiro-video.mp4`, `.data/acceptance/evidence.json`, `.data/dashboard-desktop.png`, `.data/dashboard-mobile.png`, arquivos auxiliares em `.data/renders/` e dados persistidos em `.data/clonai.sqlite`.

- Reinicialização real da API: página, roteiro, tarefa concluída e download autenticado permaneceram disponíveis depois de encerrar e iniciar o servidor.
- `npm ci` e `npm run setup:local` repetidos: instalação pelo lockfile passou e o `.env` existente foi preservado. `npm audit` completo também retornou zero vulnerabilidades nessa execução.

## Não executado / pendente

- Implantação Cloudflare, uso real de D1/R2, Actions remoto, verificação de cotas atuais, garantia de gratuidade sem cartão e execução nativa no Windows.
- Publicação social automática (fora do escopo desta versão), calendário de publicação futura, upload de fundos/áudio, edição de roteiro já aprovado, limpeza automática, métricas sociais e provedores de IA.
- Prontidão de produção depende de validação no ambiente hospedado e das configurações externas documentadas.

## Adaptação sem R2

- Build TypeScript/Vite passou após remover o binding R2 do Worker.
- `npm test`: **18 testes passaram**, incluindo novas verificações de repositório permitido, lease expirada, conclusão atômica do artifact, download autenticado, expiração HTTP 410 e teto de cinco tentativas remotas/dia UTC.
- O runner em modo artifact foi executado contra um backend HTTP de teste isolado: renderizou MP4 real e preparou apenas os cinco arquivos de exportação; token e lease não entraram no pacote. Não houve upload no GitHub nesse teste.
- Dois testes de navegador passaram: fluxo local existente e apresentação de pacote privado/expirado. O segundo usa respostas controladas para validar a interface; não representa artifact real publicado.
- Reinício da API aplicou a migração 0002 e preservou a tarefa/vídeo local anterior.
- Workflow remoto e D1 real permanecem não executados. O pacote privado exige login GitHub e autorização ao repositório; não fornece URL pública de vídeo.

## Implantação Cloudflare — atualização

Após o proprietário publicar o ambiente Codex, o token Cloudflare e a variável de conta ficaram disponíveis; a configuração observada estava atual e aplicada.

- A API confirmou o banco D1 existente `clonai`; as migrações 0001 e 0002 foram aplicadas remotamente com sucesso, e as tabelas foram consultadas pela API.
- Worker `clonai-api` implantado com binding DB, variáveis de origem/repositório e segredos administrativos; sem endpoint workers.dev público e sem R2.
- Pages `clonai-panel` implantado em https://clonai-panel.pages.dev com service binding API. A API Cloudflare confirmou estágio deploy/success.
- Requisição de validação ao domínio público foi bloqueada pelo proxy do ambiente (403). O domínio foi adicionado ao rascunho de permissões; sua aplicação requer salvar/publicar o ambiente. Login e fluxo funcional no site público ainda não foram comprovados.
- Nenhum plano pago ou assinatura R2 foi habilitado. Actions remoto, código no GitHub e seus secrets continuam pendentes.
