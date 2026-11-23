import React, { useRef, useLayoutEffect, useCallback } from 'react';

/**
 * Formats a numeric string or number with thousands separators (الفرزة).
 * Examples:
 *   1000 -> 1,000
 *   11111111 -> 11,111,111
 *   1000.5 -> 1,000.5
 */
export function formatNumberWithCommas(val, allowDecimals = true) {
  if (val == null || val === '') return '';
  const str = String(val).replace(/,/g, '').trim();
  if (!str) return '';

  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split('.');
  const integerDigits = parts[0].replace(/[^\d]/g, '');

  if (!integerDigits && parts.length === 1) {
    return isNegative ? '-' : '';
  }

  const formattedInteger = integerDigits ? integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';

  if (allowDecimals && parts.length > 1) {
    const decimalDigits = parts.slice(1).join('').replace(/[^\d]/g, '');
    const result = `${formattedInteger}.${decimalDigits}`;
    return isNegative ? `-${result}` : result;
  }

  return isNegative ? `-${formattedInteger}` : formattedInteger;
}

/**
 * Removes commas from a formatted string, returning clean raw value.
 * Example: "1,000.5" -> "1000.5"
 */
export function unformatNumber(val) {
  if (val == null) return '';
  return String(val).replace(/,/g, '').trim();
}

/**
 * Reusable NumberInput with automatic thousands separator (الفرزة).
 * Displays numbers formatted like "1,000" while emitting clean raw values in onChange.
 */
export const NumberInput = React.forwardRef(function NumberInput(
  {
    value,
    onChange,
    allowDecimals = true,
    placeholder,
    className = '',
    style,
    disabled = false,
    required = false,
    min,
    max,
    ...rest
  },
  forwardedRef
) {
  const localRef = useRef(null);
  const inputRef = forwardedRef || localRef;
  const cursorTracker = useRef({ selectionStart: 0, digitsBeforeCursor: 0 });

  const rawValue = unformatNumber(value);
  const displayValue = formatNumberWithCommas(rawValue, allowDecimals);

  // Restore cursor position after formatting
  useLayoutEffect(() => {
    const el = inputRef?.current;
    if (!el || document.activeElement !== el) return;

    const { digitsBeforeCursor } = cursorTracker.current;
    if (digitsBeforeCursor == null) return;

    // Find position in displayValue with the same count of digits
    let count = 0;
    let targetPos = displayValue.length;

    for (let i = 0; i < displayValue.length; i++) {
      if (/\d/.test(displayValue[i])) {
        count++;
        if (count >= digitsBeforeCursor) {
          targetPos = i + 1;
          break;
        }
      }
    }

    try {
      el.setSelectionRange(targetPos, targetPos);
    } catch {
      // Ignore in unsupported environments
    }
  }, [displayValue, inputRef]);

  const handleChange = useCallback(
    (e) => {
      const el = e.target;
      const inputVal = el.value;
      const currentCursor = el.selectionStart || 0;

      // Count digits before current cursor
      const textBefore = inputVal.slice(0, currentCursor);
      const digitsBefore = (textBefore.match(/\d/g) || []).length;
      cursorTracker.current = { selectionStart: currentCursor, digitsBeforeCursor: digitsBefore };

      // Clean raw value
      let clean = inputVal.replace(/,/g, '');
      if (!allowDecimals) {
        clean = clean.replace(/[^\d-]/g, '');
      } else {
        // Allow at most one decimal point
        const parts = clean.split('.');
        if (parts.length > 2) {
          clean = parts[0] + '.' + parts.slice(1).join('');
        }
        clean = clean.replace(/[^\d.-]/g, '');
      }

      // Check min/max if specified
      if (max != null && clean !== '' && !clean.endsWith('.')) {
        const num = Number(clean);
        if (!isNaN(num) && num > max) {
          clean = String(max);
        }
      }

      const formatted = formatNumberWithCommas(clean, allowDecimals);

      if (onChange) {
        // Create synthetic event with both raw and formatted values
        const syntheticEvent = {
          ...e,
          target: {
            ...el,
            value: clean,
            rawValue: clean,
            formattedValue: formatted,
            numberValue: clean === '' || isNaN(Number(clean)) ? null : Number(clean),
          },
        };
        onChange(syntheticEvent);
      }
    },
    [onChange, allowDecimals, max]
  );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      style={{
        fontVariantNumeric: 'tabular-nums',
        direction: 'ltr',
        textAlign: 'right',
        ...style,
      }}
      disabled={disabled}
      required={required}
      {...rest}
    />
  );
});

export default NumberInput;

