import {
  WORKER_SPECIALTIES,
  canAdminAccessByScope,
  loginWithEmailPassword,
  normalizeAdminLevel,
  readLocalUsers,
  resetLocalPassword,
  signupWithEmailPassword,
  updateLocalUserProfile,
} from './localAuth';
import { createLocalComplaint, prependLocalComplaint, readLocalComplaints, writeLocalComplaints } from './localComplaints';

const WORKERS_STORAGE_KEY = 'localWorkers';
const NOTIFICATIONS_STORAGE_KEY = 'localNotifications';

const defaultSpecialties = WORKER_SPECIALTIES;

const safeResolve = (data) => Promise.resolve({ data });

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : parsed || fallback;
  } catch (_error) {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
};

const normalizeLocation = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const buildReporterSnapshot = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'user',
    adminLevel: user.adminLevel || '',
    adminTitle: user.adminTitle || '',
    accountStatus: user.accountStatus || 'active',
    village: user.village || '',
    mandal: user.mandal || '',
    district: user.district || '',
    state: user.state || '',
    country: user.country || '',
  };
};

const buildAssignedAdminSnapshot = (admin) => {
  if (!admin) {
    return {
      id: '',
      name: 'Local Admin Desk',
      email: '',
      phone: '',
      adminLevel: '',
      adminTitle: '',
      village: '',
      mandal: '',
      district: '',
      state: '',
      country: '',
    };
  }

  return {
    id: admin.id,
    name: admin.name || 'Local Admin Desk',
    email: admin.email || '',
    phone: admin.phone || '',
    adminLevel: admin.adminLevel || '',
    adminTitle: admin.adminTitle || '',
    village: admin.village || '',
    mandal: admin.mandal || '',
    district: admin.district || '',
    state: admin.state || '',
    country: admin.country || '',
  };
};

const extractComplaintLocation = (complaint) => {
  const nestedLocation = complaint?.location || complaint?.complaintLocation || {};
  const village = nestedLocation.village || complaint?.village || complaint?.reporterSnapshot?.village || complaint?.userId?.village || '';
  const mandal = nestedLocation.mandal || complaint?.mandal || complaint?.reporterSnapshot?.mandal || complaint?.userId?.mandal || '';
  const district = nestedLocation.district || complaint?.district || complaint?.reporterSnapshot?.district || complaint?.userId?.district || '';
  const state = nestedLocation.state || complaint?.state || complaint?.reporterSnapshot?.state || complaint?.userId?.state || '';
  const country = nestedLocation.country || complaint?.country || complaint?.reporterSnapshot?.country || complaint?.userId?.country || '';
  const fullAddress =
    nestedLocation.fullAddress || [village, mandal, district, state, country].filter(Boolean).join(', ');

  return {
    village,
    mandal,
    district,
    state,
    country,
    fullAddress,
  };
};

const resolveAssignedAdmin = (location) => {
  const matchingAdmins = readLocalUsers()
    .filter((user) => user.role === 'admin' && user.accountStatus !== 'inactive')
    .filter((user) => canAdminAccessByScope(user, location))
    .sort((left, right) => {
      const leftRank = ['village', 'mandal', 'district', 'state', 'nation'].indexOf(normalizeAdminLevel(left.adminLevel));
      const rightRank = ['village', 'mandal', 'district', 'state', 'nation'].indexOf(normalizeAdminLevel(right.adminLevel));
      return leftRank - rightRank;
    });

  return buildAssignedAdminSnapshot(matchingAdmins[0] || null);
};

const isComplaintOwnedByUser = (complaint, user) => {
  const reporter = complaint?.userId || complaint?.reporterSnapshot;
  if (!user || !reporter) return false;
  if (reporter.id && user.id && reporter.id === user.id) return true;
  return normalizeLocation(reporter.email) === normalizeLocation(user.email);
};

const filterComplaintsForCurrentUser = (complaints, currentUser = getCurrentUser()) => {
  if (!currentUser) return complaints;

  if (currentUser.role === 'admin') {
    return complaints.filter((complaint) => {
      const assignedAdminId = complaint?.assignedAdmin?.id;
      if (assignedAdminId) {
        return assignedAdminId === currentUser.id;
      }
      return canAdminAccessByScope(currentUser, extractComplaintLocation(complaint));
    });
  }

  if (currentUser.role === 'worker') {
    return complaints.filter(
      (complaint) =>
        complaint.assignedWorker?.workerId === currentUser.id || complaint.assignedWorker?.name === currentUser.name
    );
  }

  return complaints.filter((complaint) => isComplaintOwnedByUser(complaint, currentUser));
};

const seedWorkers = () => {
  const workers = readJson(WORKERS_STORAGE_KEY, []);
  if (workers.length > 0) return workers;

  const seeded = [
    {
      _id: 'worker-1',
      name: 'Ravi Kumar',
      phone: '9000000001',
      specialty: 'Electrician',
      isAvailable: true,
      isActive: true,
      type: 'managed',
    },
    {
      _id: 'worker-2',
      name: 'Sita Rao',
      phone: '9000000002',
      specialty: 'Water Engineer',
      isAvailable: true,
      isActive: true,
      type: 'managed',
    },
    {
      _id: 'worker-3',
      name: 'Arjun Patel',
      phone: '9000000003',
      specialty: 'Road Contractor',
      isAvailable: true,
      isActive: true,
      type: 'managed',
    },
  ];

  writeJson(WORKERS_STORAGE_KEY, seeded);
  return seeded;
};

const readWorkers = () => seedWorkers();
const writeWorkers = (workers) => writeJson(WORKERS_STORAGE_KEY, workers);

const getRegisteredWorkers = ({ currentUser = getCurrentUser(), includeInactive = false } = {}) => {
  const candidates = readLocalUsers().filter((user) => user.role === 'worker');

  return candidates
    .filter((user) => {
      if (!includeInactive && user.accountStatus === 'inactive') return false;
      if (currentUser?.role === 'admin') {
        return canAdminAccessByScope(currentUser, user);
      }
      return true;
    })
    .map((user) => ({
      _id: user.id,
      name: user.name || '',
      phone: user.phone || '',
      specialty: user.specialty || 'General Contractor',
      isAvailable: user.accountStatus !== 'inactive',
      isActive: user.accountStatus !== 'inactive',
      type: 'registered',
    }));
};

const getWorkerPool = ({ currentUser = getCurrentUser(), includeInactive = false } = {}) => {
  const managed = readWorkers().filter((worker) => (includeInactive ? true : worker.isActive));
  const registered = getRegisteredWorkers({ currentUser, includeInactive });
  const merged = [...managed, ...registered];

  const deduped = new Map();
  merged.forEach((worker) => {
    if (!deduped.has(worker._id)) {
      deduped.set(worker._id, worker);
    }
  });

  return [...deduped.values()];
};

const readNotifications = () => readJson(NOTIFICATIONS_STORAGE_KEY, []);
const writeNotifications = (items) => writeJson(NOTIFICATIONS_STORAGE_KEY, items);

const createNotification = ({ title, message }) => ({
  _id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title,
  message,
  isRead: false,
  createdAt: new Date().toISOString(),
});

const addNotification = (title, message) => {
  const items = [createNotification({ title, message }), ...readNotifications()];
  writeNotifications(items.slice(0, 30));
};

const inferCategory = (text) => {
  const normalized = String(text || '').toLowerCase();
  if (normalized.includes('water') || normalized.includes('drain') || normalized.includes('pipe')) return 'Water';
  if (normalized.includes('light') || normalized.includes('power') || normalized.includes('electric')) return 'Electricity';
  if (normalized.includes('road') || normalized.includes('pothole') || normalized.includes('street')) return 'Roads';
  if (normalized.includes('garbage') || normalized.includes('waste') || normalized.includes('sanitation')) return 'Sanitation';
  return 'General';
};

const inferPriority = (text) => {
  const normalized = String(text || '').toLowerCase();
  if (normalized.includes('urgent') || normalized.includes('danger') || normalized.includes('accident')) return 'High';
  if (normalized.includes('soon') || normalized.includes('issue')) return 'Medium';
  return 'Low';
};

const inferDepartment = (category) => {
  switch (category) {
    case 'Water':
      return 'Water Board';
    case 'Electricity':
      return 'Electricity Board';
    case 'Roads':
      return 'Road & Transport';
    case 'Sanitation':
      return 'Sanitation Department';
    default:
      return 'General';
  }
};

