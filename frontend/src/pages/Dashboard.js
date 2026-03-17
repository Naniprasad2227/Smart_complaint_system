import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import { complaintApi } from '../services/api';
import EnhancedAnalyticsPanel from '../components/EnhancedAnalyticsPanel';
import { createLocalComplaint, prependLocalComplaint, readLocalComplaints } from '../services/localComplaints';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

const PIE_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#84cc16'];

const initialForm = {
  complaintTitle: '',
  complaintDescription: '',
  category: 'General',
  priority: 'Medium',
  department: 'General',
};

const getMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
};

const buildTrendSeries = (complaints) => {
  const counts = complaints.reduce((acc, complaint) => {
    const key = getMonthKey(complaint.createdAt || Date.now());
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const lastKeys = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    lastKeys.push(key);
  }

  return {
    labels: lastKeys.map(formatMonthLabel),
    data: lastKeys.map((key) => counts[key] || 0),
  };
};

const StatCard = ({ label, value, subtext }) => (
  <div className="gov-card rounded-[24px] p-4">
    <p className="gov-kicker">{label}</p>
    <p className="mt-2 text-3xl font-extrabold text-slate-800">{value}</p>
    {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
  </div>
);

const Dashboard = ({ user }) => {
  const [form, setForm] = useState(initialForm);
  const [complaints, setComplaints] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = user?.role === 'admin';

  const loadDashboard = async () => {
    try {
      setError('');
      const complaintsReq = isAdmin ? complaintApi.getAll() : complaintApi.getMine();
      const analyticsReq = isAdmin ? complaintApi.getAnalytics() : Promise.resolve({ data: null });
      const [complaintsRes, analyticsRes] = await Promise.all([complaintsReq, analyticsReq]);
      setComplaints(Array.isArray(complaintsRes.data) ? complaintsRes.data : []);
      setAnalytics(analyticsRes?.data || null);
    } catch (err) {
      const localItems = readLocalComplaints();
      setComplaints(localItems);
      setAnalytics(null);
      setError('Unable to load dashboard data. Showing saved complaint records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [isAdmin]);

  const summary = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((item) => item.status === 'Resolved').length;
    const closed = complaints.filter((item) => item.status === 'Closed').length;
    const pending = complaints.filter((item) => ['Submitted', 'Under Review', 'In Progress'].includes(item.status)).length;
    const highPriority = complaints.filter((item) => item.priority === 'High').length;

    const categoryCounts = complaints.reduce((acc, item) => {
      const key = item.category || 'General';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const sentimentCounts = complaints.reduce((acc, item) => {
      const key = item.sentiment || 'Neutral';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
    const trend = buildTrendSeries(complaints);

    return {
      total,
      resolved,
      closed,
      pending,
      highPriority,
      categoryCounts,
      sentimentCounts,
      topCategory,
      trend,
    };
  }, [complaints]);

  const pieData = useMemo(() => ({
    labels: Object.keys(summary.categoryCounts),
    datasets: [
      {
        data: Object.values(summary.categoryCounts),
        backgroundColor: PIE_COLORS,
        borderWidth: 0,
      },
    ],
  }), [summary.categoryCounts]);

  const lineData = useMemo(() => ({
    labels: summary.trend.labels,
    datasets: [
      {
        label: 'Complaints',
        data: summary.trend.data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.15)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#1d4ed8',
        pointRadius: 4,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
    ],
  }), [summary.trend]);

  const avgResolutionDays = useMemo(() => {
    const resolvedItems = complaints.filter((item) => item.status === 'Resolved');
    if (!resolvedItems.length) return '0.0';
    const totalDays = resolvedItems.reduce((acc, item) => {
      const created = new Date(item.createdAt || Date.now()).getTime();
      const updated = new Date(item.updatedAt || item.createdAt || Date.now()).getTime();
      return acc + Math.max(0, (updated - created) / 86400000);
    }, 0);
    return (totalDays / resolvedItems.length).toFixed(1);
  }, [complaints]);

  const topIssueList = useMemo(
    () => Object.entries(summary.categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3),
    [summary.categoryCounts]
  );

  const negativePercent = useMemo(() => {
    const negative = summary.sentimentCounts.Negative || 0;
    if (!summary.total) return 0;
    return Math.round((negative / summary.total) * 100);
  }, [summary.sentimentCounts, summary.total]);

  const resolutionRate = useMemo(() => {
    if (!summary.total) return 0;
    return Math.round((summary.resolved / summary.total) * 100);
  }, [summary.resolved, summary.total]);

  const aiPriorityMessage = useMemo(() => {
    if (!summary.total) return 'No complaint volume yet. AI insights will appear as records grow.';
    if (negativePercent >= 50 || summary.highPriority >= 5) {
      return 'Escalation recommended: negative sentiment and high-priority load are above baseline.';
    }
    if (summary.pending >= summary.resolved) {
      return 'Backlog risk detected: pending complaints are outpacing resolved cases.';
    }
    return 'Service flow is stable: resolution pace is within expected range today.';
  }, [negativePercent, summary.highPriority, summary.pending, summary.resolved, summary.total]);

  const sentimentMiniData = useMemo(() => {
    const labels = topIssueList.map(([label]) => label).slice(0, 3);
    const values = topIssueList.map(([, value]) => value).slice(0, 3);
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#38bdf8', '#60a5fa', '#93c5fd'],
          borderRadius: 4,
        },
      ],
    };
  }, [topIssueList]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      await complaintApi.submit({
        complaintTitle: form.complaintTitle,
        complaintDescription: form.complaintDescription,
        category: form.category,
        priority: form.priority,
        department: form.department,
      });

      setSuccess('Complaint submitted successfully.');
      setForm(initialForm);
      await loadDashboard();
    } catch (err) {
      const localComplaint = createLocalComplaint(form);
      const nextItems = prependLocalComplaint(localComplaint);
      setComplaints(nextItems);
      setSuccess('Complaint saved locally (simple mode).');
      setForm(initialForm);
      setError('');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-slate-600">Loading dashboard...</p>;
  }

  return (
    <section className="page-enter space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="blue-panel rounded-[28px] px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
                {isAdmin ? 'Administrative command dashboard' : 'Citizen grievance dashboard'}
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
                {isAdmin ? 'Department oversight and service response control' : 'Track public complaints with AI-assisted visibility'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50 md:text-base">
                {isAdmin
                  ? 'Monitor incoming complaints, prioritize urgent civic issues, and keep field action measurable across categories and departments.'
                  : 'Submit, monitor, and understand complaint progress through a unified public-service workflow designed for fast administrative action.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[310px]">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Top issue cluster</p>
                <p className="mt-2 text-2xl font-extrabold text-white">{summary.topCategory}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Negative sentiment</p>
                <p className="mt-2 text-2xl font-extrabold text-white">{negativePercent}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="gov-card rounded-[28px] p-5">
          <p className="gov-kicker">Operational posture</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-800">Daily service summary</h2>
          <div className="mt-4 space-y-3">
            <div className="gov-card-muted rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Resolved cases</span>
                <span className="text-lg font-extrabold text-emerald-700">{summary.resolved}</span>
              </div>
            </div>
            <div className="gov-card-muted rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Closed cases</span>
                <span className="text-lg font-extrabold text-purple-700">{summary.closed}</span>
              </div>
            </div>
            <div className="gov-card-muted rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Open queue</span>
                <span className="text-lg font-extrabold text-amber-700">{summary.pending}</span>
              </div>
            </div>
            <div className="gov-card-muted rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Average resolution</span>
                <span className="text-lg font-extrabold text-blue-700">{avgResolutionDays} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Complaints" value={summary.total} />
        <StatCard label="Closed Complaints" value={summary.closed} subtext="Cases marked as fully closed" />
        <StatCard label="Pending Complaints" value={summary.pending} subtext="Submitted, under review, in progress" />
        <StatCard label="Resolved Complaints" value={summary.resolved} subtext={`${summary.total ? ((summary.resolved / summary.total) * 100).toFixed(1) : 0}% closure rate`} />
        <StatCard label="High Priority" value={summary.highPriority} subtext="Cases needing immediate intervention" />
      </div>

      {(error || success) && (
        <div className="gov-card rounded-2xl px-4 py-3">
          {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="gov-card rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="gov-kicker">Category analysis</p>
              <h3 className="mt-1 text-2xl font-extrabold text-slate-800">Complaint distribution and trend</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Last 6 months</div>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="mx-auto h-[220px] w-full max-w-[280px]">
              {pieData.labels.length > 0 ? (
                <Pie
                  data={pieData}
                  options={{
                    maintainAspectRatio: false,
                    cutout: '48%',
                    plugins: { legend: { display: false } },
                  }}
                />
              ) : (
                <p className="text-sm text-slate-500">No category data to visualize.</p>
              )}
            </div>

            <div className="space-y-2">
              {pieData.labels.map((label, index) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span>{label}</span>
                  </div>
                  <span className="font-semibold text-slate-500">{pieData.datasets[0].data[index]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="my-5 h-px bg-slate-200" />

          <h3 className="text-xl font-extrabold text-slate-800">Monthly complaints trend</h3>
          <div className="mt-3 h-[230px]">
            <Line
              data={lineData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 11 } },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0, stepSize: 1, color: '#64748b', font: { size: 11 } },
                    grid: { color: 'rgba(148, 163, 184, 0.22)' },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="gov-card rounded-[28px] overflow-hidden">
            <div className="bg-gradient-to-r from-[#133566] via-[#1d4fa3] to-[#2c67bb] px-5 py-4">
              <h3 className="text-2xl font-extrabold text-white">AI insights</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-base font-bold text-slate-700">Top issue clusters</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {topIssueList.length > 0 ? (
                  topIssueList.map(([name, value], index) => (
                    <div key={name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3">
                      <span className="font-semibold">{index + 1}. {name}</span>
                      <span className="text-xs font-bold text-slate-500">{value} cases</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No issue data yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="gov-card rounded-[28px] overflow-hidden">
            <div className="bg-gradient-to-r from-[#133566] via-[#1d4fa3] to-[#2c67bb] px-5 py-4">
              <h3 className="text-xl font-extrabold text-white">Sentiment analysis</h3>
            </div>
            <div className="px-5 py-4">
              <p className="rounded-2xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700">Negative complaints {negativePercent}%</p>
              <div className="mt-3 h-[120px]">
                {sentimentMiniData.labels.length > 0 ? (
                  <Bar
                    data={sentimentMiniData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { display: false, grid: { display: false }, beginAtZero: true },
                      },
                    }}
                  />
                ) : (
                  <p className="text-sm text-slate-500">No sentiment data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="gov-card rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="gov-kicker">Citizen intake</p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">Complaint submission form</h2>
              </div>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">AI assisted</div>
            </div>

            {isAdmin ? (
              <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Admin mode: complaint submission is available for citizen users. Use analytics and case routing controls below.
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                name="complaintTitle"
                value={form.complaintTitle}
                onChange={handleChange}
                required
                disabled={isAdmin}
                placeholder="Complaint title"
                className="gov-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                disabled={isAdmin}
                className="gov-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option>General</option>
                <option>Water</option>
                <option>Electricity</option>
                <option>Roads</option>
                <option>Sanitation</option>
                <option>Other</option>
              </select>

              <textarea
                name="complaintDescription"
                value={form.complaintDescription}
                onChange={handleChange}
                required
                disabled={isAdmin}
                rows={4}
                placeholder="Describe your complaint"
                className="gov-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 md:col-span-2"
              />

              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                disabled={isAdmin}
                className="gov-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>

              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                disabled={isAdmin}
                className="gov-input px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option>General</option>
                <option>Municipality</option>
                <option>Electricity Board</option>
                <option>Water Board</option>
                <option>Road & Transport</option>
                <option>Sanitation Department</option>
              </select>

              <button
                type="submit"
                disabled={submitting || isAdmin}
                className="gov-button-primary rounded-2xl px-4 py-2.5 text-sm font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
              >
                {submitting ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </form>
          </div>

          <div className="gov-card rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="gov-kicker">Records</p>
                <h2 className="text-lg font-bold text-slate-800">Complaint table</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Showing latest 8</div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Priority</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.slice(0, 8).map((item) => (
                    <tr key={item._id} className="border-b border-slate-100 text-slate-700">
                      <td className="px-2 py-2 font-semibold">{item.complaintTitle || 'Untitled complaint'}</td>
                      <td className="px-2 py-2">{item.category || 'General'}</td>
                      <td className="px-2 py-2">{item.priority || 'Medium'}</td>
                      <td className="px-2 py-2">{item.status || 'Submitted'}</td>
                      <td className="px-2 py-2">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {analytics || isAdmin ? (
            <div className="gov-card rounded-[28px] p-5">
              <p className="gov-kicker">Department analytics</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-800">Admin analytics dashboard</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="gov-card-muted rounded-2xl px-4 py-3">Total users: {analytics?.totalUsers ?? 'N/A'}</div>
                <div className="gov-card-muted rounded-2xl px-4 py-3">Total complaints: {analytics?.totalComplaints ?? summary.total}</div>
                <div className="gov-card-muted rounded-2xl px-4 py-3">Resolved complaints: {analytics?.resolvedComplaints ?? summary.resolved}</div>
                <div className="gov-card-muted rounded-2xl px-4 py-3">Resolution rate: {resolutionRate}%</div>
              </div>
            </div>
          ) : null}

          <div className="gov-card rounded-[28px] p-5">
            <p className="gov-kicker">Response focus</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-800">What needs attention today</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                AI insight: {aiPriorityMessage}
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                High-priority queue: {summary.highPriority} cases awaiting urgent attention.
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Top complaint category: {summary.topCategory}.
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Pending action count: {summary.pending} complaints.
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Enhanced Analytics for Admin */}
      {isAdmin && (
        <div className="space-y-5">
          <div className="gov-card rounded-[28px] p-6">
            <p className="gov-kicker">Advanced analytics</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-800">
              💡 Enhanced Performance Metrics
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Detailed SLA compliance, worker performance, and trend analysis
            </p>
          </div>
          <EnhancedAnalyticsPanel user={user} />
        </div>
      )}
    </section>
  );
};

export default Dashboard;