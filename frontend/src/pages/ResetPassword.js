import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetLocalPassword } from '../services/localAuth';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!strongPasswordRegex.test(newPassword)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = resetLocalPassword({ email, newPassword });
      setSuccess(data?.message || 'Password reset successful. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={handleSubmit} className="page-enter app-surface w-full max-w-md rounded-2xl p-7 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Account Recovery</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-2 text-xs text-slate-500">Simple mode: reset password directly using your Gmail and new password.</p>
        </div>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />

        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="New Password"
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm New Password"
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />

        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</p> : null}
        {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">{success}</p> : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 py-2.5 font-medium text-white transition hover:bg-slate-700"
          disabled={loading}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>

        <p className="text-sm text-slate-600">
          Back to{' '}
          <Link className="font-semibold text-black hover:text-slate-800" to="/login">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default ResetPassword;