const enrichComplaint = (complaint) => {
  const user = getCurrentUser();
  const complaintReporter = complaint.userId || complaint.reporterSnapshot || null;
  const currentReporter = buildReporterSnapshot(user);
  const mergedReporter = complaintReporter
    ? {
        ...complaintReporter,
        ...(currentReporter && complaintReporter.email && currentReporter.email === complaintReporter.email ? currentReporter : {}),
      }
    : currentReporter;
  const complaintLocation = extractComplaintLocation(complaint);
  return {
    ...complaint,
    complaintText: complaint.complaintDescription || complaint.complaintText || '',
    complaintLocation,
    village: complaintLocation.village,
    mandal: complaintLocation.mandal,
    district: complaintLocation.district,
    state: complaintLocation.state,
    country: complaintLocation.country,
    userId: mergedReporter,
    reporterSnapshot: complaint.reporterSnapshot || mergedReporter,
    assignedAdmin: complaint.assignedAdmin || resolveAssignedAdmin(complaintLocation),
  };
};

const getAllComplaints = () => readLocalComplaints().map(enrichComplaint);
const getVisibleComplaints = () => filterComplaintsForCurrentUser(getAllComplaints());

const setComplaints = (items) => writeLocalComplaints(items);

const countBy = (items, keySelector) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = keySelector(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([key, count]) => ({ _id: key, count }));
};

const buildAnalytics = (complaints) => {
  const totalUsers = 1;
  const totalComplaints = complaints.length;
  const resolvedComplaints = complaints.filter((item) => item.status === 'Resolved').length;
  return {
    totalUsers,
    totalComplaints,
    resolvedComplaints,
  };
};

const buildEnhancedAnalytics = (complaints) => {
  const highPriorityCount = complaints.filter((item) => item.priority === 'High').length;
  const resolved = complaints.filter((item) => item.status === 'Resolved');
  const avgResolutionHours = resolved.length
    ? Math.round(
        resolved.reduce((sum, item) => {
          const created = new Date(item.createdAt || Date.now()).getTime();
          const updated = new Date(item.updatedAt || item.createdAt || Date.now()).getTime();
          return sum + Math.max(0, (updated - created) / 3600000);
        }, 0) / resolved.length
      )
    : 0;
  const maxResolutionHours = resolved.length
    ? Math.round(
        Math.max(
          ...resolved.map((item) => {
            const created = new Date(item.createdAt || Date.now()).getTime();
            const updated = new Date(item.updatedAt || item.createdAt || Date.now()).getTime();
            return Math.max(0, (updated - created) / 3600000);
          })
        )
      )
    : 0;

  const now = new Date();
  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthComplaints = complaints.filter((item) => {
      const createdAt = new Date(item.createdAt || Date.now());
      const itemKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      return itemKey === monthKey;
    });
    return {
      month: monthKey,
      total: monthComplaints.length,
      resolved: monthComplaints.filter((item) => item.status === 'Resolved').length,
    };
  });

  const workerPerformance = getWorkerPool({ currentUser: getCurrentUser(), includeInactive: true }).map((worker) => {
    const assigned = complaints.filter((item) => item.assignedWorker?.workerId === worker._id);
    const resolvedCount = assigned.filter((item) => item.status === 'Resolved').length;
    const inProgress = assigned.filter((item) => item.status === 'In Progress').length;
    return {
      workerId: worker._id,
      total: assigned.length,
      resolved: resolvedCount,
      inProgress,
      resolutionRate: assigned.length ? (resolvedCount / assigned.length) * 100 : 0,
    };
  });

  return {
    summary: {
      highPriorityCount,
      slaComplianceRate: complaints.length ? Math.round((resolved.length / complaints.length) * 100) : 0,
      avgResolutionHours,
      maxResolutionHours,
    },
    byPriority: countBy(complaints, (item) => item.priority || 'Medium'),
    categoryTrend: countBy(complaints, (item) => item.category || 'General').slice(0, 5),
    monthlyTrend,
    workerPerformance,
  };
};

const buildResponseMetrics = (complaints) => ({
  awaitingAction: complaints.filter((item) => item.status === 'Submitted').length,
  reopenedComplaints: complaints.filter((item) => item.status === 'Under Review').length,
  escalatedComplaints: complaints.filter((item) => item.priority === 'High').length,
});

