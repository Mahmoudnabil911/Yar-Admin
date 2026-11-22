import React, { useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, findCountry, filterCountries } from './countries';
import { usePrefs } from '../i18n/prefs';

export default function PhoneField({
  label,
  value,
  onChange,
  required = true,
  country = '+964',
  onCountryChange,
  placeholder,
  autoComplete = 'tel',
  lang: propLang,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { lang: prefLang } = usePrefs();
  const activeLang = propLang || prefLang || (typeof document !== 'undefined' ? document.documentElement.lang : 'ar');
  const isEn = activeLang === 'en';

  const current = findCountry(country);
  const CurrentFlag = current.Flag;

  function handleSelect(iso) {
    const selected = COUNTRIES.find((c) => c.iso === iso);
    if (selected && onCountryChange) {
      onCountryChange(selected.code, selected.iso);
    }
  }

  const filteredCountries = filterCountries(search);

  return (
    <label className="account-field">
      {label && <span>{label}</span>}
      <div className="phone-input" dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label={isEn ? "Country Code" : "رمز الدولة"}
              className="w-[110px] h-[44px] px-2.5 flex items-center justify-between border border-input rounded-md bg-background text-foreground shrink-0 hover:bg-accent/40"
              style={{ width: '110px', height: '44px', flexShrink: 0 }}
            >
              <div className="flex items-center gap-1.5 overflow-hidden" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CurrentFlag
                  className="w-5 h-3.5 rounded-xs shrink-0 object-cover shadow-xs"
                  style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover' }}
                />
                <span className="font-mono text-xs font-semibold" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  {current.code}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" style={{ width: '16px', height: '16px', opacity: 0.5 }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[280px] p-0 z-[150] bg-popover text-popover-foreground border border-border shadow-lg rounded-md"
            align="start"
            style={{ width: '280px', padding: 0 }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <Search className="h-4 w-4 shrink-0 opacity-50" style={{ width: '16px', height: '16px', opacity: 0.5 }} />
              <input
                type="search"
                placeholder={isEn ? "Search by country name or code (+964)..." : "ابحث باسم الدولة أو الرمز (+964)..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                style={{ width: '100%', background: 'transparent', fontSize: '12px', outline: 'none' }}
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1" style={{ maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
              {filteredCountries.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground" style={{ padding: '24px 0', textAlign: 'center', fontSize: '12px', opacity: 0.7 }}>
                  {isEn ? "No matching countries found" : "لا توجد نتائج مطابقة"}
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const Flag = c.Flag;
                  const isSelected = c.iso === current.iso;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => {
                        handleSelect(c.iso);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent/60 font-medium' : ''
                      }`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        textAlign: 'start',
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Flag
                          className="w-5 h-3.5 rounded-xs shrink-0 object-cover shadow-xs"
                          style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover' }}
                        />
                        <span className="truncate" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isEn ? c.nameEn : c.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground shrink-0" dir="ltr" style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.7 }}>
                        {c.code}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
        <input
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          maxLength={30}
          placeholder={placeholder || current.placeholder || '0783 140 0500'}
          value={value || ''}
          onChange={onChange}
          required={required}
          className="flex-1 min-w-0 h-[44px] px-3 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ flex: 1, minWidth: 0, height: '44px' }}
        />
      </div>
    </label>
  );
}
