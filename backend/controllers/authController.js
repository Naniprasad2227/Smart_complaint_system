const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Worker = require('../models/Worker');
const { logAdminActivity } = require('../utils/adminSecurityLogger');
const {
  ADMIN_LEVELS,
  ADMIN_LEVEL_TITLES,
  normalizeAdminLevel,
  getRequiredLocationFieldsForLevel,
  validateLocationForAdminLevel,
  buildAdminScopeKey,
  buildAdminScopeUniquenessQuery,
  canAssignAdminLevel,
  canAdminAccessByScope,
} = require('../utils/adminHierarchy');

const createAccessToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
const createRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

const OTP_EXPIRY_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES || 5));
const LOGIN_OTP_EXPIRY_SECONDS = 30;
const LOGIN_OTP_SESSION_MINUTES = Math.max(5, Number(process.env.LOGIN_OTP_SESSION_MINUTES || 10));
const OTP_RESEND_COOLDOWN_SECONDS = Math.max(5, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30));
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(3, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));
const OTP_LOCKOUT_MINUTES = Math.max(1, Number(process.env.OTP_LOCKOUT_MINUTES || 15));

const createLoginOtpToken = (userId) =>
  jwt.sign({ id: userId, type: 'login-otp' }, process.env.JWT_SECRET, { expiresIn: `${LOGIN_OTP_SESSION_MINUTES}m` });

const MOBILE_REGEX = /^\d{10}$/;
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const LOGIN_OTP_EXPIRY_MS = LOGIN_OTP_EXPIRY_SECONDS * 1000;
const OTP_HASH_ROUNDS = 10;
const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;
const OTP_LOCKOUT_MS = OTP_LOCKOUT_MINUTES * 60 * 1000;
const PASSWORD_RESET_EXPIRY_MINUTES = Math.max(10, Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES || 30));
const PASSWORD_RESET_EXPIRY_MS = PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000;
const PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS = Math.max(
  30,
  Number(process.env.PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS || 60)
);
const PASSWORD_RESET_REQUEST_COOLDOWN_MS = PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS * 1000;

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '');
const isValidMobile = (value) => MOBILE_REGEX.test(normalizeMobile(value));
const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const buildPasswordResetTokenHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

