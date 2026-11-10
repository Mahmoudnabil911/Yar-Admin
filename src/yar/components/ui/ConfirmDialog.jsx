import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const Ctx = createContext(async () => true);

/** Promise-based confirmation for destructive / high-impact actions. */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const confirmBtn = useRef(null);

  const confirm = useCallback(opts => new Promise(resolve => {
    resolver.current = resolve;
    setState(typeof opts === 'string' ? { message: opts } : opts);
  }), []);

  const close = ok => { resolver.current?.(ok); resolver.current = null; setState(null); };

  useEffect(() => {
    if (!state) return undefined;
    confirmBtn.current?.focus();
    const k = e => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [state]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <>
          <div className="drawer-overlay confirm-overlay" onClick={() => close(false)} />
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
            <h2 id="confirm-title">{state.title || 'تأكيد الإجراء'}</h2>
            <p id="confirm-msg">{state.message}</p>
            <div className="confirm-actions">
              <button type="button" className={`button ${state.danger ? 'danger' : 'primary'}`} ref={confirmBtn} onClick={() => close(true)}>
                {state.confirmLabel || 'تأكيد'}
              </button>
              <button type="button" className="button secondary" onClick={() => close(false)}>إلغاء</button>
            </div>
          </div>
        </>
      )}
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
