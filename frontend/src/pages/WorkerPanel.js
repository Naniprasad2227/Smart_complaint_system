import React, { useEffect, useMemo, useState } from 'react';
import { complaintApi, notificationApi } from '../services/api';
import NotificationPopup from '../components/NotificationPopup';

const STATUS_COLORS = {
  Submitted: 'bg-slate-100 text-slate-600',
  'Under Review': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-purple-100 text-purple-700',
};

const PRIORITY_COLORS = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-orange-100 text-orange-700',
  Low: 'bg-green-100 text-green-700',
};

const WorkerPanel = ({ user }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [progressNotes, setProgressNotes] = useState({});
  const [evidenceFiles, setEvidenceFiles] = useState({});
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const [assignmentRes, notificationRes] = await Promise.all([
          complaintApi.getMyAssignments(),
          notificationApi.getMine(10),
        ]);
        setAssignments(assignmentRes.data);

        const unread = (notificationRes.data?.notifications || []).find((item) => !item.isRead);
        if (unread) {
          setNotification({
            open: true,
            message: unread.message,
            type: 'info',
          });
          await notificationApi.markRead(unread._id);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, []);

  const updateProgress = async (id, status) => {
    setUpdatingId(id);
    try {
      const note = progressNotes[id] || '';

      if (status === 'Resolved' && evidenceFiles[id]) {
        await complaintApi.uploadImage(id, evidenceFiles[id]);
      }

      const { data } = await complaintApi.updateProgress(id, status, note);
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment._id === id
            ? { ...assignment, status: data.complaint.status, progressNote: data.complaint.progressNote }
            : assignment
        )
      );
      setProgressNotes((prev) => ({ ...prev, [id]: '' }));
      setEvidenceFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setNotification({
        open: true,
        message:
          status === 'Resolved'
            ? 'Complaint marked as resolved. Progress and evidence were submitted.'
            : 'Progress status updated successfully.',
        type: 'success',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
      setNotification({
        open: true,
        message: err.response?.data?.message || 'Failed to update status',
        type: 'error',
      });
    } finally {
      setUpdatingId('');
    }
  };

  const filtered = filter === 'All' ? assignments : assignments.filter((assignment) => assignment.status === filter);
  const counts = useMemo(() => ({
    All: assignments.length,
    'In Progress': assignments.filter((assignment) => assignment.status === 'In Progress').length,
    Resolved: assignments.filter((assignment) => assignment.status === 'Resolved').length,
    Submitted: assignments.filter((assignment) => assignment.status === 'Submitted').length,
    'Under Review': assignments.filter((assignment) => assignment.status === 'Under Review').length,
  }), [assignments]);

  if (loading) return <p className="text-slate-500 p-4">Loading your assignments...</p>;

  return (
    <div className="space-y-5 page-enter">
      <NotificationPopup
        open={notification.open}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
      />

      <div className="blue-panel rounded-[28px] px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Worker operations desk</p>
            <h2 className="mt-2 text-3xl font-extrabold text-white">Field assignments and progress updates</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50">
              Review assigned complaints, record field progress, and move cases toward resolution with transparent status updates.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-white">
            <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Worker profile</p>
            <p className="mt-1 text-lg font-extrabold capitalize">{user?.name || 'Field Worker'}</p>
            <p className="text-sm text-blue-100">{user?.specialty || 'General operations'}</p>
          </div>
        </div>
      </div>

      {error ? <div className="gov-card rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Total tasks</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{counts.All}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">In progress</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-700">{counts['In Progress']}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Resolved</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-700">{counts.Resolved}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Waiting review</p>
          <p className="mt-2 text-3xl font-extrabold text-blue-700">{counts['Under Review']}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All', 'Submitted', 'Under Review', 'In Progress', 'Resolved'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              filter === status
                ? 'bg-[#1f56ad] text-white border-[#1f56ad]'
                : 'bg-white text-slate-600 border-slate-300 hover:border-[#2c5fb5]'
            }`}
          >
            {status} ({counts[status] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="gov-card rounded-[28px] p-8 text-center text-slate-400">
          <div className="text-4xl mb-2">🔧</div>
          <p className="text-sm font-medium">No assignments yet</p>
          <p className="text-xs mt-1">Complaints will appear here once an admin assigns them to you.</p>
        </div>
      ) : null}

      {filtered.map((complaint) => (
        <div key={complaint._id} className="gov-card rounded-[24px] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-800">{complaint.complaintTitle}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {complaint.category} · {complaint.department}
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_COLORS[complaint.priority] || 'bg-slate-100 text-slate-600'}`}>
                {complaint.priority}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[complaint.status] || 'bg-slate-100 text-slate-600'}`}>
                {complaint.status}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">{complaint.complaintDescription || complaint.complaintText}</p>

          {(complaint.complaintLocation?.village || complaint.village) ? (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>📍</span>
              <span>
                {[
                  complaint.complaintLocation?.village || complaint.village,
                  complaint.complaintLocation?.mandal || complaint.mandal,
                  complaint.complaintLocation?.district || complaint.district,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          ) : null}

          {complaint.userId ? (
            <div className="text-xs text-slate-500">
              Reported by <span className="font-medium text-slate-700">{complaint.userId.name || complaint.userId.email}</span>
            </div>
          ) : null}

          {complaint.progressNote ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Last update: {complaint.progressNote}
            </div>
          ) : null}

          {complaint.status !== 'Resolved' && complaint.status !== 'Closed' ? (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <textarea
                value={progressNotes[complaint._id] || ''}
                onChange={(e) => setProgressNotes((prev) => ({ ...prev, [complaint._id]: e.target.value }))}
                placeholder="Add a progress note (optional)..."
                rows={2}
                className="gov-input w-full px-3 py-2 text-sm resize-none"
                maxLength={500}
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => updateProgress(complaint._id, 'In Progress')}
                  disabled={updatingId === complaint._id || complaint.status === 'In Progress'}
                  className="rounded-2xl bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
                >
                  {updatingId === complaint._id ? 'Saving...' : 'Mark In Progress'}
                </button>
                <button
                  onClick={() => updateProgress(complaint._id, 'Resolved')}
                  disabled={updatingId === complaint._id}
                  className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {updatingId === complaint._id ? 'Saving...' : 'Mark Resolved'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Resolution evidence (optional)
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400">
                    Choose image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        setEvidenceFiles((prev) => ({ ...prev, [complaint._id]: event.target.files?.[0] || null }))
                      }
                    />
                  </label>
                  <span className="text-xs text-slate-500">
                    {evidenceFiles[complaint._id]?.name || 'No file selected'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  If selected, this image is uploaded when you click “Mark Resolved”.
                </p>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-2 text-xs font-medium text-emerald-700">This complaint has been resolved.</div>
          )}
        </div>
      ))}

    </div>
  );
};

export default WorkerPanel;