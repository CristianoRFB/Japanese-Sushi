# Ações necessárias do proprietário

Estas ações são gates externos e não indicam falha dos testes locais.

| Prioridade | Ação | Motivo / impacto | Como desbloquear | Próxima prova |
|---|---|---|---|---|
| P0 | Fornecer/validar catálogo e regras comerciais oficiais da Teiko | Sem preços, produtos, horários, taxas e pagamentos oficiais, não é possível abrir pedidos reais nem declarar a oferta da Teiko homologada. | Entregar arquivo revisado pelo responsável da unidade com nome/descrição, variantes/adicionais, preço em centavos, horários/fuso, formas de pagamento e regras de delivery/retirada/reserva. | Import dry-run, revisão de diferenças e aprovação antes de qualquer escrita real. |
| P0 | Aprovar explicitamente eventual migração e escrita no Firebase de produção | A Teiko deve permanecer intacta; dry-run local não autoriza backfill. | Após script idempotente, backup demonstrável e plano de rollback, autorizar por escrito o projeto `sushi-cbfd2`, escopo e janela. | Backup verificado, counts/checksums e smoke pós-migração. |
| P0 | Aprovar deploy público quando houver release candidata | O goal proíbe publicação sem autorização específica; testes locais não provam produção. | Aprovar o alvo exato do Cloudflare Worker/conta e o backend Firebase, após revisão de custos e pré-flight. | Deploy, verificação de DNS/Workers/Functions/Rules e smoke autorizado. |
| P0 | Aprovar custos/alteração de plano Firebase se necessários | Functions Gen 2 e operações remotas podem exigir billing. | Confirmar orçamento/limites e autorizar a mudança no projeto antes de habilitar billing ou API paga. | Checagem de billing, quotas, alertas e custo projetado. |
| P1 | Disponibilizar uma origem HTTPS autorizada e VAPID para validar Web Push | Código/mock não prova push de navegador ou app fechado. | Configurar origem Firebase/VAPID e apontar valores públicos/segredos no ambiente apropriado, sem enviá-los em chat. | Registro, revogação, background/closed app e recebimento em Chrome/Android/Safari iOS suportado. |
| P1 | Organizar UAT com operador, cozinha, motoboy e cliente de teste | Fluxo de campo exige pessoas e dispositivos autorizados. | Definir participantes e janela; não enviar senhas, usar contas de teste com autorização. | Registro sanitizado de ambiente, dispositivo, resultado e aceite/defeitos. |
| P1 | Informar contato e política operacional para suporte/incident response | Não há canal/horário/SLO aprovado para operação comercial. | Definir responsável, canal, horário, escalação e expectativa de atendimento. | Runbook publicado com owners e limites explícitos. |

Nenhuma senha ou credencial administrativa foi solicitada nem armazenada nesta lista.
