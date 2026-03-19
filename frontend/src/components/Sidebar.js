import React from 'react';
import { NavLink } from 'react-router-dom';

const baseClass =
  'flex items-center gap-2 px-3 py-2.5 rounded-xl transition text-sm font-semibold border border-transparent';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◧' },
  { to: '/track-complaint', label: 'Track Complaint', icon: '◎', roles: ['user'] },
  { to: '/complaint-history', label: 'Complaint History', icon: '▤', roles: ['user'] },
  { to: '/my-complaints', label: 'My Complaints', icon: '▣', roles: ['user'] },
  { to: '/submit', label: 'Submit Complaint', icon: '◫', roles: ['user'] },
  { to: '/image-detection', label: 'Image Detection', icon: '📸' },
  { to: '/admin-dashboard', label: 'Admin Dashboard', icon: '◈', roles: ['admin'] },
  { to: '/sentiment-analysis', label: 'Sentiment Analysis', icon: '📊', roles: ['admin'] },
  { to: '/worker-dashboard', label: 'Worker Dashboard', icon: '◌', roles: ['worker'] },
  { to: '/worker', label: 'My Assignments', icon: '🔧', roles: ['worker'] },
];

const Sidebar = ({ role }) => {
  const isAdmin = role === 'admin';
  const dashboardRoute = role === 'admin' ? '/admin-dashboard' : role === 'worker' ? '/worker-dashboard' : '/dashboard';

  return (
    <aside className="relative w-full overflow-hidden md:w-[248px] blue-panel p-4 md:min-h-[calc(100vh-132px)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_40%,rgba(255,255,255,0.05))]" />

      <div className="relative mb-5 rounded-2xl border border-white/15 bg-white/8 px-3 py-3 text-[11px] font-semibold text-white/95">
        <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">Department cell</p>
        <p className="mt-1 text-sm font-bold">Unified Grievance Control Room</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-blue-100">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          Operational and synced
        </div>
      </div>

      <div className="relative mb-4 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-white/90">
        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100">Active profile</p>
        <p className="mt-1 text-base font-bold capitalize">{role || 'Citizen'} desk</p>
        <p className="mt-1 text-xs text-blue-100">Role-specific routing, review, and field action workflows.</p>
      </div>

      <nav className="space-y-2">
        {navItems.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
          const targetRoute = item.to === '/dashboard' ? dashboardRoute : item.to;
          return (
          <NavLink
            key={`${item.to}-${targetRoute}`}
            to={targetRoute}
            className={({ isActive }) =>
              `${baseClass} ${
                isActive
                  ? 'bg-white text-[#123b83] border-white shadow-sm'
                  : 'text-white/95 bg-white/5 hover:bg-white/10 hover:border-white/10'
              }`
            }
          >
            <span className="grid h-6 w-6 place-items-center rounded-md bg-black/10 text-[10px]">{item.icon}</span>
            <span className="text-[12px] leading-4">{item.label}</span>
          </NavLink>
          );
        })}

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `${baseClass} ${
              isActive
                ? 'bg-white text-[#123b83] border-white shadow-sm'
                : 'text-white/95 bg-white/5 hover:bg-white/10 hover:border-white/10'
            }`
          }
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-black/10 text-[10px]">◌</span>
          <span className="text-[12px] leading-4">Profile</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `${baseClass} ${
                isActive
                  ? 'bg-white text-[#123b83] border-white shadow-sm'
                  : 'text-white/95 bg-white/5 hover:bg-white/10 hover:border-white/10'
              }`
            }
          >
            <span className="grid h-6 w-6 place-items-center rounded-md bg-black/10 text-[10px]">◈</span>
            <span className="text-[12px] leading-4">Admin Panel</span>
          </NavLink>
        )}
      </nav>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/8 p-3 text-xs text-blue-50">
        <p className="font-semibold uppercase tracking-[0.16em] text-blue-100">Daily posture</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span>Citizen intake</span>
            <span className="font-bold text-white">Stable</span>
          </div>
          <div className="flex items-center justify-between">
            <span>AI triage</span>
            <span className="font-bold text-white">Online</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Field routing</span>
            <span className="font-bold text-white">Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;