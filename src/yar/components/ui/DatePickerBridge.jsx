import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { arSA, enGB } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { usePrefs } from '../../i18n/prefs';
import './date-picker.css';

const parse = (value) => (value ? new Date(`${value}T12:00:00`) : undefined);
const serialize = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export default function DatePickerBridge() {
  const { lang } = usePrefs(),
    [target, setTarget] = useState(null),
    panel = useRef(null);
  useEffect(() => {
    const open = (e) => {
      const input = e.target;
      if (
        input instanceof HTMLInputElement &&
        input.type === 'date' &&
        !input.disabled &&
        !input.readOnly
      ) {
        e.preventDefault();
        setTarget(input);
      }
    };
    const key = (e) => {
      if (e.key === 'Escape') setTarget(null);
      if (
        (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') &&
        e.target instanceof HTMLInputElement &&
        e.target.type === 'date'
      )
        open(e);
    };
    const outside = (e) => {
      if (panel.current && !panel.current.contains(e.target) && e.target !== target)
        setTarget(null);
    };
    const resize = () => setTarget(null);
    document.addEventListener('click', open, true);
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('click', open, true);
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', resize);
    };
  }, [target]);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  const top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 410));
  const left = Math.max(8, Math.min(rect.left, Math.max(8, window.innerWidth - 328)));
  function choose(date) {
    const value = date ? serialize(date) : '';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(target, value);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setTarget(null);
    target.focus();
  }
  return createPortal(
    <div
      ref={panel}
      className="yar-date-picker"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      role="dialog"
      aria-label={lang === 'ar' ? 'اختيار التاريخ' : 'Choose Date'}
      data-no-translate
      style={{ top, left }}
    >
      <header>
        <strong>{lang === 'ar' ? 'اختيار التاريخ' : 'Choose Date'}</strong>
        <Button
          variant="ghost"
          size="icon"
          aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
          onClick={() => setTarget(null)}
        >
          <X />
        </Button>
      </header>
      <DayPicker
        mode="single"
        locale={lang === 'ar' ? arSA : enGB}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        selected={parse(target.value)}
        defaultMonth={parse(target.value)}
        captionLayout="dropdown"
        startMonth={new Date(1920, 0)}
        endMonth={new Date(2100, 11)}
        disabled={[
          ...(target.min ? [{ before: parse(target.min) }] : []),
          ...(target.max ? [{ after: parse(target.max) }] : []),
        ]}
        onSelect={choose}
        components={{
          Chevron: ({ orientation }) =>
            orientation === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />,
          DayButton: (props) => <Button {...props} variant="ghost" size="icon" />,
          PreviousMonthButton: (props) => <Button {...props} variant="ghost" size="icon" />,
          NextMonthButton: (props) => <Button {...props} variant="ghost" size="icon" />,
        }}
      />
      <footer>
        <Button variant="ghost" size="sm" onClick={() => choose(undefined)}>
          {lang === 'ar' ? 'مسح' : 'Clear'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={
            (target.min && serialize(new Date()) < target.min) ||
            (target.max && serialize(new Date()) > target.max)
          }
          onClick={() => choose(new Date())}
        >
          {lang === 'ar' ? 'اليوم' : 'Today'}
        </Button>
      </footer>
    </div>,
    document.body,
  );
}
