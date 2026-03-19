import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginWithEmailPassword } from '../services/localAuth';

const getLandingRouteForRole = (role) => {
  if (role === 'admin') return '/admin-dashboard';
  if (role === 'worker') return '/worker-dashboard';
  return '/dashboard';
};

const Login = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
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
      const payload = loginWithEmailPassword(form);
      onAuthSuccess(payload);
      navigate(getLandingRouteForRole(payload?.user?.role));
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 grid min-h-[100dvh] place-items-start overflow-y-auto p-4 pt-6 pb-24 md:min-h-screen md:place-items-center md:py-8">
      <form
        onSubmit={handleSubmit}
        className="page-enter app-surface mb-6 w-full max-w-md rounded-2xl p-7 space-y-4 md:mb-0"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Welcome Back</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Sign in to your account</h1>
        </div>
        <input
          type="email"
          name="email"
          placeholder="Gmail address"
          value={form.email}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</p>}

        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
          Simple authentication mode: use Gmail and password only.
        </p>

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 py-2.5 font-medium text-white transition hover:bg-slate-700"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <p className="text-sm text-slate-600">
          Do not have an account?{' '}
          <Link className="font-semibold text-black hover:text-slate-800" to="/signup">
            Signup
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
