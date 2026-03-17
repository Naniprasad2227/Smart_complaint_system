import React, { useEffect, useMemo, useState } from 'react';
import ComplaintCard from '../components/ComplaintCard';
import { complaintApi } from '../services/api';
import WorkflowTimeline from '../components/WorkflowTimeline';
import { readLocalComplaints } from '../services/localComplaints';

const TrackComplaint = () => {
  const [complaints, setComplaints] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadComplaints = async () => {
      try {
        const { data } = await complaintApi.getMine();
        setComplaints(Array.isArray(data) ? data : []);
      } catch (err) {
        setComplaints(readLocalComplaints());
        setError('Unable to load complaint tracker. Showing local records.');
      } finally {
        setLoading(false);
      }
    };

    loadComplaints();
  }, []);

  const filteredComplaints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return complaints;

    return complaints.filter((complaint) => {
      if (statusFilter !== 'All' && complaint.status !== statusFilter) {
        return false;
      }

      const fields = [
        complaint._id,
        complaint.complaintTitle,
        complaint.complaintDescription,
        complaint.category,
        complaint.status,
        complaint.department,
      ];

      return fields.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [complaints, query, statusFilter]);

  const counts = useMemo(
    () => ({
      All: complaints.length,
      Submitted: complaints.filter((item) => item.status === 'Submitted').length,
      'Under Review': complaints.filter((item) => item.status === 'Under Review').length,
      'In Progress': complaints.filter((item) => item.status === 'In Progress').length,
      Resolved: complaints.filter((item) => item.status === 'Resolved').length,
      Closed: complaints.filter((item) => item.status === 'Closed').length,
    }),
    [complaints]
  );

  if (loading) {
    return <p className="p-4 text-slate-600">Loading complaint tracker...</p>;
  }

  return (
    <div className="space-y-4 page-enter">
      <div className="app-surface rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Track Complaint</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Search by complaint ID, title, or status</h2>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: Submitted, road, water, 67f..."
          className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(counts).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === status
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {status} ({counts[status]})
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-surface rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{counts.All}</p>
        </div>
        <div className="app-surface rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Under Review</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-700">{counts['Under Review']}</p>
        </div>
        <div className="app-surface rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">In Progress</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{counts['In Progress']}</p>
        </div>
        <div className="app-surface rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Resolved/Closed</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{counts.Resolved + counts.Closed}</p>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {filteredComplaints.length === 0 ? (
        <div className="app-surface rounded-xl p-6 text-sm text-slate-500">No complaints match the current search.</div>
      ) : (
        filteredComplaints.map((complaint) => (
          <div key={complaint._id} className="space-y-2">
            <ComplaintCard complaint={complaint} />
            <WorkflowTimeline status={complaint.status} />
          </div>
        ))
      )}
    </div>
  );
};

export default TrackComplaint;