import React, { useEffect } from 'react';

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

const NotificationPopup = ({ open, type = 'info', message, onClose, autoHideMs = 3500 }) => {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      onClose?.();
    }, autoHideMs);
    return () => clearTimeout(timer);
  }, [open, autoHideMs, onClose]);

  if (!open || !message) return null;

  return (
    <div className="fixed right-4 top-4 z-[70] w-[min(94vw,420px)]">
      <div className={`rounded-2xl border px-4 py-3 shadow-lg ${STYLES[type] || STYLES.info}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-6">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold opacity-75 transition hover:opacity-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPopup;
