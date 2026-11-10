import React from 'react';
import { MapPin, Star, Hotel, ConciergeBell, Utensils, Eye, X } from 'lucide-react';
import * as C from '../../services/hotelCatalog';
import { useHotelWords } from './hotelUi';
import { emptyHotelFilters, matchHotel } from '../../services/hotelPricing';
export { emptyHotelFilters, matchHotel };

export default function HotelFilters({ records, value, onChange }) {
  const { t, L } = useHotelWords();
  const cities = [...new Set(records.map(r => r.city).filter(Boolean))];
  const set = patch => onChange({ ...value, ...patch });
  const active = Object.values(value).some(Boolean);
  const sel = (key, Icon, label, options) => (
    <label key={key}><Icon aria-hidden="true" /><span className="sr-only">{label}</span>
      <select value={value[key]} onChange={e => set({ [key]: e.target.value })} aria-label={label}>
        <option value="">{label}</option>
        {options.map(o => <option key={o.code} value={o.code}>{L(o)}</option>)}
      </select>
    </label>
  );
  return (
    <div className="hx-filters" data-no-translate>
      {sel('city', MapPin, t('كل المدن', 'All cities'), cities.map(c => ({ code: c, ar: c, en: c })))}
      {sel('stars', Star, t('كل التصنيفات', 'All ratings'), [5, 4, 3, 2, 1].map(s => ({ code: String(s), ar: `${s} نجوم`, en: `${s} stars` })))}
      {sel('hotelType', Hotel, t('كل الأنواع', 'All types'), C.HOTEL_TYPES)}
      {sel('facility', ConciergeBell, t('كل المرافق', 'Any facility'), C.ALL_FACILITIES)}
      {sel('mealPlan', Utensils, t('كل أنظمة الوجبات', 'Any meal plan'), C.MEAL_PLANS.map(m => ({ ...m, ar: `${m.code} · ${m.ar}`, en: `${m.code} · ${m.en}` })))}
      {sel('viewType', Eye, t('كل الإطلالات', 'Any view'), C.VIEW_TYPES)}
      {active && <button type="button" className="catalog-edit" onClick={() => onChange(emptyHotelFilters)}><X aria-hidden="true" />{t('مسح الفلاتر', 'Clear filters')}</button>}
    </div>
  );
}
