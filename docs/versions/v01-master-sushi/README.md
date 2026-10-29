# Japanese-Sushi — Master SaaS v01

Esta versão acompanha a execução do goal `CODEX_GOAL_MASTER_SUSHI_100_PERCENT_PRODUCTION_READY.txt` sobre o repositório `Japanese-Sushi`.

## Fonte de verdade

- Código e contratos vigentes: branch de trabalho derivada do `main`.
- Baseline fixado pelo goal: `b250fcb57e7e555ff925aa2365ecb34b42639205`.
- Execução e evidências: [MASTER_EXECUTION_STATUS.md](MASTER_EXECUTION_STATUS.md).
- Dados de produção, configuração, custos e validação de campo só são considerados presentes quando comprovados por evidência própria.

## Fontes consultadas

- Goal Sushi enviado pelo proprietário: preços, limites e requisitos locais.
- Padrões globais disponíveis em `Manicures/docs/ecosystem/`: `SAAS_PROJECT_CORE.md`, `01_GLOBAL_STANDARD_PLANS_ENTITLEMENTS_v01.md`, `03_SHARED_VERTICAL_PATTERNS.md`, `04_IMPLEMENTATION_READINESS_AND_ORDER.md`, `05_CODEX_EXECUTION_BLUEPRINT.md` e `SAAS_PADRAO_DOCS_LEADS_IMAGENS_GERADAS.md`.
- Os documentos globais foram consultados como referência compartilhada; o código e a documentação daquele produto não fazem parte das alterações.
- Não foram encontrados no repositório Sushi os documentos comerciais verticais `DECISIONS_APPROVED.md`, `PRICING_AND_PLANS_APPROVED.md`, `FEATURE_MATRIX_APPROVED.md`, `DELTA_TECNICO.md`, `PRIORIZACAO.md` ou `GLOBAL_CONSOLIDATION_HANDOFF.md`. Os valores explícitos no goal Sushi são a fonte comercial disponível para esta execução.

## Proteção do sistema existente

O fluxo atual de pedidos, preços autoritativos em `createOrder`, KDS, reservas, delivery, confirmação por código, caixa, finanças, regras e histórico é preservado. A conversão adiciona isolamento e identidade de tenant; não substitui histórico Teiko nem atribui dados fictícios a ela.

Não há deploy público, escrita/migração em Firebase real, habilitação de cobrança ou API paga nesta versão sem autorização específica posterior.
