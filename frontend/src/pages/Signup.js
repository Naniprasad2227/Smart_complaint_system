import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ADMIN_LEVELS, WORKER_SPECIALTIES, signupWithEmailPassword } from '../services/localAuth';
import { getCurrentLocationFields } from '../services/location';

const roleOptions = [
  { value: 'user', label: 'Citizen User' },
  { value: 'admin', label: 'Admin' },
  { value: 'worker', label: 'Worker' },
];

const getLandingRouteForRole = (role) => {
  if (role === 'admin') return '/admin-dashboard';
  if (role === 'worker') return '/worker-dashboard';
  return '/dashboard';
};

const Signup = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    adminLevel: 'village',
    specialty: WORKER_SPECIALTIES[0],
    country: '',
    state: '',
    district: '',
    mandal: '',
    village: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'role' && value !== 'admin' ? { adminLevel: 'village' } : {}),
    }));
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setError('');
    try {
      const location = await getCurrentLocationFields();
      setForm((prev) => ({
        ...prev,
        country: location.country || '',
        state: location.state || '',
        district: location.district || '',
        mandal: location.mandal || '',
        village: location.village || '',
      }));
    } catch (err) {
      setError(err.message || 'Failed to detect current location');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = signupWithEmailPassword(form);
      onAuthSuccess(payload);
      navigate(getLandingRouteForRole(payload?.user?.role));
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 relative z-10">
      <form onSubmit={handleSubmit} className="page-enter app-surface w-full max-w-3xl rounded-2xl p-7 space-y-4 relative z-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Create Account</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Join Smart Complaint Hub</h1>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Gmail"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder="Mobile Number"
            value={form.phone}
            onChange={handleChange}
            maxLength={10}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {form.role === 'admin' ? (
            <select
              name="adminLevel"
              value={form.adminLevel}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              {ADMIN_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)} Admin
                </option>
              ))}
            </select>
          ) : form.role === 'worker' ? (
            <select
              name="specialty"
              value={form.specialty}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              {WORKER_SPECIALTIES.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              Role-specific routing will use your location details below.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locationLoading}
          className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {locationLoading ? 'Detecting current location...' : 'Use Current Location'}
        </button>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            name="country"
            placeholder="Country"
            value={form.country}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <input
            type="text"
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <input
            type="text"
            name="district"
            placeholder="District"
            value={form.district}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
          <input
            type="text"
            name="mandal"
            placeholder="Mandal"
            value={form.mandal}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          />
        </div>

        <input
          type="text"
          name="village"
          placeholder="Village"
          value={form.village}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          required
        />

        <p className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          Local mode stores accounts in this browser. Village complaints are routed to the matching village admin when one exists.
        </p>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg border !border-black !bg-black py-2.5 font-medium !text-white transition hover:opacity-95 disabled:opacity-70"
          style={{ backgroundColor: '#000000', borderColor: '#000000' }}
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Signup'}
        </button>
        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-semibold text-indigo-700 hover:text-indigo-800" to="/login">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Signup;
