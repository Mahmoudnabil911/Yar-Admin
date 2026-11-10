// Persisted language + theme preferences. The inline boot script in __root.tsx applies
// them before first paint (no flash of the wrong theme/direction).
import { useSyncExternalStore } from 'react';

export const LANG_KEY = 'YAR_ADMIN_LANG';
export const THEME_KEY = 'YAR_ADMIN_THEME';

const listeners = new Set();
const read = () => {
  if (typeof window === 'undefined') return { lang: 'ar', theme: 'light' };
  const lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar';
  const stored = localStorage.getItem(THEME_KEY);
  const theme = stored === 'dark' || stored === 'light'
    ? stored
    : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  return { lang, theme };
};
let state = read();
if (typeof window !== 'undefined') window.addEventListener('yar-preferences', () => { state = read(); applyPrefs(state); listeners.forEach(l => l()); });
const SERVER = { lang: 'ar', theme: 'light' };

export function applyPrefs(s = state) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = s.lang;
  html.dir = s.lang === 'ar' ? 'rtl' : 'ltr';
  html.classList.toggle('dark', s.theme === 'dark');
  html.style.colorScheme = s.theme;
}

export const prefs = {
  get: () => state,
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  set(patch) {
    state = { ...state, ...patch };
    if (patch.lang) localStorage.setItem(LANG_KEY, patch.lang);
    if (patch.theme) localStorage.setItem(THEME_KEY, patch.theme);
    applyPrefs(state);
    listeners.forEach(l => l());
  },
};

export function usePrefs() {
  return useSyncExternalStore(prefs.subscribe, prefs.get, () => SERVER);
}

export const BOOT_SCRIPT = `(function(){try{var l=localStorage.getItem('${LANG_KEY}')==='en'?'en':'ar';var s=localStorage.getItem('${THEME_KEY}');var t=s==='dark'||s==='light'?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var h=document.documentElement;h.lang=l;h.dir=l==='ar'?'rtl':'ltr';if(t==='dark')h.classList.add('dark');h.style.colorScheme=t;}catch(e){}})();`;

/** Locale for dates/numbers in the UI; stored values are never changed. Timezone stays Asia/Baghdad. */
export function uiLocale() {
  return state.lang === 'en' ? 'en-GB' : 'ar-IQ';
}
