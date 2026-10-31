# PRE-PC COMPLETENESS — Japanese-Sushi

Último SHA de código validado: `01ba386a0c8de9d7ead92e5e7b9d7db1201a699c`.

Evidência reproduzível: [GitHub Actions](https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40954806219), **SUCCESS** em lint, typecheck, unitários, Functions, Rules, E2E, fixtures A×B, migração somente em emulator e build.

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
| Storefront tenant-scoped, carrinho e checkout de retirada CASH | CODE_PRESENT_CI_TESTED_PC_VALIDATION_PENDING | `app/loja/[slug]/page.tsx`; `shared/tenant-cart.ts`; preço autoritativo em `createTenantPickupOrder`; não habilitado para tenants reais |
| Categoria/produto simples com centavos e transação de membership | CODE_COMPLETE para simples | `functions/src/tenant-catalog.ts`; E2E |
| Gestão de catálogo da nova loja | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/gestao/page.tsx` |
| Produtos de tamanhos variados com preço individual | CODE_PRESENT_CI_TESTED | `functions/src/tenant-catalog.ts`, `tenant-order-policy.ts`; variant sizes, E2E com price tampering e cross-tenant |
| Carrinho/checkout com seleção de tamanhos | CODE_PRESENT_PC_VALIDATION_PENDING | `shared/tenant-cart.ts`, `app/loja/[slug]/page.tsx`; tamanhos diferentes no mesmo carrinho |
| White-label editável por tenant owner | CODE_PRESENT_CI_TESTED_PC_VALIDATION_PENDING | `functions/src/tenant-branding.ts`, `app/loja/[slug]/branding/page.tsx`; URL HTTPS, cores e nome público; Teiko legada protegida |
| Política de preço autoritativo de retirada por tenant | CODE_COMPLETE PARA PICKUP SIMPLES | `functions/src/tenant-order-policy.ts`; unitários e E2E |
| Pedido de retirada tenant-scoped com concorrência/idempotência e leitura somente do dono | CODE_COMPLETE PARA PICKUP SIMPLES | `functions/src/tenant-orders.ts`; E2E Auth/Firestore/Functions, tenant A×B |
| Listagem e transições KDS por tenant com RBAC | CODE_COMPLETE PARA STATUS PREPARATÓRIOS | `functions/src/tenant-orders.ts`; E2E de staff A×B e transição inválida |
| Tela de fila KDS por tenant | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/pedidos/page.tsx`; build, sem QA visual real |
| Caixa por tenant: abertura, fechamento, diferença física e sessões | CODE_PRESENT_EMULATOR_TESTED | `functions/src/tenant-cash.ts`; Owner + logs; E2E em Auth/Firestore Emulator |
| Recebimento manual CASH e ledger atômico por pedido READY | CODE_PRESENT_EMULATOR_TESTED | `tenantSettlePickupCash`; cashMovements + financeEntries + COMPLETED em uma transação, sem dupla contabilização |
| Devolução manual integral em dinheiro por owner, com contrapartida financeira | CODE_PRESENT_CI_PENDING | `functions/src/tenant-refunds.ts`; ledger + cashMovements negativos, saldo e auditoria transacionais, E2E A×B |
| Consulta financeira recente restrita ao owner | CODE_PRESENT_CI_PENDING | `functions/src/tenant-finance-report.ts`, `/loja/[slug]/financeiro`; exatamente últimas 100 entradas, sem PII |
| Teste de troco com liquidez real no caixa | CODE_PRESENT_CI_PENDING | `functions/src/tenant-cash.ts`, E2E novo; rejeita troco maior que fundo disponível |
| Tela de caixa para recebimento presencial | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/caixa/page.tsx`; somente dinheiro; sem comprovante eletrônico |
| Carrinho de nova loja isolado por chave de tenant e sem dados pessoais | CODE_PRESENT_CI_TESTED | `shared/tenant-cart.ts`, `tests/tenant-cart.test.ts`; sanitização e limite de quantidade; Teiko continua legado |
| Checkout de retirada com recibo, status e retry idempotente | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/page.tsx`, `app/loja/[slug]/acompanhar/[orderId]`; E2E de preço no servidor |
| Histórico privado dos pedidos da mesma sessão Auth/tenant | CODE_PRESENT_CI_PENDING | `listMyTenantOrders`, `/loja/[slug]/historico`; E2E de owner A×B |
| Reserva request-only por tenant, idempotência e isolamento de PII | CODE_COMPLETE_EMULATOR | `functions/src/tenant-reservations.ts`; E2E A×B e Rules dedicadas |
| Reservas: console staff, histórico e acompanhamento privado pelo dono | CODE_PRESENT_PC_VALIDATION_PENDING | `app/loja/[slug]/reservas`; `reservas/gestao`; `reservas/[reservationId]`; `reservas/historico` |
| Proteção de entitlement Pro+ para reservas em produção | BLOCKED_BY_F5 | Feature fechada fora dos emuladores; exige PlanCatalog + backend gate e controle real de capacidade |
| Cache de carrinho preparado para tenant | PARTIAL | `components/providers.tsx`; ainda fixo em Teiko |
| Duas fixtures Auth/Firestore e verificadores automatizados | CODE_COMPLETE | `functions/scripts/seed-tenant-emulator.mjs`, `verify-tenant-emulator.mjs`; CI |
| Cópia idempotente Teiko somente em emulador | CODE_COMPLETE para ensaio | `functions/scripts/migrate-teiko-emulator.mjs`; CI |
| Teiko original: pedidos, caixa, delivery, PDV, KDS, reservas | PRESERVED_LEGACY_CODE | Ver `README.md`, testes legados e CI; NÃO tenantizados |
| Resolver e autenticação integrados em TODAS as rotas legadas | MISSING | Teiko ainda depende de `brandId=teiko` |
| Delivery, cartão/PIX, relatórios completos/paginados e checkout completo A×B | MISSING | Caixa com dinheiro presencial existe no novo namespace, mas não equivale a PDV ou financeiro integral |
| Migração real autorizável, backup/rollback, cutover | MISSING + EXTERNAL_GATE | Nenhuma escrita real autorizada |
| White-label completo, domínio, SEO, mídia e Storage | PARTIAL | Editor seguro de nome/cores/logo por tenant implementado; ainda sem domínio personalizado automático, mídia gerenciada e SEO por tenant |
| Web Push real em device fechado | CODE_PRESENT_EXTERNAL_GATE | FCM/opt-in e testes emulator; VAPID/HTTPS/device real faltam |
| Global Standard v01: planos/entitlements/limites/demo | NOT_STARTED | CORE_FIRST continua obrigatório |
| Docs globais diagramas SVG/screen real/visuais/leads | MISSING/PARTIAL | Não apresentar concepts como screenshots |
| Staging, homologação Teiko e go-live | EXTERNAL_GATE | Proprietário precisa autorizar e fornecer dados |

