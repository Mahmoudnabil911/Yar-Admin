// Minimal query-string navigation used by the legacy `?page=...` dashboard.
// Replaces react-router-dom: the app is mounted inside a single TanStack route
// and keeps 100% compatibility with old `?page=` / `?edit=` / `?bookingId=` bookmarks.
import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set();
const emit = () => listeners.forEach(l => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

const subscribe = l => { listeners.add(l); return () => listeners.delete(l); };
const getHref = () => (typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search);

export function navigateTo(url, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  if (url === getHref()) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  emit();
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, getHref, () => '/');
  const [pathname, search = ''] = href.split('?');
  return { pathname, search: search ? `?${search}` : '' };
}

export function useSearchParams() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const setSearchParams = useCallback((next, opts) => {
    const current = new URLSearchParams(window.location.search);
    const value = typeof next === 'function' ? next(current) : new URLSearchParams(next);
    const qs = value.toString();
    navigateTo(`/dashboard${qs ? `?${qs}` : ''}`, opts);
  }, []);
  return [params, setSearchParams];
}

export function useNavigate() {
  return useCallback((to, opts) => navigateTo(to, opts), []);
}
