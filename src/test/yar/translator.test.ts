import { describe, expect, it } from 'vitest';
import { translateString } from '../../yar/i18n/translator';

describe('dashboard English text translation', () => {
  it('translates an Arabic label sharing a text node with an English dynamic value', () => {
    expect(translateString('آخر نشاط: No sessions')).toBe('Last activity: No sessions');
  });

  it('translates Arabic fragments around dynamic values', () => {
    expect(translateString('من 4 مزوّدين · الأولوية 1 هي الأعلى')).toBe('4 providers · Priority 1 is highest');
  });

  it('preserves unmatched Arabic content for user supplied values', () => {
    expect(translateString('اسم عميل غير موجود في القاموس')).toBeNull();
  });
});
