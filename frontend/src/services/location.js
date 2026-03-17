const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });

const getPrecisePosition = async (attempts = 3) => {
  let latestPosition = null;

  for (let index = 0; index < attempts; index += 1) {
    latestPosition = await getPosition();
    const accuracy = latestPosition?.coords?.accuracy || Number.POSITIVE_INFINITY;

    // If browser returns good GPS accuracy, use it immediately.
    if (accuracy <= 200) {
      return latestPosition;
    }

    if (index < attempts - 1) {
      await wait(900);
    }
  }

  return latestPosition;
};

const completenessScore = (payload) => {
  const keys = ['country', 'state', 'district', 'mandal', 'village'];
  return keys.reduce((score, key) => (payload[key] ? score + 1 : score), 0);
};

const clean = (value) => String(value || '').trim();

const unique = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = clean(value).toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const normalizeLocation = (payload) => {
  const country = clean(payload.country);
  const state = clean(payload.state);
  const district = clean(payload.district);
  const mandal = clean(payload.mandal);
  const village = clean(payload.village);

  const fallbackChain = unique([village, mandal, district, state, country]);

  const finalCountry = country || state || district || 'Not Available';
  const finalState = state || district || country || 'Not Available';
  const finalDistrict = district || state || country || 'Not Available';
  const finalMandal = mandal || district || state || country || 'Not Available';
  const finalVillage = village || mandal || district || state || country || 'Not Available';

  return {
    country: finalCountry,
    state: finalState,
    district: finalDistrict,
    mandal: finalMandal,
    village: finalVillage,
    fullAddress: fallbackChain.join(', '),
  };
};

const toAddressPayload = (address = {}) => {
  const country =
    address.country || '';

  const state =
    address.state || address.province || address.region || '';

  const district =
    address.state_district || address.county || address.city_district || address.city || address.municipality || '';

  const mandal =
    address.subcounty || address.township || address.municipality || address.county || district || '';

  const village =
    address.village ||
    address.hamlet ||
    address.neighbourhood ||
    address.quarter ||
    address.suburb ||
    address.city_district ||
    address.town ||
    address.city ||
    address.municipality ||
    address.county ||
    district ||
    '';

  return {
    country,
    state,
    district,
    mandal,
    village,
  };
};

const reverseFromNominatim = async (latitude, longitude, zoom) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=${zoom}&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to fetch address from your current location.');
  }

  const data = await response.json();
  return toAddressPayload(data.address || {});
};

const reverseFromBigDataCloud = async (latitude, longitude) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to fetch fallback address');
  }

  const data = await response.json();
  return {
    country: data.countryName || '',
    state: data.principalSubdivision || '',
    district: data.localityInfo?.administrative?.[2]?.name || data.locality || data.city || '',
    mandal: data.locality || data.city || data.principalSubdivision || '',
    village: data.locality || data.city || data.principalSubdivision || '',
  };
};

export const getCurrentLocationFields = async () => {
  const position = await getPrecisePosition(3);
  const latitude = Number(position.coords.latitude).toFixed(7);
  const longitude = Number(position.coords.longitude).toFixed(7);
  const accuracy = position.coords.accuracy || 9999;

  const zoom = accuracy <= 50 ? 18 : accuracy <= 200 ? 16 : 14;

  let nominatimPayload = {};
  let fallbackPayload = {};

  try {
    nominatimPayload = await reverseFromNominatim(latitude, longitude, zoom);
  } catch (_error) {
    nominatimPayload = {};
  }

  try {
    fallbackPayload = await reverseFromBigDataCloud(latitude, longitude);
  } catch (_error) {
    fallbackPayload = {};
  }

  const bestPayloadRaw =
    completenessScore(fallbackPayload) > completenessScore(nominatimPayload)
      ? fallbackPayload
      : nominatimPayload;

  const bestPayload = normalizeLocation(bestPayloadRaw);

  if (completenessScore(bestPayloadRaw) === 0) {
    throw new Error('Could not detect a usable address from your current location.');
  }

  return bestPayload;
};
