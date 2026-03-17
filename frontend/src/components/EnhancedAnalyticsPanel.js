import React, { useState, useEffect } from 'react';
import { complaintApi } from '../services/api';
import { Line, Bar } from 'react-chartjs-2';

const EnhancedAnalyticsPanel = ({ user }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [responseMetrics, setResponseMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEnhancedAnalytics = async () => {
      try {
        setLoading(true);
        const [analytics, response] = await Promise.all([
          complaintApi.getEnhancedAnalytics(),
          complaintApi.getResponseMetrics(),
        ]);

        setAnalyticsData(analytics.data);
        setResponseMetrics(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load enhanced analytics');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchEnhancedAnalytics();
    }
  }, [user]);

  if (!user?.role === 'admin' || !analyticsData) {
    return null;
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-600">Loading enhanced analytics...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  const { summary, byPriority, categoryTrend, monthlyTrend, workerPerformance } =
    analyticsData || {};

  // Monthly trend chart
  const monthlyChartData = {
    labels: monthlyTrend?.map((m) => m.month) || [],
    datasets: [
      {
        label: 'Total Complaints',
        data: monthlyTrend?.map((m) => m.total) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Resolved',
        data: monthlyTrend?.map((m) => m.resolved) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gov-card p-6 bg-red-50 border-l-4 border-red-500">
          <h3 className="text-sm text-gray-600 font-semibold mb-2">High Priority</h3>
          <p className="text-3xl font-bold text-red-600">{summary?.highPriorityCount || 0}</p>
          <p className="text-xs text-gray-500 mt-2">Requiring immediate attention</p>
        </div>

        <div className="gov-card p-6 bg-green-50 border-l-4 border-green-500">
          <h3 className="text-sm text-gray-600 font-semibold mb-2">SLA Compliance</h3>
          <p className="text-3xl font-bold text-green-600">{summary?.slaComplianceRate || 0}%</p>
          <p className="text-xs text-gray-500 mt-2">Resolved within 48 hours</p>
        </div>

        <div className="gov-card p-6 bg-blue-50 border-l-4 border-blue-500">
          <h3 className="text-sm text-gray-600 font-semibold mb-2">Avg Resolution</h3>
          <p className="text-3xl font-bold text-blue-600">{summary?.avgResolutionHours || 0}h</p>
          <p className="text-xs text-gray-500 mt-2">Hours to resolve</p>
        </div>

        <div className="gov-card p-6 bg-purple-50 border-l-4 border-purple-500">
          <h3 className="text-sm text-gray-600 font-semibold mb-2">Max Resolution</h3>
          <p className="text-3xl font-bold text-purple-600">{summary?.maxResolutionHours || 0}h</p>
          <p className="text-xs text-gray-500 mt-2">Longest resolution time</p>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="gov-card p-6">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Monthly Trend</h2>
        <div className="h-80">
          <Line
            data={monthlyChartData}
            options={{
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' },
              },
            }}
          />
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="gov-card p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Complaints by Priority
          </h2>
          <div className="space-y-3">
            {byPriority?.map((item) => (
              <div key={item._id} className="flex items-center justify-between">
                <span
                  className={`font-semibold px-3 py-1 rounded text-white ${
                    item._id === 'High'
                      ? 'bg-red-500'
                      : item._id === 'Medium'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                >
                  {item._id}
                </span>
                <div className="flex-1 ml-4 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item._id === 'High'
                        ? 'bg-red-500'
                        : item._id === 'Medium'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${
                        ((item.count /
                          (byPriority?.reduce((sum, p) => sum + p.count, 0) || 1)) *
                          100)
                      }%`,
                    }}
                  ></div>
                </div>
                <span className="font-semibold text-gray-800 ml-2 w-12 text-right">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Categories */}
        <div className="gov-card p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Top Categories (30 Days)
          </h2>
          <div className="space-y-3">
            {categoryTrend?.map((item, idx) => (
              <div key={item._id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-gray-700">{item._id}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Response Metrics */}
      <div className="gov-card p-6">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Response Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">
              {responseMetrics?.awaitingAction || 0}
            </p>
            <p className="text-gray-600 text-sm">Awaiting Action</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">
              {responseMetrics?.reopenedComplaints || 0}
            </p>
            <p className="text-gray-600 text-sm">Reopened Cases</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {responseMetrics?.escalatedComplaints || 0}
            </p>
            <p className="text-gray-600 text-sm">Escalated Cases</p>
          </div>
        </div>
      </div>

      {/* Worker Performance */}
      {workerPerformance && workerPerformance.length > 0 && (
        <div className="gov-card p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Worker Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-700">Worker ID</th>
                  <th className="px-4 py-2 text-center text-gray-700">Total</th>
                  <th className="px-4 py-2 text-center text-gray-700">Resolved</th>
                  <th className="px-4 py-2 text-center text-gray-700">In Progress</th>
                  <th className="px-4 py-2 text-right text-gray-700">Resolution Rate</th>
                </tr>
              </thead>
              <tbody>
                {workerPerformance.map((worker, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold">
                      {worker.workerId.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">
                      {worker.total}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        {worker.resolved}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        {worker.inProgress}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="font-semibold text-gray-800">
                        {Math.round(worker.resolutionRate)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAnalyticsPanel;
