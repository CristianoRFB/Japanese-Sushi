# Auditoria do módulo de entregas — Teiko Sushi

Data da auditoria: 2026-10-09
Projeto: `sushi-cbfd2` · unidade `santa-fe-do-sul`
RC auditado: `992fffd` (`fix: protect automatic delivery finance entries`)
Branch: `main` · `git pull --ff-only` sem atualizações · working tree limpo.

## Veredito do RC atual

**BLOQUEADO para venda em produção.** O RC abre em `http://localhost:3001/` e a tela pública foi operada no navegador. A entrada administrativa exibe apenas e-mail/senha e informa que as credenciais são gerenciadas pelo Firebase; não há credencial administrativa versionada ou disponível neste workspace.

O bloqueio é comercial e operacional, não uma falha de build local: o cardápio real ainda não foi configurado, o deploy das Functions ainda não foi comprovado no Firebase oficial e a jornada real de produção ainda não foi executada.

O goal recuperado em Downloads (`GOAL_Acai_Mais_Sabor_Auditoria_Total_Motoboy.txt`) descreve o produto Açaí Mais Sabor. Foram aplicados somente os requisitos funcionais de auditoria de motoboy ao produto atual, Teiko Sushi; branding, dados e regras do Açaí foram descartados.

## Matriz inicial após o pull

| Área | Status | Evidência |
|---|---|---|
| Login, role e proteção de rota do motoboy | [PARCIAL] | `app/entregador/login/page.tsx`, `components/providers.tsx` e Rules existem; login real de produção ainda não foi executado. |
| Dashboard, disponibilidade, aceite, retirada, rota, chegada e falha | [PARCIAL] | `app/entregador/page.tsx` chama `lib/delivery-operations.ts` e usa listeners; faltava provar o fluxo ponta a ponta com Firebase real. |
| Código de entrega | [PARCIAL] | Hash e separação entre `orderDeliveryCodes`/`deliverySecrets` existiam, mas não havia limite de tentativas e a Rule não comparava o hash na aprovação. |
| Admin de motoboys e central de entregas | [PARCIAL] | `app/admin/entregadores/page.tsx` e `app/admin/entregas/page.tsx` existem; histórico/reatribuição dependiam da operação direta e não havia E2E. |
| Cliente acompanha pedido | [PARCIAL] | `app/pedido/[publicCode]/page.tsx` acompanhava o pedido e o código, mas não o documento `deliveries` nem o nome/status do motoboy. |
| Regras de vínculo do motoboy | [QUEBRADA] | A atualização permitia que o motoboy enviasse `driverId`/`driverName` alterados durante uma transição válida. |
| Financeiro de entrega | [PARCIAL] | A transação escrevia pedido, entrega e financeiro; as Rules não exigiam o lançamento determinístico para aceitar conclusão. |
| Notificação fora da tela | [PARCIAL] | Não há FCM/Web Push; agora há alerta in-app para nova corrida enquanto o portal está aberto. |
| PWA/service worker | [AUSENTE] | Não havia manifest nem service worker. |

## Correções aplicadas

