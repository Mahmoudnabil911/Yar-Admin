// DOM-level UI translator: when English is active, Arabic interface strings found in the
// EN table are swapped for English (text nodes + placeholder/aria-label/title/alt).
// Originals are kept so switching back to Arabic restores them exactly. Form values and
// user-entered content are never touched.
import { EN } from './en';

const norm = s => s.replace(/\s+/g, ' ').trim();
const exact = new Map();
const patterns = [];
for (const [ar, en] of Object.entries(EN)) {
  if (ar.includes('{0}')) {
    const esc = norm(ar)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{(\d+)\\\}/g, '(.+?)');
    patterns.push([new RegExp(`^${esc}$`), en]);
  } else exact.set(norm(ar), en);
}
// JSX frequently places a dynamic value in the same text node as its Arabic label
// (for example, "آخر نشاط: {date}"). Exact-only lookup misses the entire node.
// Keep a longest-first list of complete multiword labels so those labels can be
// translated in mixed text without translating arbitrary short substrings.
const partial = [...exact.entries()]
  .filter(([ar]) => (ar.length >= 7 && /\s/.test(ar)) || (ar.length >= 3 && /[^\u0600-\u06FF\s]/.test(ar)))
  .sort(([a], [b]) => b.length - a.length)
  .map(([ar, en]) => {
    const source = ar.split(' ').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    return [new RegExp(`(?<![\\u0600-\\u06FF])${source}(?![\\u0600-\\u06FF])`, 'g'), en];
  });
const partialPatterns = patterns.map(([re, en]) => [new RegExp(re.source.replace(/^\^|\$$/g, ''), 'g'), en]);
const AR = /[\u0600-\u06FF]/;

export function translateString(value) {
  if (!value || !AR.test(value)) return null;
  const key = norm(value);
  let hit = exact.get(key);
  if (hit === undefined) {
    const mPunc = key.match(/^(.+?)\s*([·:،,\.\-\–\—])\s*$/);
    if (mPunc) {
      const baseHit = exact.get(mPunc[1]);
      if (baseHit !== undefined) {
        const sep = mPunc[2] === '،' ? ',' : (mPunc[2] === '·' ? '·' : mPunc[2]);
        hit = `${baseHit} ${sep}`;
      }
    }
  }
  if (hit !== undefined) {
    const lead = value.match(/^\s*/)[0];
    const trail = value.match(/\s*$/)[0];
    return lead + hit + trail;
  }
  for (const [re, en] of patterns) {
    const m = key.match(re);
    if (m) {
      let res = en;
      for (let i = 1; i < m.length; i++) {
        const arg = m[i];
        const transArg = exact.get(norm(arg)) ?? arg;
        res = res.replace(new RegExp(`\\{${i - 1}\\}`, 'g'), transArg);
      }
      const lead = value.match(/^\s*/)[0];
      const trail = value.match(/\s*$/)[0];
      return lead + res + trail;
    }
  }
  let result = value;
  for (const [re, en] of partial) result = result.replace(re, en);
  for (const [re, en] of partialPatterns) {
    result = result.replace(re, (...args) => {
      const captures = args.slice(1, -2);
      return captures.reduce((text, arg, i) => text.replace(new RegExp(`\\{${i}\\}`, 'g'), exact.get(norm(arg)) ?? arg), en);
    });
  }
  return result === value ? null : result;
}

/** Programmatic helper for strings we render ourselves (toasts, errors). */
export function tr(value, lang) {
  if (lang !== 'en') return value;
  return translateString(value) ?? value;
}

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const origText = new WeakMap();
const origAttr = new WeakMap();
let observer = null;
let active = false;

function doText(node) {
  const current = node.nodeValue;
  const t = translateString(current);
  if (t !== null && t !== current) {
    origText.set(node, current);
    node.nodeValue = t;
  }
}
function doEl(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (!v) continue;
    const t = translateString(v);
    if (t !== null && t !== v) {
      const m = origAttr.get(el) || {};
      m[a] = v;
      origAttr.set(el, m);
      el.setAttribute(a, t);
    }
  }
}
function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  if (root.closest?.('[data-no-translate]')) return;
  doEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      const p = n.parentElement;
      if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'TEXTAREA' || p.closest('[data-no-translate]'))) continue;
      doText(n);
    } else doEl(n);
  }
}
function restore(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      if (origText.has(n)) { n.nodeValue = origText.get(n); origText.delete(n); }
    } else if (origAttr.has(n)) {
      for (const [a, v] of Object.entries(origAttr.get(n))) n.setAttribute(a, v);
      origAttr.delete(n);
    }
  }
}

export function setTranslation(lang) {
  if (typeof document === 'undefined') return;
  const root = document.body;
  if (lang === 'en' && !active) {
    active = true;
    walk(root);
    observer = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  } else if (lang !== 'en' && active) {
    active = false;
    observer?.disconnect();
    observer = null;
    restore(root);
  }
}
