import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import NotificationPopup from './NotificationPopup';
import { notificationApi } from '../services/api';
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  getNotificationSocket,
} from '../services/socket';

const Navbar = ({ user, onLogout }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });

  const hasAuth = Boolean(localStorage.getItem('token'));

  const refreshNotifications = async () => {
    if (!hasAuth) return;
    try {
      const { data } = await notificationApi.getMine(10);
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list);
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (_error) {
    }
  };

  useEffect(() => {
    refreshNotifications();
  }, [hasAuth]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const socket = connectNotificationSocket(token);
    if (!socket) return undefined;

    const onNotification = (payload) => {
      const incoming = Array.isArray(payload?.notifications) ? payload.notifications : [];
      if (!incoming.length) return;

      setNotifications((prev) => {
        const merged = [...incoming, ...prev];
        const seen = new Set();
        return merged.filter((item) => {
          if (!item?._id) return false;
          if (seen.has(item._id)) return false;
          seen.add(item._id);
          return true;
        }).slice(0, 20);
      });

      setUnreadCount((count) => count + Number(payload?.unreadDelta || incoming.length || 1));
      setToast({ open: true, message: incoming[0].message, type: 'info' });
    };

    socket.emit('notifications:subscribe');
    socket.on('notification:new', onNotification);

    return () => {
      const active = getNotificationSocket();
      if (active) {
        active.off('notification:new', onNotification);
      }
      disconnectNotificationSocket();
    };
  }, [user?._id]);

  const latestUnread = useMemo(() => notifications.filter((item) => !item.isRead), [notifications]);

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (_error) {
    }
  };

  const markRead = async (notificationId) => {
    try {
      await notificationApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((item) => (item._id === notificationId ? { ...item, isRead: true } : item))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (_error) {
    }
  };

  return (
    <nav className="blue-panel z-40 border-b border-white/15">
      <NotificationPopup
        open={toast.open}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />

      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100 md:px-6">
        <span>National Civic Response Grid</span>
        <span className="hidden md:block">Government Service Operations Dashboard</span>
      </div>

      <div className="relative flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 text-lg font-extrabold text-white shadow-inner shadow-white/10">
            GoI
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100">Citizen services command</p>
            <Link to="/dashboard" className="text-center">
              <span className="text-[1.55rem] font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.28)] md:text-[1.8rem]">
                AI Smart Complaint Management System
              </span>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/95">
            Live intake monitoring
          </div>
          <div className="rounded-full border border-[#d6b25e]/35 bg-[#d6b25e]/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffeab5]">
            {user?.role || 'user'} access
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAlerts((prev) => !prev)}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Alerts ({unreadCount})
            </button>

            {showAlerts ? (
              <div className="absolute right-0 z-50 mt-2 w-[min(90vw,380px)] rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Recent notifications</p>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-80 space-y-2 overflow-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">No notifications yet.</p>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item._id}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          item.isRead ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <p className="font-semibold text-slate-700">{item.title}</p>
                        <p className="mt-0.5 text-slate-600">{item.message}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                          {!item.isRead ? (
                            <button
                              type="button"
                              onClick={() => markRead(item._id)}
                              className="rounded border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                            >
                              Read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {latestUnread.length > 0 ? (
                  <p className="mt-2 text-[11px] font-semibold text-blue-700">{latestUnread.length} unread alert(s)</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-white/20 bg-white px-3 py-2 text-xs font-bold text-[#123b83] transition hover:bg-blue-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;