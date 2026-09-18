const brandId = 'teiko';
const unitId = 'santa-fe-do-sul';

const singleSize = (priceCents, label = 'Unidade') => [{ id: 'unico', label, active: true, basePriceCents: priceCents, displayOrder: 1 }];
const simple = (id, name, description, categoryId, priceCents, displayOrder, imageUrl) => ({
  id, brandId, name, slug: id, description, active: true, categoryId, productType: 'SIMPLE',
  displayOrder, sizes: singleSize(priceCents), modifierGroupIds: [], unitIds: [unitId], ...(imageUrl ? { imageUrl } : {}),
});
const modifier = (id, name, priceCents, displayOrder) => ({ id, brandId, name, active: true, available: true, priceCents, premium: false, maxQuantity: 1, allergenKeys: [], displayOrder });

// Dados somente de desenvolvimento. O cardápio oficial deve ser cadastrado no painel.
export const storePublicConfigSeed = {
  brandId,
  storeName: 'Teiko Sushi',
  city: 'Santa Fé do Sul/SP',
  defaultUnitId: unitId,
  units: [{ id: unitId, brandId, name: 'Teiko Sushi', city: 'Santa Fé do Sul/SP', address: 'Rua 23, 624 - Centro', whatsappEnabled: false, active: true, delivery: true, pickup: true }],
  instagramHandle: '',
  address: 'Rua 23, 624 - Centro',
  whatsappEnabled: false,
  orderingEnabled: true,
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
  status: 'ACTIVE',
};

export const menuCatalog = {
  categories: [
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
};
