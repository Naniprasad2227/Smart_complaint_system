import React, { useEffect, useState } from 'react';
import ComplaintCard from '../components/ComplaintCard';
import { complaintApi } from '../services/api';
import WorkflowTimeline from '../components/WorkflowTimeline';
import NotificationPopup from '../components/NotificationPopup';
import { readLocalComplaints } from '../services/localComplaints';

const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState('');
  const [detectionResults, setDetectionResults] = useState({});
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await complaintApi.getMine();
        setComplaints(data);
      } catch (err) {
        setComplaints(readLocalComplaints());
        setError('Unable to load saved complaints. Showing local records.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <p>Loading complaints...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const handleUpload = async (complaintId, file) => {
    if (!file) return;

    setUploadingId(complaintId);
    setError('');

    try {
      // Detect image with AI first, then attach to complaint
      const [, detectionResult] = await Promise.allSettled([
        complaintApi.uploadImage(complaintId, file),
        complaintApi.detectImage(file),
      ]);

      if (detectionResult.status === 'fulfilled' && detectionResult.value?.data) {
        const d = detectionResult.value.data;
        if (d.detected_issue && d.confidence > 0) {
          setDetectionResults((prev) => ({
            ...prev,
            [complaintId]: d,
          }));
        }
      }

      const { data } = await complaintApi.getMine();
      setComplaints(data);
      setNotification({ open: true, message: 'Image uploaded successfully.', type: 'success' });
    } catch (err) {
      setError(err.response?.data?.message || 'Image upload is unavailable in simple mode');
      setNotification({
        open: true,
        message: err.response?.data?.message || 'Image upload is unavailable in simple mode',
        type: 'error',
      });
    } finally {
      setUploadingId('');
    }
  };

  return (
    <div className="space-y-3 page-enter">
      <NotificationPopup
        open={notification.open}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
      />

      <div className="app-surface flex items-center justify-between rounded-md px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">My Complaints</h2>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="text-sm">○</span>
          <span className="text-sm">◔</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#214f9c] text-xs font-bold text-white">U</span>
        </div>
      </div>
      {complaints.length === 0 && <p className="text-slate-600">No complaints yet.</p>}
      {complaints.map((complaint) => (
        <div key={complaint._id}>
          <ComplaintCard
            complaint={complaint}
            actions={
              <div className="flex items-center gap-2">
                <label className="text-xs bg-slate-100 border border-slate-300 rounded px-2 py-1 cursor-pointer hover:bg-slate-200">
                  {uploadingId === complaint._id ? 'Uploading...' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingId === complaint._id}
                    onChange={(event) => handleUpload(complaint._id, event.target.files?.[0])}
                  />
                </label>
                <span className="text-xs text-slate-500">
                  {complaint.images?.length ? `${complaint.images.length} image(s)` : 'No images'}
                </span>
              </div>
            }
          />
          {detectionResults[complaint._id] && (
            <div className="mt-2 ml-1 mr-1 p-3 bg-[#eef3ff] border border-[#c9dafb] rounded-lg text-sm">
              <p className="font-semibold text-indigo-700">
                🤖 AI Image Detection: {detectionResults[complaint._id].detected_issue}
              </p>
              <p className="text-slate-600 mt-1">
                Category: <strong>{detectionResults[complaint._id].category}</strong> · Priority:{' '}
                <strong>{detectionResults[complaint._id].priority}</strong> · Confidence:{' '}
                {Math.round((detectionResults[complaint._id].confidence || 0) * 100)}%
              </p>
              <p className="text-slate-500 italic mt-1">{detectionResults[complaint._id].suggestion}</p>
            </div>
          )}
          <div className="mt-2 ml-1 mr-1">
            <WorkflowTimeline status={complaint.status} compact />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyComplaints;
