# Migração Teiko → tenant

**F4 IN_PROGRESS. Migração REAL nunca executada.**

Há duas ferramentas diferentes:

- `npm run tenant:inspect:emulator`: somente contagens de campos nos dados locais.
- `npm run test:migration:emulator`: seed sintético + dry-run + duas passagens idempotentes no Firestore Emulator.

`functions/scripts/migrate-teiko-emulator.mjs` aceita dry-run sem opção ou `--apply-emulator` exclusivamente com `FIRESTORE_EMULATOR_HOST` local e dados marcados `developmentSeed=true`. A cópia mantém IDs e coleções root originais e inicia `tenants/teiko` como `SUSPENDED`, sem memberships automáticas.

É um ensaio técnico: NÃO migra Teiko real, não faz cutover, não cria Platform Owner e não publica tenant.

**Antes de qualquer migração de produção ainda faltam**: script separado explicitamente autorizado, backup verificável, plano de rollback, tenant-aware Functions, Rules A×B para todos os fluxos reais, inventário de discrepâncias, owner oficial, aprovações de billing/deploy e UAT.