const sendPasswordResetEmail = async ({ toEmail, resetLink }) => {
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const fromEmail = String(process.env.MAIL_FROM || smtpUser || 'no-reply@complaints.local').trim();

  if (!smtpHost || !smtpUser || !smtpPass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured. Please configure SMTP settings.');
    }

    console.log('\n[DEV PASSWORD RESET] ----------------------');
    console.log(`  To       : ${toEmail}`);
    console.log(`  Reset URL: ${resetLink}`);
    console.log('------------------------------------------\n');
    return { devMode: true, resetLink };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: 'Reset your complaint portal password',
    text: `We received a request to reset your password. Use this secure link within ${PASSWORD_RESET_EXPIRY_MINUTES} minutes: ${resetLink}`,
    html: `<p>We received a request to reset your password.</p><p>Use this secure link within <strong>${PASSWORD_RESET_EXPIRY_MINUTES} minutes</strong>:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });

  return { devMode: false };
};

const getRetryAfterSeconds = (until) => {
  if (!until) return 0;
  return Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
};

const clearMobileOtpState = (user) => {
  user.mobileOtpCode = '';
  user.mobileOtpExpiresAt = null;
  user.mobileOtpAttempts = 0;
};

const clearLoginOtpState = (user) => {
  user.loginOtpCode = '';
  user.loginOtpExpiresAt = null;
  user.loginOtpAttempts = 0;
};

const formatPhoneForSms = (rawPhone) => {
  const value = String(rawPhone || '').trim();
  if (!value) return '';

  if (value.startsWith('+')) {
    const digitsOnly = value.replace(/[^\d+]/g, '');
    return /^\+\d{8,15}$/.test(digitsOnly) ? digitsOnly : '';
  }

  const normalized = normalizeMobile(value);
  if (!MOBILE_REGEX.test(normalized)) return '';

  const defaultCountryCode = String(process.env.OTP_DEFAULT_COUNTRY_CODE || '+91').trim();
  if (!/^\+\d{1,4}$/.test(defaultCountryCode)) return '';

  return `${defaultCountryCode}${normalized}`;
};

const sendOtpSms = async ({ toPhone, otpCode, purpose }) => {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = String(process.env.TWILIO_FROM_NUMBER || '').trim();

  if (!accountSid || !authToken || !fromNumber) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS service is not configured. Please configure Twilio environment variables.');
    }

    console.log('\n[DEV OTP] --------------------------------');
    console.log(`  Purpose : ${purpose}`);
    console.log(`  Phone   : ${toPhone}`);
    console.log(`  OTP Code: ${otpCode}`);
    console.log('--------------------------------\n');

    return { devMode: true, otp: otpCode };
  }

  const otpPurposeLabel = purpose === 'login' ? 'login' : 'mobile verification';
  const expiryMinutes = Math.max(1, Math.floor(OTP_EXPIRY_MS / 60000));
  const messageBody = `${otpCode} is your OTP for ${otpPurposeLabel}. It expires in ${expiryMinutes} minutes.`;

  const payload = new URLSearchParams({
    To: toPhone,
    From: fromNumber,
    Body: messageBody,
  });

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    payload.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );

  return { devMode: false };
};

const issueAuthTokens = async (user) => {
  const accessToken = createAccessToken(user._id);
  const refreshToken = createRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};

const userPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  mobileVerified: Boolean(user.mobileVerified),
  role: user.role,
  adminLevel: user.adminLevel || '',
  adminTitle: user.adminTitle || '',
  specialty: user.specialty,
  village: user.village,
  mandal: user.mandal,
  district: user.district,
  state: user.state,
  country: user.country,
  accountStatus: user.accountStatus || 'active',
  deactivatedAt: user.deactivatedAt || null,
  createdAt: user.createdAt,
});

const signup = async (req, res) => {
  try {
    const { name, email, password, phone, role, village, mandal, district, state, country } = req.body;
    const requestedAdminLevel = normalizeAdminLevel(req.body?.adminLevel);
    const safeRole = role === 'admin' ? 'admin' : role === 'worker' ? 'worker' : 'user';
    const adminLevel = safeRole === 'admin' ? requestedAdminLevel : '';

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'name, email, password and phone are required' });
    }

    if (!isValidMobile(phone)) {
      return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
    }

    if (safeRole === 'admin') {
      const adminLocation = { village, mandal, district, state, country };
      if (!validateLocationForAdminLevel(adminLevel, adminLocation)) {
        return res.status(400).json({
          message: `Location is incomplete for ${adminLevel} admin level`,
        });
      }
    } else if (!village || !mandal || !district || !state || !country) {
      return res.status(400).json({
        message: 'village, mandal, district, state and country are required for users and workers',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (safeRole === 'admin') {
      const adminLocation = { village, mandal, district, state, country };
      const existingVillageAdmin = await User.findOne(
        buildAdminScopeUniquenessQuery(adminLevel, adminLocation)
      ).select('_id name email village');

      if (existingVillageAdmin) {
        return res.status(409).json({
          message: `An active ${adminLevel} admin already exists for this governance scope.`,
        });
      }
    }

    const { specialty } = req.body;
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: normalizeMobile(phone),
      mobileVerified: false,
      role: safeRole,
      adminLevel,
      adminTitle: safeRole === 'admin' ? ADMIN_LEVEL_TITLES[adminLevel] : '',
      specialty: safeRole === 'worker' ? String(specialty || '').trim() : '',
      village: String(village).trim(),
      mandal: String(mandal).trim(),
      district: String(district).trim(),
      state: String(state).trim(),
      country: String(country).trim(),
      adminScopeKey:
        safeRole === 'admin'
          ? buildAdminScopeKey(adminLevel, { village, mandal, district, state, country })
          : '',
    });

    const { accessToken, refreshToken } = await issueAuthTokens(user);

    return res.status(201).json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: userPayload(user),
    });
  } catch (error) {
    if (error?.code === 11000 && Object.prototype.hasOwnProperty.call(error?.keyPattern || {}, 'adminScopeKey')) {
      return res.status(409).json({
        message: 'An active admin already exists for this governance scope and level.',
      });
    }
    return res.status(500).json({ message: 'Failed to signup', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, village, mandal, district, state, country } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ message: 'name and phone are required' });
    }

    if (req.user.role === 'admin') {
      const adminLevel = normalizeAdminLevel(req.user.adminLevel || 'village');
      const requiredFields = getRequiredLocationFieldsForLevel(adminLevel);
      const locationValues = { village, mandal, district, state, country };
      const missing = requiredFields.filter((field) => !String(locationValues[field] || '').trim());
      if (missing.length > 0) {
        return res.status(400).json({
          message: `Missing required location fields for ${adminLevel} admin: ${missing.join(', ')}`,
        });
      }
    } else if (!village || !mandal || !district || !state || !country) {
      return res.status(400).json({
        message: 'village, mandal, district, state and country are required',
      });
    }

    if (!isValidMobile(phone)) {
      return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
    }

    if (req.user.role === 'admin') {
      const adminLevel = normalizeAdminLevel(req.user.adminLevel || 'village');
      const nextScope = {
        village: String(village || '').trim(),
        mandal: String(mandal || '').trim(),
        district: String(district || '').trim(),
        state: String(state || '').trim(),
        country: String(country || '').trim(),
      };

      if (!validateLocationForAdminLevel(adminLevel, nextScope)) {
        return res.status(400).json({ message: `Location scope is invalid for ${adminLevel} admin` });
      }

      const conflictingAdmin = await User.findOne(
        buildAdminScopeUniquenessQuery(adminLevel, nextScope, req.user._id)
      ).select('_id name email');

      if (conflictingAdmin) {
        return res.status(409).json({
          message: `Another active ${adminLevel} admin already owns this scope. Choose a different location scope.`,
        });
      }
    }

    const normalizedPhone = normalizeMobile(phone);
    const hasPhoneChanged = normalizedPhone !== String(req.user.phone || '');

    req.user.name = String(name).trim();
    req.user.phone = normalizedPhone;
    if (hasPhoneChanged) {
      req.user.mobileVerified = false;
      req.user.mobileOtpCode = '';
      req.user.mobileOtpExpiresAt = null;
      req.user.mobileOtpAttempts = 0;
      req.user.mobileOtpLastSentAt = null;
      req.user.mobileOtpLockedUntil = null;
    }
    req.user.village = String(village).trim();
    req.user.mandal = String(mandal).trim();
    req.user.district = String(district).trim();
    req.user.state = String(state).trim();
    req.user.country = String(country).trim();
    req.user.adminScopeKey =
      req.user.role === 'admin'
        ? buildAdminScopeKey(req.user.adminLevel || 'village', { village, mandal, district, state, country })
        : '';

    await req.user.save();

    return res.json({ message: 'Profile updated successfully', user: userPayload(req.user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

const requestMobileOtp = async (req, res) => {
  try {
    const normalizedPhone = normalizeMobile(req.user.phone);

    if (!isValidMobile(normalizedPhone)) {
      return res.status(400).json({ message: 'Please update profile with a valid 10-digit mobile number first' });
    }

    const toPhone = formatPhoneForSms(req.user.phone);
    if (!toPhone) {
      return res.status(400).json({ message: 'Configured mobile number format is invalid for SMS delivery' });
    }

    if (req.user.mobileOtpLockedUntil && new Date(req.user.mobileOtpLockedUntil).getTime() > Date.now()) {
      return res.status(429).json({
        message: 'Too many OTP verification attempts. Try again later.',
        retryAfterSeconds: getRetryAfterSeconds(req.user.mobileOtpLockedUntil),
      });
    }

    if (req.user.mobileOtpLastSentAt && new Date(req.user.mobileOtpLastSentAt).getTime() + OTP_RESEND_COOLDOWN_MS > Date.now()) {
      const nextAllowedAt = new Date(new Date(req.user.mobileOtpLastSentAt).getTime() + OTP_RESEND_COOLDOWN_MS);
      return res.status(429).json({
        message: 'Please wait before requesting another OTP.',
        retryAfterSeconds: getRetryAfterSeconds(nextAllowedAt),
      });
    }

    const otpCode = generateOtpCode();
    const otpCodeHash = await bcrypt.hash(otpCode, OTP_HASH_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    req.user.mobileOtpCode = otpCodeHash;
    req.user.mobileOtpExpiresAt = expiresAt;
    req.user.mobileOtpAttempts = 0;
    req.user.mobileOtpLastSentAt = new Date();
    await req.user.save();

    try {
      await sendOtpSms({ toPhone, otpCode, purpose: 'mobile-verification' });
    } catch (_smsError) {
      clearMobileOtpState(req.user);
      await req.user.save();
      return res.status(502).json({ message: 'Failed to send OTP SMS. Please try again later.' });
    }

    return res.json({
      message: 'OTP sent successfully',
      expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
      resendAvailableInSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

const verifyMobileOtp = async (req, res) => {
  try {
    const otp = String(req.body?.otp || '').trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'OTP must be a valid 6-digit number' });
    }

    if (!req.user.mobileOtpCode || !req.user.mobileOtpExpiresAt) {
      return res.status(400).json({ message: 'No OTP request found. Please request OTP first.' });
    }

    if (req.user.mobileOtpLockedUntil && new Date(req.user.mobileOtpLockedUntil).getTime() > Date.now()) {
      return res.status(429).json({
        message: 'Too many incorrect OTP attempts. Please try again later.',
        retryAfterSeconds: getRetryAfterSeconds(req.user.mobileOtpLockedUntil),
      });
    }

    if (new Date(req.user.mobileOtpExpiresAt).getTime() < Date.now()) {
      clearMobileOtpState(req.user);
      await req.user.save();
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    const isOtpValid = await bcrypt.compare(otp, String(req.user.mobileOtpCode));
    if (!isOtpValid) {
      const attempts = Number(req.user.mobileOtpAttempts || 0) + 1;
      req.user.mobileOtpAttempts = attempts;

      if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        clearMobileOtpState(req.user);
        req.user.mobileOtpLockedUntil = new Date(Date.now() + OTP_LOCKOUT_MS);
        await req.user.save();
        return res.status(429).json({
          message: 'Too many incorrect OTP attempts. Please request OTP again later.',
          retryAfterSeconds: Math.floor(OTP_LOCKOUT_MS / 1000),
        });
      }

      await req.user.save();
      return res.status(400).json({
        message: 'Invalid OTP',
        attemptsRemaining: OTP_MAX_VERIFY_ATTEMPTS - attempts,
      });
    }

    req.user.mobileVerified = true;
    clearMobileOtpState(req.user);
    req.user.mobileOtpLockedUntil = null;
    await req.user.save();

    return res.json({ message: 'Mobile number verified successfully', user: userPayload(req.user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    return res.json({ user: userPayload(req.user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const normalizedIdentifier = String(identifier || email || phone || '').trim();
    const normalizedIdentifierMobile = normalizeMobile(normalizedIdentifier);

    if (!normalizedIdentifier || !password) {
      return res.status(400).json({ message: 'email or phone and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier.toLowerCase() },
        { phone: normalizedIdentifier },
        { phone: normalizedIdentifierMobile },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: 'No account found. Please create an account.' });
    }

    if (user.accountStatus === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Please contact an admin for reactivation.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    clearLoginOtpState(user);
    user.loginOtpLastSentAt = null;
    user.loginOtpLockedUntil = null;
    await user.save();

    const { accessToken, refreshToken } = await issueAuthTokens(user);

    return res.json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: userPayload(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login', error: error.message });
  }
};

const resendLoginOtp = async (req, res) => {
  return res.status(410).json({
    message: 'Login OTP is disabled. Please login using email/mobile and password only.',
  });
};

const verifyLoginOtp = async (req, res) => {
  return res.status(410).json({
    message: 'Login OTP is disabled. Please login using email/mobile and password only.',
  });
};

const googleLogin = async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    const { data: tokenInfo } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { id_token: idToken },
      timeout: 10000,
    });

    const expectedClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (expectedClientId && tokenInfo.aud !== expectedClientId) {
      return res.status(401).json({ message: 'Invalid Google token audience' });
    }

    if (String(tokenInfo.email_verified || '').toLowerCase() !== 'true') {
      return res.status(401).json({ message: 'Google account email is not verified' });
    }

    const email = String(tokenInfo.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Google token does not contain email' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const randomPassword = await bcrypt.hash(`google_${Math.random().toString(36).slice(2)}_${Date.now()}`, 10);
      user = await User.create({
        name: String(tokenInfo.name || tokenInfo.given_name || 'Google User').trim(),
        email,
        password: randomPassword,
        phone: '',
        role: 'user',
        village: '',
        mandal: '',
        district: '',
        state: '',
        country: '',
      });
    }

    const { accessToken, refreshToken } = await issueAuthTokens(user);

    return res.json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: userPayload(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to Google login', error: error.message });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const accessToken = createAccessToken(user._id);

    return res.json({ token: accessToken, accessToken });
  } catch (_error) {
    return res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
};

const logout = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken;

    if (refreshToken) {
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to logout', error: error.message });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const genericMessage = 'If an account with that email exists, a password reset link has been sent.';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const lastRequestedAt = user.passwordResetLastRequestedAt
      ? new Date(user.passwordResetLastRequestedAt).getTime()
      : 0;

    if (lastRequestedAt && lastRequestedAt + PASSWORD_RESET_REQUEST_COOLDOWN_MS > Date.now()) {
      return res.status(429).json({
        message: 'Please wait before requesting another password reset link.',
        retryAfterSeconds: getRetryAfterSeconds(new Date(lastRequestedAt + PASSWORD_RESET_REQUEST_COOLDOWN_MS)),
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = buildPasswordResetTokenHash(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${clientUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    user.passwordResetToken = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    user.passwordResetLastRequestedAt = new Date();
    await user.save();

    const mailMeta = await sendPasswordResetEmail({ toEmail: email, resetLink });

    return res.json({
      message: genericMessage,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
      ...(mailMeta?.devMode ? { devResetLink: mailMeta.resetLink } : {}),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request password reset', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (!token || token.length < 20) {
      return res.status(400).json({ message: 'Password reset token is invalid.' });
    }

    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Reset token is invalid or expired.' });
    }

    const tokenHash = buildPasswordResetTokenHash(token);
    const isExpired = !user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt).getTime() < Date.now();

    if (!user.passwordResetToken || user.passwordResetToken !== tokenHash || isExpired) {
      return res.status(400).json({ message: 'Reset token is invalid or expired.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = '';
    user.passwordResetExpiresAt = null;
    user.refreshToken = null;
    clearLoginOtpState(user);
    user.loginOtpLastSentAt = null;
    user.loginOtpLockedUntil = null;
    await user.save();

    return res.json({ message: 'Password has been reset successfully. Please login with your new password.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

const deleteMyAccount = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();

    req.user.accountStatus = 'inactive';
    req.user.deactivatedAt = new Date();
    req.user.deactivatedBy = req.user._id;
    req.user.deactivationReason = reason;
    req.user.refreshToken = null;
    clearLoginOtpState(req.user);
    clearMobileOtpState(req.user);
    req.user.mobileOtpLastSentAt = null;
    req.user.mobileOtpLockedUntil = null;
    req.user.loginOtpLastSentAt = null;
    req.user.loginOtpLockedUntil = null;

    await req.user.save();

    if (req.user.role === 'worker') {
      await Worker.updateMany(
        { _id: req.user._id },
        {
          $set: {
            isActive: false,
            isAvailable: false,
            deactivatedAt: new Date(),
            deactivationReason: reason,
          },
        }
      );
    }

    return res.json({
      message: 'Account deactivated successfully. All historical complaints and records are retained.',
      user: userPayload(req.user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to deactivate account', error: error.message });
  }
};

const canManageTargetByHierarchy = (actor, target) => {
  if (!actor || actor.role !== 'admin') return false;

  if (target.role === 'admin') {
    if (!canAssignAdminLevel(actor.adminLevel, target.adminLevel)) {
      return false;
    }
    return canAdminAccessByScope(actor, target);
  }

  return canAdminAccessByScope(actor, target);
};

const assignAdminByHigherLevel = async (req, res) => {
  try {
    const { name, email, password, phone, village, mandal, district, state, country, adminLevel } = req.body || {};
    const normalizedLevel = normalizeAdminLevel(adminLevel);

    if (!canAssignAdminLevel(req.user.adminLevel, normalizedLevel)) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'assign-admin-denied-insufficient-level',
        severity: 'warning',
        metadata: { requestedAdminLevel: normalizedLevel },
      });
      return res.status(403).json({ message: 'Forbidden: your admin level cannot assign this admin level.' });
    }

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'name, email, password and phone are required' });
    }

    if (!isValidMobile(phone)) {
      return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
    }

    const adminLocation = { village, mandal, district, state, country };
    if (!validateLocationForAdminLevel(normalizedLevel, adminLocation)) {
      return res.status(400).json({ message: `Location is incomplete for ${normalizedLevel} admin` });
    }

    if (!canAdminAccessByScope(req.user, adminLocation)) {
      return res.status(403).json({ message: 'Forbidden: target admin scope is outside your governance area.' });
    }

    const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const conflictingAdmin = await User.findOne(buildAdminScopeUniquenessQuery(normalizedLevel, adminLocation)).select('_id');
    if (conflictingAdmin) {
      return res.status(409).json({ message: `An active ${normalizedLevel} admin already exists for this scope.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: normalizeMobile(phone),
      mobileVerified: false,
      role: 'admin',
      adminLevel: normalizedLevel,
      adminTitle: ADMIN_LEVEL_TITLES[normalizedLevel],
      village: String(village || '').trim(),
      mandal: String(mandal || '').trim(),
      district: String(district || '').trim(),
      state: String(state || '').trim(),
      country: String(country || '').trim(),
      adminScopeKey: buildAdminScopeKey(normalizedLevel, adminLocation),
    });

    await logAdminActivity({
      req,
      adminId: req.user?._id,
      action: 'assign-admin-success',
      severity: 'warning',
      metadata: { targetAdminId: created._id, targetAdminLevel: normalizedLevel },
    });

    return res.status(201).json({ message: 'Admin assigned successfully', user: userPayload(created) });
  } catch (error) {
    if (error?.code === 11000 && Object.prototype.hasOwnProperty.call(error?.keyPattern || {}, 'adminScopeKey')) {
      return res.status(409).json({ message: 'An active admin already exists for this governance scope and level.' });
    }
    return res.status(500).json({ message: 'Failed to assign admin', error: error.message });
  }
};

const reactivateAccountByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirm } = req.body || {};

    if (!confirm) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'reactivate-account-denied-no-confirmation',
        severity: 'warning',
        metadata: { targetUserId: userId },
      });
      return res.status(400).json({ message: 'Admin confirmation is required to reactivate an account.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'reactivate-account-target-not-found',
        severity: 'warning',
        metadata: { targetUserId: userId },
      });
      return res.status(404).json({ message: 'User not found' });
    }

    if (!canManageTargetByHierarchy(req.user, user)) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'reactivate-account-denied-out-of-scope',
        severity: 'warning',
        metadata: { targetUserId: userId, targetRole: user.role, targetAdminLevel: user.adminLevel || '' },
      });
      return res.status(403).json({ message: 'Forbidden: target account is outside your permitted governance scope.' });
    }

    user.accountStatus = 'active';
    user.deactivatedAt = null;
    user.deactivatedBy = null;
    user.deactivationReason = '';
    await user.save();

    if (user.role === 'worker') {
      await Worker.updateMany(
        { _id: user._id },
        {
          $set: {
            isActive: true,
            deactivatedAt: null,
            deactivationReason: '',
          },
        }
      );
    }

    await logAdminActivity({
      req,
      adminId: req.user?._id,
      action: 'reactivate-account',
      severity: 'info',
      metadata: { targetUserId: user._id, targetRole: user.role },
    });

    return res.json({ message: 'Account reactivated successfully', user: userPayload(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reactivate account', error: error.message });
  }
};

const deactivateAccountByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const reason = String(req.body?.reason || '').trim();
    const target = await User.findById(userId);

    if (!target) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'deactivate-account-target-not-found',
        severity: 'warning',
        metadata: { targetUserId: userId },
      });
      return res.status(404).json({ message: 'User not found' });
    }

    if (target.role === 'admin' && String(target._id) === String(req.user._id)) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'deactivate-self-admin-via-admin-endpoint',
        severity: 'warning',
        metadata: { targetUserId: target._id },
      });
      return res.status(400).json({ message: 'Use your own account settings to deactivate your admin account.' });
    }

    if (!canManageTargetByHierarchy(req.user, target)) {
      await logAdminActivity({
        req,
        adminId: req.user?._id,
        action: 'deactivate-account-denied-out-of-scope',
        severity: 'warning',
        metadata: { targetUserId: userId, targetRole: target.role, targetAdminLevel: target.adminLevel || '' },
      });
      return res.status(403).json({ message: 'Forbidden: target account is outside your permitted governance scope.' });
    }

    target.accountStatus = 'inactive';
    target.deactivatedAt = new Date();
    target.deactivatedBy = req.user._id;
    target.deactivationReason = reason;
    target.refreshToken = null;
    clearLoginOtpState(target);
    clearMobileOtpState(target);
    target.mobileOtpLastSentAt = null;
    target.mobileOtpLockedUntil = null;
    target.loginOtpLastSentAt = null;
    target.loginOtpLockedUntil = null;
    await target.save();

    if (target.role === 'worker') {
      await Worker.updateMany(
        { _id: target._id },
        {
          $set: {
            isActive: false,
            isAvailable: false,
            deactivatedAt: new Date(),
            deactivationReason: reason,
          },
        }
      );
    }

    await logAdminActivity({
      req,
      adminId: req.user?._id,
      action: 'deactivate-account',
      severity: target.role === 'admin' ? 'critical' : 'warning',
      metadata: { targetUserId: target._id, targetRole: target.role, reason },
    });

    return res.json({ message: 'Account deactivated successfully', user: userPayload(target) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to deactivate account', error: error.message });
  }
};

module.exports = {
  signup,
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  updateProfile,
  getProfile,
  deleteMyAccount,
  reactivateAccountByAdmin,
  deactivateAccountByAdmin,
  assignAdminByHigherLevel,
  requestPasswordReset,
  resetPassword,
  requestMobileOtp,
  verifyMobileOtp,
  resendLoginOtp,
  verifyLoginOtp,
};
