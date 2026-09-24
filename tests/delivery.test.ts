import { describe, expect, it } from 'vitest';

import { canTransitionDelivery, isDeliveryCode, isValidHumanName, maskDeliveryCode, validateDeliveryAddress, validateDeliveryFailureReason, validateDriverDraft } from '../shared/delivery';

describe('entregas Teiko', () => {
  it('aceita apenas os quatro números do código e não revela o valor inteiro na máscara', () => {
    expect(isDeliveryCode('0042')).toBe(true);
    for (const value of ['', '42', '12345', '12 4', '12a4', '１２３４', '😀123']) expect(isDeliveryCode(value)).toBe(false);
    expect(maskDeliveryCode('0042')).toBe('00••');
    expect(maskDeliveryCode('123')).toBe('••••');
  });

  it('bloqueia saltos de estado e finalização direta pelo motoboy', () => {
    expect(canTransitionDelivery('ASSIGNED', 'ACCEPTED')).toBe(true);
    expect(canTransitionDelivery('ACCEPTED', 'PICKED_UP')).toBe(true);
    expect(canTransitionDelivery('ARRIVED', 'DELIVERED')).toBe(false);
    expect(canTransitionDelivery('CANCELLED', 'ASSIGNED')).toBe(false);
  });

  it('valida endereço realista e rejeita campos vazios, enormes, emoji e controles', () => {
    expect(validateDeliveryAddress({ street: 'Rua 23', number: '624', neighborhood: 'Centro', complement: 'Casa 2', reference: 'Ao lado da praça' })).toEqual({});
    expect(validateDeliveryAddress({ street: '😀😀😀', number: '', neighborhood: '!', complement: '', reference: '' })).toMatchObject({ street: expect.any(String), number: expect.any(String), neighborhood: expect.any(String) });
    expect(validateDeliveryAddress({ street: 'Rua\n23', number: '1', neighborhood: 'Centro' }).street).toBeTruthy();
    expect(validateDeliveryAddress({ street: `Rua ${'A'.repeat(130)}`, number: '1', neighborhood: 'Centro' }).street).toBeTruthy();
  });

  it('rejeita motoboy com nome emoji e credenciais/dados fora do limite', () => {
    const good = { name: 'João da Silva', phone: '(17) 99999-2222', email: 'joao@example.com', password: 'SenhaForte!23' };
    expect(validateDriverDraft(good)).toEqual({});
    expect(validateDriverDraft({ ...good, name: '🚲 João' }).name).toBeTruthy();
    expect(validateDriverDraft({ ...good, phone: '123' }).phone).toBeTruthy();
    expect(validateDriverDraft({ ...good, email: 'x@' }).email).toBeTruthy();
    expect(validateDriverDraft({ ...good, password: 'x' }).password).toBeTruthy();
    expect(isValidHumanName('João da Silva')).toBe(true);
    expect(isValidHumanName('😀 João')).toBe(false);
    expect(isValidHumanName('A'.repeat(81))).toBe(false);
  });

  it('exige motivo de falha útil e limita caracteres de controle', () => {
    expect(validateDeliveryFailureReason('Cliente ausente')).toBe(true);
    expect(validateDeliveryFailureReason('  ')).toBe(false);
    expect(validateDeliveryFailureReason('x'.repeat(201))).toBe(false);
    expect(validateDeliveryFailureReason('ab\u0000cd')).toBe(false);
  });
});
