import React, { useEffect } from 'react';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import App from './app/App';
import { usePrefs, applyPrefs } from './i18n/prefs';
import { setTranslation } from './i18n/translator';
import './styles/index.css';
import './styles/theme.css';
import './styles/additions.css';
import './accounts/accounts.css';
import '../public-site/public.css';

export default function YarRoot() {
  const p = usePrefs();
  useEffect(() => { applyPrefs(p); setTranslation(p.lang); }, [p]);
  return (
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  );
}
