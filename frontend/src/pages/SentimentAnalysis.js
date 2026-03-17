import React, { useState, useEffect } from 'react';
import { complaintApi } from '../services/api';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const SentimentAnalysis = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [sentimentData, setSentimentData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSentimentAnalysis = async () => {
      try {
        setLoading(true);
        const response = await complaintApi.getSentimentAnalysis();
        setSentimentData(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load sentiment analysis');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchSentimentAnalysis();
    }
  }, [user]);

  if (!user?.role === 'admin') {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">
          Access restricted. Only admin users can view sentiment analysis.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center">Loading sentiment analysis...</div>;
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  const { distribution, byPriority, trend, negativeComplaints } = sentimentData || {};

  // Prepare pie chart data
  const pieData = {
    labels: distribution?.map((d) => d._id) || [],
    datasets: [
      {
        label: 'Sentiment Distribution',
        data: distribution?.map((d) => d.count) || [],
        backgroundColor: [
          '#10b981', // Positive (Green)
          '#f59e0b', // Neutral (Amber)
          '#ef4444', // Negative (Red)
          '#7c3aed', // Very Negative (Purple)
        ],
        borderColor: '#fff',
        borderWidth: 2,
      },
    ],
  };

  // Prepare sentiment by priority data
  const uniqueStatuses = [...new Set(byPriority?.map((s) => s._id.sentiment) || [])];
  const uniquePriorities = [...new Set(byPriority?.map((s) => s._id.priority) || [])];

  const barData = {
    labels: uniqueStatuses,
    datasets: uniquePriorities.map((priority, idx) => ({
      label: priority,
      data: uniqueStatuses.map((status) => {
        const match = byPriority?.find(
          (s) => s._id.sentiment === status && s._id.priority === priority
        );
        return match?.count || 0;
      }),
      backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444'][idx % 3],
    })),
  };

  return (
    <div className="p-8 bg-white">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">
        Sentiment Analysis Dashboard
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sentiment Distribution */}
        <div className="gov-card p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">
            Sentiment Distribution
          </h2>
          <div className="h-80 flex items-center justify-center">
            <Pie data={pieData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Sentiment by Priority */}
        <div className="gov-card p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">
            Sentiment by Priority
          </h2>
          <div className="h-80">
            <Bar data={barData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Negative Sentiments Requiring Attention */}
      <div className="gov-card p-6 mt-8">
        <h2 className="text-2xl font-semibold mb-6 text-gray-700">
          🚨 Negative Sentiment Complaints (Requiring Attention)
        </h2>
        {negativeComplaints && negativeComplaints.length > 0 ? (
          <div className="space-y-4">
            {negativeComplaints.map((complaint) => (
              <div
                key={complaint._id}
                className="border-l-4 border-red-500 bg-red-50 p-4 rounded"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      {complaint.complaintTitle}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Sentiment: <span className="font-semibold">{complaint.sentiment}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-red-200 text-red-800 text-sm rounded-full font-semibold">
                      {complaint.priority}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(complaint.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-xs">
                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded mr-2">
                    {complaint.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No negative sentiment complaints at the moment.</p>
        )}
      </div>

      {/* Sentiment Trend (Daily) */}
      {trend && trend.length > 0 && (
        <div className="gov-card p-6 mt-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">
            Sentiment Trend (Last 30 Days)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-700">Date</th>
                  <th className="px-4 py-2 text-left text-gray-700">Sentiment</th>
                  <th className="px-4 py-2 text-right text-gray-700">Count</th>
                </tr>
              </thead>
              <tbody>
                {trend.slice(-30).map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{item._id.date}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-white text-xs font-semibold ${
                          item._id.sentiment === 'Positive'
                            ? 'bg-green-500'
                            : item._id.sentiment === 'Negative'
                            ? 'bg-red-500'
                            : item._id.sentiment === 'Very Negative'
                            ? 'bg-red-700'
                            : 'bg-gray-500'
                        }`}
                      >
                        {item._id.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{item.count}</td>
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

export default SentimentAnalysis;
