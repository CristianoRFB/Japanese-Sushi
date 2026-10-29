# F4 — tamanhos e white-label por tenant

**Estado:** implementado para novo namespace em branch, E2E em emulador; **não homologado em produção**.

## Catálogo

- Fonte: `functions/src/tenant-catalog.ts`.
- `tenantUpsertVariantProduct` cadastra tamanhos ativos/inativos com preços individuais em centavos.
- Cada item possui `productType=VARIANT` e `sizes=[{id,label,active,basePriceCents,displayOrder}]`.
- A API de produtos simples impede sobrescrita acidental de variantes e vice-versa.
- `functions/src/tenant-order-policy.ts` recalcula o pedido no servidor; tamanhos omitidos em produtos multi-size são rejeitados.
- `shared/tenant-cart.ts` separa as variantes da mesma mercadoria na chave do carrinho; cache não armazena nome ou telefone.
- UI: `/loja/[slug]` e `/loja/[slug]/gestao`.
- **Fora do escopo atual:** adicionais/modificadores e preço de delivery; não inferir feature completa.

## White-label

- Fonte: `functions/src/tenant-branding.ts`.
- `tenantUpdateBranding` exige tenant owner ativo, revalida os documentos de tenant e membership dentro da transação.
- Aceita somente nome, cores hexadecimais e logo HTTPS ou caminho `/brand/` seguro; não permite editar plano, status ou faturamento.
- `resolvePublicTenant` retorna apenas o conjunto público de branding.
- UI `/loja/[slug]/branding`. Teiko legada permanece fora desta escrita.
- Nenhum domínio DNS, bucket ou segredo foi modificado.

## Provas

- [CI SHA 01ba386a0](https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40954806219) — lint, TypeScript, unit, Functions, Rules, E2E e builds aprovados.
- Testes de adulteração, variantes inválidas, preço de servidor, isolamento A/B, negação de role/revogação.
- Capturas reais, UAT e testes em dispositivo aguardam execução autorizada. Nenhum mockup é screenshot.

## Readiness

`F4=IN_PROGRESS`; `F5=NOT_STARTED`; `STAGING_READY=false`; `PRODUCTION_READY=false`; `LIVE=false`.
