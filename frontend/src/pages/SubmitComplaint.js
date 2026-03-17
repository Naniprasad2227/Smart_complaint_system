import React, { useEffect, useMemo, useState } from 'react';
import { complaintApi } from '../services/api';
import { getCurrentLocationFields } from '../services/location';
import WorkflowTimeline from '../components/WorkflowTimeline';
import NotificationPopup from '../components/NotificationPopup';
import { createLocalComplaint, prependLocalComplaint, readLocalComplaints } from '../services/localComplaints';

const SubmitComplaint = () => {
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [adminCheck, setAdminCheck] = useState(null);
  const [mobileVerified] = useState(true);
  const [latestSubmitted, setLatestSubmitted] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [location, setLocation] = useState({
    country: '',
    state: '',
    district: '',
    mandal: '',
    village: '',
    fullAddress: '',
  });

  useEffect(() => {
    const loadComplaints = async () => {
      try {
        const { data } = await complaintApi.getMine();
        setComplaints(data);
      } catch (_error) {
        setComplaints(readLocalComplaints());
      }
    };

    const loadAdminCheck = async () => {
      try {
        const { data } = await complaintApi.adminCheck();
        setAdminCheck(data);
      } catch (_error) {
        // non-critical
      }
    };

    loadComplaints();
    loadAdminCheck();
  }, []);

  const statusCounts = useMemo(() => {
    return {
      Submitted: complaints.filter((item) => item.status === 'Submitted').length,
      'Under Review': complaints.filter((item) => item.status === 'Under Review').length,
      'In Progress': complaints.filter((item) => item.status === 'In Progress').length,
      Resolved: complaints.filter((item) => item.status === 'Resolved').length,
    };
  }, [complaints]);

  const recentComplaints = complaints.slice(0, 4);

  const showNotification = (message, type = 'info') => {
    setNotification({ open: true, message, type });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setDetection(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDetect = async () => {
    if (!imageFile) return;
    setDetecting(true);
    setDetection(null);
    try {
      const { data } = await complaintApi.detectImage(imageFile);
      setDetection(data);
      if (data.suggestion && complaintDescription.trim().length === 0) {
        setComplaintDescription(data.suggestion);
      }
    } catch (err) {
      setDetection({ detected_issue: 'Detection failed', suggestion: err.response?.data?.message || 'Service unavailable' });
    } finally {
      setDetecting(false);
    }
  };

  const handleLocationChange = (event) => {
    const { name, value } = event.target;
    setLocation((prev) => ({ ...prev, [name]: value }));
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const locationData = await getCurrentLocationFields();
      setLocation((prev) => ({
        ...prev,
        ...locationData,
      }));
      showNotification('Current location detected and applied to the form.', 'info');
    } catch (err) {
      showNotification(err.message || 'Failed to detect current location', 'error');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      let submitResponse;
      const requiredLocationFields = ['country', 'state', 'district', 'mandal', 'village'];
      const missingLocation = requiredLocationFields.some((field) => !String(location[field] || '').trim());
      if (missingLocation) {
        showNotification('Please provide complete location (country, state, district, mandal, village).', 'error');
        setLoading(false);
        return;
      }

      submitResponse = await complaintApi.submit({
        complaintTitle: complaintTitle.trim(),
        complaintDescription: complaintDescription.trim(),
        location: {
          country: location.country.trim(),
          state: location.state.trim(),
          district: location.district.trim(),
          mandal: location.mandal.trim(),
          village: location.village.trim(),
          fullAddress: location.fullAddress.trim(),
        },
      });
      const { data } = await complaintApi.getMine();
      setComplaints(data);
      setLatestSubmitted(submitResponse?.data || null);
      setComplaintTitle('');
      setComplaintDescription('');
      setImageFile(null);
      setImagePreview('');
      setDetection(null);
      setLocation({
        country: '',
        state: '',
        district: '',
        mandal: '',
        village: '',
        fullAddress: '',
      });
      showNotification(
        `Complaint submitted successfully. Routed to admin: ${
          submitResponse?.data?.assignedAdmin?.name || 'assigned admin'
        }. AI classified it as ${submitResponse?.data?.category || 'General'} with ${
          submitResponse?.data?.priority || 'Medium'
        } priority.`
        ,
        'success'
      );
    } catch (err) {
      const localComplaint = createLocalComplaint({
        complaintTitle,
        complaintDescription,
        category: detection?.category || 'General',
        priority: detection?.priority || 'Medium',
        department: detection?.department || 'General',
        location: {
          country: location.country.trim(),
          state: location.state.trim(),
          district: location.district.trim(),
          mandal: location.mandal.trim(),
          village: location.village.trim(),
          fullAddress: location.fullAddress.trim(),
        },
      });
      const nextItems = prependLocalComplaint(localComplaint);
      setComplaints(nextItems);
      setLatestSubmitted(localComplaint);
      setComplaintTitle('');
      setComplaintDescription('');
      setImageFile(null);
      setImagePreview('');
      setDetection(null);
      setLocation({
        country: '',
        state: '',
        district: '',
        mandal: '',
        village: '',
        fullAddress: '',
      });
      showNotification('Complaint saved locally (simple mode).', 'success');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="page-enter space-y-4">
      <NotificationPopup
        open={notification.open}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
      />

      <div className="app-surface flex items-center justify-between rounded-md px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">Submit a Complaint</h2>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="text-sm">○</span>
          <span className="text-sm">◔</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#214f9c] text-xs font-bold text-white">U</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="app-surface rounded-lg p-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Submit a Complaint</h3>
              <p className="mt-1 text-xs text-slate-500">Provide complaint details below.</p>

              <div className="mt-3 rounded-md border border-slate-200 bg-[#f8faff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile verification</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      mobileVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {mobileVerified ? 'Verified' : 'Not verified'}
                  </span>
                </div>

                {!mobileVerified ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-slate-500">OTP is disabled in simple authentication mode.</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Complaint Title</label>
                  <input
                    type="text"
                    value={complaintTitle}
                    onChange={(event) => setComplaintTitle(event.target.value)}
                    placeholder="Street light not working"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                    required
                    minLength={5}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Description</label>
                  <textarea
                    rows={5}
                    value={complaintDescription}
                    onChange={(event) => setComplaintDescription(event.target.value)}
                    placeholder="The street light near the main road is not working for three days."
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                    required
                    minLength={10}
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-[#f8faff] p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Complaint Location</p>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={locationLoading}
                      className="rounded border border-[#2d61b6] px-2.5 py-1 text-[11px] font-semibold text-[#2d61b6] hover:bg-blue-50 disabled:opacity-60"
                    >
                      {locationLoading ? 'Detecting...' : 'Use Current Location'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      type="text"
                      name="country"
                      value={location.country}
                      onChange={handleLocationChange}
                      placeholder="Country"
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                      required
                    />
                    <input
                      type="text"
                      name="state"
                      value={location.state}
                      onChange={handleLocationChange}
                      placeholder="State"
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                      required
                    />
                    <input
                      type="text"
                      name="district"
                      value={location.district}
                      onChange={handleLocationChange}
                      placeholder="District"
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                      required
                    />
                    <input
                      type="text"
                      name="mandal"
                      value={location.mandal}
                      onChange={handleLocationChange}
                      placeholder="Mandal"
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                      required
                    />
                  </div>

                  <input
                    type="text"
                    name="village"
                    value={location.village}
                    onChange={handleLocationChange}
                    placeholder="Village"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                    required
                  />

                  <input
                    type="text"
                    name="fullAddress"
                    value={location.fullAddress}
                    onChange={handleLocationChange}
                    placeholder="Full Address (optional)"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d61b6]"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-[#f8faff] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Attach Optional Image</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="text-xs text-slate-600"
                    />
                    {imageFile && (
                      <button
                        type="button"
                        onClick={handleDetect}
                        disabled={detecting}
                        className="rounded bg-[#2d61b6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#214f9c] disabled:opacity-50"
                      >
                        {detecting ? 'Analyzing...' : 'Analyze'}
                      </button>
                    )}
                  </div>

                  {detection && (
                    <div className={`mt-3 rounded-md border p-3 text-xs ${
                      detection.confidence >= 0.7
                        ? 'border-emerald-200 bg-emerald-50'
                        : detection.confidence > 0
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-red-200 bg-red-50'
                    }`}>
                      <p className="font-semibold text-slate-800">Detected: {detection.detected_issue}</p>
                      {detection.category && (
                        <p className="mt-1 text-slate-600">
                          {detection.category} · {detection.priority} · {detection.department}
                        </p>
                      )}
                      <p className="mt-1 italic text-slate-500">{detection.suggestion}</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="rounded bg-[#2d61b6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#214f9c]"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Complaint'}
                </button>
              </form>

              {adminCheck?.message ? (
                <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  {adminCheck.message}
                </div>
              ) : null}
            </div>

            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-[#f4f7fd] via-[#e6edf9] to-[#d7e4fb] min-h-[280px]">
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0">
                  <div className="absolute right-0 top-0 h-full w-[72%] bg-[linear-gradient(180deg,#eef3fb_0%,#dfe8f8_48%,#e8dccf_100%)]" />
                  <div className="absolute right-10 top-9 h-52 w-36 rounded-[32px] bg-[linear-gradient(180deg,#fff_0%,#f3e8dd_65%,#d4a375_100%)] opacity-95 shadow-xl" />
                  <div className="absolute right-14 top-13 h-18 w-18 rounded-full bg-[radial-gradient(circle_at_40%_35%,#7a4d35_0%,#4e2c1e_75%)]" />
                  <div className="absolute right-6 bottom-0 h-24 w-44 rounded-tl-[58px] bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.78))]" />
                  <div className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.94)_48%,rgba(255,255,255,0.1)_76%,rgba(255,255,255,0)_100%)]" />
                  <div className="absolute left-4 top-5 max-w-[13rem]">
                    <h4 className="text-lg font-bold text-slate-800">Smart complaint desk</h4>
                    <p className="mt-2 text-[11px] text-slate-500">Quickly report and track civic issues.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="app-surface rounded-lg overflow-hidden">
            <div className="bg-[#214f9c] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white">Complaint Status</div>
            <div className="space-y-2 p-3 text-sm">
              {Object.entries(statusCounts).map(([label, count], index) => (
                <div key={label} className="flex items-center justify-between rounded border border-slate-100 bg-white px-2 py-2">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      index === 0 ? 'bg-green-500' : index === 1 ? 'bg-blue-500' : index === 2 ? 'bg-orange-400' : 'bg-rose-500'
                    }`} />
                    {label}
                  </span>
                  <span className="text-xs font-bold text-[#2d61b6]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="app-surface rounded-lg overflow-hidden">
            <div className="bg-[#214f9c] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white">Recent Complaints</div>
            <div className="space-y-2 p-3 text-xs">
              {recentComplaints.length === 0 && <p className="text-slate-500">No complaints yet.</p>}
              {recentComplaints.map((item, index) => (
                <div key={item._id} className="rounded border border-slate-100 bg-white px-2 py-2">
                  <p className="flex items-start gap-2 font-semibold text-slate-700">
                    <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${index % 3 === 0 ? 'bg-rose-500' : index % 3 === 1 ? 'bg-blue-500' : 'bg-lime-500'}`} />
                    <span className="line-clamp-2">{item.complaintTitle || item.complaintText}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="app-surface rounded-lg p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow Preview</p>
            <p className="mt-1 text-xs text-slate-500">
              {latestSubmitted
                ? `Latest complaint status: ${latestSubmitted.status || 'Submitted'}`
                : 'Submit a complaint to view your active workflow progression.'}
            </p>
            <div className="mt-3">
              <WorkflowTimeline status={latestSubmitted?.status || 'Submitted'} compact />
            </div>
          </div>
        </div>
      </div>

      <div className="app-surface rounded-lg p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">My Complaints</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Complaint</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentComplaints.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-slate-500">No complaints found.</td>
                </tr>
              )}
              {recentComplaints.map((item, index) => (
                <tr key={item._id} className="border-b border-slate-100 text-slate-700">
                  <td className="py-2 pr-3">{index + 1}</td>
                  <td className="py-2 pr-3 max-w-[18rem] truncate">{item.complaintTitle || item.complaintText}</td>
                  <td className="py-2 pr-3">{item.category}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      item.priority === 'High'
                        ? 'bg-amber-100 text-amber-700'
                        : item.priority === 'Medium'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      item.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'In Progress'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubmitComplaint;
