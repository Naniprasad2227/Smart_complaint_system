require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Worker = require('../models/Worker');
const Complaint = require('../models/Complaint');
const { buildAdminScopeKey } = require('../utils/adminHierarchy');

const LOCATION = {
  village: 'Demo Village',
  mandal: 'Demo Mandal',
  district: 'Demo District',
  state: 'Demo State',
  country: 'India',
};

const ADMIN_BASE = {
  role: 'admin',
  accountStatus: 'active',
  phone: '9000001000',
  mobileVerified: true,
  ...LOCATION,
};

const createAdminPayload = (level, details = {}) => ({
  ...ADMIN_BASE,
  ...details,
  adminLevel: level,
  adminTitle: level.charAt(0).toUpperCase() + level.slice(1),
  adminScopeKey: buildAdminScopeKey(level, {
    ...LOCATION,
    ...details,
  }),
});

const hashPassword = (password) => bcrypt.hash(password, 10);

const upsertUser = async (filter, payload) => {
  return User.findOneAndUpdate(filter, { $set: payload }, { new: true, upsert: true, setDefaultsOnInsert: true });
};

const upsertWorker = async (filter, payload) => {
  return Worker.findOneAndUpdate(filter, { $set: payload }, { new: true, upsert: true, setDefaultsOnInsert: true });
};

const sampleComplaints = [
  {
    complaintTitle: 'Street light not working',
    complaintDescription: 'Main road street light has been off for three days.',
    category: 'Electricity',
    priority: 'Medium',
    department: 'Electricity Board',
  },
  {
    complaintTitle: 'Water leakage near school',
    complaintDescription: 'A large leak is wasting water near the primary school entrance.',
    category: 'Water',
    priority: 'High',
    department: 'Water Board',
  },
  {
    complaintTitle: 'Garbage not collected',
    complaintDescription: 'Garbage has not been collected in ward 3 since last week.',
    category: 'Sanitation',
    priority: 'Medium',
    department: 'Sanitation Department',
  },
];

const seed = async () => {
  await connectDB();

  const passwordHash = await hashPassword('Admin@123');
  const citizenPasswordHash = await hashPassword('Citizen@123');

  const nationAdmin = await upsertUser(
    { email: 'nation.admin@aismart.local' },
    createAdminPayload('nation', {
      name: 'National Overseer',
      email: 'nation.admin@aismart.local',
      password: passwordHash,
      phone: '9000001001',
      village: '',
      mandal: '',
      district: '',
      state: '',
    })
  );

  const stateAdmin = await upsertUser(
    { email: 'state.admin@aismart.local' },
    createAdminPayload('state', {
      name: 'State Officer',
      email: 'state.admin@aismart.local',
      password: passwordHash,
      phone: '9000001002',
      village: '',
      mandal: '',
      district: '',
    })
  );

  const districtAdmin = await upsertUser(
    { email: 'district.admin@aismart.local' },
    createAdminPayload('district', {
      name: 'District Collector',
      email: 'district.admin@aismart.local',
      password: passwordHash,
      phone: '9000001003',
      village: '',
      mandal: '',
    })
  );

  const mandalAdmin = await upsertUser(
    { email: 'mandal.admin@aismart.local' },
    createAdminPayload('mandal', {
      name: 'Mandal Coordinator',
      email: 'mandal.admin@aismart.local',
      password: passwordHash,
      phone: '9000001004',
      village: '',
    })
  );

  const villageAdmin = await upsertUser(
    { email: 'village.admin@aismart.local' },
    createAdminPayload('village', {
      name: 'Village Leader',
      email: 'village.admin@aismart.local',
      password: passwordHash,
      phone: '9000001005',
    })
  );

  const citizen = await upsertUser(
    { email: 'citizen@aismart.local' },
    {
      name: 'Demo Citizen',
      email: 'citizen@aismart.local',
      password: citizenPasswordHash,
      phone: '9000002001',
      role: 'user',
      mobileVerified: true,
      accountStatus: 'active',
      adminLevel: '',
      adminTitle: '',
      adminScopeKey: '',
      ...LOCATION,
    }
  );

  const workerUser = await upsertUser(
    { email: 'worker@aismart.local' },
    {
      name: 'Demo Worker',
      email: 'worker@aismart.local',
      password: citizenPasswordHash,
      phone: '9000003001',
      role: 'worker',
      mobileVerified: true,
      accountStatus: 'active',
      adminLevel: '',
      adminTitle: '',
      adminScopeKey: '',
      ...LOCATION,
      specialty: 'Electrician',
    }
  );

  await upsertWorker(
    { userId: workerUser._id },
    {
      userId: workerUser._id,
      name: workerUser.name,
      phone: workerUser.phone,
      specialty: 'Electrician',
      isAvailable: true,
      isActive: true,
      type: 'managed',
    }
  );

  for (const item of sampleComplaints) {
    const existing = await Complaint.findOne({ complaintTitle: item.complaintTitle, userId: citizen._id });
    if (existing) continue;

    await Complaint.create({
      userId: citizen._id,
      assignedAdminId: villageAdmin._id,
      complaintTitle: item.complaintTitle,
      complaintDescription: item.complaintDescription,
      complaintText: `${item.complaintTitle}. ${item.complaintDescription}`,
      category: item.category,
      priority: item.priority,
      department: item.department,
      status: 'Submitted',
      sentiment: item.priority === 'High' ? 'Negative' : 'Neutral',
      complaintLocation: {
        ...LOCATION,
        fullAddress: `${LOCATION.village}, ${LOCATION.mandal}, ${LOCATION.district}, ${LOCATION.state}, ${LOCATION.country}`,
      },
      reporterSnapshot: {
        name: citizen.name,
        email: citizen.email,
        phone: citizen.phone,
        ...LOCATION,
      },
      reportHistory: [
        {
          reporterId: citizen._id,
          reporterSnapshot: {
            name: citizen.name,
            email: citizen.email,
            phone: citizen.phone,
            ...LOCATION,
          },
          complaintTitle: item.complaintTitle,
          complaintDescription: item.complaintDescription,
          reportedAt: new Date(),
        },
      ],
      deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      ...LOCATION,
    });
  }

  console.log('Seed completed successfully');
  console.log('Admins:', {
    nation: nationAdmin.email,
    state: stateAdmin.email,
    district: districtAdmin.email,
    mandal: mandalAdmin.email,
    village: villageAdmin.email,
  });
  console.log('Citizen:', citizen.email);
  console.log('Worker:', workerUser.email);

  await mongoose.connection.close();
};

seed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.connection.close();
  process.exit(1);
});