const buildSentimentAnalysis = (complaints) => {
  const distribution = countBy(complaints, (item) => item.sentiment || 'Neutral');
  const byPriority = complaints.reduce((acc, item) => {
    const existing = acc.find(
      (entry) => entry._id.sentiment === (item.sentiment || 'Neutral') && entry._id.priority === (item.priority || 'Medium')
    );
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({
        _id: { sentiment: item.sentiment || 'Neutral', priority: item.priority || 'Medium' },
        count: 1,
      });
    }
    return acc;
  }, []);
  const trend = complaints.map((item) => ({
    _id: {
      date: new Date(item.createdAt || Date.now()).toLocaleDateString(),
      sentiment: item.sentiment || 'Neutral',
    },
    count: 1,
  }));
  const negativeComplaints = complaints.filter((item) => ['Negative', 'Very Negative'].includes(item.sentiment || 'Neutral'));
  return { distribution, byPriority, trend, negativeComplaints };
};

const updateComplaintRecord = (id, updater) => {
  const complaints = getAllComplaints();
  const next = complaints.map((item) => {
    if (item._id !== id) return item;
    return {
      ...updater(item),
      updatedAt: new Date().toISOString(),
    };
  });
  setComplaints(next);
  return next.find((item) => item._id === id);
};

const defaultReply = (message) => {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('status') || normalized.includes('track')) {
    return 'Open Track Complaint to review your submitted complaint statuses.';
  }
  if (normalized.includes('submit')) {
    return 'Open Submit Complaint and provide the issue title, description, and location details.';
  }
  if (normalized.includes('pending')) {
    return `You currently have ${getVisibleComplaints().filter((item) => ['Submitted', 'Under Review', 'In Progress'].includes(item.status)).length} pending complaint(s).`;
  }
  return 'Use Dashboard, Submit Complaint, My Complaints, and Track Complaint to manage your local complaint records.';
};

export const authApi = {
  signup: (payload) => safeResolve(signupWithEmailPassword(payload)),
  login: (payload) => safeResolve(loginWithEmailPassword(payload)),
  googleLogin: () => Promise.reject(new Error('Google login is disabled in simple mode')),
  forgotPassword: (email) => safeResolve({ message: `Simple mode: reset password directly for ${email}.` }),
  resetPassword: (payload) => safeResolve(resetLocalPassword(payload)),
  verifyLoginOtp: () => safeResolve({ message: 'OTP is disabled in simple mode.' }),
  resendLoginOtp: () => safeResolve({ message: 'OTP is disabled in simple mode.' }),
  refresh: () => safeResolve({ token: localStorage.getItem('token') || '' }),
  logout: () => safeResolve({ ok: true }),
  getProfile: () => safeResolve({ user: getCurrentUser() }),
  updateProfile: (payload) => safeResolve({ user: updateLocalUserProfile(payload) }),
  deleteAccount: () => safeResolve({ ok: true }),
  deactivateAccount: () => safeResolve({ ok: true }),
  adminDeactivateUser: () => safeResolve({ ok: true }),
  adminReactivateUser: () => safeResolve({ ok: true }),
  assignAdmin: () => safeResolve({ ok: true }),
  requestMobileOtp: () => safeResolve({ resendAvailableInSeconds: 0 }),
  verifyMobileOtp: () => safeResolve({ user: { ...getCurrentUser(), mobileVerified: true } }),
};

