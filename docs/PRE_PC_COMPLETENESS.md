# PRE-PC COMPLETENESS — Japanese-Sushi

Último SHA de código avaliado: `95f4ac2c6dc6379356ad8b0536943a8691404961`.

Evidência reproduzível: [GitHub Actions](https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40545368745), **SUCCESS** em lint, typecheck, unitários, Functions, Rules, E2E, fixtures A×B, migração somente em emulator e build.

## Fonte de verdade

- Repositório e branch `feat/sushi-master-multitenant`; Teiko original em `main` não modificada.
- Código + Rules + testes têm precedência sobre metas, READMEs antigos e visuais.
- Não foi executado deploy real, backup de produção, migração de clientes, navegador real ou UAT.

## Contrato por módulo

| Módulo / capacidade | Estado de CÓDIGO | Arquivos / evidência |
|---|---|---|
| Platform Owner verificado por Auth + controle revogável | CODE_COMPLETE | `functions/src/tenant-admin.ts`; E2E Auth Emulator |
| Create/suspend/resume Tenant + audit append-only | CODE_COMPLETE | `functions/src/tenant-admin.ts` |
| Membership por tenant e gestão segura | CODE_COMPLETE | `functions/src/tenant-admin.ts`; E2E A×B |
| Console do proprietário da plataforma | CODE_PRESENT_PC_VALIDATION_PENDING | `app/plataforma/page.tsx`; compile/build |
| Resolver público por slug sem expor configuração privada | CODE_COMPLETE | `functions/src/resolve-tenant.ts`; E2E |
| Rules novas em `tenants/{id}/...`, sem acesso cruzado A×B | CODE_COMPLETE para namespace novo | `firestore.rules`; `tests/firestore.rules.test.ts` |
| Storefront público tenant-scoped, somente leitura | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/page.tsx`; Rules + build |
| Categoria/produto simples com centavos e transação de membership | CODE_COMPLETE para simples | `functions/src/tenant-catalog.ts`; E2E |
| Gestão de catálogo da nova loja | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/gestao/page.tsx` |
| Cache de carrinho preparado para tenant | PARTIAL | `components/providers.tsx`; ainda fixo em Teiko |
| Duas fixtures Auth/Firestore e verificadores automatizados | CODE_COMPLETE | `functions/scripts/seed-tenant-emulator.mjs`, `verify-tenant-emulator.mjs`; CI |
| Cópia idempotente Teiko somente em emulador | CODE_COMPLETE para ensaio | `functions/scripts/migrate-teiko-emulator.mjs`; CI |
| Teiko original: pedidos, caixa, delivery, PDV, KDS, reservas | PRESERVED_LEGACY_CODE | Ver `README.md`, testes legados e CI; NÃO tenantizados |
| Resolver e autenticação integrados em TODAS as rotas legadas | MISSING | Teiko ainda depende de `brandId=teiko` |
| Functions `createOrder`, caixa, delivery e Finance A×B | MISSING | Não expor múltiplos tenants aos fluxos legados |
| Migração real autorizável, backup/rollback, cutover | MISSING + EXTERNAL_GATE | Nenhuma escrita real autorizada |
| White-label completo, domínio, SEO, mídia e Storage | PARTIAL | Branding público limitado, sem custom domain |
| Web Push real em device fechado | CODE_PRESENT_EXTERNAL_GATE | FCM/opt-in e testes emulator; VAPID/HTTPS/device real faltam |
| Global Standard v01: planos/entitlements/limites/demo | NOT_STARTED | CORE_FIRST continua obrigatório |
| Docs globais diagramas SVG/screen real/visuais/leads | MISSING/PARTIAL | Não apresentar concepts como screenshots |
| Staging, homologação Teiko e go-live | EXTERNAL_GATE | Proprietário precisa autorizar e fornecer dados |

**Percentual global 95%: NÃO ATINGIDO / NÃO DECLARADO.** Esta matriz contém tanto contratos completos quanto infraestrutura parcial; contagem ingênua de linhas não equivale a readiness nem pode transformar itens MISSING em DEFERRED.

## Próximos bloqueios implementáveis (não exigem PC)

1. Tenant-aware end-to-end de pedido, KDS/PDV, delivery, finanças e reserva; preservar invariantes atuais.
2. Conversão da Teiko legada sem quebra de Auth, IDs ou links, com migrador production-safe separado e proteção de rollback (sem executar).
3. Domain resolver e branding completos para todos os tenants; regras de cache/storage.
4. Após F4 passar: PlanCatalog/EntitlementService/Sushi approved matrix, backend gating, DemoMode.
5. Telas restantes, docs manifests, diagramas fonte/render e QA automatizável.

## Exclusivamente fora do alcance desta sessão

- Dados e preços oficiais da Teiko, custo/credenciais de Firebase e Cloudflare, autorização de migração/deploy, dispositivos reais e aceitação humana.
- Nenhum percentual de produção, staging ou UAT é inferido a partir de CI.

Retomada no PC: [PC_FINAL_TEST_SESSION.md](PC_FINAL_TEST_SESSION.md).
