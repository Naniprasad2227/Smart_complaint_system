import React from 'react';
import StatusBadge from './StatusBadge';

const priorityColors = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
};

const sentimentEmoji = {
  Negative: '😠',
  Neutral: '😐',
  Positive: '😊',
};

const ComplaintCard = ({ complaint, actions }) => {
  const isAngry = complaint.sentiment === 'Negative' && complaint.priority === 'High';
  const title = complaint.complaintTitle || complaint.complaintText;
  const description = complaint.complaintDescription || complaint.complaintText;
  const complainantName = complaint.userId?.name || complaint.reporterSnapshot?.name || '';
  const complainantEmail = complaint.userId?.email || complaint.reporterSnapshot?.email || '';
  const complainantPhone = complaint.userId?.phone || complaint.reporterSnapshot?.phone || '';
  const complainantAccountStatus = complaint.userId?.accountStatus || 'active';
  const complainantVillage = complaint.userId?.village || complaint.reporterSnapshot?.village || complaint.village || '';
  const complainantMandal = complaint.userId?.mandal || complaint.reporterSnapshot?.mandal || complaint.mandal || '';
  const complainantDistrict = complaint.userId?.district || complaint.reporterSnapshot?.district || complaint.district || '';
  const complainantState = complaint.userId?.state || complaint.reporterSnapshot?.state || complaint.state || '';
  const complainantCountry = complaint.userId?.country || complaint.reporterSnapshot?.country || complaint.country || '';
  const complainantAddress = [complainantVillage, complainantMandal, complainantDistrict, complainantState, complainantCountry]
    .filter(Boolean)
    .join(', ');
  const locationLabel =
    complaint.complaintLocation?.fullAddress ||
    [
      complaint.complaintLocation?.village || complaint.village,
      complaint.complaintLocation?.mandal || complaint.mandal,
      complaint.complaintLocation?.district || complaint.district,
      complaint.complaintLocation?.state || complaint.state,
      complaint.complaintLocation?.country || complaint.country,
    ]
      .filter(Boolean)
      .join(', ');
  const reportHistory = Array.isArray(complaint.reportHistory) ? complaint.reportHistory : [];
  const recurrenceHistory = Array.isArray(complaint.recurrenceHistory) ? complaint.recurrenceHistory : [];
  const uniqueReporterCount = new Set(
    reportHistory
      .map((entry) => entry?.reporterId || entry?.reporterSnapshot?.email || entry?.reporterSnapshot?.phone || '')
      .filter(Boolean)
  ).size;

  return (
    <div
      className={`gov-card rounded-[22px] p-4 transition-all ${
        isAngry ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200'
      }`}
    >
      {isAngry && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          <span>🚨</span>
          <span>Critical complaint detected. Immediate administrative review recommended.</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          {complaint.createdAt && (
            <p className="mt-1 text-xs text-slate-400">Filed on {new Date(complaint.createdAt).toLocaleDateString()}</p>
          )}
        </div>
        <StatusBadge status={complaint.status} />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

      {(complainantName || complainantEmail || complainantPhone || complainantAddress) ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <p className="font-semibold">Reported by</p>
          <div className="mt-1 space-y-1">
            <p><span className="font-semibold">Name:</span> {complainantName || 'Not available'}</p>
            <p><span className="font-semibold">Email:</span> {complainantEmail || 'Not available'}</p>
            <p>
              <span className="font-semibold">Mobile Number:</span>{' '}
              {complainantPhone || 'Not provided in user profile'}
            </p>
            <p><span className="font-semibold">Address:</span> {complainantAddress || 'Not available'}</p>
            <p>
              <span className="font-semibold">Account Status:</span>{' '}
              {complainantAccountStatus === 'inactive' ? 'Inactive (history retained)' : 'Active'}
            </p>
            {reportHistory.length > 1 ? (
              <p>
                <span className="font-semibold">Linked reporters:</span>{' '}
                {uniqueReporterCount || reportHistory.length} people, {reportHistory.length} total report events
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {reportHistory.length > 0 ? (
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <p className="font-semibold">Same issue report history ({reportHistory.length})</p>
          <div className="mt-1 max-h-36 overflow-auto space-y-1">
            {[...reportHistory]
              .sort((a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime())
              .map((entry, index) => {
                const reporter = entry?.reporterSnapshot || {};
                return (
                  <p key={`${entry?._id || index}`}>
                    <span className="font-semibold">{reporter.name || reporter.email || 'Unknown reporter'}</span>
                    {' · '}
                    {entry?.reportedAt ? new Date(entry.reportedAt).toLocaleString() : 'Unknown time'}
                    {' · '}
                    {(entry?.complaintTitle || 'Issue reported').slice(0, 90)}
                  </p>
                );
              })}
          </div>
        </div>
      ) : null}

      {recurrenceHistory.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Re-open / recurrence timeline ({recurrenceHistory.length})</p>
          <div className="mt-1 max-h-32 overflow-auto space-y-1">
            {[...recurrenceHistory]
              .sort((a, b) => new Date(b.reopenedAt || 0).getTime() - new Date(a.reopenedAt || 0).getTime())
              .map((event, index) => (
                <p key={`${event?._id || index}`}>
                  {event?.reopenedAt ? new Date(event.reopenedAt).toLocaleString() : 'Unknown time'}
                  {' · from '}
                  {event?.previousStatus || 'Unknown'}
                  {' · '}
                  {event?.reason || 'Issue re-opened'}
                </p>
              ))}
          </div>
        </div>
      ) : null}

      {locationLabel ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">Location:</span> {locationLabel}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          <strong>Category:</strong> {complaint.category}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-medium ${priorityColors[complaint.priority] || 'bg-slate-100 text-slate-700'}`}>
          <strong>Priority:</strong> {complaint.priority}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          <strong>Dept:</strong> {complaint.department}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          {sentimentEmoji[complaint.sentiment] || '😐'} {complaint.sentiment}
        </span>
      </div>

      {complaint.images?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {complaint.images.map((img, index) => (
            <a
              key={index}
              href={img.filePath}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              View Image {index + 1}
            </a>
          ))}
        </div>
      )}

      {complaint.assignedWorker?.name && (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 w-fit">
          <span>👷</span>
          <span className="font-medium">{complaint.assignedWorker.name}</span>
          <span className="text-emerald-500">·</span>
          <span>{complaint.assignedWorker.specialty}</span>
          {complaint.assignedWorker.phone ? (
            <>
              <span className="text-emerald-500">·</span>
              <span>{complaint.assignedWorker.phone}</span>
            </>
          ) : null}
        </div>
      )}

      {actions ? <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
};

export default ComplaintCard;