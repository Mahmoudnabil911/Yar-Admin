import Flags from 'country-flag-icons/react/3x2';
import type { ComponentType, SVGProps } from 'react';

export interface CountryInfo {
  iso: string;
  code: string;
  name: string;
  nameEn: string;
  placeholder?: string;
  Flag: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Country list sorted by business priority:
 * 1. Iraq (primary market)
 * 2. GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman)
 * 3. Egypt
 * 4. Arab / Levant / North Africa & regional neighbors (Jordan, Palestine, Lebanon, Syria, Yemen, Turkey, Iran, Libya, Tunisia, Algeria, Morocco, Sudan)
 * 5. Other international markets
 *
 * NOTE: Israel (IL / +972) is strictly omitted.
 */
export const COUNTRIES: CountryInfo[] = [
  // 1. Iraq (First Priority)
  { iso: 'IQ', code: '+964', name: 'العراق', nameEn: 'Iraq', placeholder: '0783 140 0500', Flag: Flags.IQ },

  // 2. GCC Countries (Second Priority)
  { iso: 'SA', code: '+966', name: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', placeholder: '050 123 4567', Flag: Flags.SA },
  { iso: 'AE', code: '+971', name: 'الإمارات العربية المتحدة', nameEn: 'UAE', placeholder: '050 123 4567', Flag: Flags.AE },
  { iso: 'KW', code: '+965', name: 'الكويت', nameEn: 'Kuwait', placeholder: '5123 4567', Flag: Flags.KW },
  { iso: 'QA', code: '+974', name: 'قطر', nameEn: 'Qatar', placeholder: '3312 3456', Flag: Flags.QA },
  { iso: 'BH', code: '+973', name: 'البحرين', nameEn: 'Bahrain', placeholder: '3612 3456', Flag: Flags.BH },
  { iso: 'OM', code: '+968', name: 'سلطنة عمان', nameEn: 'Oman', placeholder: '9123 4567', Flag: Flags.OM },

  // 3. Egypt (Third Priority)
  { iso: 'EG', code: '+20', name: 'مصر', nameEn: 'Egypt', placeholder: '010 1234 5678', Flag: Flags.EG },

  // 4. Arab & Regional Countries
  { iso: 'JO', code: '+962', name: 'الأردن', nameEn: 'Jordan', placeholder: '07 9123 4567', Flag: Flags.JO },
  { iso: 'PS', code: '+970', name: 'فلسطين', nameEn: 'Palestine', placeholder: '059 123 4567', Flag: Flags.PS },
  { iso: 'LB', code: '+961', name: 'لبنان', nameEn: 'Lebanon', placeholder: '03 123 456', Flag: Flags.LB },
  { iso: 'SY', code: '+963', name: 'سوريا', nameEn: 'Syria', placeholder: '093 123 4567', Flag: Flags.SY },
  { iso: 'YE', code: '+967', name: 'اليمن', nameEn: 'Yemen', placeholder: '771 234 567', Flag: Flags.YE },
  { iso: 'TR', code: '+90', name: 'تركيا', nameEn: 'Turkey', placeholder: '532 123 4567', Flag: Flags.TR },
  { iso: 'IR', code: '+98', name: 'إيران', nameEn: 'Iran', placeholder: '0912 123 4567', Flag: Flags.IR },
  { iso: 'LY', code: '+218', name: 'ليبيا', nameEn: 'Libya', placeholder: '091 123 4567', Flag: Flags.LY },
  { iso: 'TN', code: '+216', name: 'تونس', nameEn: 'Tunisia', placeholder: '20 123 456', Flag: Flags.TN },
  { iso: 'DZ', code: '+213', name: 'الجزائر', nameEn: 'Algeria', placeholder: '0551 23 45 67', Flag: Flags.DZ },
  { iso: 'MA', code: '+212', name: 'المغرب', nameEn: 'Morocco', placeholder: '0661 23 45 67', Flag: Flags.MA },
  { iso: 'SD', code: '+249', name: 'السودان', nameEn: 'Sudan', placeholder: '091 234 5678', Flag: Flags.SD },

  // 5. Popular International Destinations
  { iso: 'GB', code: '+44', name: 'المملكة المتحدة', nameEn: 'United Kingdom', placeholder: '07123 456789', Flag: Flags.GB },
  { iso: 'US', code: '+1', name: 'الولايات المتحدة', nameEn: 'United States', placeholder: '(555) 123-4567', Flag: Flags.US },
  { iso: 'CA', code: '+1', name: 'كندا', nameEn: 'Canada', placeholder: '(555) 123-4567', Flag: Flags.CA },
  { iso: 'DE', code: '+49', name: 'ألمانيا', nameEn: 'Germany', placeholder: '0151 12345678', Flag: Flags.DE },
  { iso: 'FR', code: '+33', name: 'فرنسا', nameEn: 'France', placeholder: '06 12 34 56 78', Flag: Flags.FR },
  { iso: 'SE', code: '+46', name: 'السويد', nameEn: 'Sweden', placeholder: '070 123 45 67', Flag: Flags.SE },
  { iso: 'NL', code: '+31', name: 'هولندا', nameEn: 'Netherlands', placeholder: '06 12345678', Flag: Flags.NL },
  { iso: 'MY', code: '+60', name: 'ماليزيا', nameEn: 'Malaysia', placeholder: '012-345 6789', Flag: Flags.MY },
  { iso: 'IN', code: '+91', name: 'الهند', nameEn: 'India', placeholder: '98123 45678', Flag: Flags.IN },
  { iso: 'PK', code: '+92', name: 'باكستان', nameEn: 'Pakistan', placeholder: '0300 1234567', Flag: Flags.PK },
  { iso: 'CN', code: '+86', name: 'الصين', nameEn: 'China', placeholder: '138 1234 5678', Flag: Flags.CN },
  { iso: 'RU', code: '+7', name: 'روسيا', nameEn: 'Russia', placeholder: '912 345-67-89', Flag: Flags.RU },
  { iso: 'AU', code: '+61', name: 'أستراليا', nameEn: 'Australia', placeholder: '0412 345 678', Flag: Flags.AU },
];

export function findCountry(query?: string | null): CountryInfo {
  if (!query) return COUNTRIES[0];
  const cleaned = query.trim().toUpperCase();
  return (
    COUNTRIES.find(c => c.iso === cleaned || c.code === query.trim()) ||
    COUNTRIES[0]
  );
}

export function filterCountries(query?: string | null): CountryInfo[] {
  if (!query) return COUNTRIES;
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const cleanedQ = q.replace(/^\+/, '');
  return COUNTRIES.filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.code.replace('+', '').includes(cleanedQ) ||
      c.iso.toLowerCase().includes(q)
    );
  });
}

