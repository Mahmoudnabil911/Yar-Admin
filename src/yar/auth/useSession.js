import { useSyncExternalStore } from 'react';
import { auth } from './access';

export function useSession() {
  return useSyncExternalStore(auth.subscribe, auth.get, () => null);
}
