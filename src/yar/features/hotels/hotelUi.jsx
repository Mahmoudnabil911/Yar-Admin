import React, { useMemo, useState } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';
import { usePrefs } from '../../i18n/prefs';
import { FALLBACK_ICON, CATEGORY_ICONS } from './hotelIcons';

export function useHotelWords() {
  const { lang } = usePrefs();
  const en = lang === 'en';
  return { lang, t: (ar, enText) => (en ? enText : ar), L: option => (option ? (en ? option.en || option.labelEn || option.ar : option.ar || option.labelAr || option.en) : '') };
}

export const money = (value, currency = 'IQD', lang = 'ar') => value == null || value === '' ? '—'
  : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'USD' ? 2 : 0 }).format(Number(value))} ${currency === 'USD' ? 'USD' : lang === 'en' ? 'IQD' : 'د.ع'}`;

export function Field({ label, wide, hint, req, children }) {
  return (
    <label className={`editor-field hx-field${wide ? ' wide-field' : ''}`}>
      <span className="hx-label">{label}{req && <span className="required-mark">*</span>}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export const TextIn = ({ value, onChange, ...rest }) => <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest} />;
export const AreaIn = ({ value, onChange, ...rest }) => <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest} />;
export const NumIn = ({ value, onChange, ...rest }) => (
  <input type="number" inputMode="decimal" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} {...rest} />
);
export const DateIn = ({ value, onChange, ...rest }) => <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest} />;

export function SelectIn({ value, onChange, options, placeholder, ...rest }) {
  const { L, t } = useHotelWords();
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest}>
      <option value="">{placeholder || t('اختر…', 'Select…')}</option>
      {options.map(o => <option key={o.code} value={o.code}>{L(o)}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="hx-toggle">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="hx-toggle-track" aria-hidden="true" />
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

/** Single-choice chips with an icon for every option. */
export function ChoiceChips({ options, icons = {}, value, onChange, label }) {
  const { L } = useHotelWords();
  return (
    <div className="hx-chips" role="group" aria-label={label}>
      {options.map(o => {
        const Icon = icons[o.code] || FALLBACK_ICON;
        const on = value === o.code;
        return (
          <button type="button" key={o.code} className={`hx-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? '' : o.code)}>
            <Icon aria-hidden="true" />{L(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Categorized, searchable multi-select with icons (hotel facilities or room amenities). */
export function AmenityPicker({ categories, icons, selected, onToggle, extra = [] }) {
  const { t, L } = useHotelWords();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => categories.map(cat => ({
    ...cat,
    items: [...cat.items, ...extra.filter(x => x.category === cat.code)].filter(i => !q || `${i.ar} ${i.en} ${i.labelAr || ''} ${i.labelEn || ''}`.toLowerCase().includes(q)),
  })).filter(cat => cat.items.length), [categories, extra, q]);
  return (
    <div className="hx-amenities">
      <label className="hx-search">
        <Search aria-hidden="true" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('ابحث عن مرفق…', 'Search amenities…')} />
      </label>
      {groups.map(cat => {
        const CatIcon = CATEGORY_ICONS[cat.code] || FALLBACK_ICON;
        const count = cat.items.filter(i => selected.has(i.code)).length;
        return (
          <details className="hx-amenity-group" key={cat.code} open={!!q || count > 0 || undefined}>
            <summary><CatIcon aria-hidden="true" /><strong>{L(cat)}</strong>{count > 0 && <span className="hx-count">{count}</span>}<ChevronDown className="hx-caret" aria-hidden="true" /></summary>
            <div className="hx-amenity-grid">
              {cat.items.map(item => {
                const Icon = icons[item.code] || FALLBACK_ICON;
                const on = selected.has(item.code);
                return (
                  <button type="button" key={item.code} className={`hx-amenity${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onToggle(item)}>
                    <Icon aria-hidden="true" /><span>{item.labelAr ? L({ ar: item.labelAr, en: item.labelEn }) : L(item)}</span>{on && <Check className="hx-tick" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </details>
        );
      })}
      {!groups.length && <p className="field-hint">{t('لا توجد نتائج مطابقة.', 'No matching amenities.')}</p>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, text, children }) {
  return (
    <div className="hx-section-title">
      {Icon && <span className="hx-section-icon"><Icon aria-hidden="true" /></span>}
      <div><h2>{title}</h2>{text && <p>{text}</p>}</div>
      {children && <div className="hx-section-actions">{children}</div>}
    </div>
  );
}
