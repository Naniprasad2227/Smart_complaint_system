import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const Login = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const googleClientId = useMemo(() => process.env.REACT_APP_GOOGLE_CLIENT_ID || '', []);
  const googleBtnRef = useRef(null);

  // Effect 1: load GIS script and initialize
  useEffect(() => {
    if (!googleClientId) return undefined;

    const scriptId = 'google-identity-services-sdk';
    let script = document.getElementById(scriptId);

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const { data } = await authApi.googleLogin(response.credential);
            onAuthSuccess(data);
            navigate('/dashboard');
          } catch (err) {
            setError(err.response?.data?.message || 'Google login failed');
          }
        },
      });

      setGoogleReady(true);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      document.head.appendChild(script);
    } else {
      initializeGoogle();
    }

    return () => {};
  }, [googleClientId, navigate, onAuthSuccess]);

  // Effect 2: render the official Google button once GIS is ready and the container div is in the DOM
  useEffect(() => {
    if (!googleReady || !googleBtnRef.current) return;
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: googleBtnRef.current.offsetWidth || 400,
    });
  }, [googleReady]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await authApi.login(form);
      onAuthSuccess(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setForgotLoading(true);
    setError('');
    setForgotMessage('');

    try {
      const { data } = await authApi.forgotPassword(forgotEmail);
      setForgotMessage(
        data?.devResetLink
          ? `${data.message} [Dev reset link] ${data.devResetLink}`
          : data?.message || 'If an account exists, a password reset link has been sent.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request reset link');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative z-10 grid min-h-[100dvh] place-items-start overflow-y-auto p-4 pt-6 pb-24 md:min-h-screen md:place-items-center md:py-8">
      <form
        onSubmit={forgotMode ? handleForgotPassword : handleSubmit}
        className="page-enter app-surface mb-6 w-full max-w-md rounded-2xl p-7 space-y-4 md:mb-0"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Welcome Back</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Sign in to your account</h1>
        </div>
        {!forgotMode ? (
          <>
            <input
              type="text"
              name="identifier"
              placeholder="Email or Mobile Number"
              value={form.identifier}
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
          </>
        ) : null}

        {forgotMode ? (
          <>
            <input
              type="email"
              placeholder="Enter your account email"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2.5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              required
            />
            {forgotMessage ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {forgotMessage}
              </p>
            ) : null}
          </>
        ) : null}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</p>}

        {!forgotMode ? (
          <>
            {googleClientId ? (
              /* Google renders its branded button into this div */
              <div ref={googleBtnRef} className="w-full flex justify-center" />
            ) : (
              <div className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3 opacity-50 cursor-not-allowed select-none">
                {/* Static Google G logo SVG for visual reference when disabled */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.3 9 3.4l6.7-6.7C35.8 2.5 30.3 0 24 0 14.8 0 6.9 5.4 3 13.3l7.8 6C12.7 13 17.9 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z"/>
                  <path fill="#FBBC05" d="M10.8 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.3-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.1 0-11.3-3.5-13.2-8.8l-8.3 6.1C6.9 42.6 14.8 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                <span className="text-sm font-medium text-slate-400">Continue with Google</span>
              </div>
            )}
            {!googleClientId ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Google login is disabled. Set REACT_APP_GOOGLE_CLIENT_ID to enable.
              </p>
            ) : null}
          </>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 py-2.5 font-medium text-white transition hover:bg-slate-700"
          disabled={loading || forgotLoading}
        >
          {forgotMode
            ? (forgotLoading ? 'Sending reset link...' : 'Send Reset Link')
            : loading
            ? 'Logging in...'
            : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => {
            const nextForgotMode = !forgotMode;
            if (nextForgotMode && !forgotEmail && String(form.identifier || '').includes('@')) {
              setForgotEmail(String(form.identifier || '').trim());
            }
            setForgotMode(nextForgotMode);
            setError('');
            setForgotMessage('');
          }}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {forgotMode ? 'Back to Login' : 'Forgot Password?'}
        </button>
        {!forgotMode ? (
          <p className="text-sm text-slate-600">
            Do not have an account?{' '}
            <Link className="font-semibold text-black hover:text-slate-800" to="/signup">
              Signup
            </Link>
          </p>
        ) : null}
      </form>
    </div>
  );
};

export default Login;