- O motoboy não consegue mais trocar `driverId` ou `driverName` em uma transição; a Rule mantém o vínculo com a conta autenticada.
- A tela do cliente passa a acompanhar `deliveries/{orderId}` em tempo real, exibindo etapa e motoboy somente para o dono do pedido.
- O portal do motoboy ganhou navegação inferior para celular, com âncoras de corrida, histórico e perfil, além de espaço seguro para a barra inferior.
- Falhas de entrega agora registram `failedAt`; a reatribuição limpa esse timestamp junto com o motivo da tentativa anterior.
- As Rules agora exigem `failedAt` com timestamp quando a corrida entra em `DELIVERY_FAILED` e impedem reatribuição com motivo/timestamp obsoletos; o cenário foi incluído no teste do Firestore Emulator.
- A sessão da equipe agora acompanha `users/{uid}` em tempo real; usuário inativo, role inválida ou motoboy desativado perde a sessão efetiva imediatamente, sem depender de refresh.
- O pedido de confirmação passou a ter `attempts` e `locked`; após cinco rejeições, uma nova tentativa é bloqueada até reatribuição administrativa.
- O hash correto é exigido pela Rule na aprovação. A conclusão exige, na mesma operação, entrega `DELIVERED`, pedido `COMPLETED` e lançamento financeiro cujo `sourceOrderId` é o próprio pedido.
- A reatribuição reinicia o contador da nova corrida sem apagar o documento existente.
- Foi adicionado manifest, service worker com fallback público offline e aviso de conexão no portal do motoboy. Dados administrativos e pedidos privados não são cacheados.
- O checkout público e o PDV passaram a chamar `createOrder`; o preço é recalculado no servidor e a criação direta de pedidos pelo cliente foi bloqueada nas Rules.
- `firebase.json` agora declara Functions de segunda geração em `southamerica-east1`; o custo/plano e o deploy oficial continuam pendentes.
- Foi criada a coleção append-only `deliveryEvents`, com leitura restrita ao admin e ao motoboy vinculado; inclusão e imutabilidade são validadas pelas Rules.
- A Central de entregas agora exibe a trilha recente por corrida, com etapa, motivo e horário, sem expor o UID interno do ator.
- O portal do motoboy agora abre rota de direção real no Google Maps a partir do endereço da corrida e oferece Waze como fallback.
- O runner `npm run test:e2e` agora escolhe portas livres, fixa o projeto/emuladores corretos e limpa a configuração temporária ao terminar.
- O runner E2E tolera descoberta fria das Functions no Windows com timeout de 60 segundos; a suíte também registra as disputas concorrentes de delivery no emulador.
- Lançamentos financeiros automáticos ligados a `sourceOrderId` agora são imutáveis nas Rules e aparecem separados dos lançamentos manuais na tela de Finanças.
- O runtime foi atualizado para React 19.3, Vinext 1.0.1 e Vite 8.3.4; os overrides de `@grpc/grpc-js` e `proxy-addr` removem vulnerabilidades críticas conhecidas sem usar `--force`.
- O pacote de build `shadcn` foi movido para `devDependencies`; ele continua disponível durante o build, mas não é instalado como dependência de runtime.

## Matriz final local

| Área | Status | Prova/limitação |
|---|---|---|
| RBAC, isolamento do motoboy, cliente dono e cliente alheio | [OK local] | 15 cenários em `tests/firestore.rules.test.ts`, incluindo leitura do dono, bloqueio de usuário alheio, usuário inativo e motoboy desativado. A sessão também revalida role/cadastro em tempo real no `AuthProvider`. |
| Sequestro de entrega e transições inválidas | [OK] | Rules testadas contra alteração de vínculo e conclusão direta pelo motoboy. |
| Tentativas de código | [OK] | Cinco rejeições são permitidas; a sexta submissão é bloqueada por Rules e pela operação. |
| Reatribuição após falha | [OK] | Fluxo e Rules testados para liberar o motoboy anterior e aceitar novo vínculo. |
| Cliente em tempo real | [OK] | Listener do pedido e listener protegido de `deliveries/{orderId}` implementados. Execução real depende do Firebase configurado. |
| Login/fluxo ponta a ponta em produção | [PARCIAL] | Não há credencial/ambiente de produção disponível nesta auditoria. |
| E2E do pedido server-side | [OK local] | `npm run test:e2e` passou 3/3 em portas dinâmicas: persistência, idempotência e rejeição de total adulterado. |
| Concorrência de delivery | [OK local] | A suíte de Rules passou 16/16, cobrindo disputa de atribuição, dois aceites simultâneos, duas conclusões simultâneas e uma única receita criada. |
| Push quando o app está fechado | [PARCIAL] | Não implementado; o fallback é alerta in-app e atualização em tempo real enquanto a tela está aberta. |
| Financeiro e caixa | [PARCIAL] | A conclusão exige lançamento financeiro e as Rules protegem entradas automáticas ligadas ao pedido; ainda falta exercício ponta a ponta com caixa de produção e auditoria específica da movimentação de dinheiro. |
| Histórico de eventos imutável | [OK local] | `deliveryEvents` é criada nas operações de despacho, aceite, recusa, etapas, falha, código e conclusão; Rules bloqueiam update/delete, há cenário dedicado de imutabilidade e a Central exibe a trilha recente. |
| Mobile 360/390/430 e teclado | [PARCIAL] | Login do motoboy foi inspecionado visualmente em 360×800, 390×844 e 430×932 sem overflow/clipping; portal autenticado e teclado aberto ainda dependem de Firebase/credenciais reais. |
| Mapas e navegação | [PARCIAL] | O portal gera deep link de direções para o endereço real e fallback Waze em `app/entregador/page.tsx`; a abertura em dispositivo móvel autenticado ainda depende de Firebase/credenciais reais. |
| PWA/offline | [PARCIAL] | Manifest, service worker e fallback foram adicionados; ações Firestore não são enfileiradas offline e devem ser repetidas somente após reconexão. |
| Perfil próprio do motoboy | [OK] | O portal exibe nome, telefone e e-mail ativos; edição continua centralizada na administração. |

