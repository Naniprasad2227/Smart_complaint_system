import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupWithEmailPassword } from '../services/localAuth';

const Signup = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = signupWithEmailPassword(form);
      onAuthSuccess(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
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
          placeholder="Gmail"
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
        <p className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          Simple authentication mode: signup with Gmail and password.
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
