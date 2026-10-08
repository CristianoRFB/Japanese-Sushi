# Teiko Sushi

Sistema operacional da Teiko Sushi — Santa Fé do Sul/SP — com cardápio administrável, carrinho, checkout, pedidos, acompanhamento, KDS, PDV, reservas, promoções, caixa de turno e fluxo de delivery com portal individual de motoboy.

## Arquitetura

- React 19, TypeScript, Vinext/Vite e Tailwind.
- Frontend executado como Worker Cloudflare; `npm run build` gera `dist/server/wrangler.json` e `npm run deploy:frontend` publica o release.
- Firebase dedicado `sushi-cbfd2`, usando Authentication, Firestore `(default)` e Cloud Functions na região `southamerica-east1`.
- Firebase Web SDK inicializado como singleton em `lib/firebase/client.ts`.
- Cliente anônimo para pedidos e reservas; Email/Password para a equipe.
- Regras deny-by-default: o cliente só lê seus próprios pedidos/reservas e não altera status.
- O checkout exibe uma prévia, mas a Function `createOrder` recalcula catálogo, promoções e preço antes de gravar o pedido.
- Firebase Storage, Cloud Run, gateway de pagamento, Maps e WhatsApp Business API não são usados.
- `brandId: teiko` permanece apenas como campo de domínio; o isolamento físico é o projeto dedicado.

## Rotas

- `/` — unidade, disponibilidade e cardápio.
- `/montar/:productId` — configuração do item.
- `/carrinho` e `/checkout` — revisão e criação do pedido.
- `/pedido/:publicCode` — acompanhamento do próprio pedido em tempo real.
- `/reserva` — solicitação persistente de reserva.
- `/admin/login` — acesso da equipe.
- `/admin`, `/admin/pedidos`, `/admin/kds`, `/admin/pdv` — operação de pedidos.
- `/admin/entregas`, `/admin/entregadores` — despacho, acompanhamento e gestão de acessos individuais.
- `/entregador/login`, `/entregador`, `/entregador/entrega/:id` — portal mobile do motoboy, etapas da corrida, navegação e confirmação.
- `/admin/caixa` — fundo inicial, vendas por meio, suprimentos, sangrias, fechamento e conferência do turno.
- `/admin/ajuda` — guias rápidos da operação.
- `/admin/reservas` — confirmar, recusar e concluir reservas.
- `/admin/catalogo`, `/admin/adicionais`, `/admin/promocoes`, `/admin/financas` e `/admin/configuracoes` — gestão da unidade.
- `/admin/integracao` — preparação segura para integrações futuras, desativada por padrão.

O início também oferece busca pelo código ou número do pedido e recupera os últimos códigos salvos no cache individual do navegador.

## Caixa e delivery

- O Caixa registra valores em centavos, permite somente um turno aberto, impede sangria acima do saldo físico e usa identificadores idempotentes para evitar duplicação após falha de conexão. Pix e cartão entram nas vendas e em Finanças, sem aumentar o dinheiro esperado na gaveta.
- A cozinha marca o pedido como pronto; a Central de entregas atribui um motoboy disponível. O motoboy aceita/recusa, confirma retirada, inicia a rota, marca chegada e envia o código de quatro dígitos do cliente.
- O código secreto é armazenado como hash e nunca fica disponível ao motoboy. A equipe confirma o código e o pagamento antes de concluir o pedido e liberar a corrida; a conclusão atualiza pedido, caixa (quando dinheiro) e Finanças numa única transação Firestore.
- A Function `createOrder` é a única porta de entrada para pedidos comerciais e impede preço adulterado pelo navegador. As regras do Firestore restringem a leitura e as transições, e a conferência final é feita pela equipe dentro do painel. Não há rastreamento GPS em segundo plano nem notificações push quando o app está fechado.

O fluxo de produção usa somente o Firebase dedicado `sushi-cbfd2`, Firestore `(default)`, Authentication e Functions. Não conecte Rules/deploy ao projeto da Açaíteria. Functions de segunda geração exigem um projeto Firebase com faturamento habilitado; confirme esse custo antes do go-live.

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
6. Habilitar o plano necessário para Cloud Functions e publicar o backend com `npm run deploy:backend` após conferir o projeto Firebase selecionado.
7. Autenticar o Wrangler na conta Cloudflare correta e publicar o frontend com `npm run deploy:frontend`; o preflight bloqueia projeto errado, emulador ou seed de desenvolvimento.

Não criar banco nomeado adicional. Não ativar Storage ou Cloud Run. Se Functions forem publicadas, revisar faturamento, App Check e limites antes de abrir pedidos.

## Qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run test:functions # somente contratos legados locais, se necessário
npm run test:rules
npm run build
npm --prefix functions run build
npx firebase emulators:exec --config firebase.e2e.json --project sushi-cbfd2 --only auth,firestore,functions "npm --prefix functions run test:e2e"
npm run preflight:production
```

As Functions em `functions/` fazem parte do fluxo de pedidos. O `firebase.e2e.json` usa portas isoladas (Auth 9199, Firestore 8280 e Functions 5101) para não interromper outros emuladores locais; o teste cobre persistência, idempotência e rejeição de preço adulterado. Antes do go-live, publique o bundle compilado e repita o teste contra o projeto oficial.

O deploy do frontend é separado do Firebase: use a conta Cloudflare da unidade, confira o nome do Worker gerado (`teiko-sushi`) e configure as variáveis públicas Firebase no ambiente de build. O dry-run local deve ser executado antes da publicação.
