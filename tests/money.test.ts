import { describe, expect, it } from 'vitest';
import { brlToCents } from '../shared/money';

describe('entrada BRL sem arredondamento inesperado', () => {
  it('converte reais, centavos e aceita vírgula sem floats', () => {
    expect(brlToCents('19,90')).toBe(1990);
    expect(brlToCents('0,01')).toBe(1);
    expect(brlToCents('100')).toBe(10000);
    expect(brlToCents('12.3')).toBe(1230);
  });
  it('rejeita valor fracionado inválido, negativo, zero e grande', () => {
    for (const v of ['0', '0,00', '-1', '12,345', '1.000,00', 'abc', '1e6', '100001']) {
      expect(brlToCents(v)).toBeNull();
    }
  });
});
