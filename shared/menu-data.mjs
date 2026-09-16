const size = (id, label, priceCents, displayOrder = 1) => ({ id, label, active: true, basePriceCents: priceCents, displayOrder });
const simple = (id, name, description, categoryId, priceCents, displayOrder, sizes = [size('unico', 'Porção', priceCents)]) => ({
  id, name, slug: id, description, active: true, categoryId, productType: 'SIMPLE', displayOrder, sizes, modifierGroupIds: [],
});

export const storePublicConfigSeed = {
  storeName: 'Teiko Sushi',
  instagramHandle: '@teikosushi',
  address: 'Endereço pendente de confirmação',
  city: 'Santa Fé do Sul/SP',
  whatsappEnabled: false,
  orderingEnabled: true,
  pauseMessage: 'No momento, estamos fora do horário de pedidos.',
  enforceHours: true,
  timezone: 'America/Sao_Paulo',
  hours: [
    { day: 0, closed: false, windows: [{ open: '18:00', close: '22:30' }] },
    ...[1, 2, 3, 4].map((day) => ({ day, closed: true, windows: [] })),
    ...[5, 6].map((day) => ({ day, closed: false, windows: [{ open: '18:00', close: '22:30' }] })),
  ],
  holidayDates: [],
  holidayHours: [{ open: '18:00', close: '22:30' }],
  fulfillmentModes: ['PICKUP', 'DELIVERY'],
  paymentMethods: ['PIX', 'CARD', 'CASH'],
  deliveryConfig: { mode: 'FIXED', fixedFeeCents: 500 },
  orderInstructions: 'Escolha seus pratos, informe como deseja receber e confira o pagamento antes de confirmar.',
  deliveryEstimate: 'O tempo de entrega varia conforme a região e a demanda.',
  busyDeliveryEstimate: 'Em horários movimentados, o prazo pode aumentar.',
  holidayHoursNote: 'Confira a disponibilidade nos feriados antes de pedir.',
  gratitudeMessage: 'Obrigado por escolher o Teiko Sushi. Bom apetite! 🍣',
  privacyNotice: 'Seus dados são usados apenas para preparar e entregar este pedido.',
  status: 'ACTIVE',
};

export const menuCatalog = {
  categories: [
    { id: 'combinados', name: 'Combinados', active: true, displayOrder: 1 },
    { id: 'sushis', name: 'Sushis', active: true, displayOrder: 2 },
    { id: 'sashimis', name: 'Sashimis', active: true, displayOrder: 3 },
    { id: 'temakis', name: 'Temakis', active: true, displayOrder: 4 },
    { id: 'quentes', name: 'Pratos quentes', active: true, displayOrder: 5 },
    { id: 'bebidas', name: 'Bebidas', active: true, displayOrder: 6 },
  ],
  products: [
    simple('teiko-combinado-12', 'Combinado Teiko 12 peças', 'Seleção da casa com uramakis, niguiris e hossomakis.', 'combinados', 4290, 1, [size('12pcs', '12 peças', 4290), size('20pcs', '20 peças', 6590, 2)]),
    simple('combinado-salmon-20', 'Combinado Salmão', 'Salmão em diferentes preparos para compartilhar.', 'combinados', 6990, 2, [size('20pcs', '20 peças', 6990), size('30pcs', '30 peças', 9490, 2)]),
    simple('niguiri-salmao', 'Niguiri de salmão', 'Duas unidades de arroz cobertas com salmão fresco.', 'sushis', 1490, 1, [size('2pcs', '2 peças', 1490)]),
    simple('uramaki-philadelphia', 'Uramaki Philadelphia', 'Oito peças com salmão, cream cheese e cebolinha.', 'sushis', 2490, 2),
    simple('hossomaki-salmao', 'Hossomaki de salmão', 'Oito peças de salmão envolto em arroz e nori.', 'sushis', 2290, 3),
    simple('sashimi-salmao', 'Sashimi de salmão', 'Cinco fatias de salmão fresco.', 'sashimis', 2890, 1),
    simple('sashimi-mix', 'Sashimi mix', 'Seleção de salmão e peixe branco.', 'sashimis', 3290, 2),
    simple('temaki-salmao', 'Temaki de salmão', 'Cone de nori com arroz, salmão e cream cheese.', 'temakis', 2990, 1),
    simple('temaki-hot', 'Temaki hot', 'Cone crocante com salmão temperado e cream cheese.', 'temakis', 3190, 2),
    simple('yakisoba-frango', 'Yakisoba de frango', 'Macarrão oriental com frango e legumes ao molho da casa.', 'quentes', 2790, 1),
    simple('hot-roll-salmao', 'Hot roll de salmão', 'Oito peças empanadas com salmão e cream cheese.', 'quentes', 2690, 2),
    simple('guarana-lata', 'Guaraná lata', 'Lata de 350 ml.', 'bebidas', 600, 1),
    simple('agua-sem-gas', 'Água sem gás', 'Garrafa de 500 ml.', 'bebidas', 450, 2),
    simple('cha-gelado', 'Chá gelado', 'Chá gelado da casa.', 'bebidas', 900, 3),
  ],
  groups: [],
  modifiers: [],
};
