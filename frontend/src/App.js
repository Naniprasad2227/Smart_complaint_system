import React, { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Chatbot from './components/Chatbot';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import SubmitComplaint from './pages/SubmitComplaint';
import Dashboard from './pages/Dashboard';
import ComplaintHistory from './pages/ComplaintHistory';
import MyComplaints from './pages/MyComplaints';
import TrackComplaint from './pages/TrackComplaint';
import AdminDashboard from './pages/AdminDashboard';
import AdminPanel from './pages/AdminPanel';
import Profile from './pages/Profile';
import WorkerDashboard from './pages/WorkerDashboard';
import WorkerPanel from './pages/WorkerPanel';
import SentimentAnalysis from './pages/SentimentAnalysis';
import ImageDetection from './pages/ImageDetection';
import { disconnectNotificationSocket } from './services/socket';
import ErrorBoundary from './components/ErrorBoundary';

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const getDefaultRouteForRole = (user) => {
  if (user?.role === 'admin') return '/admin-dashboard';
  if (user?.role === 'worker') return '/worker-dashboard';
  return '/dashboard';
};

const PrivateLayout = ({ user, onLogout, children }) => {
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen px-2 py-2 md:px-3 md:py-3 relative z-10">
      <div className="mx-auto w-full max-w-[1380px] shell-frame overflow-hidden">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex flex-col md:flex-row">
          <Sidebar role={user.role} />
          <main className="flex-1 bg-transparent p-3 md:p-4 page-enter">{children}</main>
        </div>
      </div>
      <Chatbot />
    </div>
  );
};

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [user, setUser] = useState(getStoredUser);

  const isAuthenticated = Boolean(token && user);
  const defaultRoute = getDefaultRouteForRole(user);

  const authValue = useMemo(() => ({ token, user }), [token, user]);

  const onAuthSuccess = (data) => {
    localStorage.setItem('token', data.accessToken || data.token);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
      setRefreshToken(data.refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.accessToken || data.token);
    setUser(data.user);
  };

  const onLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    disconnectNotificationSocket();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const onUserUpdate = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <div>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <Home />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <Login onAuthSuccess={onAuthSuccess} />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <Register onAuthSuccess={onAuthSuccess} />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <Signup onAuthSuccess={onAuthSuccess} />} />
        <Route path="/reset-password" element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            authValue.user?.role === 'admin' ? (
              <Navigate to="/admin-dashboard" replace />
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker-dashboard" replace />
            ) : (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <Dashboard user={authValue.user} />
              </PrivateLayout>
            )
          }
        />
        <Route
          path="/submit"
          element={
            authValue.user?.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker" replace />
            ) : (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <SubmitComplaint />
              </PrivateLayout>
            )
          }
        />
        <Route
          path="/my-complaints"
          element={
            authValue.user?.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker" replace />
            ) : (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <MyComplaints />
              </PrivateLayout>
            )
          }
        />
        <Route
          path="/complaint-history"
          element={
            authValue.user?.role === 'user' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <ComplaintHistory />
              </PrivateLayout>
            ) : authValue.user?.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/track-complaint"
          element={
            authValue.user?.role === 'user' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <TrackComplaint />
              </PrivateLayout>
            ) : authValue.user?.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateLayout user={authValue.user} onLogout={onLogout}>
              <Profile user={authValue.user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
            </PrivateLayout>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            authValue.user?.role === 'admin' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <AdminDashboard />
              </PrivateLayout>
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            authValue.user?.role === 'admin' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <AdminPanel />
              </PrivateLayout>
            ) : authValue.user?.role === 'worker' ? (
              <Navigate to="/worker" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/worker-dashboard"
          element={
            authValue.user?.role === 'worker' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <WorkerDashboard user={authValue.user} />
              </PrivateLayout>
            ) : authValue.user?.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/worker"
          element={
            authValue.user?.role === 'worker' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <WorkerPanel user={authValue.user} />
              </PrivateLayout>
            ) : authValue.user?.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        <Route
          path="/sentiment-analysis"
          element={
            authValue.user?.role === 'admin' ? (
              <PrivateLayout user={authValue.user} onLogout={onLogout}>
                <SentimentAnalysis user={authValue.user} />
              </PrivateLayout>
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        <Route
          path="/image-detection"
          element={
            <PrivateLayout user={authValue.user} onLogout={onLogout}>
              <ImageDetection />
            </PrivateLayout>
          }
        />

        <Route path="*" element={<Navigate to={isAuthenticated ? defaultRoute : '/'} replace />} />
      </Routes>
      </ErrorBoundary>
    </div>
  );
};

export default App;