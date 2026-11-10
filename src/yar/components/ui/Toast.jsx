import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Icon } from './Icon';

const ToastContext = createContext({
  showToast: () => {}
});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ open: false, message: '', icon: 'check' });
  const timerRef = useRef(null);

  const showToast = useCallback((message, icon = 'check') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ open: true, message, icon });
    timerRef.current = setTimeout(() => {
      setToast(t => ({ ...t, open: false }));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.open && (
        <div className="toast" id="toast" role="status">
          <i data-icon={toast.icon}>
            <Icon name={toast.icon} />
          </i>
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  const fn = (...args) => context.showToast(...args);
  fn.showToast = context.showToast;
  return fn;
}

export default ToastProvider;
