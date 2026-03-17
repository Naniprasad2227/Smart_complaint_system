import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, complaintApi, workerApi } from '../services/api';

const MetricCard = ({ label, value, tone = 'text-slate-800' }) => (
  <div className="gov-card rounded-[24px] p-4">
    <p className="gov-kicker">{label}</p>
    <p className={`mt-2 text-3xl font-extrabold ${tone}`}>{value}</p>
  </div>
);

const AdminDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activityItems, setActivityItems] = useState([]);
  const [securitySummary, setSecuritySummary] = useState({
    last24Hours: { criticalCount: 0, warningCount: 0 },
    topActions: [],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [complaintsRes, workersRes] = await Promise.all([complaintApi.getAll(), workerApi.getAll()]);
        setComplaints(Array.isArray(complaintsRes.data) ? complaintsRes.data : []);
        setWorkers(Array.isArray(workersRes.data) ? workersRes.data : []);
        const [activitiesRes, summaryRes] = await Promise.all([
          adminApi.getActivities(8),
          adminApi.getSecuritySummary(),
        ]);
        setActivityItems(Array.isArray(activitiesRes.data) ? activitiesRes.data : []);
        setSecuritySummary(summaryRes.data || { last24Hours: { criticalCount: 0, warningCount: 0 }, topActions: [] });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load admin overview');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const metrics = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter((item) => ['Submitted', 'Under Review', 'In Progress'].includes(item.status)).length;
    const resolved = complaints.filter((item) => item.status === 'Resolved').length;
    const highPriority = complaints.filter((item) => item.priority === 'High').length;
    const busyWorkers = workers.filter((item) => !item.isAvailable).length;
    const categoryBreakdown = Object.entries(
      complaints.reduce((acc, item) => {
        const key = item.category || 'General';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { total, pending, resolved, highPriority, busyWorkers, categoryBreakdown };
  }, [complaints, workers]);

  if (loading) {
    return <p className="p-6 text-slate-600">Loading administrative dashboard...</p>;
  }

  return (
    <section className="space-y-5 page-enter">
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="blue-panel rounded-[28px] px-5 py-5 md:px-6 md:py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Administrative command deck</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">Real government dashboard layout for complaint operations</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50 md:text-base">
            This overview gives administrators a top-layer command view before moving into worker assignment, complaint review,
            and status action workflows.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#123b83] transition hover:bg-blue-50">
              Open Admin Operations
            </Link>
            <Link to="/dashboard" className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              View Unified Dashboard
            </Link>
          </div>
        </div>

        <div className="gov-layout-preview p-4">
          <div className="gov-map-grid absolute inset-0 opacity-25" />
          <div className="relative grid h-full gap-3 rounded-[22px] border border-white/10 bg-white/8 p-4 md:grid-cols-[0.34fr_0.66fr]">
            <div className="rounded-2xl bg-[#0d2344]/75 p-3 text-white">
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100">Navigation</p>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-white/10 px-3 py-2 text-xs">Overview</div>
                <div className="rounded-xl bg-white/10 px-3 py-2 text-xs">Complaint queue</div>
                <div className="rounded-xl bg-white/10 px-3 py-2 text-xs">Worker assignment</div>
                <div className="rounded-xl bg-white/10 px-3 py-2 text-xs">Reports</div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl bg-[#eef4ff] p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-3 shadow-sm" />
                <div className="rounded-2xl bg-white p-3 shadow-sm" />
                <div className="rounded-2xl bg-white p-3 shadow-sm" />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="h-28 rounded-2xl bg-gradient-to-r from-[#d8e6ff] to-white" />
                <div className="h-28 rounded-2xl bg-white shadow-sm" />
              </div>
              <div className="h-20 rounded-2xl bg-white shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="gov-card rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total complaints" value={metrics.total} />
        <MetricCard label="Pending queue" value={metrics.pending} tone="text-amber-700" />
        <MetricCard label="Resolved" value={metrics.resolved} tone="text-emerald-700" />
        <MetricCard label="High priority" value={metrics.highPriority} tone="text-rose-700" />
        <MetricCard label="Busy workers" value={metrics.busyWorkers} tone="text-blue-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="gov-card rounded-[28px] p-5">
          <p className="gov-kicker">Top categories</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-800">Where service pressure is building</h2>
          <div className="mt-4 space-y-3">
            {metrics.categoryBreakdown.length > 0 ? (
              metrics.categoryBreakdown.map(([label, value], index) => (
                <div key={label} className="gov-card-muted rounded-2xl px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rank {index + 1}</p>
                      <p className="mt-1 text-lg font-bold text-slate-800">{label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-slate-800">{value}</p>
                      <p className="text-xs text-slate-500">registered cases</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No complaints available yet.</p>
            )}
          </div>
        </div>

        <div className="gov-card rounded-[28px] p-5">
          <p className="gov-kicker">Operational recommendations</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-800">Suggested admin actions</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              Review high-priority complaints first and route them to available workers with matching specialties.
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              Watch pending queue growth in categories with the highest complaint concentration.
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              Use the operations panel to move cases from review to assignment without leaving the dashboard shell.
            </div>
          </div>
        </div>

      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="gov-card rounded-[28px] p-5">
          <p className="gov-kicker">Admin security summary (24h)</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-800">Governance risk pulse</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Critical events</p>
              <p className="mt-2 text-3xl font-extrabold text-rose-800">{securitySummary?.last24Hours?.criticalCount || 0}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Warning events</p>
              <p className="mt-2 text-3xl font-extrabold text-amber-800">{securitySummary?.last24Hours?.warningCount || 0}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(securitySummary?.topActions || []).length ? (
              securitySummary.topActions.map((item) => (
                <div key={item.action} className="gov-card-muted rounded-xl px-3 py-2 text-sm text-slate-700 flex justify-between">
                  <span>{item.action}</span>
                  <span className="font-bold">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No security events in the last 24 hours.</p>
            )}
          </div>
        </div>

        <div className="gov-card rounded-[28px] p-5">
          <p className="gov-kicker">Recent admin activity</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-800">Action timeline</h2>
          <div className="mt-4 space-y-2 max-h-[320px] overflow-auto pr-1">
            {activityItems.length ? (
              activityItems.map((item) => (
                <div key={item._id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{item.action}</p>
                    <span
                      className={`text-[10px] uppercase tracking-[0.12em] font-bold ${
                        item.severity === 'critical'
                          ? 'text-rose-700'
                          : item.severity === 'warning'
                          ? 'text-amber-700'
                          : 'text-blue-700'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.adminUserId?.name || 'Admin'} • {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No admin activity found.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminDashboard;