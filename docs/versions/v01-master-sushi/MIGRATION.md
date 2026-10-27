# Migração Teiko → tenant (estado atual)

Status: **F4 EM IMPLEMENTAÇÃO**. Nenhuma escrita ou migração real foi executada.

## Inspeção segura disponível

```sh
npm run tenant:inspect:emulator
```

Este comando:
- inicia Firestore Emulator;
- lê apenas campos `tenantId`/`brandId` das coleções operacionais conhecidas;
- apresenta somente contagens agregadas;
- **não escreve, não apaga e não conecta produção**;
- falha antes de importar Firebase Admin se não houver emulador.

Resultado em emulador vazio não prova quantidades reais da Teiko.

## Próximos passos bloqueados até implementação/autorizações

1. Criar TenantResolver confiável, memberships e Rules A×B.
2. Construir migrador idempotente com dry-run, preview de diffs e backfill de `tenantId=teiko`.
3. Criar fixtures de dois tenants e testar recursos e Functions cruzadas.
4. Solicitar backup verificável e autorização específica de escrita no projeto `sushi-cbfd2`.
5. Executar migração real apenas depois de checklist de rollback, counts/IDs e janela aprovados.

Preservar `createOrder`, `orderRequests`, Auth UIDs, histórico e todos os IDs existentes. Não transformar Teiko em demo.
