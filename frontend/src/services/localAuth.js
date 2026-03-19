const USERS_STORAGE_KEY = 'simpleAuthUsers';

export const ADMIN_LEVELS = ['village', 'mandal', 'district', 'state', 'nation'];

export const WORKER_SPECIALTIES = [
  'Civil Engineer',
  'Electrician',
  'Plumber',
  'Road Contractor',
  'Environmental Inspector',
  'Sanitation Worker',
  'Building Inspector',
  'Water Engineer',
  'IT Technician',
  'General Contractor',
];

export const ADMIN_LEVEL_TITLES = {
  village: 'Village Local Leader',
  mandal: 'Mandal Regional Coordinator',
  district: 'District Collector',
  state: 'State Official',
  nation: 'National Overseer',
};

const VALID_ROLES = ['user', 'admin', 'worker'];

const readUsers = () => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const writeUsers = (users) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
const normalizeText = (value) => String(value || '').trim();
const normalizeLocation = (value) => normalizeText(value).toLowerCase().replace(/\s+/g, ' ');

export const normalizeAdminLevel = (value) => {
  const normalized = normalizeLocation(value);
  return ADMIN_LEVELS.includes(normalized) ? normalized : 'village';
};

const getRequiredLocationFieldsForLevel = (level) => {
  switch (normalizeAdminLevel(level)) {
    case 'nation':
      return ['country'];
    case 'state':
      return ['state', 'country'];
    case 'district':
      return ['district', 'state', 'country'];
    case 'mandal':
      return ['mandal', 'district', 'state', 'country'];
    case 'village':
    default:
      return ['village', 'mandal', 'district', 'state', 'country'];
  }
};

const buildLocationPayload = (values = {}) => ({
  village: normalizeText(values.village),
  mandal: normalizeText(values.mandal),
  district: normalizeText(values.district),
  state: normalizeText(values.state),
  country: normalizeText(values.country),
});

const validateUserLocation = (location) => {
  const requiredFields = ['village', 'mandal', 'district', 'state', 'country'];
  return requiredFields.every((field) => normalizeText(location?.[field]).length > 0);
};

const validateAdminLocationForLevel = (level, location) => {
  return getRequiredLocationFieldsForLevel(level).every((field) => normalizeText(location?.[field]).length > 0);
};

export const buildAdminScopeKey = (level, location) => {
  const normalizedLevel = normalizeAdminLevel(level);
  const fields = getRequiredLocationFieldsForLevel(normalizedLevel);
  return [normalizedLevel, ...fields.map((field) => normalizeLocation(location?.[field]))].join('::');
};

export const canAdminAccessByScope = (admin, entityLocation) => {
  const level = normalizeAdminLevel(admin?.adminLevel);

  if (level === 'nation') {
    return normalizeLocation(admin?.country) === normalizeLocation(entityLocation?.country);
  }

  if (level === 'state') {
    return (
      normalizeLocation(admin?.country) === normalizeLocation(entityLocation?.country) &&
      normalizeLocation(admin?.state) === normalizeLocation(entityLocation?.state)
    );
  }

  if (level === 'district') {
    return (
      normalizeLocation(admin?.country) === normalizeLocation(entityLocation?.country) &&
      normalizeLocation(admin?.state) === normalizeLocation(entityLocation?.state) &&
      normalizeLocation(admin?.district) === normalizeLocation(entityLocation?.district)
    );
  }

  if (level === 'mandal') {
    return (
      normalizeLocation(admin?.country) === normalizeLocation(entityLocation?.country) &&
      normalizeLocation(admin?.state) === normalizeLocation(entityLocation?.state) &&
      normalizeLocation(admin?.district) === normalizeLocation(entityLocation?.district) &&
      normalizeLocation(admin?.mandal) === normalizeLocation(entityLocation?.mandal)
    );
  }

  return (
    normalizeLocation(admin?.country) === normalizeLocation(entityLocation?.country) &&
    normalizeLocation(admin?.state) === normalizeLocation(entityLocation?.state) &&
    normalizeLocation(admin?.district) === normalizeLocation(entityLocation?.district) &&
    normalizeLocation(admin?.mandal) === normalizeLocation(entityLocation?.mandal) &&
    normalizeLocation(admin?.village) === normalizeLocation(entityLocation?.village)
  );
};

