# SECURITY AUDIT — evidence and remaining blockers

STATUS: IN_PROGRESS / NO_GO para release.

## Antes das correções
- Runtime frontend: 7 advisories (1 alta, 5 moderadas, 1 baixa).
- Runtime Functions: 10 advisories (2 altas, 8 moderadas).
- Evidência: https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40513881876

## Correções compatíveis verificadas
- zod <4.6.6 foi atualizado para ^4.6.7 em ambos os projetos.
- body-parser <2.4.0 recebeu override 2.4.0 nas Functions.
- Workflow sem --force recompôs lockfiles, reinstalou, auditou runtime para high/critical e passou lint, typecheck, unit, Rules, E2E e builds.
- Commit de patch: https://github.com/CristianoRFB/Japanese-Sushi/commit/18264b915a6a87cb67129b4166ba4678c6ecdb24
- Workflow: https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40514874611

## Auditoria após correção, validada em CI

- Frontend runtime: 6 apontamentos (0 críticas, 0 altas, 5 moderadas, 1 baixo).
- Functions runtime: 8 apontamentos (0 críticas, 0 altas, 8 moderadas).
- Fonte: https://github.com/CristianoRFB/Japanese-Sushi/actions/runs/40516004475
- A triagem das moderadas continua obrigatória. Teste local/CI verde não é aprovação de release.

## Pendências
- Revisão de moderadas/baixas e transitivas do ambiente de build.
- App Check, autorização/isolamento A×B, monitoramento, testes de browser/dispositivos e staging.
- Nenhuma conclusão de segurança de produção é autorizada por CI/emulador isoladamente.
