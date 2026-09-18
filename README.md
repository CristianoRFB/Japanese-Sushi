<<<<<<< HEAD
# Teiko Sushi

Sistema operacional da Teiko Sushi — Santa Fé do Sul/SP — com cardápio administrável, carrinho, checkout, pedidos, acompanhamento, KDS, PDV, reservas, promoções e caixa financeiro.
=======
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
>>>>>>> origin/main

## Rotas principais

<<<<<<< HEAD
- React 19, TypeScript, Vinext/Vite e Tailwind.
- Firebase dedicado `sushi-cbfd2`, usando somente Authentication e Firestore `(default)`.
- Firebase Web SDK inicializado como singleton em `lib/firebase/client.ts`.
- Cliente anônimo para pedidos e reservas; Email/Password para a equipe.
- Regras deny-by-default: o cliente só lê seus próprios pedidos/reservas e não altera status.
- Preços no checkout são uma prévia do cliente; a equipe confirma o valor antes do preparo.
- Firebase Storage, Functions em produção, Cloud Run, gateway de pagamento, Maps e WhatsApp Business API não são usados.
- `brandId: teiko` permanece apenas como campo de domínio; o isolamento físico é o projeto dedicado.

## Rotas

- `/` — unidade, disponibilidade e cardápio.
- `/montar/:productId` — configuração do item.
- `/carrinho` e `/checkout` — revisão e criação do pedido.
- `/pedido/:publicCode` — acompanhamento do próprio pedido em tempo real.
- `/reserva` — solicitação persistente de reserva.
- `/admin/login` — acesso da equipe.
- `/admin`, `/admin/pedidos`, `/admin/kds`, `/admin/pdv` — operação de pedidos.
- `/admin/reservas` — confirmar, recusar e concluir reservas.
- `/admin/catalogo`, `/admin/adicionais`, `/admin/promocoes`, `/admin/financas` e `/admin/configuracoes` — gestão da unidade.
- `/admin/integracao` — preparação segura para integrações futuras, desativada por padrão.

O início também oferece busca pelo código ou número do pedido e recupera os últimos códigos salvos no cache individual do navegador.

## Desenvolvimento
=======
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
>>>>>>> origin/main

Os valores ficam em centavos inteiros em `shared/cash.ts`. O documento `cashRegisters` representa o turno e `cashMovements` é o livro de movimentações. Não são coletados dados sensíveis de cartão.

## Desenvolvimento

Requisitos: Node 22 e Java 21+.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
```

<<<<<<< HEAD
O `.env.local` local aponta para `sushi-cbfd2` e não é versionado. Em outra máquina, preencha as mesmas variáveis de `.env.example` com a configuração Web oficial do projeto. Para emuladores, altere apenas localmente `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` e use `npm run emulators`.

## Console Firebase — passos manuais

No projeto `sushi-cbfd2`:
=======
Para o emulador, mantenha `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` e use:
>>>>>>> origin/main

1. Firebase Console → Authentication → Sign-in method → habilitar **Email/Password** e **Anonymous**.
2. Authentication → Users → adicionar o primeiro usuário administrativo.
3. Copiar o UID desse usuário.
4. Firestore Database → `(default)` → criar `users/{UID}` com `brandId: teiko`, `role: admin`, `active: true`.
5. Firestore Database → `(default)` → preencher `storePublicConfig/main` e o catálogo oficial antes de abrir pedidos.

<<<<<<< HEAD
Não criar banco nomeado adicional. Não ativar Blaze, cartão, Storage ou Functions em produção.
=======
Em outro terminal, execute `npm run dev`. A aplicação fica em `http://localhost:3000`; o painel em `/admin/login`.
>>>>>>> origin/main

## Qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run test:functions # somente contratos legados locais, se necessário
npm run test:rules
npm run build
```

<<<<<<< HEAD
As Functions mantidas em `functions/` são código legado/local para contratos históricos e não estão configuradas no `firebase.json`, não são importadas pelo frontend e não devem ser publicadas.
=======
Antes de produção, confirme os preços, endereço, telefone, horários e o projeto Firebase do Teiko. O seed é bloqueado quando os emuladores não estão ativos.
>>>>>>> origin/main