const ensureAdminScopeAvailable = (users, user, excludeId) => {
  if (user.role !== 'admin' || user.accountStatus === 'inactive') {
    return;
  }

  const scopeKey = buildAdminScopeKey(user.adminLevel, user);
  const existing = users.find(
    (entry) =>
      entry.role === 'admin' &&
      entry.accountStatus !== 'inactive' &&
      entry.id !== excludeId &&
      buildAdminScopeKey(entry.adminLevel, entry) === scopeKey
  );

  if (existing) {
    throw new Error(`An active ${user.adminLevel} admin already exists for this governance scope`);
  }
};

const sanitizeStoredUser = (user) => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const buildUserRecord = (values = {}, existingUser) => {
  const role = VALID_ROLES.includes(normalizeLocation(values.role)) ? normalizeLocation(values.role) : 'user';
  const location = buildLocationPayload(values);
  const adminLevel = role === 'admin' ? normalizeAdminLevel(values.adminLevel) : '';
  const specialty =
    role === 'worker'
      ? normalizeText(values.specialty || existingUser?.specialty || WORKER_SPECIALTIES[0])
      : '';
  const phone = normalizePhone(values.phone);
  const email = normalizeEmail(values.email || existingUser?.email);
  const password = Object.prototype.hasOwnProperty.call(values, 'password') ? values.password : existingUser?.password;

  if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
    throw new Error('Please use a valid Gmail address');
  }

  if (!String(password || '').trim()) {
    throw new Error('Password is required');
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new Error('Mobile number must be exactly 10 digits');
  }

  if (!validateUserLocation(location)) {
    throw new Error('Village, mandal, district, state, and country are required');
  }

  if (role === 'admin' && !validateAdminLocationForLevel(adminLevel, location)) {
    throw new Error(`Location is incomplete for ${adminLevel} admin level`);
  }

  return {
    id: existingUser?.id || String(Date.now()),
    name: normalizeText(values.name) || normalizeText(existingUser?.name) || email.split('@')[0],
    email,
    phone,
    password,
    role,
    adminLevel,
    adminTitle: role === 'admin' ? ADMIN_LEVEL_TITLES[adminLevel] : '',
    specialty,
    accountStatus: existingUser?.accountStatus || 'active',
    mobileVerified: true,
    createdAt: existingUser?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...location,
    adminScopeKey: role === 'admin' ? buildAdminScopeKey(adminLevel, location) : '',
  };
};

const createAuthPayload = (user) => {
  const tokenSeed = `${user.email}:${Date.now()}`;
  const token = btoa(tokenSeed);
  return {
    token,
    accessToken: token,
    refreshToken: token,
    user,
  };
};

export const readLocalUsers = () => readUsers().map(sanitizeStoredUser);

export const signupWithEmailPassword = (values) => {
  const normalizedEmail = normalizeEmail(values?.email);
  const users = readUsers();

  if (users.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) {
    throw new Error('Email already registered');
  }

  const newUser = buildUserRecord(values);
  ensureAdminScopeAvailable(users, newUser);
  users.push(newUser);
  writeUsers(users);

  return createAuthPayload(sanitizeStoredUser(newUser));
};

export const loginWithEmailPassword = ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();

  const user = users.find(
    (entry) => normalizeEmail(entry.email) === normalizedEmail && String(entry.password) === String(password)
  );

  if (!user) {
    throw new Error('Invalid Gmail or password');
  }

  return createAuthPayload(sanitizeStoredUser(user));
};

export const updateLocalUserProfile = (updates = {}) => {
  const rawUser = localStorage.getItem('user');
  if (!rawUser) {
    throw new Error('No logged in user found');
  }

  const currentUser = JSON.parse(rawUser);
  const email = normalizeEmail(currentUser.email);
  const users = readUsers();
  const index = users.findIndex((entry) => normalizeEmail(entry.email) === email);

  if (index === -1) {
    throw new Error('Account not found');
  }

  const nextUser = buildUserRecord(
    {
      ...users[index],
      ...updates,
      email,
      role: users[index].role,
      adminLevel: users[index].adminLevel,
      password: users[index].password,
    },
    users[index]
  );

  ensureAdminScopeAvailable(users, nextUser, users[index].id);
  users[index] = nextUser;
  writeUsers(users);

  const safeUser = sanitizeStoredUser(nextUser);
  localStorage.setItem('user', JSON.stringify(safeUser));
  return safeUser;
};

export const resetLocalPassword = ({ email, newPassword }) => {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const index = users.findIndex((entry) => normalizeEmail(entry.email) === normalizedEmail);

  if (index === -1) {
    throw new Error('No account exists with this Gmail address');
  }

  users[index] = {
    ...users[index],
    password: String(newPassword || ''),
    updatedAt: new Date().toISOString(),
  };

  writeUsers(users);
  return { message: 'Password reset successful. Redirecting to login...' };
};
