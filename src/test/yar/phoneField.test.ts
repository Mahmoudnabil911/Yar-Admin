import { describe, it, expect } from 'vitest';
import { COUNTRIES, findCountry, filterCountries } from '@/yar/accounts/countries';

describe('Country code and flag registry', () => {
  it('places Iraq (+964) as the first and primary priority', () => {
    expect(COUNTRIES[0].iso).toBe('IQ');
    expect(COUNTRIES[0].code).toBe('+964');
  });

  it('places GCC countries immediately after Iraq', () => {
    const gccCodes = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'];
    const firstGcc = COUNTRIES.slice(1, 7).map(c => c.iso);
    expect(firstGcc).toEqual(gccCodes);
  });

  it('places Egypt (+20) as the third priority after GCC', () => {
    expect(COUNTRIES[7].iso).toBe('EG');
    expect(COUNTRIES[7].code).toBe('+20');
  });

  it('includes Palestine (+970) in regional countries', () => {
    const palestine = COUNTRIES.find(c => c.iso === 'PS');
    expect(palestine).toBeDefined();
    expect(palestine?.code).toBe('+970');
  });

  it('MUST NOT include Israel (IL / +972) anywhere in the list', () => {
    const israelByIso = COUNTRIES.find(c => c.iso === 'IL');
    const israelByCode = COUNTRIES.find(c => c.code === '+972');
    const israelByName = COUNTRIES.find(c => c.name.includes('إسرائيل') || c.nameEn.toLowerCase().includes('israel'));

    expect(israelByIso).toBeUndefined();
    expect(israelByCode).toBeUndefined();
    expect(israelByName).toBeUndefined();
  });

  it('finds country correctly by code or ISO, defaulting to Iraq', () => {
    expect(findCountry('+966').iso).toBe('SA');
    expect(findCountry('EG').code).toBe('+20');
    expect(findCountry('').iso).toBe('IQ');
    expect(findCountry(null).iso).toBe('IQ');
  });

  it('filters countries by dial code with or without plus sign', () => {
    const byPlus = filterCountries('+964');
    expect(byPlus.map(c => c.iso)).toContain('IQ');

    const withoutPlus = filterCountries('964');
    expect(withoutPlus.map(c => c.iso)).toContain('IQ');

    const egyptByCode = filterCountries('20');
    expect(egyptByCode.map(c => c.iso)).toContain('EG');
  });

  it('filters countries by Arabic and English names', () => {
    const iraqAr = filterCountries('عراق');
    expect(iraqAr.map(c => c.iso)).toContain('IQ');

    const saudiAr = filterCountries('سعودية');
    expect(saudiAr.map(c => c.iso)).toContain('SA');

    const egyptEn = filterCountries('egypt');
    expect(egyptEn.map(c => c.iso)).toContain('EG');
  });

  it('filters countries by ISO code', () => {
    const jordan = filterCountries('JO');
    expect(jordan.map(c => c.iso)).toContain('JO');
  });

  it('never returns Israel when searching', () => {
    expect(filterCountries('israel')).toHaveLength(0);
    expect(filterCountries('إسرائيل')).toHaveLength(0);
    expect(filterCountries('972')).toHaveLength(0);
    expect(filterCountries('+972')).toHaveLength(0);
    expect(filterCountries('IL')).toHaveLength(0);
  });
});