export const complaintApi = {
  submit: (payload) => {
    const text = `${payload?.complaintTitle || ''} ${payload?.complaintDescription || ''}`;
    const category = payload?.category || inferCategory(text);
    const priority = payload?.priority || inferPriority(text);
    const department = payload?.department || inferDepartment(category);
    const currentUser = getCurrentUser();
    const reporterSnapshot = buildReporterSnapshot(currentUser);
    const complaintLocation = extractComplaintLocation({ location: payload?.location, ...payload });
    const assignedAdmin = resolveAssignedAdmin(complaintLocation);
    const complaint = enrichComplaint(
      createLocalComplaint({
        complaintTitle: payload?.complaintTitle,
        complaintDescription: payload?.complaintDescription,
        category,
        priority,
        department,
        location: complaintLocation,
      })
    );
    complaint.userId = reporterSnapshot;
    complaint.reporterSnapshot = reporterSnapshot;
    complaint.sentiment = priority === 'High' ? 'Negative' : 'Neutral';
    complaint.assignedAdmin = assignedAdmin;
    complaint.village = complaintLocation.village;
    complaint.mandal = complaintLocation.mandal;
    complaint.district = complaintLocation.district;
    complaint.state = complaintLocation.state;
    complaint.country = complaintLocation.country;
    prependLocalComplaint(complaint);
    addNotification(
      'Complaint submitted',
      `${complaint.complaintTitle || 'Complaint'} was submitted successfully and routed to ${assignedAdmin.name || 'Local Admin Desk'}.`
    );
    return safeResolve(complaint);
  },
  getMine: () => safeResolve(getAllComplaints().filter((item) => isComplaintOwnedByUser(item, getCurrentUser()))),
  getAll: () => safeResolve(getVisibleComplaints()),
  getById: (id) => safeResolve(getVisibleComplaints().find((item) => item._id === id) || null),
  update: (id, payload) => safeResolve(updateComplaintRecord(id, (item) => ({ ...item, ...payload }))),
  remove: (id) => {
    const next = getAllComplaints().filter((item) => item._id !== id);
    setComplaints(next);
    return safeResolve({ ok: true });
  },
  updateStatus: (id, status) => {
    const complaint = updateComplaintRecord(id, (item) => ({ ...item, status }));
    addNotification('Complaint updated', `${complaint?.complaintTitle || 'Complaint'} moved to ${status}.`);
    return safeResolve({ complaint });
  },
  uploadImage: (id, file) => {
    const imageRecord = { name: file?.name || 'image', uploadedAt: new Date().toISOString() };
    const complaint = updateComplaintRecord(id, (item) => ({ ...item, images: [...(item.images || []), imageRecord] }));
    return safeResolve({ complaint });
  },
  getAnalytics: () => safeResolve(buildAnalytics(getVisibleComplaints())),
  getEnhancedAnalytics: () => safeResolve(buildEnhancedAnalytics(getVisibleComplaints())),
  getSentimentAnalysis: () => safeResolve(buildSentimentAnalysis(getVisibleComplaints())),
  getResponseMetrics: () => safeResolve(buildResponseMetrics(getVisibleComplaints())),
  chat: (message) => safeResolve({ reply: defaultReply(message) }),
  adminCheck: () => safeResolve({ message: 'Simple local mode is active. Complaints are stored in this browser.' }),
  assignWorker: (complaintId, workerId) => {
    const currentUser = getCurrentUser();
    const targetComplaint = getAllComplaints().find((item) => item._id === complaintId);

    if (!targetComplaint) {
      return Promise.reject(new Error('Complaint not found'));
    }

    if (currentUser?.role === 'admin' && targetComplaint?.assignedAdmin?.id && targetComplaint.assignedAdmin.id !== currentUser.id) {
      return Promise.reject(new Error('This complaint is assigned to a different admin'));
    }

    const availableWorkers = getWorkerPool({ currentUser, includeInactive: true });
    const worker = availableWorkers.find((item) => item._id === workerId) || null;
    if (workerId && !worker) {
      return Promise.reject(new Error('Worker not found in your governance scope'));
    }
    if (worker && !worker.isActive) {
      return Promise.reject(new Error('Cannot assign an inactive worker'));
    }

    const complaint = updateComplaintRecord(complaintId, (item) => ({
      ...item,
      assignedWorker: worker
        ? { workerId: worker._id, name: worker.name, specialty: worker.specialty, workerType: worker.type }
        : null,
      status: worker ? 'In Progress' : item.status,
    }));
    if (worker && worker.type === 'managed') {
      const workers = readWorkers().map((item) => (item._id === worker._id ? { ...item, isAvailable: false } : item));
      writeWorkers(workers);
    }
    if (worker) {
      addNotification('Worker assigned', `${worker.name} was assigned to ${complaint?.complaintTitle || 'a complaint'}.`);
    }
    return safeResolve({ complaint });
  },
  getMyAssignments: () => {
    const currentUser = getCurrentUser();
    const assignments = getAllComplaints().filter((item) => {
      if (!item.assignedWorker) return false;
      if (!currentUser) return true;
      return item.assignedWorker.workerId === currentUser.id || item.assignedWorker.name === currentUser.name;
    });
    return safeResolve(assignments);
  },
  updateProgress: (id, status, progressNote) => {
    const complaint = updateComplaintRecord(id, (item) => ({ ...item, status, progressNote }));
    if (
      status === 'Resolved' &&
      complaint?.assignedWorker?.workerId &&
      complaint?.assignedWorker?.workerType === 'managed'
    ) {
      const workers = readWorkers().map((item) =>
        item._id === complaint.assignedWorker.workerId ? { ...item, isAvailable: true } : item
      );
      writeWorkers(workers);
    }
    addNotification('Worker update', `${complaint?.complaintTitle || 'Complaint'} marked as ${status}.`);
    return safeResolve({ complaint });
  },
  detectImage: () =>
    safeResolve({
      detected_issue: 'General civic issue',
      category: 'General',
      priority: 'Medium',
      department: 'General',
      confidence: 0.82,
      description: 'Simple mode uses a local placeholder image analysis result.',
      suggestion: 'Add clear complaint details to improve manual routing.',
    }),
};

