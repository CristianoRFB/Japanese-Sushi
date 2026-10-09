# Master execution status — Sushi v01

Atualizado em 2026-10-09. Estado deste arquivo separado em código local, testes locais, staging, campo e produção.

## Identificação

| Campo | Valor |
|---|---|
| Repositório | `Japanese-Sushi` |
| Baseline definido | `b250fcb57e7e555ff925aa2365ecb34b42639205` |
| HEAD inicial verificado | `b250fcb57e7e555ff925aa2365ecb34b42639205` |
| Branch inicial | `main` |
| Delta após baseline | Nenhum |
| Branch local de execução | `feat/sushi-master-multitenant` |
| Working tree de código após baseline | Limpo antes do início; instalações em `node_modules` são ignoradas pelo Git |
| Ambiente local | Node 22.23.3, npm 11.6.4, Java 21.0.12 |
| Firebase de produção configurado | `sushi-cbfd2`; nenhum acesso/escrita de produção usado nesta execução |
| Último checkpoint concluído | F1 — baseline reproduzido |
| Último SHA concluído | `b250fcb57e7e555ff925aa2365ecb34b42639205` |

## Estado das fases

| Fase | Estado | Evidência / próximo gate |
|---|---|---|
| F1 — Preservar e consolidar o sistema atual | PASS | Instalações limpas Node 22; lint, typecheck, 29 testes app, 7 Functions, 16 Rules, 3 E2E, build e build Functions aprovados. Nenhum delta de código após o baseline. |
| F2 — Operação, push e PWA | NOT_STARTED | Preservar delivery; implementar push opt-in e outbox testável, aguardando validação de VAPID/origem/dispositivos. |
| F3 — Segurança e dependências | NOT_STARTED | Reauditar advisories e handlers, aplicar correções compatíveis e documentar risco residual. |
| F4 — Multi-tenant white-label | NOT_STARTED | Resolver/memberships/Rules/Functions Tenant A×B, Platform Owner seguro, Beta de teste e migração dry-run. Gate estrutural antes do comercial. |
| F5 — Planos e entitlements | NOT_STARTED | Implementar catálogo Sushi e enforcement depois que F4 passar; sem billing automático. |
| F6 — Firebase/Cloudflare, staging, backup e CI/CD | NOT_STARTED | Guardrails e restore local; staging remoto e deploy dependem de aprovação e acesso. |
| F7 — Cadastro Teiko e homologação | NOT_STARTED | Pipeline/checklist podem avançar; dados oficiais e aceite de campo dependem do proprietário e participantes. |
| F8 — Go-live, docs e evidências | IN_PROGRESS | Esta trilha retomável está criada. Pacote técnico, diagramas, screenshots reais, verificadores e runbooks ainda precisam ser completados. |

## Evidência F1

Comandos executados no baseline, sob Node 22.23.3 e Java 21:

- `npm ci --no-audit --no-fund` — raiz, concluído.
- `npm ci --no-audit --no-fund` — `functions/`, concluído.
- `npm run ci` — lint, typecheck, `npm test` (7 arquivos / 29 testes) e build passaram.
- `npm run test:functions` — 1 arquivo / 7 testes passaram.
- `npm --prefix functions run build` — passou.
- `npm run test:rules` — 1 arquivo / 16 testes passou no Firestore Emulator.
- `npm run test:e2e` — 1 arquivo / 3 testes passaram com Auth, Firestore e Functions Emulator.
- `npm run test:integration` — script não existe; não foi substituído por uma alegação de teste de integração amplo.
- Build emite avisos de chunk cliente >500 kB e imports dinâmicos ineficazes; não falha. A parcela cliente indicada foi 574.56 kB (170.29 kB gzip), a revisar após mudança estrutural.

Uma tentativa inicial de `npm ci` raiz no Node 24 falhou ao tentar remover `lightningcss` enquanto o servidor local antigo o mantinha aberto. O processo identificado era `vinext dev --port 3001`, do próprio repositório; ele foi encerrado, as instalações foram repetidas com Node 22 e concluíram sem erro. Nenhum arquivo rastreado foi descartado.

## Preservar / adaptar

| Módulo | Tratamento |
|---|---|
| `createOrder`, cálculo autoritativo, `orderRequests` e checkout/PDV | PRESERVAR; adaptar tenant no servidor e na idempotência |
| KDS, pedidos, status/histórico e acompanhamento do cliente | PRESERVAR; escopar por tenant |
| Delivery, códigos, Rules, concorrência, eventos, caixa e finanças | PRESERVAR invariantes; escopar documentos e membership |
| Reservas, catálogo, unidades, mesas, horários e promoções | PRESERVAR domínio Sushi; remover IDs fixos como fronteira de segurança |
| Auth atual e UIDs Teiko | PRESERVAR; adicionar memberships sem promoção automática de role |
| Rotas, sessão e caches | ADAPTAR ao resolver e isolamento; manter aliases históricos Teiko |
| Demo/Beta, Platform Owner, tenant model e catálogo comercial | ADICIONAR como dados sintéticos e controles seguros; nunca gravar em Teiko real |

## Gate final

| Marco | Estado atual | Condição de verdade |
|---|---|---|
| `FEATURE_COMPLETE` | FALSE | Requisitos comerciais e diferenciais Premium/push ainda não estão implementados/homologados. |
| `STAGING_READY` | FALSE | Só existe teste local/emulador; não há staging remoto validado. |
| `PRODUCTION_READY` | FALSE | Catálogo oficial, custos, credenciais, migração/backups, segurança residual e UAT ainda não comprovados. |
| `LIVE` | FALSE | Nenhuma publicação real foi feita ou autorizada por este goal. |

## Ações do proprietário

Lista operacional em [NEEDS_USER_ACTION.md](NEEDS_USER_ACTION.md). A execução local continua sem esses itens.
