const ADMIN_LEVELS = ['village', 'mandal', 'district', 'state', 'nation'];

const ADMIN_LEVEL_TITLES = {
  village: 'Village Local Leader',
  mandal: 'Mandal Regional Coordinator',
  district: 'District Collector',
  state: 'State Official',
  nation: 'National Overseer',
};

const LEVEL_RANK = {
  village: 1,
  mandal: 2,
  district: 3,
  state: 4,
  nation: 5,
};

const normalizeLocation = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactInsensitive = (value) => ({ $regex: new RegExp(`^${escapeRegExp(String(value || '').trim())}$`, 'i') });

const normalizeAdminLevel = (value) => {
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

const validateLocationForAdminLevel = (level, location) => {
  return getRequiredLocationFieldsForLevel(level).every((field) => normalizeLocation(location?.[field]).length > 0);
};

const buildAdminScopeKey = (level, location) => {
  const normalizedLevel = normalizeAdminLevel(level);
  const fields = getRequiredLocationFieldsForLevel(normalizedLevel);
  return [normalizedLevel, ...fields.map((field) => normalizeLocation(location?.[field]))].join('::');
};

const buildAdminScopeUniquenessQuery = (level, location, excludeUserId) => {
  const normalizedLevel = normalizeAdminLevel(level);
  const fields = getRequiredLocationFieldsForLevel(normalizedLevel);

  const query = {
    role: 'admin',
    adminLevel: normalizedLevel,
    accountStatus: 'active',
  };

  fields.forEach((field) => {
    query[field] = exactInsensitive(location?.[field]);
  });

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return query;
};

const buildComplaintScopeMatch = (admin) => {
  const level = normalizeAdminLevel(admin?.adminLevel);

  if (level === 'nation') {
    return { country: exactInsensitive(admin?.country) };
  }
  if (level === 'state') {
    return {
      state: exactInsensitive(admin?.state),
      country: exactInsensitive(admin?.country),
    };
  }
  if (level === 'district') {
    return {
      district: exactInsensitive(admin?.district),
      state: exactInsensitive(admin?.state),
      country: exactInsensitive(admin?.country),
    };
  }
  if (level === 'mandal') {
    return {
      mandal: exactInsensitive(admin?.mandal),
      district: exactInsensitive(admin?.district),
      state: exactInsensitive(admin?.state),
      country: exactInsensitive(admin?.country),
    };
  }

  return {
    village: exactInsensitive(admin?.village),
    mandal: exactInsensitive(admin?.mandal),
    district: exactInsensitive(admin?.district),
    state: exactInsensitive(admin?.state),
    country: exactInsensitive(admin?.country),
  };
};

const canAdminAccessByScope = (admin, entityLocation) => {
  const level = normalizeAdminLevel(admin?.adminLevel);

  if (level === 'nation') return normalizeLocation(admin?.country) === normalizeLocation(entityLocation?.country);
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

const nextHigherLevel = (level) => {
  const normalized = normalizeAdminLevel(level);
  if (normalized === 'village') return 'mandal';
  if (normalized === 'mandal') return 'district';
  if (normalized === 'district') return 'state';
  if (normalized === 'state') return 'nation';
  return null;
};

const buildHigherLevelAdminQuery = (currentAdmin) => {
  const targetLevel = nextHigherLevel(currentAdmin?.adminLevel);
  if (!targetLevel) return null;

  const query = {
    role: 'admin',
    accountStatus: 'active',
    adminLevel: targetLevel,
  };

  if (targetLevel === 'nation') {
    query.country = exactInsensitive(currentAdmin?.country);
    return query;
  }
  if (targetLevel === 'state') {
    query.state = exactInsensitive(currentAdmin?.state);
    query.country = exactInsensitive(currentAdmin?.country);
    return query;
  }
  if (targetLevel === 'district') {
    query.district = exactInsensitive(currentAdmin?.district);
    query.state = exactInsensitive(currentAdmin?.state);
    query.country = exactInsensitive(currentAdmin?.country);
    return query;
  }
  if (targetLevel === 'mandal') {
    query.mandal = exactInsensitive(currentAdmin?.mandal);
    query.district = exactInsensitive(currentAdmin?.district);
    query.state = exactInsensitive(currentAdmin?.state);
    query.country = exactInsensitive(currentAdmin?.country);
    return query;
  }

  query.village = exactInsensitive(currentAdmin?.village);
  query.mandal = exactInsensitive(currentAdmin?.mandal);
  query.district = exactInsensitive(currentAdmin?.district);
  query.state = exactInsensitive(currentAdmin?.state);
  query.country = exactInsensitive(currentAdmin?.country);
  return query;
};

const canAssignAdminLevel = (actorLevel, targetLevel) => {
  const actorRank = LEVEL_RANK[normalizeAdminLevel(actorLevel)] || 0;
  const targetRank = LEVEL_RANK[normalizeAdminLevel(targetLevel)] || 0;
  return actorRank > targetRank;
};

module.exports = {
  ADMIN_LEVELS,
  ADMIN_LEVEL_TITLES,
  LEVEL_RANK,
  normalizeAdminLevel,
  getRequiredLocationFieldsForLevel,
  validateLocationForAdminLevel,
  buildAdminScopeKey,
  buildAdminScopeUniquenessQuery,
  buildComplaintScopeMatch,
  canAdminAccessByScope,
  nextHigherLevel,
  buildHigherLevelAdminQuery,
  canAssignAdminLevel,
};
