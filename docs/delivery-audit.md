# Auditoria do módulo de entregas — Teiko Sushi

Data da auditoria: 2026-10-08
Projeto: `sushi-cbfd2` · unidade `santa-fe-do-sul`
RC auditado: `ea070f7` (`feat: route order creation through server`)
Branch: `main` · `git pull --ff-only` sem atualizações · working tree limpo.

## Veredito do RC atual

**BLOQUEADO para venda em produção.** O RC abre em `http://localhost:3001/` e a tela pública foi operada no navegador. A entrada administrativa exibe apenas e-mail/senha e informa que as credenciais são gerenciadas pelo Firebase; não há credencial administrativa versionada ou disponível neste workspace.

O bloqueio é comercial e operacional, não uma falha de build local: o cardápio real ainda não foi configurado, o deploy das Functions ainda não foi comprovado no Firebase oficial e a jornada real de produção ainda não foi executada.

O TXT encontrado em Downloads descreve o produto Açaí Mais Sabor. Foram aplicados somente os requisitos funcionais de auditoria de motoboy ao produto atual, Teiko Sushi; branding, dados e regras do Açaí foram descartados.

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
- O pedido de confirmação passou a ter `attempts` e `locked`; após cinco rejeições, uma nova tentativa é bloqueada até reatribuição administrativa.
- O hash correto é exigido pela Rule na aprovação. A conclusão exige, na mesma operação, entrega `DELIVERED`, pedido `COMPLETED` e lançamento financeiro cujo `sourceOrderId` é o próprio pedido.
- A reatribuição reinicia o contador da nova corrida sem apagar o documento existente.
- Foi adicionado manifest, service worker com fallback público offline e aviso de conexão no portal do motoboy. Dados administrativos e pedidos privados não são cacheados.
- O checkout público e o PDV passaram a chamar `createOrder`; o preço é recalculado no servidor e a criação direta de pedidos pelo cliente foi bloqueada nas Rules.
- `firebase.json` agora declara Functions de segunda geração em `southamerica-east1`; o custo/plano e o deploy oficial continuam pendentes.

## Matriz final local

| Área | Status | Prova/limitação |
|---|---|---|
| RBAC, isolamento do motoboy, cliente dono e cliente alheio | [OK] | 13 cenários em `tests/firestore.rules.test.ts`, incluindo leitura do dono e bloqueio de usuário alheio. |
| Sequestro de entrega e transições inválidas | [OK] | Rules testadas contra alteração de vínculo e conclusão direta pelo motoboy. |
| Tentativas de código | [OK] | Cinco rejeições são permitidas; a sexta submissão é bloqueada por Rules e pela operação. |
| Reatribuição após falha | [OK] | Fluxo e Rules testados para liberar o motoboy anterior e aceitar novo vínculo. |
| Cliente em tempo real | [OK] | Listener do pedido e listener protegido de `deliveries/{orderId}` implementados. Execução real depende do Firebase configurado. |
| Login/fluxo ponta a ponta em produção | [PARCIAL] | Não há credencial/ambiente de produção disponível nesta auditoria. |
| Push quando o app está fechado | [PARCIAL] | Não implementado; o fallback é alerta in-app e atualização em tempo real enquanto a tela está aberta. |
| Financeiro e caixa | [PARCIAL] | A conclusão exige lançamento financeiro; ainda falta exercício ponta a ponta com caixa de produção e auditoria específica da movimentação de dinheiro. |
| Histórico de eventos imutável | [PARCIAL] | Há timestamps e documentos de entrega, mas não existe coleção `DeliveryEvent` append-only. |
| Mobile 360/390/430 e teclado | [PARCIAL] | Layout tem breakpoints e alvos de toque; não foi executada varredura visual automatizada nessas três larguras. |
| PWA/offline | [PARCIAL] | Manifest, service worker e fallback foram adicionados; ações Firestore não são enfileiradas offline e devem ser repetidas somente após reconexão. |
| Perfil próprio do motoboy | [OK] | O portal exibe nome, telefone e e-mail ativos; edição continua centralizada na administração. |

## Validações executadas

- `git pull --ff-only` — sem atualizações; RC confirmado em `ea070f7`.
- Navegador local — passou para a home pública em `http://localhost:3001/`; a página mostra o cardápio de desenvolvimento e preços pendentes.
- `/admin/login` — passou visualmente; acesso exige e-mail e senha do Firebase e não expõe credenciais no código.
- `npm run lint` — passou.
- `npm run typecheck` — passou.
- `npm test` — 7 arquivos, 29 testes passaram.
- `npm run test:functions` — 1 arquivo, 7 testes passaram.
- `npm --prefix functions run build` — passou.
- `firebase emulators:exec --only auth,firestore,functions "npm --prefix functions run test:e2e"` — 3 cenários de criação de pedido passaram, incluindo idempotência e rejeição de preço adulterado.
- `npm run test:rules` — 1 arquivo, 13 testes passaram no Firestore Emulator com Java 21.
- `npm run build` — passou; apenas aviso não bloqueante de chunks acima de 500 kB.
- `npm audit --omit=dev --audit-level=high` — encontrou 26 vulnerabilidades (1 crítica, 21 altas, 3 moderadas, 1 baixa); não foi aplicado `npm audit fix --force` por risco de alterações incompatíveis.
- `npm run test:integration` e `npm run test:e2e` — scripts raiz inexistentes; o E2E aplicável das Functions foi executado explicitamente acima.

## Bloqueios antes de vender

1. Cadastrar e conferir o catálogo, preços, adicionais, horários, unidade, pagamentos e regras de delivery oficiais; o seed de desenvolvimento usa preços `0` e o README exige configuração manual.
2. Publicar e observar `createOrder` no Firebase oficial; a proteção já está implementada e validada no emulator, mas ainda não há evidência de deploy, App Check e logs em produção.
3. Configurar uma chave Firebase Web válida, Auth Email/Password + Anonymous, primeiro admin e documentos de produção; `.env.local` não está versionado neste workspace.
4. Escolher e executar o deploy oficial de Hosting, Firestore e Functions; Functions de segunda geração exigem plano de faturamento e revisão de limites/custos.
5. Resolver as vulnerabilidades de dependências, preferencialmente por atualizações compatíveis e nova rodada completa de testes.
6. Executar uma jornada real com cliente, admin e motoboy, incluindo código errado/certo, falha, reatribuição, dinheiro e duas sessões concorrentes.
7. Decidir se a operação exige push quando o portal estiver fechado; se sim, implementar FCM/Web Push antes da venda.

Enquanto esses itens não forem comprovados, o sistema não deve ser anunciado como pronto para venda em produção.
