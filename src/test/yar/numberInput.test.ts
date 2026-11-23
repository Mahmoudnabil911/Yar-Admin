import { describe, it, expect } from 'vitest';
import { formatNumberWithCommas, unformatNumber } from '@/yar/components/ui/NumberInput';

describe('NumberInput & formatNumberWithCommas (فرزة الأرقام والآلاف)', () => {
  it('formats thousands correctly with commas', () => {
    expect(formatNumberWithCommas(1000)).toBe('1,000');
    expect(formatNumberWithCommas('1000')).toBe('1,000');
    expect(formatNumberWithCommas(11111111)).toBe('11,111,111');
    expect(formatNumberWithCommas('11111111')).toBe('11,111,111');
    expect(formatNumberWithCommas(500)).toBe('500');
    expect(formatNumberWithCommas(0)).toBe('0');
  });

  it('formats decimals with commas while keeping decimal digits', () => {
    expect(formatNumberWithCommas('1000.5')).toBe('1,000.5');
    expect(formatNumberWithCommas('1000.50')).toBe('1,000.50');
    expect(formatNumberWithCommas('1234567.89')).toBe('1,234,567.89');
  });

  it('handles empty and null values gracefully', () => {
    expect(formatNumberWithCommas('')).toBe('');
    expect(formatNumberWithCommas(null)).toBe('');
    expect(formatNumberWithCommas(undefined)).toBe('');
  });

  it('unformats numbers with commas back to clean raw numeric strings', () => {
    expect(unformatNumber('1,000')).toBe('1000');
    expect(unformatNumber('11,111,111')).toBe('11111111');
    expect(unformatNumber('1,000.5')).toBe('1000.5');
    expect(unformatNumber('')).toBe('');
  });

  it('respects allowDecimals=false for integer-only fields', () => {
    expect(formatNumberWithCommas('1000.5', false)).toBe('1,000');
    expect(formatNumberWithCommas('11111111', false)).toBe('11,111,111');
  });
});