**Percentual global 95%: NÃO ATINGIDO / NÃO DECLARADO.** Esta matriz contém tanto contratos completos quanto infraestrutura parcial; contagem ingênua de linhas não equivale a readiness nem pode transformar itens MISSING em DEFERRED.

## Próximos bloqueios implementáveis (não exigem PC)

1. Continuar com adicionais/modificadores e entrega tenant-aware; manter o pricing autoritativo e preservar os fluxos legados Teiko. Tamanhos e reservas isoladas já existem no Core, mas reservas permanecem bloqueadas fora do emulador até F5.
2. Conversão da Teiko legada sem quebra de Auth, IDs ou links, com migrador production-safe separado e proteção de rollback (sem executar).
3. Domain resolver e branding completos para todos os tenants; regras de cache/storage.
4. Após F4 passar: PlanCatalog/EntitlementService/Sushi approved matrix, backend gating, DemoMode.
5. Telas restantes, docs manifests, diagramas fonte/render e QA automatizável.

## Exclusivamente fora do alcance desta sessão

- Dados e preços oficiais da Teiko, custo/credenciais de Firebase e Cloudflare, autorização de migração/deploy, dispositivos reais e aceitação humana.
- Nenhum percentual de produção, staging ou UAT é inferido a partir de CI.

Retomada no PC: [PC_FINAL_TEST_SESSION.md](PC_FINAL_TEST_SESSION.md).

## Estimativa global de avanço — 29/10/2026

**Estimativa heurística: ~54% do escopo total do GOAL MASTER, com incerteza alta (aprox. ±10 pontos percentuais).**
Não é métrica automatizada, percentual de linhas de código nem declaração de produção pronta.

| Fase | Peso estimado | Avanço estimado |
|---|---:|---:|
| F1 Preservação Teiko | 10% | 95% |
| F2 Operação e PWA/push | 12% | 65% |
| F3 Segurança e dependências | 13% | 72% |
| F4 Core Multi-Tenant | 28% | 83% |
| F5 Global Standard v01 | 14% | 0% |
| F6 Firebase/Cloudflare/staging | 10% | 25% |
| F7 Dados oficiais/UAT Teiko | 7% | 5% |
| F8 Go-live/docs/observabilidade | 6% | 15% |

