# Teiko Sushi

Sistema operacional da Teiko Sushi — Santa Fé do Sul/SP — com cardápio administrável, carrinho, checkout, pedidos, acompanhamento, KDS, PDV e reservas.

## Arquitetura

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
- `/admin/catalogo`, `/admin/adicionais` e `/admin/configuracoes` — gestão da unidade.

## Desenvolvimento

Requisitos: Node 22, Java 21+ e npm.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
```

O `.env.local` local aponta para `sushi-cbfd2` e não é versionado. Em outra máquina, preencha as mesmas variáveis de `.env.example` com a configuração Web oficial do projeto. Para emuladores, altere apenas localmente `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` e use `npm run emulators`.

## Console Firebase — passos manuais

No projeto `sushi-cbfd2`:

1. Firebase Console → Authentication → Sign-in method → habilitar **Email/Password** e **Anonymous**.
2. Authentication → Users → adicionar o primeiro usuário administrativo.
3. Copiar o UID desse usuário.
4. Firestore Database → `(default)` → criar `users/{UID}` com `brandId: teiko`, `role: admin`, `active: true`.
5. Firestore Database → `(default)` → preencher `storePublicConfig/main` e o catálogo oficial antes de abrir pedidos.

Não criar banco nomeado adicional. Não ativar Blaze, cartão, Storage ou Functions em produção.

## Qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run test:functions # somente contratos legados locais, se necessário
npm run test:rules
npm run build
```

As Functions mantidas em `functions/` são código legado/local para contratos históricos e não estão configuradas no `firebase.json`, não são importadas pelo frontend e não devem ser publicadas.
