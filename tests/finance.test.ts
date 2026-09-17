import { describe, expect, it } from 'vitest';

import { formatDateKey, parseBRLToCents } from '../shared/finance';

describe('caixa da Teiko', () => {
  it('converte valores brasileiros em centavos sem floats', () => {
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456);
    expect(parseBRLToCents('39,90')).toBe(3990);
    expect(parseBRLToCents('0')).toBe(0);
    expect(parseBRLToCents('texto')).toBe(0);
  });

  it('formata a data do lançamento para leitura', () => {
    expect(formatDateKey('2026-09-17')).toBe('17/09/2026');
    expect(formatDateKey('')).toBe('');
  });
});
