const Notification = require('../models/Notification');
const { emitToUserIds } = require('../socket');

const buildUniqueUserIds = (userIds) =>
  Array.from(new Set((userIds || []).filter(Boolean).map((id) => String(id))));

const notifyUsers = async ({
  recipientUserIds,
  complaintId = null,
  type = 'system',
  title,
  message,
  metadata = {},
}) => {
  const uniqueRecipients = buildUniqueUserIds(recipientUserIds);
  if (!uniqueRecipients.length) return [];

  const docs = uniqueRecipients.map((recipientUserId) => ({
    recipientUserId,
    complaintId,
    type,
    title,
    message,
    metadata,
  }));

  const saved = await Notification.insertMany(docs);

  emitToUserIds(uniqueRecipients, 'notification:new', {
    notifications: saved,
    unreadDelta: saved.length,
  });

  return saved;
};

module.exports = {
  notifyUsers,
  buildUniqueUserIds,
};