## Validações executadas

- `git pull --ff-only` — sem atualizações; RC confirmado em `6a2383a`.
- Navegador local — passou para a home pública em `http://localhost:3001/`; a página mostra o cardápio de desenvolvimento e preços pendentes.
- Navegador local — login do motoboy passou visualmente em 360×800, 390×844 e 430×932; o ambiente sem Firebase mantém o botão desabilitado como esperado.
- `/admin/login` — passou visualmente; acesso exige e-mail e senha do Firebase e não expõe credenciais no código.
- `npm run lint` — passou.
- `npm run typecheck` — passou.
- `npm test` — 7 arquivos, 29 testes passaram.
- `npm run test:functions` — 1 arquivo, 7 testes passaram.
- `npm --prefix functions run build` — passou.
- `npm run test:e2e` — 3 cenários de criação de pedido passaram em portas dinâmicas, incluindo idempotência e rejeição de preço adulterado.
- `npx wrangler deploy --dry-run --config dist/server/wrangler.json` — passou; release Cloudflare gerado com 394 módulos, 5,1 MB de upload e sem bindings pendentes. Nenhuma publicação real foi feita.
- `npm run preflight:production` — bloqueou corretamente sem configuração Firebase; com valores de teste e projeto `sushi-cbfd2`, passou sem imprimir segredos.
- `npm run deploy:frontend` e `npm run deploy:backend` — comandos de publicação documentados; não executados, pois exigem credenciais das contas Cloudflare/Firebase e efeito externo autorizado.
- `npm run test:rules` — 1 arquivo, 16 testes passaram no Firestore Emulator; a nova prova cobre atribuição, aceite e conclusão concorrentes.
- `npm run build` — passou; apenas aviso não bloqueante de chunks acima de 500 kB.
- `npm audit` — o audit de produção do frontend ficou em 10 vulnerabilidades (1 baixa, 3 moderadas e 6 altas), e o audit de produção das Functions em 8 moderadas, sem críticas; as restantes exigem revisão de versões maiores e não foi aplicado `--force`.
- `npm run test:integration` — script raiz inexistente; o E2E aplicável está disponível em `npm run test:e2e` e foi executado acima.

## Bloqueios antes de vender

1. Cadastrar e conferir o catálogo, preços, adicionais, horários, unidade, pagamentos e regras de delivery oficiais; o seed de desenvolvimento usa preços `0` e o README exige configuração manual.
2. Publicar e observar `createOrder` no Firebase oficial; a proteção já está implementada e validada no emulator, mas ainda não há evidência de deploy, App Check e logs em produção.
3. Configurar uma chave Firebase Web válida, Auth Email/Password + Anonymous, primeiro admin e documentos de produção; `.env.local` não está versionado neste workspace.
4. Executar o deploy oficial separado: frontend com Wrangler na conta Cloudflare correta; Firestore/Functions com Firebase. Functions de segunda geração exigem plano de faturamento e revisão de limites/custos.
5. Resolver/revisar as 10 vulnerabilidades do frontend e 8 moderadas das Functions, preferencialmente por atualizações compatíveis e nova rodada completa de testes.
6. Executar uma jornada real com cliente, admin e motoboy, incluindo código errado/certo, falha, reatribuição e dinheiro; a concorrência principal já tem prova no emulador, mas ainda falta a confirmação operacional em produção.
7. Decidir se a operação exige push quando o portal estiver fechado; se sim, implementar FCM/Web Push antes da venda.

Enquanto esses itens não forem comprovados, o sistema não deve ser anunciado como pronto para venda em produção.
