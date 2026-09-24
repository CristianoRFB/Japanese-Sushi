import { describe, expect, it } from 'vitest';

import { formatDateKey, parseBRLToCents, parseOptionalBRLToCents } from '../shared/finance';

describe('caixa da Teiko', () => {
  it('converte valores brasileiros em centavos sem floats', () => {
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456);
    expect(parseBRLToCents('39,90')).toBe(3990);
    expect(parseBRLToCents('0')).toBe(0);
    expect(parseBRLToCents('texto')).toBe(0);
    expect(parseBRLToCents('-10,00')).toBe(0);
    expect(parseBRLToCents('1e3')).toBe(0);
    expect(parseBRLToCents('12,345')).toBe(0);
    expect(parseBRLToCents('R$ 100.000,00')).toBe(10000000);
    expect(parseBRLToCents('100000,01')).toBe(10000001);
  });

  it('valida valor de troco com limite, centavos e formatos brasileiros', () => {
    expect(parseOptionalBRLToCents('R$ 1.234,56', 10000000)).toBe(123456);
    expect(parseOptionalBRLToCents('0,00', 10000000)).toBe(0);
    for (const value of ['-1,00', '+5', '1e3', '12,345', '😀', '100000,01']) {
      expect(parseOptionalBRLToCents(value, 10000000)).toBeNull();
    }
  });

  it('formata a data do lançamento para leitura', () => {
    expect(formatDateKey('2026-09-17')).toBe('17/09/2026');
    expect(formatDateKey('')).toBe('');
  });
});
