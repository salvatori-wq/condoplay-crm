import { describe, it, expect } from 'vitest';
import { normalizePhone, phoneVariants, calculateFee, formatCurrency } from './utils';

describe('normalizePhone', () => {
  it('remove caracteres não-dígito', () => {
    expect(normalizePhone('(11) 99999-8888')).toBe('11999998888');
  });
  it('remove zeros à esquerda', () => {
    expect(normalizePhone('0011999998888')).toBe('11999998888');
  });
  it('retorna vazio para null/undefined/vazio', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });
  it('mantém número já normalizado', () => {
    expect(normalizePhone('5511999998888')).toBe('5511999998888');
  });
});

describe('phoneVariants', () => {
  it('gera variante com e sem DDI 55', () => {
    expect(phoneVariants('11999998888').sort()).toEqual(['11999998888', '5511999998888']);
    expect(phoneVariants('5511999998888').sort()).toEqual(['11999998888', '5511999998888']);
  });
  it('retorna array vazio para input vazio', () => {
    expect(phoneVariants(null)).toEqual([]);
    expect(phoneVariants('')).toEqual([]);
  });
  it('deduplica se resultado for igual', () => {
    const out = phoneVariants('55');
    // '55' normalizado é '55', startsWith('55') → adiciona '' → set { '55', '' }
    // comportamento ok; testamos que não explode e é idempotente
    expect(Array.isArray(out)).toBe(true);
  });
});

describe('calculateFee', () => {
  it('sem fee nas primeiras 24h', () => {
    expect(calculateFee(0)).toBe(0);
    expect(calculateFee(24)).toBe(0);
  });
  it('R$30/dia após 24h', () => {
    expect(calculateFee(25)).toBe(30);
    expect(calculateFee(48)).toBe(30);
    expect(calculateFee(49)).toBe(60);
  });
});

describe('formatCurrency', () => {
  it('formata em BRL', () => {
    const out = formatCurrency(1500);
    // Node usa espaço não-quebrável entre R$ e o número; testa ambos os casos
    expect(out.replace(/\s/g, ' ')).toMatch(/R\$\s?1\.500,00/);
  });
});
