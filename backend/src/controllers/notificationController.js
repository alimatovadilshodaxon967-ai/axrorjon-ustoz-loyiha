const prisma = require('../config/db');

/**
 * Get user notifications
 */
async function getMyNotifications(req, res) {
  try {
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Bildirishnomalarni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (id === 'all') {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return res.json({ success: true, message: 'Barcha bildirishnomalar o‘qildi deb belgilandi.' });
    }

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Bildirishnoma o‘qildi.' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Xatolik yuz berdi.' });
  }
}

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
};
