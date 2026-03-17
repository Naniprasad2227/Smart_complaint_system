const LOCAL_COMPLAINTS_KEY = 'localDashboardComplaints';

export const readLocalComplaints = () => {
  try {
    const raw = localStorage.getItem(LOCAL_COMPLAINTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

export const writeLocalComplaints = (items) => {
  localStorage.setItem(LOCAL_COMPLAINTS_KEY, JSON.stringify(items));
};

export const createLocalComplaint = ({
  complaintTitle,
  complaintDescription,
  category = 'General',
  priority = 'Medium',
  department = 'General',
  location,
}) => ({
  _id: `local-${Date.now()}`,
  complaintTitle: String(complaintTitle || '').trim(),
  complaintDescription: String(complaintDescription || '').trim(),
  category,
  priority,
  department,
  location: location || null,
  status: 'Submitted',
  sentiment: 'Neutral',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  images: [],
});

export const prependLocalComplaint = (complaint) => {
  const nextItems = [complaint, ...readLocalComplaints()];
  writeLocalComplaints(nextItems);
  return nextItems;
};
