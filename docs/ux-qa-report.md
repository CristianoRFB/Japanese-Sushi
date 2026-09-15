# Teiko Sushi — relatório de personalização e QA

Data: 15/09/2026

## Direção aplicada

- Identidade “Noite Teiko”: ameixa profunda como base, marfim nas superfícies, vinho para ações, vermelho-cereja para destaque, dourado para orientação e lima somente para ação/estado positivo.
- Tokens de cor persistentes em `app/globals.css`, aplicados também ao Admin, Login, checkout, reserva, montagem e acompanhamento.
- Logo oficial recebido incorporado em `public/brand/teiko-logo.jpg`.
- Fotos individuais para os seis itens do catálogo de desenvolvimento em `public/menu/`, com composição fotográfica consistente.
- Imagem de atmosfera culinária local em `public/brand/teiko-sushi-atmosphere.png`; ela não representa um produto específico do catálogo.
- Cabeçalho consistente entre cliente, login e administração.
- Home orientada à tarefa: CTA para cardápio, reserva, busca e categorias visíveis.
- Foco de teclado global, estados `focus-visible` e respeito a `prefers-reduced-motion`.

## Fluxos auditados

Cliente: home → cardápio/busca → montagem de produto → carrinho → checkout; reserva; consulta de pedido.

Pedidos: Cliente envia → pedido entra como `NEW` → Admin recebe badge/alerta → aceita (`CONFIRMED`), recusa (`CANCELLED`) ou propõe edição → Cliente recebe a proposta na consulta → aceita a nova composição ou recusa e encerra o pedido.

Admin: login → dashboard → pedidos → PDV → KDS → reservas → catálogo → adicionais → configurações.

Estados verificados: vazio, carregando, erro/indisponibilidade de preço, sucesso de autenticação, operação online e rota inexistente (`404`).

## Dois ciclos de QA

### Ciclo 1 — achados e correções

- Logo genérico na navegação: substituído pelo logo oficial.
- Cardápio sem busca rápida: adicionadas busca e categorias horizontais, com estado sem resultado.
- Produtos de desenvolvimento exibidos como `R$ 0,00`: agora mostram “Preço a confirmar”.
- Montagem, carrinho e checkout podiam sugerir continuidade sem preço oficial: bloqueio explícito e mensagem orientativa.
- Catálogo admin não diferenciava preço pendente: chips e status atualizados.
- Botões que renderizam links não declaravam a semântica nativa: corrigido em todos os links equivalentes do carrinho.
- Ausência de foto individual no cardápio: adicionadas imagens locais por produto e `alt` acessível.
- Pedido mínimo/antigo sem adicionais quebrava o detalhe admin: visualização agora trata adicionais ausentes e preços incompletos com segurança.

### Ciclo 2 — revalidação

- Busca por “temaki” filtrou corretamente o cardápio.
- Produto sem preço oficial exibiu “Preço a confirmar” e botão indisponível.
- Formulário de reserva apresentou campos nomeados e ação clara.
- Dashboard, pedidos, KDS, reservas, catálogo e configurações admin carregaram.
- Smoke test: 16 rotas válidas retornaram `200`; rota inexistente retornou `404`.
- Regras Firestore: 4 testes passaram, incluindo proposta de edição, aprovação do dono e bloqueio de outro usuário.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 3 arquivos e 11 testes passaram.
- `npm run build`: passou.
- `git diff --check`: passou; apenas avisos de conversão de fim de linha do Git.

### Ciclo 3 — reservas e entradas adversas

- Formulário limitado ao intervalo de 01/01 a 31/12 de 2026, com validação de calendário real; 31/02 e anos fora do limite são rejeitados.
- Caixa de erro substituiu mensagens brutas do Firebase por resumo, lista de correções e destaque acessível por campo.
- Testados nome sem letras, WhatsApp inválido, horário vazio/inválido, lotação acima de 30, espaços extras e observação com caracteres especiais.
- Observações com texto comum foram persistidas no emulador e mantêm validação amigável.
- Fila administrativa de reservas também filtra registros fora do calendário 2026 e apresenta datas no formato brasileiro.
- Regras Firestore passaram a rejeitar anos fora de 2026, datas impossíveis do calendário e observações acima de 500 caracteres.
- Suíte geral passou a 14 testes; suíte de Rules passou a 5 testes.

### Ciclo 4 — código da reserva e consistência visual

- Código da reserva recebeu tratamento de informação crítica, com destaque visual, botão de cópia e confirmação “Código copiado”.
- Dados da última reserva ficam salvos em `localStorage` por UID anônimo do cliente, sem compartilhar o cache entre clientes do mesmo navegador.
- Após recarregar a tela, o cliente recupera código, data, horário e quantidade de pessoas no cartão “Salvo neste dispositivo”.
- Cores residuais do Admin e estados semânticos foram consolidados na paleta Teiko: ameixa/ink, vinho, berry, cereja, dourado, lima, marfim, blush e muted.
- Rotas de cliente, reserva, pedidos, checkout e Administração foram revalidadas após a consolidação visual.

### Ciclo 5 — dados oficiais da unidade

- Endereço público atualizado para `Rua 23, 624 - Centro`, em Santa Fé do Sul/SP.
- Serviço comunicado ao cliente: `Buffet por kg ou à vontade`.
- Horário configurado como segunda a sábado, das 19h às 23h, com domingo fechado.
- Home, Informações e Configurações do admin revalidadas após a sincronização do emulador local.

### Ciclo 6 — promoções

- Admin ganhou a área Promoções para cadastrar nome, descrição, desconto percentual ou fixo, período, produtos participantes e status.
- Promoções ativas aparecem no cardápio público e recebem aplicação automática no cálculo do carrinho quando há preço oficial.
- Regras e backend mantêm a promoção vinculada à marca Teiko e impedem leitura pública de ofertas pausadas.
- Suíte de domínio cobre desconto percentual, elegibilidade por produto e período ativo.

## Limites preservados

- Firebase oficial permanece `sushi-cbfd2`, Firestore `(default)`.
- Nenhum runtime, Rules ou deploy foi conectado ao Firebase da Açaí.
- Não foram habilitados Blaze, Functions em produção, Cloud Run ou Storage.
- O seed local usa apenas os dados oficiais fornecidos nesta etapa para endereço e horário; preços e integrações reais continuam aguardando a próxima passada de configuração do Firebase.

## Referências de UX consultadas

- [Banha restaurant ordering case study](https://www.tisham.com/en/case-studies/banha-restaurant)
- [Recio’s restaurant ordering case study](https://www.beatrice-designs.com/recios)
- [Awoof restaurant case study](https://www.buildwithjj.studio/work/awoof)
- [Pizza Hut mobile-first ordering case study](https://www.monterail.com/projects/food-delivery-mobile-first-app-for-pizza-hut)
- [Restaurant and café accessibility checklist](https://mvga-prod-files.s3.ap-southeast-4.amazonaws.com/public/2024-06/restaurants-cafes-accessibility-checklist.pdf)

## Veredito

A personalização e os fluxos principais estão prontos para a próxima passada de configuração do Firebase oficial. O sistema ainda não deve ser tratado como produção até receber catálogo/preços completos e até validar as integrações reais de pagamento e entrega.