Resultado ponderado = ~54%. Critérios: somente o código entregue e o CI têm evidência; trabalho externo/credenciais/dados reais/UAT permanecem pendentes.

- Neste checkpoint, carrinho de retirada em novo tenant, recibo e histórico privado foram adicionados.
- Novos tenants só aceitam pedidos quando explicitamente habilitados; fixtures A/B habilitadas só no Emulator.
- O código da Teiko legada NÃO foi convertido para o novo namespace. Billing SaaS não foi implementado.
- Excluir manualmente riscos de pagamento ou reserva do cálculo seria incorreto; fases incompletas contam como tal.

## Reservas Multi-Tenant — checkpoint incremental

- Backend isolado: `tenantCreateReservation`, `tenantGetMyReservation`, `tenantListReservations`, `tenantSetReservationStatus`, `tenantCancelMyReservation`.
- Solicitações idempotentes por `reservationRequests/{clientRequestId}` em `tenants/{tenantId}`; Auth UID e request hash conferidos.
- Permissionamento: leitura privada ao dono ou staff com membership, alterações somente Functions; Rule negative tests para A×B, PII, suspensão.
- Formulário público e acompanhamento do dono apenas em staging/emulador; interface de gestão staff com confirmação manual.
- **Nunca declarar reserva confirmada automaticamente:** não foi implementado inventário real de mesas/capacidade nem duração de ocupação.
- Reservas são Pro+ na matriz aprovada. **F5 ainda NÃO está pronto**, portanto reserva por tenant é ativa somente em Firebase Emulator e fechada em ambientes reais.
- Teiko original (`reservations` root) continua preservada e sem migração real.

Estimativa de progresso global após este incremento: ~49% (incerteza ±10 p.p.), ponderada pelas fases do GOAL MASTER. Não corresponde a release readiness.

## Catálogo com tamanhos e white-label — 29/10/2026

- `tenantUpsertVariantProduct`: criação/edição de tamanhos por owner, validação de preços/IDs e transação com membership; bloqueia conversão destrutiva de produto simples para variante.
- `tenant-order-policy.ts` e `shared/tenant-cart.ts`: preço calculado a partir de variante ativa no catálogo do próprio tenant, total limitado tecnicamente, resistência a tampering e distinção de tamanhos no mesmo carrinho.
- `app/loja/[slug]/gestao` oferece editor de variantes com vários tamanhos; `app/loja/[slug]` permite selecionar e incluir cada tamanho.
- `tenantUpdateBranding`: owner-only, validação de logo HTTPS, cores e nome, com auditoria. `resolvePublicTenant` expõe apenas o branding público. UI em `/loja/[slug]/branding`.
- E2E: variação de tamanho, preço adulterado, tentativas A×B, papel revogado e spoof de `planId`.
- **CI aprovado:** https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40954806219 (SHA `01ba386a0`).
- **Não pronto para produção:** ainda faltam adicionais/modificadores, migração original da Teiko, delivery completo, billing manual/entitlements F5, staging e aceites humanos.
- Estimativa ponderada do GOAL MASTER: **~52% (±10 p.p.)**, sem valor de certificação.

## Financeiro Multi-Tenant: estorno manual e visão recente — 29/10/2026

- `tenantRefundPickupCash`: somente proprietário com membership ativo, senha/sessão Auth válida e tenant ACTIVE; recebe confirmação explícita de dinheiro efetivamente devolvido.
- Estorno **integral** com documento idempotente `cashMovements/REFUND_{orderId}` e contrapartida `financeEntries/REFUND_{orderId}`, valor negativo, ajuste de saldo no caixa e status `REFUNDED` na mesma transação.
- **Nenhuma movimentação bancária ou reembolso de PIX/cartão é executada.** Estorno manual só depois de pagamento presencial CASH comprovado por `SALE_{orderId}`. Não altera dados da Teiko legada.
- Liquidez do caixa agora bloqueia troco cujo valor exceda o saldo disponível (defeito na condição anterior corrigido).
- `tenantGetRecentFinanceSummary`: owner-only; últimas 100 entradas do ledger, vendas, estornos e líquido. **Amostra recente, não balanço completo nem extrato fiscal**.
- Interfaces em `/loja/[slug]/caixa`, `/loja/[slug]/financeiro` e recibo privado atualizados. Tests E2E contemplam duplicate refund, tenant A×B, acesso indevido e troco insuficiente.
- Estado de CI deste incremento deve ser atualizado após conclusão dos Actions do último SHA; navegador real/UAT pendentes. Estimativa geral revisada: ~54% ±10 p.p.; F4 ainda incompleta.
