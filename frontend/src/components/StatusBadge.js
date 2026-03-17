import React from 'react';

const STATUS_STYLES = {
  Submitted: 'bg-slate-100 text-slate-700',
  'Under Review': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-violet-100 text-violet-700',
};

const StatusBadge = ({ status, className = '' }) => {
  const statusLabel = status || 'Submitted';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[statusLabel] || 'bg-slate-100 text-slate-700'
      } ${className}`.trim()}
    >
      {statusLabel}
    </span>
  );
};

export default StatusBadge;