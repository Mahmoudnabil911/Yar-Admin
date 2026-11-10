import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { usePrefs } from '../../i18n/prefs';
import './select-bridge.css';

export default function SelectBridge() {
  const { lang } = usePrefs();
  const [target, setTarget] = useState(null);
  const [options, setOptions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const panelRef = useRef(null);

  // Keep track of target to toggle open/close class and attribute
  useEffect(() => {
    if (target) {
      target.setAttribute('data-yar-open', 'true');
      target.classList.add('yar-select-open');
    }
    return () => {
      if (target) {
        target.removeAttribute('data-yar-open');
        target.classList.remove('yar-select-open');
      }
    };
  }, [target]);

  // Read options from the select element
  const refreshOptions = (selectEl) => {
    if (!selectEl) return;
    const items = [];
    const children = Array.from(selectEl.children);
    children.forEach((child) => {
      if (child.tagName === 'OPTGROUP') {
        items.push({ isGroup: true, label: child.label });
        Array.from(child.children).forEach((opt) => {
          items.push({
            value: opt.value,
            label: opt.textContent,
            disabled: opt.disabled,
            selected: opt.selected,
          });
        });
      } else if (child.tagName === 'OPTION') {
        items.push({
          value: child.value,
          label: child.textContent,
          disabled: child.disabled,
          selected: child.selected,
        });
      }
    });
    setOptions(items);
    const selectedIdx = items.findIndex((it) => !it.isGroup && it.selected);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  };

  const updatePosition = (selectEl) => {
    if (!selectEl) return;
    const rect = selectEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 240;

    let top = rect.bottom + 4;
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      top = Math.max(8, rect.top - estimatedHeight - 4);
    }

    const minWidth = Math.max(rect.width, 160);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - minWidth - 8);
    }

    setPos({
      top,
      left,
      width: minWidth,
    });
  };

  useEffect(() => {
    const handleMouseDown = (e) => {
      const select = e.target.closest('select');
      if (panelRef.current && panelRef.current.contains(e.target)) {
        return;
      }
      if (select && !select.disabled && select.offsetParent !== null) {
        e.preventDefault();
        if (target === select) {
          setTarget(null);
        } else {
          setTarget(select);
          refreshOptions(select);
          updatePosition(select);
        }
        return;
      }

      if (target && (!select || select !== target)) {
        setTarget(null);
      }
    };

    const handleKeyDown = (e) => {
      if (!target) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setTarget(null);
        target.focus();
        return;
      }

      const validItems = options.filter((o) => !o.isGroup && !o.disabled);
      if (validItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < options.length && (options[next].isGroup || options[next].disabled)) {
            next++;
          }
          return next < options.length ? next : prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && (options[next].isGroup || options[next].disabled)) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = options[highlightedIndex];
        if (item && !item.isGroup && !item.disabled) {
          selectValue(item.value);
        }
      }
    };

    const handleScrollOrResize = () => {
      if (target) {
        updatePosition(target);
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [target, options, highlightedIndex]);

  const selectValue = (val) => {
    if (!target) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(target, val);
    } else {
      target.value = val;
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    setTarget(null);
    target.focus();
  };

  if (!target) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="yar-select-portal"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        minWidth: `${pos.width}px`,
      }}
      role="listbox"
    >
      {options.map((item, idx) => {
        if (item.isGroup) {
          return (
            <div key={`group-${idx}`} className="yar-select-group-label">
              {item.label}
            </div>
          );
        }

        const isSelected = item.selected;
        const isHighlighted = idx === highlightedIndex;

        return (
          <div
            key={`opt-${idx}-${item.value}`}
            className={`yar-select-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => selectValue(item.value)}
            onMouseEnter={() => setHighlightedIndex(idx)}
          >
            <span>{item.label}</span>
            {isSelected && <Check size={14} />}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
