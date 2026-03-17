const USERS_STORAGE_KEY = 'simpleAuthUsers';

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

export const signupWithEmailPassword = ({ name, email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@gmail\.com$/i.test(normalizedEmail)) {
    throw new Error('Please use a valid Gmail address');
  }

  if (!String(password || '').trim()) {
    throw new Error('Password is required');
  }

  const users = readUsers();
  if (users.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) {
    throw new Error('Email already registered');
  }

  const newUser = {
    id: String(Date.now()),
    name: String(name || '').trim() || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    password,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  const { password: _password, ...safeUser } = newUser;
  return createAuthPayload(safeUser);
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

  const { password: _password, ...safeUser } = user;
  return createAuthPayload(safeUser);
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

  users[index] = {
    ...users[index],
    ...updates,
    email,
  };

  writeUsers(users);

  const { password: _password, ...safeUser } = users[index];
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
  };

  writeUsers(users);
  return { message: 'Password reset successful. Redirecting to login...' };
};
