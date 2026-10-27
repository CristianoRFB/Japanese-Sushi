# Master execution status — Sushi v01

Atualizado em 2026-10-27. Estado deste arquivo separado em código local, testes locais, staging, campo e produção.

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
| Último checkpoint concluído | F2/F3 e preparação F4 — evidências verificadas em CI, nenhuma prova de produção |
| Último SHA concluído | `95f4ac2c6dc6379356ad8b0536943a8691404961` (testes completos no CI; documentação posterior pode avançar) |

## Estado das fases

| Fase | Estado | Evidência / próximo gate |
|---|---|---|
| F1 — Preservar e consolidar o sistema atual | PASS | Instalações limpas Node 22; lint, typecheck, 29 testes app, 7 Functions, 16 Rules, 3 E2E, build e build Functions aprovados. Nenhum delta de código após o baseline. |
| F2 — Operação, push e PWA | IN_PROGRESS | FCM opt-in/revogação, Functions e testes em Emulator; push real em dispositivos e VAPID/HTTPS seguem pendentes. |
| F3 — Segurança e dependências | IN_PROGRESS | Reservas por callable autenticada, regras negando escrita pública, pacote Zod/Body-parser atualizado sem force; triagem moderados pendente. |
| F4 — Multi-tenant white-label | IN_PROGRESS | Tenant/Membership types, cache de carrinho escopado e inventário somente Emulator. Resolver, regras A×B, Platform Owner e migração real NÃO implementados. |
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

## Evidência F2a — hardening PWA de 2026-10-27

- Commit de código: [`cf22ff6`](https://github.com/CristianoRFB/Japanese-Sushi/commit/cf22ff6d0e5c0c3815008e9d74e2fcc222c6e9be).
- `public/sw.js`: mantém apenas assets públicos estáticos no cache offline; não armazena HTML dinâmico, pedidos, APIs ou páginas administrativas.
- `tests/sw-cache-policy.test.cjs`: 6 cenários Node para fallback seguro, isolamento de cache e rotas privadas.
- `package.json`: script `npm run test:sw`.
- `.github/workflows/ci.yml`: integração do novo teste no CI.
- [GitHub Actions deste commit](https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40507816850): **SUCCESS** — lint, typecheck, testes gerais, `test:sw`, Functions, Firestore Rules e build passaram.
- Verificação local do patch antes do commit: `node --test tests/sw-cache-policy.test.cjs` **6/6 PASS**.
- Não houve teste hospedado de navegador/dispositivo, deploy Cloudflare/Firebase ou escrita em dados de produção nesta entrega.
- F2 não está concluída: Web Push/FCM com permissão explícita, notificações em background, compatibilidade real e UAT seguem pendentes.

## Evidências adicionais — 27/10/2026

- F2: Web Push opt-in, revogação, tokens com autenticação no servidor e payload sem dados pessoais. Tests de Rules e E2E via emulador. Dispositivo real e VAPID ainda não homologados.
- Reservas: validação do calendário além de 2026; agora criadas por callable autenticada, idempotente e com ownership. Rules bloqueiam criação direta. E2E valida horário e retry.
- F4: shared/tenancy.ts, tests/tenancy.test.ts, chave de carrinho Teiko preparada para tenant e script de inspeção read-only para Firestore Emulator. NÃO comprova isolamento A×B.
- F4 adicional: callable resolvePublicTenant aceita slug validado, retorna apenas branding/status públicos, conserva fallback legado Teiko e foi testada com Beta fictício e tenant suspenso no emulador. Aplicação e Rules continuam single-tenant; a função isolada NÃO implementa Core A×B.
- CI agora inclui lint, TypeScript, unitários, service worker, Functions, Firestore Rules, E2E e build.
- Dependências: Zod ^4.6.7 no frontend/Functions e body-parser 2.4.0 nas Functions após remediação sem --force e validação completa. CI final: 0 high/critical, com 14 achados moderados/baixos somados entre os dois runtimes (não deduplicados).
- Evidência: https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40514874611 (SUCCESS), commit de dependências 18264b915a6a87cb67129b4166ba4678c6ecdb24.
- Nenhuma alteração em Firebase real, Cloudflare live, dados reais ou contas de faturamento.
- F4 continua FAIL até tenant resolver, memberships, regras/Functions tenant-aware e testes A×B. F5 continua NEXT.
- Gate: FEATURE_COMPLETE=false, STAGING_READY=false, PRODUCTION_READY=false, LIVE=false.

## Checkpoint F4 incremental — 27/10/2026

- Backend de plataforma: `functions/src/tenant-admin.ts` controla Tenant CRUD, suspensão, memberships e auditoria; token `platform_owner` checado também no Auth atual.
- UI `app/plataforma/page.tsx` para gestão de contas já existentes; não cria Platform Owner nem autenticação falsa.
- Rules protegendo `tenants/{tenantId}/...`, membership e auditoria. E2E A×B e consultas públicas Firestore testadas. **Rules legadas da Teiko não estão tenantizadas.**
- `app/loja/[slug]` mostra catálogo público do tenant ativo; `app/loja/[slug]/gestao` oferece CRUD de categorias e produtos simples via Functions. Checkout Beta continua expressamente desativado.
- Fixture sintética e emulador: `npm run test:tenant:fixture`. Cópia idempotente de dados Teiko apenas sintéticos em emulador: `npm run test:migration:emulator`.
- CI com todos os checks verdes: https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40545368745.
- Backlog e gates revisados em [PRE_PC_COMPLETENESS.md](../../PRE_PC_COMPLETENESS.md); staging/prod/LIVE continuam FALSE.

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
