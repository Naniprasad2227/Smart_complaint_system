import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { getCurrentLocationFields } from '../services/location';

const Signup = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'user',
    adminLevel: 'village',
    specialty: '',
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
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedMobile = String(form.phone || '').replace(/\D/g, '');
      if (!/^\d{10}$/.test(normalizedMobile)) {
        setError('Mobile number must be exactly 10 digits');
        setLoading(false);
        return;
      }

      const { data } = await authApi.signup(form);
      onAuthSuccess(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setError('');
    try {
      const locationData = await getCurrentLocationFields();
      setForm((prev) => ({
        ...prev,
        ...locationData,
      }));
    } catch (err) {
      setError(err.message || 'Failed to detect current location');
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 relative z-10">
      <form onSubmit={handleSubmit} className="page-enter app-surface w-full max-w-xl rounded-2xl p-7 space-y-4 relative z-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Create Account</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Join Smart Complaint Hub</h1>
        </div>
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
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
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
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="user">Citizen / User</option>
          <option value="worker">Field Worker</option>
          <option value="admin">Admin</option>
        </select>
        {form.role === 'admin' ? (
          <select
            name="adminLevel"
            value={form.adminLevel}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          >
            <option value="village">Village Admin (Local Leader)</option>
            <option value="mandal">Mandal Admin (Regional Coordinator)</option>
            <option value="district">District Admin (Collector)</option>
            <option value="state">State Admin (State Official)</option>
            <option value="nation">Nation Admin (National Overseer)</option>
          </select>
        ) : null}
        {form.role === 'worker' && (
          <select
            name="specialty"
            value={form.specialty}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            required
          >
            <option value="">-- Select Your Specialty --</option>
            <option value="Civil Engineer">Civil Engineer</option>
            <option value="Electrician">Electrician</option>
            <option value="Plumber">Plumber</option>
            <option value="Road Contractor">Road Contractor</option>
            <option value="Environmental Inspector">Environmental Inspector</option>
            <option value="Sanitation Worker">Sanitation Worker</option>
            <option value="Building Inspector">Building Inspector</option>
            <option value="Water Engineer">Water Engineer</option>
            <option value="IT Technician">IT Technician</option>
            <option value="General Contractor">General Contractor</option>
          </select>
        )}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locationLoading}
          className="w-full rounded-lg border border-indigo-400 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {locationLoading ? 'Detecting current location...' : 'Use Current Location'}
        </button>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
