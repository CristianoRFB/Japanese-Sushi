# Teiko Sushi — pedidos, caixa e financeiro

Sistema de pedidos para o Teiko Sushi, com cardápio de comida japonesa, checkout sem conta, acompanhamento público do pedido e painel administrativo protegido por Firebase Authentication.

## O que existe

- Cardápio de combinados, sushis, sashimis, temakis, pratos quentes e bebidas.
- Preço canônico no servidor usando centavos inteiros.
- Idempotência de checkout por `clientRequestId`.
- Fila de pedidos com atualização de status e auditoria.
- Caixa operacional: abertura, vendas concluídas, sangria, suprimento, fechamento, divergência e histórico.
- Financeiro com faturamento, ticket médio, pagamentos, estornos, descontos e taxas de entrega.
- Integração externa isolada por adapter, sem credenciais ou escrita direta no navegador.

## Rotas principais

- `/` — cardápio
- `/carrinho` e `/checkout` — pedido
- `/pedido/:publicCode` — acompanhamento público
- `/admin/login` — acesso da equipe
- `/admin/pedidos` — operação dos pedidos
- `/admin/caixa` — caixa atual
- `/admin/financeiro` — relatórios financeiros
- `/admin/catalogo` — produtos e preços
- `/admin/configuracoes` — loja, horários e pagamentos

## Caixa e financeiro

O fluxo oficial é `Pedido → pagamento informado → pedido concluído → venda no Caixa → Financeiro`. A venda é gravada uma única vez por pedido. Um cancelamento após a venda gera um estorno auditável. Operações de caixa passam por Cloud Functions autenticadas; Firestore Rules permitem leitura à equipe, mas bloqueiam qualquer escrita direta.

Os valores ficam em centavos inteiros em `shared/cash.ts`. O documento `cashRegisters` representa o turno e `cashMovements` é o livro de movimentações. Não são coletados dados sensíveis de cartão.

## Desenvolvimento

Requisitos: Node 22 e Java 21+.

```powershell
npm ci
npm ci --prefix functions
Copy-Item .env.example .env.local
```

Para o emulador, mantenha `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` e use:

```powershell
$env:SEED_ADMIN_EMAIL="admin-local@exemplo.test"
$env:SEED_ADMIN_PASSWORD="uma-senha-local-forte"
npm run seed:emulator
npm run emulators
```

Em outro terminal, execute `npm run dev`. A aplicação fica em `http://localhost:3000`; o painel em `/admin/login`.

## Qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run test:functions
npm run test:rules
npm run test:functions:integration
npm run build:firebase
```

Antes de produção, confirme os preços, endereço, telefone, horários e o projeto Firebase do Teiko. O seed é bloqueado quando os emuladores não estão ativos.
