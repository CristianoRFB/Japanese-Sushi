# Sessão final no PC — roteiro reprodutível

> Este roteiro não significa que o SaaS já esteja homologado. A produção da Teiko permanece intacta.

## Preparação

Ambiente: Node 22, Java 21, npm, Firebase CLI incluído em devDependencies.

```sh
npm ci
npm ci --prefix functions
npm --prefix functions run build
npm run lint
npm run typecheck
npm test
npm run test:sw
npm run test:functions
npm run test:rules
npm run test:e2e
npm run build
```

## Tenants A/B sintéticos

Execute `npm run seed:tenants:emulator` para gerar e exportar exclusivamente fixtures locais (sem dados da Teiko).
Depois inicie `npm run emulators` em um terminal e `npm run dev` em outro (com `.env.local` configurado para `sushi-cbfd2` e `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`).

Contas de teste exclusivamente locais: `platform-fixture@example.test`, `owner-a@example.test`, `owner-b@example.test`.
Senha sintética: `EMULATOR_ONLY_Never_Use_in_Production_2026!` (não é segredo real, não reutilizar).

- [ ] Abrir `/plataforma`: login Platform Owner e presença de Tenant A e B.
- [ ] Abrir `/loja/tenant-a` e `/loja/tenant-b`: catálogos fictícios distintos e branding distinto.
- [ ] Abrir `/loja/tenant-a/gestao`: owner-a consegue criar categoria e produto simples.
- [ ] Repetir owner-a em `/loja/tenant-b/gestao`: deve ser negado.
- [ ] Suspender tenant-a no painel de plataforma: as operações autenticadas desse tenant devem ser negadas.
- [ ] Reativar tenant-a; revogar membership e confirmar negativa.
- [ ] Executar novamente `npm run test:rules` e `npm run test:e2e`.

## Navegadores e responsividade

- [ ] Chrome desktop: 320, 375, 768 e 1440 px; verificar menus, formulários, labels e mensagens de erro.
- [ ] Edge desktop: teste equivalente; Firefox como navegador de regressão.
- [ ] Android Chrome com HTTPS de staging autorizado; iOS Safari quando disponível.
- [ ] Testar notificações somente com opt-in e VAPID de staging legitimamente configurado.
- [ ] Em rede offline, conferir fallback PWA sem cache de pedidos, dados privados ou páginas admin.

## Teiko operacional (staging, depois de aprovação)

- [ ] Catálogo oficial, pedidos/preços, KDS, PDV, caixa, finanças, reservas, delivery e motoboy com contas autorizadas.
- [ ] Códigos errados, concorrência, reatribuição, estorno manual, revogação e perda de conexão.
- [ ] Backup/export verificado, restore ensaiado, dry-run de migração, rollback, autorização escrita para operações reais.
- [ ] PRODUCTION_READY e LIVE continuam false até evidência de staging/produção e aceite humano.

STOP: projeto errado, credencial real em arquivo, acesso cruzado A/B, pedido com preço adulterado, falha de Rules, custos não aprovados ou tentativa de escrita real.
