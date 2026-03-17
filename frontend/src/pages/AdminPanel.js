import React, { useEffect, useMemo, useState } from 'react';
import ComplaintCard from '../components/ComplaintCard';
import NotificationPopup from '../components/NotificationPopup';
import { complaintApi, notificationApi, workerApi } from '../services/api';

const statusOptions = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];

const suggestSpecialty = (complaint) => {
  const text = `${complaint.category} ${complaint.department}`.toLowerCase();
  if (text.includes('road') || text.includes('transport')) return 'Road Contractor';
  if (text.includes('water')) return 'Water Engineer';
  if (text.includes('sanitation') || text.includes('sewage')) return 'Sanitation Worker';
  if (text.includes('plumb')) return 'Plumber';
  if (text.includes('electr') || text.includes('power')) return 'Electrician';
  if (text.includes('environ') || text.includes('pollut')) return 'Environmental Inspector';
  if (text.includes('building') || text.includes('construct')) return 'Building Inspector';
  if (text.includes('infra')) return 'Civil Engineer';
  if (text.includes('it') || text.includes('tech')) return 'IT Technician';
  return null;
};

const AdminPanel = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const [workers, setWorkers] = useState([]);
  const [showWorkerPanel, setShowWorkerPanel] = useState(false);
  const [workerForm, setWorkerForm] = useState({ name: '', phone: '', specialty: 'Civil Engineer' });
  const [specialties, setSpecialties] = useState([]);
  const [editingWorker, setEditingWorker] = useState(null);
  const [workerError, setWorkerError] = useState('');
  const [assigningId, setAssigningId] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationToast, setNotificationToast] = useState({ open: false, message: '', type: 'info' });

  const loadComplaints = async () => {
    try {
      const { data } = await complaintApi.getAll();
      setComplaints(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load all complaints');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkers = async () => {
    try {
      const [wRes, sRes] = await Promise.all([workerApi.getAll({ includeInactive: true }), workerApi.getSpecialties()]);
      setWorkers(wRes.data);
      setSpecialties(sRes.data);
    } catch (err) {
      setWorkerError(err.response?.data?.message || 'Failed to load workers');
    }
  };

  const loadNotifications = async () => {
    try {
      const { data } = await notificationApi.getMine(20);
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unreadCount || 0));
      const latestUnread = (Array.isArray(data?.notifications) ? data.notifications : []).find((item) => !item.isRead);
      if (latestUnread) {
        setNotificationToast({
          open: true,
          message: latestUnread.message,
          type: 'info',
        });
      }
    } catch (_err) {
    }
  };

  useEffect(() => {
    loadComplaints();
    loadWorkers();
    loadNotifications();
  }, []);

  const updateStatus = async (complaintId, status) => {
    setUpdatingId(complaintId);
    try {
      await complaintApi.updateStatus(complaintId, status);
      setComplaints((prev) => prev.map((c) => (c._id === complaintId ? { ...c, status } : c)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId('');
    }
  };

  const assignWorker = async (complaintId, workerId) => {
    setAssigningId(complaintId);
    try {
      const { data } = await complaintApi.assignWorker(complaintId, workerId || null);
      setComplaints((prev) =>
        prev.map((c) => (c._id === complaintId ? { ...c, assignedWorker: data.complaint.assignedWorker } : c))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign worker');
    } finally {
      setAssigningId('');
    }
  };

  const saveWorker = async () => {
    setWorkerError('');
    try {
      if (editingWorker) {
        const { data } = await workerApi.update(editingWorker._id, workerForm);
        setWorkers((prev) => prev.map((w) => (w._id === data._id ? data : w)));
        setEditingWorker(null);
      } else {
        const { data } = await workerApi.create(workerForm);
        setWorkers((prev) => [data, ...prev]);
      }
      setWorkerForm({ name: '', phone: '', specialty: specialties[0] || 'Civil Engineer' });
    } catch (err) {
      setWorkerError(err.response?.data?.message || 'Failed to save worker');
    }
  };

  const deleteWorker = async (id) => {
    if (!window.confirm('Deactivate this worker? They will no longer appear in active worker assignment lists.')) return;
    try {
      await workerApi.remove(id);
      await loadWorkers();
    } catch (err) {
      setWorkerError(err.response?.data?.message || 'Failed to delete worker');
    }
  };

  const reactivateManagedWorker = async (id) => {
    if (!window.confirm('Reactivate this worker account? Admin confirmation is required.')) return;
    try {
      await workerApi.reactivate(id);
      await loadWorkers();
    } catch (err) {
      setWorkerError(err.response?.data?.message || 'Failed to reactivate worker');
    }
  };

  const toggleRegisteredWorker = async (worker) => {
    try {
      if (!window.confirm('Registered worker auth-account controls are disabled in simple auth mode. Continue with worker status management only?')) return;
      await loadWorkers();
    } catch (_err) {
      setWorkerError('Failed to refresh worker list');
    }
  };

  const startEditWorker = (worker) => {
    setEditingWorker(worker);
    setWorkerForm({ name: worker.name, phone: worker.phone || '', specialty: worker.specialty });
  };

  const filtered = complaints.filter((complaint) => {
    const text = `${complaint.complaintText || ''} ${complaint.complaintTitle || ''} ${complaint.category || ''}`.toLowerCase();
    if (filterStatus !== 'All' && complaint.status !== filterStatus) return false;
    if (filterPriority !== 'All' && complaint.priority !== filterPriority) return false;
    if (search && !text.includes(search.toLowerCase())) return false;
    return true;
  });

  const groupedByYear = useMemo(() => {
    return filtered.reduce((acc, complaint) => {
      const year = new Date(complaint.createdAt || Date.now()).getFullYear();
      const key = Number.isFinite(year) ? String(year) : 'Unknown Year';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(complaint);
      return acc;
    }, {});
  }, [filtered]);

  const yearKeys = useMemo(
    () => Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a)),
    [groupedByYear]
  );

  const metrics = useMemo(() => ({
    total: complaints.length,
    highPriority: complaints.filter((c) => c.priority === 'High').length,
    assigned: complaints.filter((c) => c.assignedWorker?.workerId).length,
    availableWorkers: workers.filter((worker) => worker.isAvailable).length,
  }), [complaints, workers]);

  const countByStatus = (status) => complaints.filter((complaint) => complaint.status === status).length;

  if (loading) return <p className="text-slate-500 p-4">Loading admin data...</p>;

  return (
    <div className="space-y-5 page-enter">
      <NotificationPopup
        open={notificationToast.open}
        type={notificationToast.type}
        message={notificationToast.message}
        onClose={() => setNotificationToast((prev) => ({ ...prev, open: false }))}
      />

      <div className="blue-panel rounded-[28px] px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Administrative operations</p>
            <h2 className="mt-2 text-3xl font-extrabold text-white">Complaint review, assignment, and worker control</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50">
              This panel is the live execution layer for the government-style dashboard: review complaints, assign field staff,
              and move cases through their service lifecycle.
            </p>
          </div>
          <button
            onClick={() => setShowWorkerPanel((prev) => !prev)}
            className="rounded-full bg-white px-4 py-3 text-sm font-bold text-[#123b83] transition hover:bg-blue-50"
          >
            Manage Workers ({workers.length})
          </button>
        </div>
      </div>

      {(error || workerError) ? (
        <div className="gov-card rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600">{error || workerError}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Total queue</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{metrics.total}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">High priority</p>
          <p className="mt-2 text-3xl font-extrabold text-rose-700">{metrics.highPriority}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Assigned cases</p>
          <p className="mt-2 text-3xl font-extrabold text-blue-700">{metrics.assigned}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Available workers</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-700">{metrics.availableWorkers}</p>
        </div>
        <div className="gov-card rounded-[24px] p-4">
          <p className="gov-kicker">Unread alerts</p>
          <p className="mt-2 text-3xl font-extrabold text-indigo-700">{unreadCount}</p>
        </div>
      </div>

      {notifications.length > 0 ? (
        <div className="gov-card rounded-[24px] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="gov-kicker">Reopen and escalation alerts</p>
            <button
              type="button"
              onClick={async () => {
                await notificationApi.markAllRead();
                await loadNotifications();
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Mark all as read
            </button>
          </div>
          <div className="space-y-2">
            {notifications.map((item) => (
              <div key={item._id} className={`rounded-xl border px-3 py-2 text-xs ${item.isRead ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5">{item.message}</p>
                    <p className="mt-1 text-[11px] opacity-80">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  {!item.isRead ? (
                    <button
                      type="button"
                      className="rounded border border-current/20 px-2 py-1 font-semibold"
                      onClick={async () => {
                        await notificationApi.markRead(item._id);
                        await loadNotifications();
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showWorkerPanel ? (
        <div className="gov-card rounded-[28px] p-4 space-y-4">
          <div>
            <p className="gov-kicker">Field workforce</p>
            <h3 className="mt-1 font-semibold text-slate-700">Workers / Field Staff</h3>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <input
              value={workerForm.name}
              onChange={(e) => setWorkerForm((form) => ({ ...form, name: e.target.value }))}
              placeholder="Name *"
              className="gov-input px-2 py-2 text-sm w-36"
            />
            <input
              value={workerForm.phone}
              onChange={(e) => setWorkerForm((form) => ({ ...form, phone: e.target.value }))}
              placeholder="Mobile Number"
              className="gov-input px-2 py-2 text-sm w-32"
            />
            <select
              value={workerForm.specialty}
              onChange={(e) => setWorkerForm((form) => ({ ...form, specialty: e.target.value }))}
              className="gov-input px-2 py-2 text-sm bg-white"
            >
              {specialties.map((specialty) => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
            <button onClick={saveWorker} disabled={!workerForm.name.trim()} className="gov-button-primary rounded-2xl px-3 py-2 text-sm disabled:opacity-40">
              {editingWorker ? 'Update' : 'Add Worker'}
            </button>
            {editingWorker ? (
              <button
                onClick={() => {
                  setEditingWorker(null);
                  setWorkerForm({ name: '', phone: '', specialty: specialties[0] || 'Civil Engineer' });
                }}
                className="gov-button-secondary rounded-2xl px-3 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-2 py-2 text-left font-medium">Name</th>
                  <th className="px-2 py-2 text-left font-medium">Specialty</th>
                  <th className="px-2 py-2 text-left font-medium">Mobile Number</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker._id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-700">{worker.name}</td>
                    <td className="px-2 py-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{worker.specialty}</span></td>
                    <td className="px-2 py-2 text-slate-500">{worker.phone || '—'}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-1 font-medium ${worker.isActive ? (worker.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600') : 'bg-slate-200 text-slate-700'}`}>
                        {worker.isActive ? (worker.isAvailable ? 'Available' : 'Busy') : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-2 py-2 flex gap-2">
                      {worker.type === 'managed' ? (
                        <button onClick={() => startEditWorker(worker)} className="text-blue-600 hover:underline">Edit</button>
                      ) : null}
                      {worker.type === 'managed' ? (
                        worker.isActive ? (
                          <button onClick={() => deleteWorker(worker._id)} className="text-red-500 hover:underline">Deactivate</button>
                        ) : (
                          <button onClick={() => reactivateManagedWorker(worker._id)} className="text-emerald-600 hover:underline">Reactivate</button>
                        )
                      ) : (
                        <button onClick={() => toggleRegisteredWorker(worker)} className={`${worker.isActive ? 'text-red-500' : 'text-emerald-600'} hover:underline`}>
                          {worker.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {['All', ...statusOptions].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              filterStatus === status
                ? 'bg-[#1f56ad] text-white border-[#1f56ad]'
                : 'bg-white text-slate-600 border-slate-300 hover:border-[#2c5fb5]'
            }`}
          >
            {status} {status === 'All' ? `(${complaints.length})` : `(${countByStatus(status)})`}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="gov-input px-3 py-2 text-sm bg-white">
          <option value="All">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search complaints..."
          className="gov-input px-3 py-2 text-sm flex-1 min-w-[180px] bg-white"
        />
        <span className="text-xs text-slate-500">{filtered.length} result(s)</span>
      </div>

      {filtered.length === 0 ? <p className="text-slate-500 text-sm">No complaints match the current filters.</p> : null}

      {yearKeys.map((year) => (
        <div key={year} className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <h3 className="text-sm font-bold text-slate-700">Complaints from {year}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {groupedByYear[year].length} records
            </span>
          </div>

          {groupedByYear[year].map((complaint) => {
            const suggested = suggestSpecialty(complaint);
            const activeWorkers = workers.filter((worker) => worker.isActive);
            const relevantWorkers = activeWorkers.filter((worker) => !suggested || worker.specialty === suggested);
            const allWorkers = suggested
              ? [...relevantWorkers, ...activeWorkers.filter((worker) => worker.specialty !== suggested)]
              : activeWorkers;
            const currentWorkerId = complaint.assignedWorker?.workerId || '';

            return (
              <ComplaintCard
                key={complaint._id}
                complaint={complaint}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    {(complaint.status === 'Resolved' || complaint.status === 'Closed') ? (
                      <button
                        type="button"
                        disabled={updatingId === complaint._id}
                        onClick={() => updateStatus(complaint._id, 'Under Review')}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        Re-open
                      </button>
                    ) : null}

                    <select
                      value={currentWorkerId}
                      disabled={assigningId === complaint._id}
                      onChange={(e) => assignWorker(complaint._id, e.target.value)}
                      className="gov-input px-2 py-2 text-xs bg-white text-slate-700"
                    >
                      <option value="">Assign Worker</option>
                      {allWorkers.map((worker) => (
                        <option key={worker._id} value={worker._id}>
                          {worker.name} — {worker.specialty}{suggested && worker.specialty === suggested ? ' ✓' : ''}
                        </option>
                      ))}
                    </select>

                    <select
                      defaultValue={complaint.status}
                      disabled={updatingId === complaint._id}
                      onChange={(e) => updateStatus(complaint._id, e.target.value)}
                      className="gov-input px-2 py-2 text-xs bg-white text-slate-700"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;