export const adminApi = {
  getAllComplaints: () => complaintApi.getAll(),
  assignWorker: (complaintId, workerId) => complaintApi.assignWorker(complaintId, workerId),
  updateStatus: (complaintId, status) => complaintApi.updateStatus(complaintId, status),
  collectorQuestionLowerAdmins: () => safeResolve({ ok: true }),
  getActivities: (limit = 25) =>
    safeResolve(
      Array.from({ length: Math.min(25, Math.max(1, Number(limit) || 10)) }, (_, index) => ({
        _id: `local-activity-${index}`,
        action: ['complaint-status-updated', 'worker-assigned', 'complaint-escalated'][index % 3],
        severity: index % 7 === 0 ? 'warning' : 'info',
        createdAt: new Date(Date.now() - index * 30 * 60000).toISOString(),
        adminUserId: { name: 'Local Admin', email: 'local.admin@example.com', adminLevel: 'village' },
      }))
    ),
  getSecuritySummary: () =>
    safeResolve({
      last24Hours: { criticalCount: 0, warningCount: 2 },
      topActions: [
        { action: 'worker-assigned', count: 6, maxSeverity: 'info', severityScore: 1 },
        { action: 'complaint-status-updated', count: 4, maxSeverity: 'warning', severityScore: 2 },
      ],
    }),
};

export const workerPortalApi = {
  getAssignedComplaints: () => complaintApi.getMyAssignments(),
  updateStatus: (complaintId, status, progressNote) => complaintApi.updateProgress(complaintId, status, progressNote),
};

export const workerApi = {
  getAll: (options = {}) => {
    const currentUser = getCurrentUser();
    const includeInactive = String(options?.includeInactive || '').toLowerCase() === 'true' || options?.includeInactive === true;
    return safeResolve(getWorkerPool({ currentUser, includeInactive }));
  },
  getSpecialties: () => safeResolve(defaultSpecialties),
  create: (payload) => {
    const worker = {
      _id: `worker-${Date.now()}`,
      name: String(payload?.name || '').trim(),
      phone: String(payload?.phone || '').trim(),
      specialty: String(payload?.specialty || defaultSpecialties[0]).trim(),
      isAvailable: true,
      isActive: true,
      type: 'managed',
    };
    const next = [worker, ...readWorkers()];
    writeWorkers(next);
    return safeResolve(worker);
  },
  update: (id, payload) => {
    const workers = readWorkers().map((item) => (item._id === id ? { ...item, ...payload } : item));
    writeWorkers(workers);
    return safeResolve(workers.find((item) => item._id === id));
  },
  reactivate: (id) => {
    const workers = readWorkers().map((item) => (item._id === id ? { ...item, isActive: true, isAvailable: true } : item));
    writeWorkers(workers);
    return safeResolve(workers.find((item) => item._id === id));
  },
  remove: (id) => {
    const workers = readWorkers().map((item) => (item._id === id ? { ...item, isActive: false, isAvailable: false } : item));
    writeWorkers(workers);
    return safeResolve({ ok: true });
  },
};

export const notificationApi = {
  getMine: (limit = 25) => {
    const notifications = readNotifications().slice(0, limit);
    const unreadCount = notifications.filter((item) => !item.isRead).length;
    return safeResolve({ notifications, unreadCount });
  },
  markRead: (id) => {
    const next = readNotifications().map((item) => (item._id === id ? { ...item, isRead: true } : item));
    writeNotifications(next);
    return safeResolve({ ok: true });
  },
  markAllRead: () => {
    const next = readNotifications().map((item) => ({ ...item, isRead: true }));
    writeNotifications(next);
    return safeResolve({ ok: true });
  },
};

const api = {
  get: () => safeResolve(null),
  post: () => safeResolve(null),
  put: () => safeResolve(null),
  patch: () => safeResolve(null),
  delete: () => safeResolve(null),
};

export default api;
