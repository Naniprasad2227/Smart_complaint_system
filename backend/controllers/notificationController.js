const Notification = require('../models/Notification');

const getMyNotifications = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 25)));
    const notifications = await Notification.find({ recipientUserId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('complaintId', 'complaintTitle status createdAt');

    const unreadCount = await Notification.countDocuments({
      recipientUserId: req.user._id,
      isRead: false,
    });

    return res.json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load notifications', error: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipientUserId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update notification', error: error.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipientUserId: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update notifications', error: error.message });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
