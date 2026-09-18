<<<<<<< HEAD
const brandId = 'teiko';
const unitId = 'santa-fe-do-sul';

const singleSize = (priceCents, label = 'Unidade') => [{ id: 'unico', label, active: true, basePriceCents: priceCents, displayOrder: 1 }];
const simple = (id, name, description, categoryId, priceCents, displayOrder, imageUrl) => ({
  id, brandId, name, slug: id, description, active: true, categoryId, productType: 'SIMPLE',
  displayOrder, sizes: singleSize(priceCents), modifierGroupIds: [], unitIds: [unitId], ...(imageUrl ? { imageUrl } : {}),
=======
const size = (id, label, priceCents, displayOrder = 1) => ({ id, label, active: true, basePriceCents: priceCents, displayOrder });
const simple = (id, name, description, categoryId, priceCents, displayOrder, sizes = [size('unico', 'Porção', priceCents)]) => ({
  id, name, slug: id, description, active: true, categoryId, productType: 'SIMPLE', displayOrder, sizes, modifierGroupIds: [],
>>>>>>> origin/main
});
const modifier = (id, name, priceCents, displayOrder) => ({ id, brandId, name, active: true, available: true, priceCents, premium: false, maxQuantity: 1, allergenKeys: [], displayOrder });

// Dados somente de desenvolvimento. O cardápio oficial deve ser cadastrado no painel.
export const storePublicConfigSeed = {
<<<<<<< HEAD
  brandId,
  storeName: 'Teiko Sushi',
=======
  storeName: 'Teiko Sushi',
  instagramHandle: '@teikosushi',
  address: 'Endereço pendente de confirmação',
>>>>>>> origin/main
  city: 'Santa Fé do Sul/SP',
  defaultUnitId: unitId,
  units: [{ id: unitId, brandId, name: 'Teiko Sushi', city: 'Santa Fé do Sul/SP', address: 'Rua 23, 624 - Centro', whatsappEnabled: false, active: true, delivery: true, pickup: true }],
  instagramHandle: '',
  address: 'Rua 23, 624 - Centro',
  whatsappEnabled: false,
  orderingEnabled: true,
<<<<<<< HEAD
  pauseMessage: 'Pedidos temporariamente pausados pela loja.',
  enforceHours: true,
  timezone: 'America/Sao_Paulo',
  hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: day === 0, windows: day === 0 ? [] : [{ open: '19:00', close: '23:00' }] })),
  holidayDates: [],
  holidayHours: [],
  holidayHoursNote: 'Segunda a sábado, das 19h às 23h. Domingos fechados.',
  fulfillmentModes: ['PICKUP', 'DELIVERY'],
  paymentMethods: ['PIX', 'CARD', 'CASH'],
  deliveryConfig: { mode: 'CONFIRM' },
  orderInstructions: 'Buffet por kg ou à vontade. Escolha sua experiência e confirme os detalhes do atendimento com a unidade.',
  deliveryEstimate: 'Prazo a confirmar pela unidade.',
  busyDeliveryEstimate: 'Prazo a confirmar pela unidade.',
  gratitudeMessage: 'Obrigado por escolher a Teiko Sushi.',
  privacyNotice: 'Seus dados são usados somente para atender este pedido ou reserva.',
=======
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
>>>>>>> origin/main
  status: 'ACTIVE',
};

export const menuCatalog = {
  categories: [
<<<<<<< HEAD
    { id: 'sushi', brandId, name: 'Sushi', active: true, displayOrder: 1 },
    { id: 'sashimi', brandId, name: 'Sashimi', active: true, displayOrder: 2 },
    { id: 'temaki', brandId, name: 'Temaki', active: true, displayOrder: 3 },
    { id: 'combinados', brandId, name: 'Combinados', active: true, displayOrder: 4 },
    { id: 'bebidas', brandId, name: 'Bebidas', active: true, displayOrder: 5 },
  ],
  products: [
    simple('sushi-salmao', 'Sushi de salmão', 'Unidade de sushi de salmão.', 'sushi', 0, 1, '/menu/sushi-salmao.png'),
    simple('sushi-atum', 'Sushi de atum', 'Unidade de sushi de atum.', 'sushi', 0, 2, '/menu/sushi-atum.png'),
    simple('sashimi-salmao', 'Sashimi de salmão', 'Cortes de salmão preparados na hora.', 'sashimi', 0, 1, '/menu/sashimi-salmao.png'),
    simple('temaki-salmao', 'Temaki de salmão', 'Temaki de salmão. Consulte a unidade para disponibilidade e preço.', 'temaki', 0, 1, '/menu/temaki-salmao.png'),
    simple('combinado-teiko', 'Combinado Teiko', 'Seleção da casa. Composição e preço definidos pela unidade.', 'combinados', 0, 1, '/menu/combinado-teiko.png'),
    simple('agua', 'Água', 'Bebida.', 'bebidas', 0, 1, '/menu/agua.png'),
  ],
  groups: [
    { id: 'extras', brandId, name: 'Observações', description: 'Opções adicionais serão cadastradas pela unidade.', active: false, required: false, minSelections: 0, maxSelections: 1, allowDuplicate: false, displayOrder: 1, pricingMode: 'individual', modifierIds: ['shoyu'] },
  ],
  modifiers: [modifier('shoyu', 'Shoyu', 0, 1)],
=======
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
>>>>>>> origin/main
};
