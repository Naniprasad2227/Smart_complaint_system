import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { getCurrentLocationFields } from '../services/location';

const ProfileRow = ({ label, value }) => (
  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100 last:border-b-0">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-sm text-slate-800">{value || '-'}</p>
  </div>
);

const Profile = ({ user, onLogout, onUserUpdate }) => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    country: user?.country || '',
    state: user?.state || '',
    district: user?.district || '',
    mandal: user?.mandal || '',
    village: user?.village || '',
  });

  const joinedDate = useMemo(() => {
    if (!user?.createdAt) return 'N/A';
    return new Date(user.createdAt).toLocaleDateString();
  }, [user?.createdAt]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout?.();
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleEditToggle = () => {
    setError('');
    setSuccess('');
    setIsEditing((prev) => !prev);
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      country: user?.country || '',
      state: user?.state || '',
      district: user?.district || '',
      mandal: user?.mandal || '',
      village: user?.village || '',
    });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const normalizedMobile = String(form.phone || '').replace(/\D/g, '');
      if (!/^\d{10}$/.test(normalizedMobile)) {
        setError('Mobile number must be exactly 10 digits');
        setSaving(false);
        return;
      }

      const { data } = await authApi.updateProfile(form);
      onUserUpdate?.(data.user);
      setSuccess(
        data.user?.mobileVerified
          ? 'Profile updated successfully.'
          : 'Profile updated. Please verify your mobile number with OTP.'
      );
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setError('');
    setSuccess('');
    try {
      const locationData = await getCurrentLocationFields();
      setForm((prev) => ({
        ...prev,
        ...locationData,
      }));
      setSuccess('Current location applied. Verify fields and save changes.');
    } catch (err) {
      setError(err.message || 'Failed to detect current location');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setRequestingOtp(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await authApi.requestMobileOtp();
      setOtpCooldown(Number(data?.resendAvailableInSeconds || 30));
      setSuccess('OTP sent successfully to your mobile number.');
    } catch (err) {
      const retryAfterSeconds = Number(err.response?.data?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        setOtpCooldown(retryAfterSeconds);
      }
      setError(err.response?.data?.message || 'Failed to request OTP');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setVerifyingOtp(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await authApi.verifyMobileOtp(otpCode);
      onUserUpdate?.(data.user);
      setOtpCode('');
      setOtpCooldown(0);
      setSuccess('Mobile number verified successfully.');
    } catch (err) {
      const attemptsRemaining = Number(err.response?.data?.attemptsRemaining);
      const retryAfterSeconds = Number(err.response?.data?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        setOtpCooldown(retryAfterSeconds);
      }
      if (!Number.isNaN(attemptsRemaining) && attemptsRemaining >= 0) {
        setError(`${err.response?.data?.message || 'Failed to verify OTP'} (${attemptsRemaining} attempts left)`);
      } else {
        setError(err.response?.data?.message || 'Failed to verify OTP');
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleDeactivateAccount = async () => {
    const reason = window.prompt('Optional: enter a reason for account deactivation (or leave blank).', '');
    const confirmDeactivate = window.confirm(
      'Deactivate this account? Your complaints and history will be retained, but you will not be able to log in until an admin reactivates it.'
    );
    if (!confirmDeactivate) return;

    setDeactivating(true);
    setError('');
    setSuccess('');
    try {
      await authApi.deactivateAccount({ reason: String(reason || '').trim() });
      await onLogout?.();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate account');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="page-enter space-y-4">
      <div className="app-surface flex items-center justify-between rounded-md px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">Profile</h2>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="text-sm">○</span>
          <span className="text-sm">◔</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#214f9c] text-xs font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>
      </div>

      <div className="app-surface rounded-lg p-4 md:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#214f9c] text-white text-lg font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{user?.name || 'User'}</h3>
            <p className="text-xs text-slate-500">Profile details</p>
          </div>
        </div>

        {!isEditing ? (
          <div>
            <ProfileRow label="Name" value={user?.name} />
            <ProfileRow label="Email" value={user?.email} />
            <ProfileRow label="Mobile Number" value={user?.phone} />
            <ProfileRow label="Role" value={user?.role} />
            <ProfileRow label="Country" value={user?.country} />
            <ProfileRow label="State" value={user?.state} />
            <ProfileRow label="District" value={user?.district} />
            <ProfileRow label="Mandal" value={user?.mandal} />
            <ProfileRow label="Village" value={user?.village} />
            <ProfileRow label="Joined" value={joinedDate} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locationLoading}
              className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {locationLoading ? 'Detecting current location...' : 'Use Current Location'}
            </button>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Name"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Mobile Number"
                maxLength={10}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <input
                type="text"
                name="country"
                value={form.country}
                onChange={handleChange}
                placeholder="Country"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="State"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <input
                type="text"
                name="district"
                value={form.district}
                onChange={handleChange}
                placeholder="District"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <input
                type="text"
                name="mandal"
                value={form.mandal}
                onChange={handleChange}
                placeholder="Mandal"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>
            <input
              type="text"
              name="village"
              value={form.village}
              onChange={handleChange}
              placeholder="Village"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              required
            />

            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-[#214f9c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4388] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleEditToggle}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {success && !isEditing ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile verification</p>
              <p className="text-sm font-semibold text-slate-700">
                Status: {user?.mobileVerified ? 'Verified' : 'Not verified'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={requestingOtp || otpCooldown > 0}
              className="rounded border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              {requestingOtp ? 'Sending OTP...' : otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : 'Send OTP'}
            </button>
          </div>

          {!user?.mobileVerified ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.length !== 6}
                className="rounded bg-[#214f9c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1a4388] disabled:opacity-60"
              >
                {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={handleEditToggle}
              className="rounded border border-[#214f9c] bg-white px-4 py-2 text-sm font-semibold text-[#214f9c] hover:bg-blue-50"
            >
              Edit Profile
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded bg-[#214f9c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4388] disabled:opacity-60"
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
          <button
            type="button"
            onClick={handleDeactivateAccount}
            disabled={deactivating}
            className="rounded border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            {deactivating ? 'Deactivating...' : 'Deactivate Account'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;
