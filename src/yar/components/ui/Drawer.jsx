import React, { useEffect } from 'react';
import { Icon } from './Icon';

export function Drawer({
  open,
  isOpen,
  onClose,
  eyebrow = 'تفاصيل الحجز',
  badgeText,
  title = '',
  children
}) {
  const isDrawerOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('no-scroll');
    };
  }, [isDrawerOpen, onClose]);

  if (!isDrawerOpen) return null;

  const eyebrowText = badgeText || eyebrow;

  return (
    <>
      <div className="drawer-overlay" id="drawer-overlay" onClick={onClose} />
      <section
        className="drawer"
        id="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <header>
          <div>
            <span className="eyebrow" id="drawer-eyebrow">{eyebrowText}</span>
            <h2 id="drawer-title">{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            id="close-drawer"
            aria-label="إغلاق التفاصيل"
            onClick={onClose}
          >
            <i data-icon="close">
              <Icon name="close" />
            </i>
          </button>
        </header>
        <div className="drawer-content" id="drawer-content">
          {children}
        </div>
      </section>
    </>
  );
}

export default Drawer;
